"""
Thufu Deploy — Full Init: Schema + Seed via Python sqlite3
Bypasses Node.js/sql.js entirely for guaranteed persistence.
"""
import sqlite3, hashlib, os, uuid, json, warnings
warnings.filterwarnings('ignore')
from datetime import datetime, timezone

DB = r"C:\Users\Jude M\Documents\Report Project\thufu-deploy\backend\data\thufu_deploy.db"
if os.path.exists(DB):
    os.remove(DB)
    print("Removed stale DB")

conn = sqlite3.connect(DB)
cur = conn.cursor()

# ── Create Schema ──
schema = """
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'starter', logo_url TEXT, settings TEXT DEFAULT '{}',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, email TEXT NOT NULL, password TEXT NOT NULL,
  full_name TEXT NOT NULL, phone TEXT, role TEXT NOT NULL DEFAULT 'surveyor', avatar_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, email)
);
CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, site_id TEXT NOT NULL, name TEXT NOT NULL,
  latitude REAL, longitude REAL, altitude REAL, gps_accuracy REAL, address TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(tenant_id, site_id)
);
CREATE TABLE IF NOT EXISTS survey_templates (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL, record_type TEXT NOT NULL,
  description TEXT, sections TEXT NOT NULL DEFAULT '[]', is_active INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS survey_sections (
  id TEXT PRIMARY KEY, template_id TEXT NOT NULL, name TEXT NOT NULL, order_index INTEGER NOT NULL DEFAULT 0,
  description TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS survey_questions (
  id TEXT PRIMARY KEY, section_id TEXT NOT NULL, field_name TEXT NOT NULL, label TEXT NOT NULL,
  input_type TEXT NOT NULL, description TEXT, required INTEGER NOT NULL DEFAULT 0,
  order_index INTEGER NOT NULL DEFAULT 0, options TEXT, validation TEXT, depends_on TEXT,
  depends_value TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS survey_assignments (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, template_id TEXT NOT NULL, site_id TEXT NOT NULL,
  assigned_to TEXT NOT NULL, assigned_by TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
  due_date TEXT, submitted_at TEXT, reviewed_at TEXT, reviewed_by TEXT, review_notes TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, assignment_id TEXT NOT NULL, site_id TEXT NOT NULL,
  template_id TEXT NOT NULL, record_type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft',
  answers TEXT NOT NULL DEFAULT '{}', technician_id TEXT NOT NULL, submitted_at TEXT,
  reviewed_at TEXT, reviewed_by TEXT, review_notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, submission_id TEXT NOT NULL, site_id TEXT NOT NULL,
  field_name TEXT NOT NULL, original_name TEXT, stored_name TEXT NOT NULL, file_path TEXT NOT NULL,
  file_size INTEGER, mime_type TEXT, width INTEGER, height INTEGER, latitude REAL, longitude REAL,
  captured_at TEXT, uploaded_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ground_equipment (
  id TEXT PRIMARY KEY, submission_id TEXT NOT NULL, tenant_id TEXT NOT NULL, site_id TEXT NOT NULL DEFAULT '',
  site_name_plate_photo_id TEXT, survey_date TEXT, technician_name TEXT, technician_contact TEXT,
  contractor_name TEXT DEFAULT 'Innovis', latitude REAL, longitude REAL, gps_accuracy REAL, altitude REAL,
  gps_screenshot_id TEXT, tower_type TEXT, tower_height REAL, building_height REAL DEFAULT 0,
  total_height REAL, site_indoor_outdoor TEXT, no_of_tenants INTEGER, other_tenants TEXT,
  site_photo_id TEXT, has_grid INTEGER DEFAULT 0, has_dg INTEGER DEFAULT 0, has_solar INTEGER DEFAULT 0,
  grid_distance_to_3phase REAL, guard_at_site INTEGER DEFAULT 0, rru_type TEXT, rru_count INTEGER,
  cabinet_types TEXT, cabinet_count INTEGER, equipment_labelled INTEGER DEFAULT 0, cabinet_comments TEXT,
  cabinet_dimensions TEXT, active_idu_types TEXT, non_active_idu_types TEXT, non_active_idu_count INTEGER,
  slab_dimensions TEXT, redundant_equipment_count INTEGER, is_on_fiber INTEGER, overall_remarks TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS dcdb_records (
  id TEXT PRIMARY KEY, submission_id TEXT NOT NULL, tenant_id TEXT NOT NULL,
  grid_distance_to_3phase REAL, np_cable_size_dcdb TEXT, np_breaker1_mcb TEXT,
  np_dcdus TEXT DEFAULT '[]', pp_cable_size_dcdb TEXT, pp_breaker1_mcb TEXT,
  pp_dcdus TEXT DEFAULT '[]', dcdus TEXT DEFAULT '[]', rru_dcdus TEXT DEFAULT '[]',
  aau_dcdus TEXT DEFAULT '[]', bts_earthing TEXT DEFAULT '{}',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tower_equipment (
  id TEXT PRIMARY KEY, submission_id TEXT NOT NULL, tenant_id TEXT NOT NULL,
  antennas TEXT DEFAULT '[]', rrus TEXT DEFAULT '[]',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, user_id TEXT NOT NULL, title TEXT NOT NULL,
  message TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'info', is_read INTEGER NOT NULL DEFAULT 0,
  link TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, user_id TEXT, action TEXT NOT NULL,
  entity_type TEXT NOT NULL, entity_id TEXT, details TEXT, ip_address TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sites_tenant ON sites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_submissions_tenant ON submissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_site ON submissions(site_id);
CREATE INDEX IF NOT EXISTS idx_submissions_type ON submissions(record_type);
CREATE INDEX IF NOT EXISTS idx_photos_submission ON photos(submission_id);
CREATE INDEX IF NOT EXISTS idx_photos_site ON photos(site_id);
CREATE INDEX IF NOT EXISTS idx_assignments_assigned_to ON survey_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON survey_assignments(status);
CREATE INDEX IF NOT EXISTS idx_ground_submission ON ground_equipment(submission_id);
CREATE INDEX IF NOT EXISTS idx_dcdb_submission ON dcdb_records(submission_id);
CREATE INDEX IF NOT EXISTS idx_tower_submission ON tower_equipment(submission_id);
"""
cur.executescript(schema)
conn.commit()
print("✅ Schema created")

