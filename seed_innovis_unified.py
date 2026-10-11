"""
Thufu Deploy — Innovis Unified Template Seed
ONE template: Ground Equipment + DCDB Information + Tower Equipment

PM2 must be STOPPED before running this script.
"""
import hashlib, json, sqlite3, uuid
from datetime import datetime, timedelta

ITERATIONS = 100000
KEYLEN = 32
DIGEST = 'sha256'
SALT = 'thufu-salt-v1'

def pbkdf2(pw: str) -> str:
    return hashlib.pbkdf2_hmac(DIGEST, pw.encode(), SALT.encode(), ITERATIONS, dklen=KEYLEN).hex()

DB = '/root/thufu-deploy/backend/data/thufu_deploy.db'
conn = sqlite3.connect(DB)
cur = conn.cursor()

def uid():
    return str(uuid.uuid4())

def q(sec_id, fname, flabel, ftype, freq, fopts=None, fdesc=None, forder=0):
    """Insert survey question."""
    opts = json.dumps(fopts) if fopts else None
    cur.execute("""
        INSERT INTO survey_questions
        (id, section_id, field_name, label, input_type, description, required, order_index, options)
        VALUES (?,?,?,?,?,?,?,?,?)
    """, [uid(), sec_id, fname, flabel, ftype, fdesc, 1 if freq else 0, forder, opts])

# ── Clean Innovis data ───────────────────────────────────────────────────
TENANT_ID = 'innovis-tenant-001'
print('Cleaning...')
for table in ['survey_questions', 'survey_sections', 'survey_templates',
              'survey_assignments', 'submissions', 'ground_equipment',
              'dcdb_records', 'tower_equipment', 'photos', 'sites', 'users']:
    try:
        if table == 'survey_questions':
            cur.execute(f"DELETE FROM {table} WHERE section_id IN (SELECT id FROM survey_sections WHERE template_id IN (SELECT id FROM survey_templates WHERE tenant_id = ?))", [TENANT_ID])
        elif table == 'survey_sections':
            cur.execute(f"DELETE FROM {table} WHERE template_id IN (SELECT id FROM survey_templates WHERE tenant_id = ?)", [TENANT_ID])
        else:
            cur.execute(f"DELETE FROM {table} WHERE tenant_id = ?", [TENANT_ID])
        print(f'  {table}: {cur.rowcount}')
    except Exception as e:
        print(f'  {table}: skip ({e})')
conn.commit()

# ── Tenant + Users ───────────────────────────────────────────────────────
cur.execute("INSERT OR REPLACE INTO tenants (id, name, slug, plan, settings) VALUES (?,?,?,?,?)",
    [TENANT_ID, 'Innovis Uganda', 'innovis', 'professional', '{"theme":"innovis"}'])
conn.commit()

ADMIN_ID = 'innovis-admin-001'
SURVEYOR_ID = 'innovis-surveyor-001'
cur.execute("DELETE FROM users WHERE tenant_id = ?", [TENANT_ID])
conn.commit()
cur.execute("INSERT INTO users (id, tenant_id, email, password, full_name, role) VALUES (?,?,?,?,?,?)",
    [ADMIN_ID, TENANT_ID, 'admin@innovis.com', pbkdf2('admin123'), 'Innovis Admin', 'admin'])
cur.execute("INSERT INTO users (id, tenant_id, email, password, full_name, role) VALUES (?,?,?,?,?,?)",
    [SURVEYOR_ID, TENANT_ID, 'surveyor@innovis.com', pbkdf2('surveyor123'), 'John Kato', 'surveyor'])
conn.commit()
print('Tenant + users done')

# ─────────────────────────────────────────────────────────────────────────
# ONE UNIFIED TEMPLATE
# ─────────────────────────────────────────────────────────────────────────
TID = uid()
cur.execute("""
    INSERT INTO survey_templates (id, tenant_id, name, record_type, description)
    VALUES (?,?,?,?,?)
""", [TID, TENANT_ID, 'Innovis Site Survey', 'ground_info',
     'Complete site survey: Ground Equipment, DCDB Power Audit, and Tower Equipment scopes.'])
