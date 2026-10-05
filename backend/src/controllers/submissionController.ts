import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getOne, getAll, run } from '../db/database';
import { Submission, RecordType } from '../types/models';

// ---- Submissions ----

export async function listSubmissions(req: Request, res: Response): Promise<void> {
  const { status, record_type, page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let sql = `
    SELECT sub.*, st.name as template_name, s.site_id, s.name as site_name,
           u.full_name as technician_name
    FROM submissions sub
    JOIN survey_templates st ON st.id = sub.template_id
    JOIN sites s ON s.id = sub.site_id
    JOIN users u ON u.id = sub.technician_id
    WHERE sub.tenant_id = ?`;

  const params: unknown[] = [req.tenantId];

  if (status) { sql += ' AND sub.status = ?'; params.push(status); }
  if (record_type) { sql += ' AND sub.record_type = ?'; params.push(record_type); }

  const total = getOne<{ total: number }>(
    sql.replace(/SELECT[\s\S]+?FROM/, 'SELECT COUNT(*) as total FROM'),
    params
  )?.total || 0;

  const rows = getAll(
    `${sql} ORDER BY sub.created_at DESC LIMIT ? OFFSET ?`,
    [...params, Number(limit), offset]
  );

  res.json({
    success: true,
    data: rows,
    pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) }
  });
}

export async function getSubmission(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const submission = getOne<Submission & { template_name: string; site_id: string; site_name: string; technician_name: string }>(
    `SELECT sub.*, st.name as template_name, s.site_id, s.name as site_name,
            u.full_name as technician_name
     FROM submissions sub
     JOIN survey_templates st ON st.id = sub.template_id
     JOIN sites s ON s.id = sub.site_id
     JOIN users u ON u.id = sub.technician_id
     WHERE sub.id = ? AND sub.tenant_id = ?`,
    [id, req.tenantId]
  );

  if (!submission) {
    res.status(404).json({ success: false, error: 'Submission not found' });
    return;
  }

  const photos = getAll('SELECT * FROM photos WHERE submission_id = ?', [id]);

  let formData: unknown = null;
  if (submission.record_type === 'ground_info') {
    formData = getOne('SELECT * FROM ground_equipment WHERE submission_id = ?', [id]);
  } else if (submission.record_type === 'dcdb_info') {
    formData = getOne('SELECT * FROM dcdb_records WHERE submission_id = ?', [id]);
  } else if (submission.record_type === 'tower_info') {
    formData = getOne('SELECT * FROM tower_equipment WHERE submission_id = ?', [id]);
  }

  res.json({ success: true, data: { ...submission, photos, formData: formData || {} } });
}

