import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getOne, getAll, run } from '../db/database';
import { SurveyTemplate, SurveySection, SurveyQuestion } from '../types/models';

// ---- Survey Templates ----

export async function listTemplates(req: Request, res: Response): Promise<void> {
  const templates = getAll<SurveyTemplate>(
    `SELECT id, tenant_id, name, record_type, description, is_active, version, created_at, updated_at
     FROM survey_templates WHERE tenant_id = ? AND is_active = 1`,
    [req.tenantId]
  );
  res.json({ success: true, data: templates });
}

export async function getTemplate(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const template = getOne<SurveyTemplate>(
    'SELECT * FROM survey_templates WHERE id = ? AND tenant_id = ?',
    [id, req.tenantId]
  );

  if (!template) {
    res.status(404).json({ success: false, error: 'Template not found' });
    return;
  }

  const sections = getAll<SurveySection>(
    'SELECT * FROM survey_sections WHERE template_id = ? ORDER BY order_index',
    [id]
  );

  const sectionsWithQuestions = sections.map(section => {
    const questions = getAll<SurveyQuestion>(
      'SELECT * FROM survey_questions WHERE section_id = ? ORDER BY order_index',
      [section.id]
    );
    return { ...section, questions };
  });

  res.json({ success: true, data: { ...template, sections: sectionsWithQuestions } });
}

export async function createTemplate(req: Request, res: Response): Promise<void> {
  const { name, record_type, description, sections } = req.body;
  if (!name || !record_type) {
    res.status(400).json({ success: false, error: 'name and record_type required' });
    return;
  }

  const templateId = uuidv4();
  run(
    `INSERT INTO survey_templates (id, tenant_id, name, record_type, description, sections)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [templateId, req.tenantId, name, record_type, description || null, JSON.stringify(sections || [])]
  );

  if (sections && Array.isArray(sections)) {
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const sectionId = uuidv4();
      run(
        `INSERT INTO survey_sections (id, template_id, name, order_index, description)
         VALUES (?, ?, ?, ?, ?)`,
        [sectionId, templateId, section.name, i, section.description || null]
      );

      if (section.questions) {
        for (let j = 0; j < section.questions.length; j++) {
          const q = section.questions[j];
          run(
            `INSERT INTO survey_questions (id, section_id, field_name, label, input_type, description, required, order_index, options, validation, depends_on, depends_value)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              uuidv4(), sectionId, q.field_name, q.label, q.input_type,
              q.description || null, q.required ? 1 : 0, j,
              JSON.stringify(q.options || null),
              JSON.stringify(q.validation || null),
              q.depends_on || null, q.depends_value || null
            ]
          );
        }
      }
    }
  }

  res.status(201).json({ success: true, data: { id: templateId } });
}

// ---- Sites ----

export async function listSites(req: Request, res: Response): Promise<void> {
  const { page = 1, limit = 50, search } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let sql = 'SELECT * FROM sites WHERE tenant_id = ?';
  const params: unknown[] = [req.tenantId];

  if (search) {
    sql += ' AND (name LIKE ? OR site_id LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  const total = getOne<{ total: number }>(
    sql.replace('SELECT *', 'SELECT COUNT(*) as total'),
    params
  )?.total || 0;

  const rows = getAll(
    `${sql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, Number(limit), offset]
  );

  res.json({
    success: true,
    data: rows,
    pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) }
  });
}

export async function createSite(req: Request, res: Response): Promise<void> {
  const { site_id, name, latitude, longitude, altitude, gps_accuracy, address } = req.body;
  if (!site_id || !name) {
    res.status(400).json({ success: false, error: 'site_id and name are required' });
    return;
  }

  const siteId = uuidv4();
  try {
    run(
      `INSERT INTO sites (id, tenant_id, site_id, name, latitude, longitude, altitude, gps_accuracy, address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [siteId, req.tenantId, site_id, name, latitude || null, longitude || null,
       altitude || null, gps_accuracy || null, address || null]
    );
    res.status(201).json({ success: true, data: { id: siteId } });
  } catch (err: unknown) {
    const nodeErr = err as { code?: string };
    if (nodeErr.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(409).json({ success: false, error: 'Site with this Site ID already exists' });
    } else {
      res.status(500).json({ success: false, error: String(err) });
    }
  }
}