conn.commit()

idx = 0  # global section order index

def sec(name):
    global idx
    s = uid()
    cur.execute("INSERT INTO survey_sections (id, template_id, name, order_index) VALUES (?,?,?,?)",
        [s, TID, name, idx])
    idx += 1
    return s

# ═══════════════════════════════════════════════════════════════════════
# GROUND EQUIPMENT SCOPE
# ═══════════════════════════════════════════════════════════════════════
s = sec('Ground Equipment — Site Identification')
q(s, 'atc_id', 'ATC / Site ID', 'text', True, None, 'Site name plate ID', 0)
q(s, 'site_name_plate_photo', 'Site Name Plate Photo', 'photo', True, None, None, 1)
q(s, 'site_photo', 'General Site Overview Photo', 'photo', True, None, None, 2)

s = sec('Ground Equipment — Survey Details')
q(s, 'survey_date', 'Survey Date', 'date', True, None, 'Auto-filled by system', 0)
q(s, 'technician_name', 'Survey Technician Name', 'text', True, None, 'Auto-filled from account', 1)
q(s, 'technician_contact', 'Survey Technician Contact', 'text', True, None, 'Auto-filled from account', 2)
q(s, 'contractor_name', 'Contractor Name', 'text', False, [{'value':'Innovis','label':'Innovis'}], 'Default: Innovis', 3)

s = sec('Ground Equipment — GPS & Coordinates')
q(s, 'latitude', 'Latitude', 'gps', True, None, 'Auto-captured from GPS', 0)
q(s, 'longitude', 'Longitude', 'gps', True, None, 'Auto-captured from GPS', 1)
q(s, 'gps_accuracy', 'GPS Accuracy (m)', 'number', False, None, 'Should be < 4m', 2)
q(s, 'altitude', 'Altitude (m)', 'number', False, None, 'Above sea level', 3)
q(s, 'gps_screenshot', 'GPS Screenshot', 'photo', True, None,
    'Screenshot: lat, lon, accuracy < 4m, altitude, speed = 0', 4)

s = sec('Ground Equipment — Tower & Site Information')
q(s, 'tower_type', 'Tower Type', 'dropdown', True,
    [{'value':'GBT','label':'GBT'},{'value':'RTT','label':'RTT'},{'value':'RTP','label':'RTP'}], None, 0)
q(s, 'tower_height', 'Tower Height (m)', 'number', True, None, 'Integer in metres', 1)
q(s, 'building_height', 'Building Height (m)', 'number', False, None, 'Defaults to 0 if not captured', 2)
q(s, 'total_height', 'Total Structure Height (m)', 'number', True, None,
    'Auto-calculated: Tower Height + Building Height', 3)
q(s, 'site_indoor_outdoor', 'Site Location', 'dropdown', True,
    [{'value':'Indoor','label':'Indoor'},{'value':'Outdoor','label':'Outdoor'}], None, 4)
q(s, 'no_of_tenants', 'Number of Tenants', 'number', True, None, 'Integer count of co-located operators', 5)
q(s, 'other_tenants', 'Names of Other Tenants', 'multiselect', False,
    [{'value':'Lyca','label':'Lyca'},{'value':'MTN','label':'MTN'},
     {'value':'UTL','label':'UTL'},{'value':'Savanna','label':'Savanna'},
     {'value':'Other','label':'Other'},{'value':'N/A','label':'N/A (Single Tenant)'}],
    'Select all that apply', 6)

s = sec('Ground Equipment — Power Infrastructure')
q(s, 'has_grid', 'Grid Power Available', 'dropdown', True,
    [{'value':'Yes','label':'Yes'},{'value':'No','label':'No'}], None, 0)