def now():
    return datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')

def hash_pw(pw):
    return hashlib.pbkdf2_hmac('sha256', pw.encode(), b'thufu-salt-v1', 100000).hex()

def run(sql, params=()):
    cur.execute(sql, params)

# ── Seed Data ──
tenant_id = 'seed-tenant-001'
run("INSERT INTO tenants VALUES (?,?,?,?,?,?,?,?)",
    [tenant_id, 'Innovis Demo', 'innovis-demo', 'professional', None, '{}', now(), now()])
print("✅ Tenant")

admin_id = str(uuid.uuid4())
surveyor_id = str(uuid.uuid4())
reviewer_id = str(uuid.uuid4())
for uid, email, pw, name, phone, role in [
    (admin_id, 'admin@thufu.com', 'admin123', 'Admin User', '+256700000001', 'admin'),
    (surveyor_id, 'surveyor@thufu.com', 'surveyor123', 'Field Surveyor', '+256700000002', 'surveyor'),
    (reviewer_id, 'reviewer@thufu.com', 'surveyor123', 'QA Reviewer', '+256700000003', 'reviewer'),
]:
    run("INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (uid, tenant_id, email, hash_pw(pw), name, phone, role, None, 1, now(), now()))
print("✅ Users")

sites = [
    ('ATC-KLA-001', 'Kampala CBD Tower', 0.3476, 32.5825, 'Kampala, Uganda'),
    ('ATC-KLA-002', 'Ntinda Grid Site', 0.3589, 32.6012, 'Ntinda, Kampala'),
    ('ATC-MBA-001', 'Mbarara Hub', -0.6074, 30.6545, 'Mbarara, Uganda'),
    ('ATC-EBB-001', 'Entebbe Airport', 0.0424, 32.4435, 'Entebbe, Uganda'),
    ('ATC-JIN-001', 'Jinja Industrial', 0.4237, 33.2040, 'Jinja, Uganda'),
]
site_ids = []
for atc, name, lat, lng, addr in sites:
    sid = str(uuid.uuid4())
    site_ids.append(sid)
    run("INSERT INTO sites VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (sid, tenant_id, atc, name, lat, lng, None, None, addr, now(), now()))
print(f"✅ {len(site_ids)} Sites")

def add_template(name, record_type, desc):
    tid = str(uuid.uuid4())
    run("INSERT INTO survey_templates VALUES (?,?,?,?,?,?,?,?,?,?)",
        (tid, tenant_id, name, record_type, desc, '[]', 1, 1, now(), now()))
    return tid

gtid = add_template('Ground Equipment Scope', 'ground_info',
    'Documents physical site infrastructure: tower type, power systems, cabinets, RRU equipment, GPS coordinates, and slab dimensions.')
dtid = add_template('DCDB Power Audit', 'dcdb_info',
    'Documents the DC Distribution Box power architecture: Non-Priority and Priority sections, DCDU connections, RRU/AAU cabling, and BTS earthing.')
ttid = add_template('Tower Equipment Scope', 'tower_info',
    'Documents all tower-mounted equipment: antennas and RRUs with physical dimensions, azimuth bearings, heights, and operational status.')
print("✅ 3 Templates")

def add_section(template_id, name, order):
    sid = str(uuid.uuid4())
    run("INSERT INTO survey_sections VALUES (?,?,?,?,?,?)", (sid, template_id, name, order, None, now()))
    return sid

def add_question(section_id, field_name, label, input_type, required, order, options=None):
    qid = str(uuid.uuid4())
    opts = json.dumps(options) if options else None
    run("INSERT INTO survey_questions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (qid, section_id, field_name, label, input_type, None, required, order,
         opts, None, None, None, now()))

# Ground Equipment sections
ground_def = [
    ('Site Identification', [
        ('site_id', 'Site ID', 'text', 1, None),
        ('site_name_plate_photo_id', 'Site Name Plate Photo', 'photo', 1, None),
    ]),
    ('Survey Details', [
        ('survey_date', 'Survey Date', 'date', 1, None),
        ('technician_name', 'Technician Name', 'text', 1, None),
        ('technician_contact', 'Technician Contact', 'text', 1, None),
        ('contractor_name', 'Contractor Name', 'text', 0, None),
    ]),
    ('Tower & Site Information', [
        ('latitude', 'Latitude', 'gps', 1, None),
        ('longitude', 'Longitude', 'gps', 1, None),
        ('gps_accuracy', 'GPS Accuracy (m)', 'number', 0, None),
        ('altitude', 'Altitude (m)', 'number', 0, None),
        ('gps_screenshot_id', 'GPS Screenshot', 'photo', 1, None),
        ('tower_type', 'Tower Type', 'dropdown', 1,
         [{'value':'GBT','label':'Greenfield Tower'},{'value':'RTT','label':'Rooftop Tower'},{'value':'RTP','label':'Rooftop Pole'}]),
        ('tower_height', 'Tower Height (m)', 'number', 1, None),
        ('building_height', 'Building Height (m)', 'number', 0, None),
        ('total_height', 'Total Height (m)', 'number', 0, None),
        ('site_indoor_outdoor', 'Site Location', 'dropdown', 1,
         [{'value':'Indoor','label':'Indoor'},{'value':'Outdoor','label':'Outdoor'}]),
        ('no_of_tenants', 'Number of Tenants', 'number', 1, None),
        ('other_tenants', 'Other Telecom Operators', 'multiselect', 0,
         [{'value':'Lyca','label':'Lyca'},{'value':'MTN','label':'MTN'},{'value':'UTL','label':'UTL'},{'value':'Savanna','label':'Savanna'}]),
        ('site_photo_id', 'General Site Photo', 'photo', 1, None),
    ]),
    ('Power Infrastructure', [
        ('has_grid', 'Mains Grid Available', 'checkbox', 1, None),
        ('has_dg', 'Diesel Generator Present', 'checkbox', 1, None),
        ('has_solar', 'Solar System Installed', 'checkbox', 1, None),
        ('grid_distance_to_3phase', 'Distance to 3-Phase Grid (m)', 'number', 0, None),
    ]),
    ('RRU & Cabinets', [
        ('guard_at_site', 'Security Guard at Site', 'checkbox', 1, None),
        ('rru_type', 'RRU Type/Model', 'text', 1, None),
        ('rru_count', 'Number of RRU Units', 'number', 1, None),
        ('rru_photo_paths', 'RRU Photos (up to 4)', 'photo', 1, None),
        ('cabinet_types', 'Cabinet Types/Models', 'text', 1, None),
        ('cabinet_count', 'Number of Cabinets', 'number', 1, None),
        ('cabinet_photo_paths', 'Cabinet Photos', 'photo', 1, None),
        ('equipment_labelled', 'All Equipment Labelled', 'checkbox', 1, None),
        ('cabinet_dimensions', 'Cabinet Dimensions (L x W)', 'text', 1, None),
        ('cabinet_dimension_photo_paths', 'Cabinet Dimension Photos', 'photo', 1, None),
        ('active_idu_types', 'Active IDU Types', 'text', 0, None),
        ('non_active_idu_types', 'Non-Active IDU Types', 'text', 0, None),
        ('non_active_idu_count', 'Non-Active IDU Count', 'number', 0, None),
        ('non_active_idu_photo_paths', 'Non-Active IDU Photos', 'photo', 0, None),
        ('cabinet_comments', 'Cabinet Comments', 'textarea', 0, None),
    ]),
    ('Slab Foundation', [
        ('slab_dimensions', 'Slab Dimensions (L x W x H)', 'text', 1, None),
        ('slab_photo_paths', 'Slab Photos (3)', 'photo', 1, None),
    ]),
    ('Redundant Equipment', [
        ('redundant_equipment_count', 'Redundant Equipment Count', 'number', 1, None),
        ('redundant_item_name', 'Redundant Item Description', 'text', 0, None),
        ('redundant_photo_paths', 'Redundant Equipment Photos', 'photo', 0, None),
    ]),
    ('Media & Remarks', [
        ('is_on_fiber', 'Connected to Fiber Network', 'checkbox', 1, None),
        ('overall_remarks', 'Overall Remarks', 'textarea', 0, None),
    ]),
]
for oi, (sname, fields) in enumerate(ground_def):
    sid = add_section(gtid, sname, oi)
    for fi, (fname, flabel, ftype, freq, fopts) in enumerate(fields):
        add_question(sid, fname, flabel, ftype, freq, fi, fopts)

dcdb_def = [
    ('DCDB Non-Priority Section', [
        ('grid_distance_to_3phase', 'Distance to 3-Phase Grid (m)', 'number', 1, None),
        ('np_cable_size_dcdb', 'Non-Priority Cable Size (mm²)', 'text', 1, None),
        ('np_breaker1_mcb', 'MCB-1 Rating (A)', 'text', 1, None),
    ]),
    ('DCDB Priority Section', [
        ('pp_cable_size_dcdb', 'Priority Cable Size (mm²)', 'text', 0, None),
        ('pp_breaker1_mcb', 'MCB-1 Rating - Priority (A)', 'text', 0, None),
    ]),
    ('DCDU Sub-section', [('dcdus', 'DCDU Details', 'textarea', 0, None)]),
    ('RRU Sub-section', [('rru_dcdus', 'RRU DCDU Connections', 'textarea', 0, None)]),
    ('AAU Sub-section', [('aau_dcdus', 'AAU DCDU Connections', 'textarea', 0, None)]),
    ('BTS Earthing', [('bts_earthing', 'Earthing Details', 'textarea', 0, None)]),
]
for oi, (sname, fields) in enumerate(dcdb_def):
    sid = add_section(dtid, sname, oi)
    for fi, (fname, flabel, ftype, freq, fopts) in enumerate(fields):
        add_question(sid, fname, flabel, ftype, freq, fi, fopts)

tower_def = [
    ('Antenna Sub-section', [('antennas', 'Antenna Array', 'textarea', 1, None)]),
    ('RRU Sub-section', [('rrus', 'RRU Array', 'textarea', 1, None)]),
]
for oi, (sname, fields) in enumerate(tower_def):
    sid = add_section(ttid, sname, oi)
    for fi, (fname, flabel, ftype, freq, fopts) in enumerate(fields):
        add_question(sid, fname, flabel, ftype, freq, fi, fopts)

print("✅ Template sections & questions")

for sid in site_ids[:3]:
    aid = str(uuid.uuid4())
    run("INSERT INTO survey_assignments VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (aid, tenant_id, gtid, sid, surveyor_id, admin_id, 'pending', None, None, None, None, now(), now()))
print("✅ 3 Assignments")

conn.commit()
conn.close()

import os
print(f"\nDB size: {os.path.getsize(DB):,} bytes")
print("\n========================================")
print("🎉 Thufu Deploy seeded!")
print("Admin:    admin@thufu.com / admin123")
print("Surveyor:  surveyor@thufu.com / surveyor123")
print("Reviewer:  reviewer@thufu.com / surveyor123")
print("========================================")
