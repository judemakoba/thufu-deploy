/**
 * Thufu Deploy — Startup Seed
 * Runs on first boot to populate demo data if DB is empty.
 * Called from index.ts after initializeDatabase().
 */
import { v4 as uuidv4 } from 'uuid';
import { getOne, run } from './database';

const TENANT_ID = 'seed-tenant-001';
const SALT = 'thufu-salt-v1';
const ITERATIONS = 100000;
const KEYLEN = 32;

function pbkdf2(password: string): string {
  const { pbkdf2Sync } = require('crypto');
  return pbkdf2Sync(password, SALT, ITERATIONS, KEYLEN, 'sha256').toString('hex');
}

export async function seedIfEmpty(): Promise<void> {
  const existing = getOne<{ id: string }>(
    'SELECT id FROM users WHERE tenant_id = ? LIMIT 1',
    [TENANT_ID]
  );
  if (existing) {
    console.log('[Seed] Data already exists, skipping.');
    return;
  }

  console.log('[Seed] Populating demo data...');

  // Tenant
  run(`INSERT OR IGNORE INTO tenants (id, name, slug, plan) VALUES (?, ?, ?, ?)`,
    [TENANT_ID, 'Thufu Deploy Demo', 'thufu', 'professional']);

  const adminId = uuidv4();
  const surveyorId = uuidv4();

  run(`INSERT OR IGNORE INTO users (id, tenant_id, email, password, full_name, phone, role) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [adminId, TENANT_ID, 'admin@thufu.com', pbkdf2('admin123'), 'Admin User', '+256700000001', 'admin']);
  run(`INSERT OR IGNORE INTO users (id, tenant_id, email, password, full_name, phone, role) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [surveyorId, TENANT_ID, 'surveyor@thufu.com', pbkdf2('surveyor123'), 'Field Surveyor', '+256700000002', 'surveyor']);

  // Sites
  const siteData = [
    ['ATC-KLA-001', 'Kampala CBD Tower', 0.3476, 32.5825, 'Kampala, Uganda'],
    ['ATC-KLA-002', 'Ntinda Grid Site', 0.3589, 32.6012, 'Ntinda, Kampala'],
    ['ATC-KLA-003', 'Kololo BTS Hub', 0.3321, 32.5880, 'Kololo, Kampala'],
    ['ATC-MBA-001', 'Mbarara Hub', -0.6074, 30.6545, 'Mbarara, Uganda'],
    ['ATC-EBB-001', 'Entebbe Airport', 0.0424, 32.4435, 'Entebbe, Uganda'],
  ];

  const siteIds: string[] = [];
  for (const [site_id, name, lat, lng, addr] of siteData) {
    const siteUuid = uuidv4();
    siteIds.push(siteUuid);
    run(`INSERT OR IGNORE INTO sites (id, tenant_id, site_id, name, latitude, longitude, address) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [siteUuid, TENANT_ID, site_id, name, lat, lng, addr]);
  }

  // Ground Equipment Template
  const groundTmplId = uuidv4();
  run(`INSERT OR IGNORE INTO survey_templates (id, tenant_id, name, record_type, description) VALUES (?, ?, ?, ?, ?)`,
    [groundTmplId, TENANT_ID, 'Ground Equipment Scope', 'ground_info',
     'Documents physical site infrastructure: tower type, power systems, cabinets, RRU equipment, GPS coordinates.']);

  const groundSections = [
    { name: 'Site Identification', fields: [
      { f: 'site_id', l: 'Site ID', t: 'text', r: 1 },
      { f: 'site_name_plate_photo_id', l: 'Site Name Plate Photo', t: 'photo', r: 1 },
    ]},
    { name: 'Survey Details', fields: [
      { f: 'survey_date', l: 'Survey Date', t: 'date', r: 1 },
      { f: 'technician_name', l: 'Technician Name', t: 'text', r: 1 },
      { f: 'technician_contact', l: 'Technician Contact', t: 'text', r: 1 },
    ]},
    { name: 'Tower & Site Information', fields: [
      { f: 'latitude', l: 'Latitude', t: 'gps', r: 1 },
      { f: 'longitude', l: 'Longitude', t: 'gps', r: 1 },
      { f: 'tower_type', l: 'Tower Type', t: 'dropdown', r: 1, opts: [
        { value: 'GBT', label: 'Greenfield Tower' },
        { value: 'RTT', label: 'Rooftop Tower' },
        { value: 'RTP', label: 'Rooftop Pole' },
      ]},
      { f: 'tower_height', l: 'Tower Height (m)', t: 'number', r: 1 },
      { f: 'total_height', l: 'Total Height (m)', t: 'number', r: 0 },
      { f: 'site_indoor_outdoor', l: 'Site Location', t: 'dropdown', r: 1, opts: [
        { value: 'Indoor', label: 'Indoor' },
        { value: 'Outdoor', label: 'Outdoor' },
      ]},
      { f: 'no_of_tenants', l: 'Number of Tenants', t: 'number', r: 1 },
      { f: 'site_photo_id', l: 'General Site Photo', t: 'photo', r: 1 },
    ]},
    { name: 'Power Infrastructure', fields: [
      { f: 'has_grid', l: 'Mains Grid Available', t: 'checkbox', r: 1 },
      { f: 'has_dg', l: 'Diesel Generator Present', t: 'checkbox', r: 1 },
      { f: 'has_solar', l: 'Solar System Installed', t: 'checkbox', r: 1 },
      { f: 'grid_distance_to_3phase', l: 'Distance to 3-Phase Grid (m)', t: 'number', r: 0 },
    ]},
    { name: 'RRU & Cabinets', fields: [
      { f: 'guard_at_site', l: 'Security Guard at Site', t: 'checkbox', r: 1 },
      { f: 'rru_type', l: 'RRU Type/Model', t: 'text', r: 1 },
      { f: 'rru_count', l: 'Number of RRU Units', t: 'number', r: 1 },
      { f: 'cabinet_types', l: 'Cabinet Types/Models', t: 'text', r: 1 },
      { f: 'cabinet_count', l: 'Number of Cabinets', t: 'number', r: 1 },
      { f: 'equipment_labelled', l: 'All Equipment Labelled', t: 'checkbox', r: 1 },
    ]},
    { name: 'Media & Remarks', fields: [
      { f: 'is_on_fiber', l: 'Connected to Fiber Network', t: 'checkbox', r: 1 },
      { f: 'overall_remarks', l: 'Overall Remarks', t: 'textarea', r: 0 },
    ]},
  ];

  for (let i = 0; i < groundSections.length; i++) {
    const sec = groundSections[i];
    const secId = uuidv4();
    run(`INSERT OR IGNORE INTO survey_sections (id, template_id, name, order_index) VALUES (?, ?, ?, ?)`,
      [secId, groundTmplId, sec.name, i]);
    for (let j = 0; j < sec.fields.length; j++) {
      const field = sec.fields[j];
      const opts = field.opts ? JSON.stringify(field.opts) : null;
      run(`INSERT OR IGNORE INTO survey_questions (id, section_id, field_name, label, input_type, required, order_index, options) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), secId, field.f, field.l, field.t, field.r, j, opts]);
    }
  }

  // Assignments for first 3 sites
  const dueDates = ['2026-10-15', '2026-10-18', '2026-10-20'];
  for (let i = 0; i < 3; i++) {
    run(`INSERT OR IGNORE INTO survey_assignments (id, tenant_id, template_id, site_id, assigned_to, assigned_by, status, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), TENANT_ID, groundTmplId, siteIds[i], surveyorId, adminId, 'pending', dueDates[i]]);
  }

  console.log('[Seed] ✅ Demo data seeded: admin@thufu.com / admin123, surveyor@thufu.com / surveyor123');
}
