/**
 * Thufu Deploy — Database Seed
 * Seeds: 1 demo tenant, 2 users, 3 BTS survey templates, 5 sample sites
 */
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { run, initializeDatabase } from './database';

async function main() {
  await initializeDatabase();

  console.log('🌱 Seeding Thufu Deploy database...\n');

// --- Tenant ---
const tenantId = 'seed-tenant-001';
run(`INSERT OR IGNORE INTO tenants (id, name, slug, plan) VALUES (?, ?, ?, ?)`,
  [tenantId, 'Innovis Demo', 'innovis-demo', 'professional']);
console.log('✅ Tenant: Innovis Demo');

// --- Users ---
const adminId = uuidv4();
const surveyorId = uuidv4();
const reviewerId = uuidv4();

const adminHash = bcrypt.hashSync('admin123', 12);
const surveyorHash = bcrypt.hashSync('surveyor123', 12);

run(`INSERT OR IGNORE INTO users (id, tenant_id, email, password, full_name, phone, role) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  [adminId, tenantId, 'admin@thufu.com', adminHash, 'Admin User', '+256700000001', 'admin']);
run(`INSERT OR IGNORE INTO users (id, tenant_id, email, password, full_name, phone, role) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  [surveyorId, tenantId, 'surveyor@thufu.com', surveyorHash, 'Field Surveyor', '+256700000002', 'surveyor']);
run(`INSERT OR IGNORE INTO users (id, tenant_id, email, password, full_name, phone, role) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  [reviewerId, tenantId, 'reviewer@thufu.com', surveyorHash, 'QA Reviewer', '+256700000003', 'reviewer']);
console.log('✅ Users: admin@thufu.com / admin123, surveyor@thufu.com / surveyor123');

// --- Sites ---
const sites = [
  { site_id: 'ATC-KLA-001', name: 'Kampala CBD Tower', lat: 0.3476, lng: 32.5825, addr: 'Kampala, Uganda' },
  { site_id: 'ATC-KLA-002', name: 'Ntinda Grid Site', lat: 0.3589, lng: 32.6012, addr: 'Ntinda, Kampala' },
  { site_id: 'ATC-MBA-001', name: 'Mbarara Hub', lat: -0.6074, lng: 30.6545, addr: 'Mbarara, Uganda' },
  { site_id: 'ATC-EBB-001', name: 'Entebbe Airport', lat: 0.0424, lng: 32.4435, addr: 'Entebbe, Uganda' },
  { site_id: 'ATC-JIN-001', name: 'Jinja Industrial', lat: 0.4237, lng: 33.2040, addr: 'Jinja, Uganda' },
];

const siteIds: string[] = [];
for (const site of sites) {
  const siteId = uuidv4();
  siteIds.push(siteId);
  run(`INSERT OR IGNORE INTO sites (id, tenant_id, site_id, name, latitude, longitude, address) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [siteId, tenantId, site.site_id, site.name, site.lat, site.lng, site.addr]);
}
console.log(`✅ ${sites.length} sample sites seeded`);

// --- Survey Templates ---

// Template 1: Ground Equipment Scope
const groundTemplateId = uuidv4();
run(`INSERT OR IGNORE INTO survey_templates (id, tenant_id, name, record_type, description) VALUES (?, ?, ?, ?, ?)`,
  [groundTemplateId, tenantId, 'Ground Equipment Scope', 'ground_info',
   'Documents physical site infrastructure: tower type, power systems, cabinets, RRU equipment, GPS coordinates, and slab dimensions.']);