q(s, 'has_dg', 'Diesel Generator (DG)', 'dropdown', True,
    [{'value':'Yes','label':'Yes'},{'value':'No','label':'No'}], None, 1)
q(s, 'has_solar', 'Solar Power Installed', 'dropdown', True,
    [{'value':'Yes','label':'Yes'},{'value':'No','label':'No'}], None, 2)
q(s, 'grid_distance_to_3phase', 'Grid Distance to 3-Phase (m)', 'number', False, None, 'Integer in metres', 3)
q(s, 'guard_at_site', 'Security Guard at Site', 'dropdown', True,
    [{'value':'Yes','label':'Yes'},{'value':'No','label':'No'}], None, 4)

s = sec('Ground Equipment — RRU Details')
q(s, 'rru_type', 'RRU Type / Model', 'text', True, None,
    'e.g. Huawei RRU, Nokia RRU — capture model plate', 0)
q(s, 'rru_overview_photo', 'RRU Overview Photo', 'photo', True, None, None, 1)
q(s, 'rru_model_photos', 'RRU Model Plate Photos', 'photo', False, None, 'Up to 4 individual RRU photos', 2)
q(s, 'rru_count', 'RRU Count on Ground', 'number', True, None, 'Integer count', 3)

s = sec('Ground Equipment — Cabinet Details')
q(s, 'cabinet_types', 'Cabinet Types / Models', 'text', True, None,
    'e.g. Huawei Cabinet, Nokia Cabinet, Shared Cabinet', 0)
q(s, 'cabinet_overview_photo', 'Cabinet Overview Photo', 'photo', True, None, None, 1)
q(s, 'cabinet_model_photos', 'Cabinet Model Plate Photos', 'photo', False, None, 'Up to 20 cabinet photos', 2)
q(s, 'cabinet_count', 'Number of Cabinets', 'number', True, None, 'Integer count', 3)
q(s, 'equipment_labelled', 'All Equipment Labelled', 'dropdown', True,
    [{'value':'Yes','label':'Yes'},{'value':'No','label':'No'}], None, 4)
q(s, 'cabinet_comments', 'Cabinet Comments', 'textarea', False, None,
    'e.g. Redundant, Active, Requires Maintenance', 5)

s = sec('Ground Equipment — BTS Cabinet Dimensions')
q(s, 'bts_cabinet_dimensions', 'BTS Cabinet Dimensions (LxWxH)', 'text', False, None,
    'Format: LxWxH in metres, e.g. 0.6x0.5x1.2', 0)
q(s, 'cabinet_length_photo', 'Length Measurement Photo', 'photo', False, None, None, 1)
q(s, 'cabinet_width_photo', 'Width Measurement Photo', 'photo', False, None, None, 2)
q(s, 'cabinet_height_photo', 'Height Measurement Photo', 'photo', False, None, None, 3)

s = sec('Ground Equipment — IDU Equipment')
q(s, 'active_idu_types', 'Active IDU Types / Models', 'text', True, None,
    'e.g. ATN910C, NE8000, CX600, RTN910', 0)
q(s, 'non_active_idu_types', 'Non-Active IDU Types / Models', 'text', False, None,
    'e.g. ATN910C, NE8000, CX600, RTN910', 1)
q(s, 'non_active_idu_count', 'Non-Active IDU Count', 'number', False, None, 'Integer count', 2)
q(s, 'non_active_idu_photos', 'Non-Active IDU Support Photos', 'photo', False, None, 'Up to 5 supporting photos', 3)

s = sec('Ground Equipment — Slab Dimensions')
q(s, 'slab_dimensions', 'Slab Dimensions (LxW in m)', 'text', False, None,
    'Format: LxW in metres, e.g. 2.0x1.5', 0)
q(s, 'slab_overview_photo', 'Slab Overview Photo', 'photo', False, None, None, 1)
q(s, 'slab_dimension_photos', 'Slab Dimension Photos', 'photo', False, None, 'Up to 2 measurement photos', 2)