export async function updateSubmission(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { status, review_notes } = req.body;

  const existing = getOne<Submission>(
    'SELECT * FROM submissions WHERE id = ? AND tenant_id = ?',
    [id, req.tenantId]
  );

  if (!existing) {
    res.status(404).json({ success: false, error: 'Submission not found' });
    return;
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (status) {
    updates.push('status = ?');
    params.push(status);
    if (status === 'submitted') {
      updates.push('submitted_at = ?');
      params.push(new Date().toISOString());
    }
    if (status === 'approved' || status === 'rejected') {
      updates.push('reviewed_at = ?', 'reviewed_by = ?');
      params.push(new Date().toISOString(), req.user!.userId);
    }
  }

  if (review_notes !== undefined) {
    updates.push('review_notes = ?');
    params.push(review_notes);
  }

  updates.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id, req.tenantId);

  run(`UPDATE submissions SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, params);

  res.json({ success: true, message: 'Submission updated' });
}

// ---- Mobile Sync Endpoint ----

export async function syncSubmission(req: Request, res: Response): Promise<void> {
  const { record_type, submission_id, site_id, answers } = req.body as {
    record_type: RecordType;
    submission_id?: string;
    site_id: string;
    answers: Record<string, unknown>;
  };

  if (!record_type || !site_id || !answers) {
    res.status(400).json({ success: false, error: 'record_type, site_id, and answers are required' });
    return;
  }

  const id: string = (submission_id || uuidv4()) as unknown as string;
  const isNew = !submission_id;

  if (isNew) {
    // id already set to new uuidv4() above

    let assignment = getOne<{ id: string }>(
      `SELECT id FROM survey_assignments
       WHERE site_id = ? AND assigned_to = ? AND tenant_id = ?
       ORDER BY created_at DESC LIMIT 1`,
      [site_id, req.user!.userId, req.tenantId]
    );

    if (!assignment) {
      const template = getOne<{ id: string }>(
        `SELECT id FROM survey_templates WHERE tenant_id = ? AND record_type = ? AND is_active = 1 LIMIT 1`,
        [req.tenantId, record_type]
      );

      if (!template) {
        res.status(404).json({ success: false, error: `No template found for record_type: ${record_type}` });
        return;
      }

      const assignmentId = uuidv4();
      run(
        `INSERT INTO survey_assignments (id, tenant_id, template_id, site_id, assigned_to, assigned_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [assignmentId, req.tenantId, template.id, site_id, req.user!.userId, req.user!.userId]
      );
      assignment = { id: assignmentId };
    }

    run(
      `INSERT INTO submissions (id, tenant_id, assignment_id, site_id, template_id, record_type, answers, technician_id)
       SELECT ?, ?, id, ?, template_id, ?, ?, ?
       FROM survey_assignments WHERE id = ?`,
      [id, req.tenantId, site_id, record_type, JSON.stringify(answers),
       req.user!.userId, assignment.id]
    );
  } else {
    run(
      `UPDATE submissions SET answers = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`,
      [JSON.stringify(answers), new Date().toISOString(), id, req.tenantId]
    );
  }

  if (record_type === 'ground_info') {
    // @ts-ignore
    upsertGroundEquipment(id, req.tenantId, answers);
  } else if (record_type === 'dcdb_info') {
    // @ts-ignore
    upsertDCDBRecord(id, req.tenantId, answers);
  } else if (record_type === 'tower_info') {
    // @ts-ignore
    upsertTowerEquipment(id, req.tenantId, answers);
  }

  res.json({
    success: true,
    data: {
      submission_id: id,
      synced_at: new Date().toISOString(),
      is_new: isNew
    }
  });
}

function upsertGroundEquipment(submissionId: string, tenantId: string, answers: Record<string, unknown>): void {
  const existing = getOne<{ id: string }>('SELECT id FROM ground_equipment WHERE submission_id = ?', [submissionId]);

  const fields = [
    'site_id', 'latitude', 'longitude', 'gps_accuracy', 'altitude',
    'tower_type', 'tower_height', 'building_height', 'total_height',
    'site_indoor_outdoor', 'no_of_tenants', 'has_grid', 'has_dg', 'has_solar',
    'grid_distance_to_3phase', 'guard_at_site', 'rru_type', 'rru_count',
    'cabinet_types', 'cabinet_count', 'equipment_labelled', 'cabinet_comments',
    'cabinet_dimensions', 'active_idu_types', 'non_active_idu_types',
    'non_active_idu_count', 'slab_dimensions', 'redundant_equipment_count',
    'is_on_fiber', 'overall_remarks', 'technician_contact', 'contractor_name'
  ];

  const sets: string[] = [];
  const params: unknown[] = [];

  for (const field of fields) {
    if (answers[field] !== undefined) {
      sets.push(`${field} = ?`);
      params.push(answers[field]);
    }
  }

  sets.push('updated_at = ?');
  params.push(new Date().toISOString());

  if (existing) {
    params.push(submissionId);
    run(`UPDATE ground_equipment SET ${sets.join(', ')} WHERE submission_id = ?`, params);
  } else {
    const geId = uuidv4();
    run(
      `INSERT INTO ground_equipment (id, submission_id, tenant_id, site_id) VALUES (?, ?, ?, ?)`,
      [geId, submissionId, tenantId, (answers.site_id as string) || '']
    );
    params.push(submissionId);
    run(`UPDATE ground_equipment SET ${sets.join(', ')} WHERE submission_id = ?`, params);
  }
}