// Ground Equipment sections
const groundSections = [
  {
    name: 'Site Identification',
    fields: [
      { field_name: 'site_id', label: 'Site ID', type: 'text', required: true },
      { field_name: 'site_name_plate_photo_id', label: 'Site Name Plate Photo', type: 'photo', required: true },
    ]
  },
  {
    name: 'Survey Details',
    fields: [
      { field_name: 'survey_date', label: 'Survey Date', type: 'date', required: true },
      { field_name: 'technician_name', label: 'Technician Name', type: 'text', required: true },
      { field_name: 'technician_contact', label: 'Technician Contact', type: 'text', required: true },
      { field_name: 'contractor_name', label: 'Contractor Name', type: 'text', required: false },
    ]
  },
  {
    name: 'Tower & Site Information',
    fields: [
      { field_name: 'latitude', label: 'Latitude', type: 'gps', required: true },
      { field_name: 'longitude', label: 'Longitude', type: 'gps', required: true },
      { field_name: 'gps_accuracy', label: 'GPS Accuracy (m)', type: 'number', required: false },
      { field_name: 'altitude', label: 'Altitude (m)', type: 'number', required: false },
      { field_name: 'gps_screenshot_id', label: 'GPS Screenshot', type: 'photo', required: true },
      { field_name: 'tower_type', label: 'Tower Type', type: 'dropdown', required: true,
        options: [{ value: 'GBT', label: 'Greenfield Tower' }, { value: 'RTT', label: 'Rooftop Tower' }, { value: 'RTP', label: 'Rooftop Pole' }] },
      { field_name: 'tower_height', label: 'Tower Height (m)', type: 'number', required: true },
      { field_name: 'building_height', label: 'Building Height (m)', type: 'number', required: false },
      { field_name: 'total_height', label: 'Total Height (m)', type: 'number', required: false },
      { field_name: 'site_indoor_outdoor', label: 'Site Location', type: 'dropdown', required: true,
        options: [{ value: 'Indoor', label: 'Indoor' }, { value: 'Outdoor', label: 'Outdoor' }] },
      { field_name: 'no_of_tenants', label: 'Number of Tenants', type: 'number', required: true },
      { field_name: 'other_tenants', label: 'Other Telecom Operators Present', type: 'multiselect', required: false,
        options: [{ value: 'Lyca', label: 'Lyca' }, { value: 'MTN', label: 'MTN' }, { value: 'UTL', label: 'UTL' }, { value: 'Savanna', label: 'Savanna' }, { value: 'Other', label: 'Other' }] },
      { field_name: 'site_photo_id', label: 'General Site Photo', type: 'photo', required: true },
    ]
  },
  {
    name: 'Power Infrastructure',
    fields: [
      { field_name: 'has_grid', label: 'Mains Grid Available', type: 'checkbox', required: true },
      { field_name: 'has_dg', label: 'Diesel Generator Present', type: 'checkbox', required: true },
      { field_name: 'has_solar', label: 'Solar System Installed', type: 'checkbox', required: true },
      { field_name: 'grid_distance_to_3phase', label: 'Distance to 3-Phase Grid (m)', type: 'number', required: false },
    ]
  },
  {
    name: 'RRU & Cabinets',
    fields: [
      { field_name: 'guard_at_site', label: 'Security Guard at Site', type: 'checkbox', required: true },
      { field_name: 'rru_type', label: 'RRU Type/Model', type: 'text', required: true },
      { field_name: 'rru_count', label: 'Number of RRU Units', type: 'number', required: true },
      { field_name: 'rru_photo_paths', label: 'RRU Photos (up to 4)', type: 'photo', required: true },
      { field_name: 'cabinet_types', label: 'Cabinet Types/Models', type: 'text', required: true },
      { field_name: 'cabinet_count', label: 'Number of Cabinets', type: 'number', required: true },
      { field_name: 'cabinet_photo_paths', label: 'Cabinet Photos (up to 20)', type: 'photo', required: true },
      { field_name: 'equipment_labelled', label: 'All Equipment Labelled', type: 'checkbox', required: true },
      { field_name: 'cabinet_dimensions', label: 'Cabinet Dimensions (L x W)', type: 'text', required: true },
      { field_name: 'cabinet_dimension_photo_paths', label: 'Cabinet Dimension Photos (3)', type: 'photo', required: true },
      { field_name: 'active_idu_types', label: 'Active IDU Types', type: 'text', required: false },
      { field_name: 'non_active_idu_types', label: 'Non-Active IDU Types', type: 'text', required: false },
      { field_name: 'non_active_idu_count', label: 'Non-Active IDU Count', type: 'number', required: false },
      { field_name: 'non_active_idu_photo_paths', label: 'Non-Active IDU Photos', type: 'photo', required: false },
      { field_name: 'cabinet_comments', label: 'Cabinet Comments / Notes', type: 'textarea', required: false },
    ]
  },
  {
    name: 'Slab Foundation',
    fields: [
      { field_name: 'slab_dimensions', label: 'Slab Dimensions (L x W x H)', type: 'text', required: true },
      { field_name: 'slab_photo_paths', label: 'Slab Photos (3)', type: 'photo', required: true },
    ]
  },
  {
    name: 'Redundant Equipment',
    fields: [
      { field_name: 'redundant_equipment_count', label: 'Redundant Equipment Count', type: 'number', required: true },
      { field_name: 'redundant_item_name', label: 'Redundant Item Description', type: 'text', required: false },
      { field_name: 'redundant_photo_paths', label: 'Redundant Equipment Photos', type: 'photo', required: false },
    ]
  },
  {
    name: 'Media & Remarks',
    fields: [
      { field_name: 'is_on_fiber', label: 'Connected to Fiber Network', type: 'checkbox', required: true },
      { field_name: 'overall_remarks', label: 'Overall Remarks', type: 'textarea', required: false },
    ]
  },
];