s = sec('Ground Equipment — Redundant Equipment')
q(s, 'redundant_equipment_count', 'Redundant Equipment Count', 'number', False, None, 'Integer count', 0)
q(s, 'redundant_item_name_model', 'Redundant Item Name & Model', 'text', False, None, 'Description of redundant equipment', 1)
q(s, 'redundant_equipment_photos', 'Redundant Equipment Photos', 'photo', False, None, 'Up to 3 supporting photos', 2)

s = sec('Ground Equipment — Transmission & Remarks')
q(s, 'is_on_fiber', 'Site on Fiber (TRM Media)', 'dropdown', True,
    [{'value':'Yes','label':'Yes'},{'value':'No','label':'No'}], None, 0)
q(s, 'overall_remarks', 'Overall Remarks', 'textarea', False, None, 'Additional observations', 1)

conn.commit()

# ═══════════════════════════════════════════════════════════════════════
# DCDB INFORMATION
# ═══════════════════════════════════════════════════════════════════════
s = sec('DCDB Information — Power Source')
q(s, 'grid_distance_dcdb', 'Grid Distance to 3-Phase (m)', 'number', False, None,
    'Pulled from Ground Equipment scope', 0)

s = sec('DCDB Information — Non-Priority Cable & Breaker')
q(s, 'np_cable_size_dcdb', 'Supply Cable Size to DCDB (mm²)', 'number', False, None, 'Integer mm²', 0)
q(s, 'np_breaker1_mcb', 'Breaker 1 — Supply Cable MCB (A)', 'number', False, None, 'Integer Amps', 1)
q(s, 'np_dcdu1_cable_size', 'Supply Cable Size to DCDU1 (mm²)', 'number', False, None, 'Integer mm²', 2)
q(s, 'np_breaker2_dcdu1', 'Breaker 2 — DCDU1 MCB (A)', 'number', False, None, 'Integer Amps', 3)
q(s, 'np_dcdu2_cable_size', 'Supply Cable Size to DCDU2 (mm²)', 'number', False, None, 'Integer mm²', 4)
q(s, 'np_breaker3_dcdu2', 'Breaker 3 — DCDU2 MCB (A)', 'number', False, None, 'Integer Amps', 5)
q(s, 'np_dcdu_extra', 'Additional DCDU Rows (JSON)', 'text', False, None,
    'JSON array: [{dcdu_name, cable_mm2, breaker_amps}]', 6)
q(s, 'np_dcdb_photo', 'Non-Priority DCDB Section Photo', 'photo', False, None, None, 7)
q(s, 'np_load_measurement', 'Supply Load — Non-Priority Incoming (A)', 'number', False, None, 'Meter reading in Amps', 8)
q(s, 'np_load_photo', 'Non-Priority Load Measurement Photo', 'photo', False, None, None, 9)
q(s, 'np_load_measured_at', 'Load Measurement Time', 'text', False, None, 'Auto-captured time of photo', 10)

s = sec('DCDB Information — Priority Cable & Breaker')
q(s, 'p_cable_size_dcdb', 'Supply Cable Size to DCDB (mm²)', 'number', False, None, 'Integer mm²', 0)
q(s, 'p_breaker1_mcb', 'Breaker 1 — Supply Cable MCB (A)', 'number', False, None, 'Integer Amps', 1)
q(s, 'p_dcdu1_cable_size', 'Supply Cable Size to DCDU1 (mm²)', 'number', False, None, 'Integer mm²', 2)
q(s, 'p_breaker2_dcdu1', 'Breaker 2 — DCDU1 MCB (A)', 'number', False, None, 'Integer Amps', 3)
q(s, 'p_dcdu2_cable_size', 'Supply Cable Size to DCDU2 (mm²)', 'number', False, None, 'Integer mm²', 4)
q(s, 'p_breaker3_dcdu2', 'Breaker 3 — DCDU2 MCB (A)', 'number', False, None, 'Integer Amps', 5)
q(s, 'p_dcdu_extra', 'Additional DCDU Rows (JSON)', 'text', False, None,
    'JSON array: [{dcdu_name, cable_mm2, breaker_amps}]', 6)