function upsertDCDBRecord(submissionId: string, tenantId: string, answers: Record<string, unknown>): void {
  const existing = getOne<{ id: string }>('SELECT id FROM dcdb_records WHERE submission_id = ?', [submissionId]);

  const jsonFields = ['np_dcdus', 'pp_dcdus', 'dcdus', 'rru_dcdus', 'aau_dcdus', 'bts_earthing'];
  const sets: string[] = [];
  const params: unknown[] = [];

  for (const field of jsonFields) {
    if (answers[field] !== undefined) {
      sets.push(`${field} = ?`);
      params.push(JSON.stringify(answers[field]));
    }
  }

  if (existing) {
    params.push(submissionId);
    if (sets.length > 0) run(`UPDATE dcdb_records SET ${sets.join(', ')} WHERE submission_id = ?`, params);
  } else {
    const dcdbId = uuidv4();
    run(`INSERT INTO dcdb_records (id, submission_id, tenant_id) VALUES (?, ?, ?)`, [dcdbId, submissionId, tenantId]);
    if (sets.length > 0) {
      params.push(submissionId);
      run(`UPDATE dcdb_records SET ${sets.join(', ')} WHERE submission_id = ?`, params);
    }
  }
}

function upsertTowerEquipment(submissionId: string, tenantId: string, answers: Record<string, unknown>): void {
  const existing = getOne<{ id: string }>('SELECT id FROM tower_equipment WHERE submission_id = ?', [submissionId]);

  const sets: string[] = [];
  const params: unknown[] = [];

  if (answers.antennas !== undefined) {
    sets.push('antennas = ?');
    params.push(JSON.stringify(answers.antennas));
  }
  if (answers.rrus !== undefined) {
    sets.push('rrus = ?');
    params.push(JSON.stringify(answers.rrus));
  }

  if (existing) {
    params.push(submissionId);
    if (sets.length > 0) run(`UPDATE tower_equipment SET ${sets.join(', ')} WHERE submission_id = ?`, params);
  } else {
    const towerId = uuidv4();
    run(`INSERT INTO tower_equipment (id, submission_id, tenant_id) VALUES (?, ?, ?)`,
      [towerId, submissionId, tenantId]);
    if (sets.length > 0) {
      params.push(submissionId);
      run(`UPDATE tower_equipment SET ${sets.join(', ')} WHERE submission_id = ?`, params);
    }
  }
}

// ---- Photo Upload ----

export async function uploadPhoto(req: Request, res: Response): Promise<void> {
  const { submission_id, site_id, field_name, latitude, longitude } = req.body;
  const file = (req as unknown as { file?: { originalname: string; filename: string; path: string; size: number; mimetype: string } }).file;

  if (!file || !submission_id || !site_id || !field_name) {
    res.status(400).json({ success: false, error: 'file, submission_id, site_id, and field_name are required' });
    return;
  }

  const photoId = uuidv4();
  run(
    `INSERT INTO photos (id, tenant_id, submission_id, site_id, field_name, original_name, stored_name, file_path, file_size, mime_type, latitude, longitude)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [photoId, req.tenantId, submission_id, site_id, field_name, file.originalname,
     file.filename, file.path, file.size, file.mimetype, latitude || null, longitude || null]
  );

  res.status(201).json({
    success: true,
    data: { id: photoId, url: `/uploads/${file.filename}` }
  });
}

// ---- Analytics ----

export async function getAnalytics(req: Request, res: Response): Promise<void> {
  const stats = {
    total_sites: getOne<{ count: number }>('SELECT COUNT(*) as count FROM sites WHERE tenant_id = ?', [req.tenantId])?.count || 0,
    total_submissions: getOne<{ count: number }>('SELECT COUNT(*) as count FROM submissions WHERE tenant_id = ?', [req.tenantId])?.count || 0,
    pending_review: getOne<{ count: number }>('SELECT COUNT(*) as count FROM submissions WHERE tenant_id = ? AND status = ?', [req.tenantId, 'submitted'])?.count || 0,
    approved: getOne<{ count: number }>('SELECT COUNT(*) as count FROM submissions WHERE tenant_id = ? AND status = ?', [req.tenantId, 'approved'])?.count || 0,
    rejected: getOne<{ count: number }>('SELECT COUNT(*) as count FROM submissions WHERE tenant_id = ? AND status = ?', [req.tenantId, 'rejected'])?.count || 0,
    by_type: getAll<{ record_type: string; count: number }>(
      `SELECT record_type, COUNT(*) as count FROM submissions WHERE tenant_id = ? GROUP BY record_type`,
      [req.tenantId]
    )
  };

  res.json({ success: true, data: stats });
}