for (let i = 0; i < groundSections.length; i++) {
  const section = groundSections[i];
  const sectionId = uuidv4();
  run(`INSERT OR IGNORE INTO survey_sections (id, template_id, name, order_index) VALUES (?, ?, ?, ?)`,
    [sectionId, groundTemplateId, section.name, i]);

  for (let j = 0; j < section.fields.length; j++) {
    const f = section.fields[j];
    run(`INSERT OR IGNORE INTO survey_questions (id, section_id, field_name, label, input_type, required, order_index, options)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), sectionId, f.field_name, f.label, f.type, f.required ? 1 : 0, j,
       // eslint-disable-next-line @typescript-eslint/no-explicit-any
       (f as any).options ? JSON.stringify((f as any).options) : null]);
  }
}
console.log('✅ Template 1: Ground Equipment Scope');

// Template 2: DCDB Power Audit
const dcdbTemplateId = uuidv4();
run(`INSERT OR IGNORE INTO survey_templates (id, tenant_id, name, record_type, description) VALUES (?, ?, ?, ?, ?)`,
  [dcdbTemplateId, tenantId, 'DCDB Power Audit', 'dcdb_info',
   'Documents the DC Distribution Box (DCDB) power architecture: Non-Priority and Priority sections, DCDU connections, RRU/AAU power cabling, and BTS earthing.']);

const dcdbSections = [
  {
    name: 'DCDB Non-Priority Section',
    fields: [
      { field_name: 'grid_distance_to_3phase', label: 'Distance to 3-Phase Grid (m)', type: 'number', required: true },
      { field_name: 'np_cable_size_dcdb', label: 'Non-Priority Cable Size (mm²)', type: 'text', required: true },
      { field_name: 'np_breaker1_mcb', label: 'MCB-1 Rating (A)', type: 'text', required: true },
      { field_name: 'np_dcdus', label: 'DCDU Slots (NP)', type: 'text', required: false },
    ]
  },
  {
    name: 'DCDB Priority Section',
    fields: [
      { field_name: 'pp_cable_size_dcdb', label: 'Priority Cable Size (mm²)', type: 'text', required: false },
      { field_name: 'pp_breaker1_mcb', label: 'MCB-1 Rating - Priority (A)', type: 'text', required: false },
      { field_name: 'pp_dcdus', label: 'DCDU Slots (PP)', type: 'text', required: false },
    ]
  },
  {
    name: 'DCDU Sub-section',
    fields: [
      { field_name: 'dcdus', label: 'DCDU Details (Slot, Type, Count, Cable No.)', type: 'textarea', required: false },
    ]
  },
  {
    name: 'RRU Sub-section',
    fields: [
      { field_name: 'rru_dcdus', label: 'RRU DCDU Connections', type: 'textarea', required: false },
    ]
  },
  {
    name: 'AAU Sub-section',
    fields: [
      { field_name: 'aau_dcdus', label: 'AAU DCDU Connections', type: 'textarea', required: false },
    ]
  },
  {
    name: 'BTS Earthing',
    fields: [
      { field_name: 'bts_earthing', label: 'Earthing Details', type: 'textarea', required: false },
    ]
  },
];

for (let i = 0; i < dcdbSections.length; i++) {
  const section = dcdbSections[i];
  const sectionId = uuidv4();
  run(`INSERT OR IGNORE INTO survey_sections (id, template_id, name, order_index) VALUES (?, ?, ?, ?)`,
    [sectionId, dcdbTemplateId, section.name, i]);

  for (let j = 0; j < section.fields.length; j++) {
    const f = section.fields[j];
    run(`INSERT OR IGNORE INTO survey_questions (id, section_id, field_name, label, input_type, required, order_index, options)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), sectionId, f.field_name, f.label, f.type, f.required ? 1 : 0, j,
       // eslint-disable-next-line @typescript-eslint/no-explicit-any
       (f as any).options ? JSON.stringify((f as any).options) : null]);
  }
}
console.log('✅ Template 2: DCDB Power Audit');

