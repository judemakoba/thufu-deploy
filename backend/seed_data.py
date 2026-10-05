"""
Thufu Deploy — Direct SQLite seed
Bypasses Node.js/tsx to guarantee data persists to disk.
"""
import sqlite3, hashlib, os, uuid, json
from datetime import datetime, timedelta

DB = r"C:\Users\Jude M\Documents\Report Project\thufu-deploy\backend\data\thufu_deploy.db"

# Remove stale DB so we start clean
if os.path.exists(DB):
    os.remove(DB)
    print("Removed stale DB")

conn = sqlite3.connect(DB)
cur = conn.cursor()

def run(sql, params=()):
    cur.execute(sql, params)
    return cur

def hash_password(pw):
    return hashlib.pbkdf2_hmac('sha256', pw.encode(), b'thufu-salt-v1', 100000).hex()

now = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')

# ── Tenant ──
tenant_id = 'seed-tenant-001'
run("INSERT INTO tenants VALUES (?,?,?,?,?,?,?,?)", [
    tenant_id, 'Innovis Demo', 'innovis-demo', 'professional', None, '{}', now, now
])
print("✅ Tenant")

# ── Users ──
admin_id = str(uuid.uuid4())
surveyor_id = str(uuid.uuid4())
reviewer_id = str(uuid.uuid4())
users = [
    (admin_id, tenant_id, 'admin@thufu.com', hash_password('admin123'), 'Admin User', '+256700000001', 'admin', None),
    (surveyor_id, tenant_id, 'surveyor@thufu.com', hash_password('surveyor123'), 'Field Surveyor', '+256700000002', 'surveyor', None),
    (reviewer_id, tenant_id, 'reviewer@thufu.com', hash_password('surveyor123'), 'QA Reviewer', '+256700000003', 'reviewer', None),
]
for u in users:
    run("INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", u + (1, now, now))
print("✅ Users")

# ── Sites ──
sites = [
    ('ATC-KLA-001', 'Kampala CBD Tower', 0.3476, 32.5825, 'Kampala, Uganda'),
    ('ATC-KLA-002', 'Ntinda Grid Site', 0.3589, 32.6012, 'Ntinda, Kampala'),
    ('ATC-MBA-001', 'Mbarara Hub', -0.6074, 30.6545, 'Mbarara, Uganda'),
    ('ATC-EBB-001', 'Entebbe Airport', 0.0424, 32.4435, 'Entebbe, Uganda'),
    ('ATC-JIN-001', 'Jinja Industrial', 0.4237, 33.2040, 'Jinja, Uganda'),
]
site_ids = []
for s in sites:
    sid = str(uuid.uuid4())
    site_ids.append(sid)
    run("INSERT INTO sites VALUES (?,?,?,?,?,?,?,?,?,?)", [sid, tenant_id, s[0], s[1], s[2], s[3], None, None, s[4], now, now])
print(f"✅ {len(site_ids)} Sites")

# ── Survey Templates ──
def make_template(name, record_type, desc):
    tid = str(uuid.uuid4())
    run("INSERT INTO survey_templates VALUES (?,?,?,?,?,?,?,?,?)",
        [tid, tenant_id, name, record_type, desc, '[]', 1, 1, now, now])
    return tid

gtid = make_template('Ground Equipment Scope', 'ground_info',
    'Documents physical site infrastructure: tower type, power systems, cabinets, RRU equipment, GPS coordinates, and slab dimensions.')
dtid = make_template('DCDB Power Audit', 'dcdb_info',
    'Documents DC Distribution Box power architecture: Non-Priority and Priority sections, DCDU connections, RRU/AAU cabling, and BTS earthing.')
ttid = make_template('Tower Equipment Scope', 'tower_info',
    'Documents tower-mounted equipment: antennas and RRUs with physical dimensions, azimuth bearings, heights, and operational status.')
print("✅ 3 Templates")

# ── Ground Equipment Sections ──
ground_sections = [
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
        ('tower_type', 'Tower Type', 'dropdown', 1, json.dumps([{'value':'GBT','label':'Greenfield Tower'},{'value':'RTT','label':'Rooftop Tower'},{'value':'RTP','label':'Rooftop Pole'}])),
        ('tower_height', 'Tower Height (m)', 'number', 1, None),
        ('building_height', 'Building Height (m)', 'number', 0, None),
        ('total_height', 'Total Height (m)', 'number', 0, None),
        ('site_indoor_outdoor', 'Site Location', 'dropdown', 1, json.dumps([{'value':'Indoor','label':'Indoor'},{'value':'Outdoor','label':'Outdoor'}])),
        ('no_of_tenants', 'Number of Tenants', 'number', 1, None),
        ('other_tenants', 'Other Telecom Operators', 'multiselect', 0, json.dumps([{'value':'Lyca','label':'Lyca'},{'value':'MTN','label':'MTN'},{'value':'UTL','label':'UTL'},{'value':'Savanna','label':'Savanna'}])),
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

section_q_order = 0
for si, (sec_name, fields) in enumerate(ground_sections):
    sid = str(uuid.uuid4())
    run("INSERT INTO survey_sections VALUES (?,?,?,?,?,?)", [sid, gtid, sec_name, si, None, now])
    for fi, (fname, flabel, ftype, freq, foptions) in enumerate(fields):
        qid = str(uuid.uuid4())
        run("INSERT INTO survey_questions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            [qid, sid, fname, flabel, ftype, None, freq, fi, foptions, None, None, None, now])

# DCDB sections
dcdb_sections = [
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
for si, (sec_name, fields) in enumerate(dcdb_sections):
    sid = str(uuid.uuid4())
    run("INSERT INTO survey_sections VALUES (?,?,?,?,?,?)", [sid, dtid, sec_name, si, None, now])
    for fi, (fname, flabel, ftype, freq, foptions) in enumerate(fields):
        qid = str(uuid.uuid4())
        run("INSERT INTO survey_questions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            [qid, sid, fname, flabel, ftype, None, freq, fi, foptions, None, None, None, now])

# Tower sections
tower_sections = [
    ('Antenna Sub-section', [('antennas', 'Antenna Array', 'textarea', 1, None)]),
    ('RRU Sub-section', [('rrus', 'RRU Array', 'textarea', 1, None)]),
]
for si, (sec_name, fields) in enumerate(tower_sections):
    sid = str(uuid.uuid4())
    run("INSERT INTO survey_sections VALUES (?,?,?,?,?,?)", [sid, ttid, sec_name, si, None, now])
    for fi, (fname, flabel, ftype, freq, foptions) in enumerate(fields):
        qid = str(uuid.uuid4())
        run("INSERT INTO survey_questions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            [qid, sid, fname, flabel, ftype, None, freq, fi, foptions, None, None, None, now])

print("✅ Template sections & questions")

# ── Assignments ──
for i, sid in enumerate(site_ids[:3]):
    aid = str(uuid.uuid4())
    run("INSERT INTO survey_assignments VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [aid, tenant_id, gtid, sid, surveyor_id, admin_id, 'pending', None, None, None, None, now, now])
print("✅ 3 Assignments")

conn.commit()
conn.close()
print("\n========================================")
print("🎉 Seed complete!")
print(f"DB: {DB}")
print("\nDemo credentials:")
print("  Admin:    admin@thufu.com / admin123")
print("  Surveyor: surveyor@thufu.com / surveyor123")
print("  Reviewer: reviewer@thufu.com / surveyor123")
print("========================================")