q(s, 'p_dcdb_photo', 'Priority DCDB Section Photo', 'photo', False, None, None, 7)
q(s, 'p_load_measurement', 'Supply Load — Priority Incoming (A)', 'number', False, None, 'Meter reading in Amps', 8)
q(s, 'p_load_photo', 'Priority Load Measurement Photo', 'photo', False, None, None, 9)
q(s, 'p_load_measured_at', 'Load Measurement Time', 'text', False, None, 'Auto-captured time of photo', 10)

s = sec('DCDB Information — DCDU Connections')
q(s, 'np_dcdu_breakers', 'Non-Priority DCDU Breaker List (JSON)', 'text', False, None,
    'JSON: [{breaker_name, photo_url}]', 0)
q(s, 'p_dcdu_breakers', 'Priority DCDU Breaker List (JSON)', 'text', False, None,
    'JSON: [{breaker_name, photo_url}]', 1)
q(s, 'total_dcdu_count', 'Total DCDU Count', 'number', False, None,
    'Must equal sum of all DCDU breakers (NP + Priority)', 2)

s = sec('DCDB Information — RRU Power & Earthing')
q(s, 'dcdb_rru_count', 'RRU Count', 'number', False, None, 'Must tally with Tower Equipment scope', 0)
q(s, 'rru_power_cable_count', 'RRU Power Cable Count', 'number', False, None, 'Integer', 1)
q(s, 'rru_power_cable_missing', 'RRU Power Cable Count Missing', 'number', False, None, 'Integer', 2)
q(s, 'rru_power_cable_length_per_run', 'RRU Power Cable Length per Run (m)', 'number', False, None, 'Integer metres', 3)
q(s, 'rru_power_cable_total_missing', 'RRU Power Cable Total Length Missing (m)', 'number', False, None, 'Integer metres', 4)
q(s, 'rru_earth_cable_count', 'RRU Earthing Cable Count (pcs)', 'number', False, None, 'Integer', 5)
q(s, 'rru_earth_cable_missing', 'RRU Earthing Cable Count Missing (pcs)', 'number', False, None, 'Integer', 6)
q(s, 'rru_earth_cable_length', 'RRU Earthing Cable Length per Run (m)', 'number', False, None, 'Integer metres', 7)

s = sec('DCDB Information — AAU Power & Earthing')
q(s, 'aau_count', 'AAU Count', 'number', False, None, 'Must tally with Tower Equipment scope', 0)
q(s, 'aau_power_cable_count', 'AAU Power Cable Count', 'number', False, None, 'Integer', 1)
q(s, 'aau_power_cable_missing', 'AAU Power Cable Count Missing', 'number', False, None, 'Integer', 2)
q(s, 'aau_power_cable_length_per_run', 'AAU Power Cable Length per Run (m)', 'number', False, None, 'Integer metres', 3)
q(s, 'aau_power_cable_total_missing', 'AAU Power Cable Total Length Missing (m)', 'number', False, None, 'Integer metres', 4)
q(s, 'aau_earth_cable_count', 'AAU Earthing Cable Count (pcs)', 'number', False, None, 'Integer', 5)
q(s, 'aau_earth_cable_missing', 'AAU Earthing Cable Count Missing (pcs)', 'number', False, None, 'Integer', 6)
q(s, 'aau_earth_cable_length', 'AAU Earthing Cable Length per Run (m)', 'number', False, None, 'Integer metres', 7)