export async function updateSite(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { site_id, name, latitude, longitude, altitude, gps_accuracy, address } = req.body;

  const existing = getOne('SELECT id FROM sites WHERE id = ? AND tenant_id = ?', [id, req.tenantId]);
  if (!existing) {
    res.status(404).json({ success: false, error: 'Site not found' });
    return;
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  if (site_id !== undefined)    { fields.push('site_id = ?');         values.push(site_id); }
  if (name !== undefined)        { fields.push('name = ?');           values.push(name); }
  if (latitude !== undefined)    { fields.push('latitude = ?');       values.push(latitude); }
  if (longitude !== undefined)   { fields.push('longitude = ?');      values.push(longitude); }
  if (altitude !== undefined)    { fields.push('altitude = ?');       values.push(altitude); }
  if (gps_accuracy !== undefined) { fields.push('gps_accuracy = ?'); values.push(gps_accuracy); }
  if (address !== undefined)     { fields.push('address = ?');        values.push(address); }

  if (fields.length === 0) {
    res.status(400).json({ success: false, error: 'No fields to update' });
    return;
  }

  values.push(id, req.tenantId);
  try {
    run(`UPDATE sites SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`, values);
    res.json({ success: true, data: { id } });
  } catch (err: unknown) {
    const nodeErr = err as { code?: string };
    if (nodeErr.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(409).json({ success: false, error: 'Site with this ATC ID already exists' });
    } else {
      res.status(500).json({ success: false, error: String(err) });
    }
  }
}

export async function deleteSite(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const existing = getOne('SELECT id FROM sites WHERE id = ? AND tenant_id = ?', [id, req.tenantId]);
  if (!existing) {
    res.status(404).json({ success: false, error: 'Site not found' });
    return;
  }

  run('DELETE FROM sites WHERE id = ? AND tenant_id = ?', [id, req.tenantId]);
  res.json({ success: true, data: { id } });
}

// ---- Survey Assignments -----

export async function listAssignments(req: Request, res: Response): Promise<void> {
  const { status, page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let sql = `
    SELECT sa.*, st.name as template_name, s.site_id, s.name as site_name,
           u.full_name as assigned_to_name
    FROM survey_assignments sa
    JOIN survey_templates st ON st.id = sa.template_id
    JOIN sites s ON s.id = sa.site_id
    JOIN users u ON u.id = sa.assigned_to
    WHERE sa.tenant_id = ? AND sa.assigned_to = ?`;

  const params: unknown[] = [req.tenantId, req.user!.userId];

  if (status) {
    sql += ' AND sa.status = ?';
    params.push(status);
  }

  const total = getOne<{ total: number }>(
    sql.replace(/SELECT[\s\S]+?FROM/, 'SELECT COUNT(*) as total FROM'),
    params
  )?.total || 0;

  const rows = getAll(
    `${sql} ORDER BY sa.due_date ASC LIMIT ? OFFSET ?`,
    [...params, Number(limit), offset]
  );

  res.json({
    success: true,
    data: rows,
    pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) }
  });
}

export async function createAssignment(req: Request, res: Response): Promise<void> {
  const { template_id, site_id, assigned_to, due_date } = req.body;
  if (!template_id || !site_id || !assigned_to) {
    res.status(400).json({ success: false, error: 'template_id, site_id, and assigned_to are required' });
    return;
  }

  const assignmentId = uuidv4();
  run(
    `INSERT INTO survey_assignments (id, tenant_id, template_id, site_id, assigned_to, assigned_by, due_date)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [assignmentId, req.tenantId, template_id, site_id, assigned_to, req.user!.userId, due_date || null]
  );

  res.status(201).json({ success: true, data: { id: assignmentId } });
}