// Template 3: Tower Equipment Scope
const towerTemplateId = uuidv4();
run(`INSERT OR IGNORE INTO survey_templates (id, tenant_id, name, record_type, description) VALUES (?, ?, ?, ?, ?)`,
  [towerTemplateId, tenantId, 'Tower Equipment Scope', 'tower_info',
   'Documents all tower-mounted equipment: antennas and RRUs with physical dimensions, azimuth bearings, heights, and operational status.']);

const towerSections = [
  {
    name: 'Antenna Sub-section',
    fields: [
      { field_name: 'antennas', label: 'Antenna Array', type: 'textarea', required: true,
        description: 'JSON array: [{antenna_id, antenna_type, azimuth, height, mtw, downtilt, brand, total_count, status}]' },
    ]
  },
  {
    name: 'RRU Sub-section',
    fields: [
      { field_name: 'rrus', label: 'RRU Array', type: 'textarea', required: true,
        description: 'JSON array: [{rru_id, rru_type, azimuth, height, rru_count, status}]' },
    ]
  },
];

for (let i = 0; i < towerSections.length; i++) {
  const section = towerSections[i];
  const sectionId = uuidv4();
  run(`INSERT OR IGNORE INTO survey_sections (id, template_id, name, order_index) VALUES (?, ?, ?, ?)`,
    [sectionId, towerTemplateId, section.name, i]);

  for (let j = 0; j < section.fields.length; j++) {
    const f = section.fields[j];
    run(`INSERT OR IGNORE INTO survey_questions (id, section_id, field_name, label, input_type, description, required, order_index)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), sectionId, f.field_name, f.label, f.type, f.description || null, f.required ? 1 : 0, j]);
  }
}
console.log('✅ Template 3: Tower Equipment Scope');

// Seed a few sample assignments
const assignmentIds: string[] = [];
for (let i = 0; i < Math.min(siteIds.length, 3); i++) {
  const assignmentId = uuidv4();
  assignmentIds.push(assignmentId);
  run(`INSERT OR IGNORE INTO survey_assignments (id, tenant_id, template_id, site_id, assigned_to, assigned_by, status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
    [assignmentId, tenantId, groundTemplateId, siteIds[i], surveyorId, adminId]);
}
console.log(`✅ ${assignmentIds.length} sample assignments seeded\n`);

console.log('========================================');
console.log('🎉 Seed complete!');
console.log('');
console.log('Demo credentials:');
console.log('  Admin:    admin@thufu.com / admin123');
console.log('  Surveyor: surveyor@thufu.com / surveyor123');
console.log('  Reviewer: reviewer@thufu.com / surveyor123');
console.log('========================================');

}
main().catch(err => { console.error('Seed failed:', err); process.exit(1); });