s = sec('DCDB Information — BTS Earthing')
q(s, 'bts_earth_cable_count', 'BTS Earthing Cable Count', 'number', False, None, 'Integer', 0)
q(s, 'bts_earth_cable_missing', 'BTS Earthing Cable Count Missing', 'number', False, None, 'Integer', 1)
q(s, 'bts_earth_length_per_run', 'BTS Earthing Length per Run (m)', 'number', False, None, 'Integer metres', 2)
q(s, 'bts_earth_total_missing', 'BTS Earthing Total Length Missing (m)', 'number', False, None, 'Integer metres', 3)

conn.commit()

# ═══════════════════════════════════════════════════════════════════════
# TOWER EQUIPMENT SCOPE
# ═══════════════════════════════════════════════════════════════════════
s = sec('Tower Equipment — Antenna')
q(s, 'antenna_json', 'Antenna Entries (JSON)', 'text', False, None,
    'JSON: [{rf_type, manufacturer, model, sector, azimuth, height_centre, length_mm, width_mm, height_mm, active, labelled, photos}]',
    0)
q(s, 'antenna_count', 'Total Antenna Count', 'number', False, None, 'Integer count', 1)
q(s, 'antenna_model_photo', 'Antenna Model Plate Photo', 'photo', False, None, None, 2)
q(s, 'antenna_ports_photo', 'Antenna Ports Photo', 'photo', False, None, None, 3)
q(s, 'antenna_dimensions_photo', 'Antenna Dimensions Photo', 'photo', False, None, 'Up to 3 dimension photos', 4)
q(s, 'antenna_azimuth_photo', 'Antenna Azimuth Photo', 'photo', False, None, None, 5)
q(s, 'antenna_height_photo', 'Antenna Height Photo', 'photo', False, None, None, 6)

s = sec('Tower Equipment — RRU')
q(s, 'rru_tower_json', 'RRU Entries (JSON)', 'text', False, None,
    'JSON: [{rf_type, manufacturer, model, sector, length_mm, width_mm, height_mm, active, labelled, photos}]',
    0)
q(s, 'rru_tower_count', 'Total RRU Count', 'number', False, None, 'Integer count', 1)
q(s, 'rru_model_plate_photo', 'RRU Model Plate Photo', 'photo', False, None, None, 2)
q(s, 'rru_dimensions_photo', 'RRU Dimensions Photo', 'photo', False, None, 'Up to 3 dimension photos', 3)

conn.commit()

# ── Sites + Assignment ──────────────────────────────────────────────────
due = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')
SITES = [
    ('INV-KLA-001', 'Kampala Central BTS', 0.3136, 32.5812, 'Kampala Road, Kampala CBD, Uganda'),
    ('INV-ENT-001', 'Entebbe Airport Tower', 0.0425, 32.4446, 'Airport Road, Entebbe, Uganda'),
    ('INV-JIN-001', 'Jinja Industrial BTS', 0.4249, 33.2042, 'Industrial Area, Jinja, Uganda'),
]

for site_code, name, lat, lng, addr in SITES:
    site_uuid = uid()
    cur.execute(
        "INSERT INTO sites (id, tenant_id, site_id, name, latitude, longitude, address) VALUES (?,?,?,?,?,?,?)",
        [site_uuid, TENANT_ID, site_code, name, lat, lng, addr])
    conn.commit()
    cur.execute(
        "INSERT INTO survey_assignments (id, tenant_id, template_id, site_id, assigned_to, assigned_by, status, due_date) VALUES (?,?,?,?,?,?,?,?)",
        [uid(), TENANT_ID, TID, site_uuid, SURVEYOR_ID, ADMIN_ID, 'pending', due])
    conn.commit()
    print(f'Site: {site_code} ({site_uuid[:8]}...) — assignment created')

conn.close()
print(f'\n=== DONE ===')
print(f'Template ID: {TID}')
print(f'Total sections: {idx}')
print(f'\nSurveyor:  surveyor@innovis.com / surveyor123')
print(f'Admin:     admin@innovis.com / admin123')
