"""
Thufu Deploy — Innovis Comprehensive Template Seed
Full Ground Equipment, DCDB, and Tower Equipment scopes.

PBKDF2-SHA256 matching backend/src/controllers/authController.ts:
  Salt: 'thufu-salt-v1', 100k iterations, keylen=32 bytes
"""
import hashlib, json, sqlite3, uuid
from datetime import datetime, timedelta

ITERATIONS = 100000
KEYLEN = 32
DIGEST = 'sha256'
SALT = 'thufu-salt-v1'

def pbkdf2(password: str) -> str:
    return hashlib.pbkdf2_hmac(DIGEST, password.encode(), SALT.encode(), ITERATIONS, dklen=KEYLEN).hex()

DB_PATH = '/root/thufu-deploy/backend/data/thufu_deploy.db'
conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

def uid():
    return str(uuid.uuid4())

def now():
    return datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S')

def insert_question(cur, sec_id, fname, flabel, ftype, freq, fopts=None, fdesc=None, forder=0, fvalidation=None):
    """Insert a survey question row."""
    opts_json = json.dumps(fopts) if fopts else None
    validation_json = json.dumps(fvalidation) if fvalidation else None
    cur.execute("""
        INSERT INTO survey_questions
        (id, section_id, field_name, label, input_type, description, required, order_index, options, validation)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, [uid(), sec_id, fname, flabel, ftype, fdesc, 1 if freq else 0, forder, opts_json, validation_json])

# ── Clean Innovis tenant data ──────────────────────────────────────────────
TENANT_ID = 'innovis-tenant-001'
print('Cleaning existing Innovis data...')
for table in ['survey_questions', 'survey_sections', 'survey_templates',
              'survey_assignments', 'submissions', 'ground_equipment',
              'dcdb_records', 'tower_equipment', 'photos', 'sites', 'users']:
    try:
        if table in ('survey_questions',):
            cur.execute(f"DELETE FROM {table} WHERE section_id IN (SELECT id FROM survey_sections WHERE template_id IN (SELECT id FROM survey_templates WHERE tenant_id = ?))", [TENANT_ID])
        elif table == 'survey_sections':
            cur.execute(f"DELETE FROM {table} WHERE template_id IN (SELECT id FROM survey_templates WHERE tenant_id = ?)", [TENANT_ID])
        elif table in ('submissions', 'ground_equipment', 'dcdb_records', 'tower_equipment', 'photos'):
            cur.execute(f"DELETE FROM {table} WHERE tenant_id = ?", [TENANT_ID])
        else:
            cur.execute(f"DELETE FROM {table} WHERE tenant_id = ?", [TENANT_ID])
        print(f'  {table}: {cur.rowcount} deleted')
    except Exception as e:
        print(f'  {table}: skip ({e})')
conn.commit()

# ── Tenant ────────────────────────────────────────────────────────────────
cur.execute("INSERT OR REPLACE INTO tenants (id, name, slug, plan, settings) VALUES (?, ?, ?, ?, ?)",
    [TENANT_ID, 'Innovis Uganda', 'innovis', 'professional', json.dumps({'theme': 'innovis'})])
conn.commit()
print('Tenant upserted')

# ── Users ─────────────────────────────────────────────────────────────────
ADMIN_ID = 'innovis-admin-001'
SURVEYOR_ID = 'innovis-surveyor-001'
cur.execute("DELETE FROM users WHERE tenant_id = ?", [TENANT_ID])
conn.commit()
cur.execute("INSERT INTO users (id, tenant_id, email, password, full_name, role) VALUES (?, ?, ?, ?, ?, ?)",
    [ADMIN_ID, TENANT_ID, 'admin@innovis.com', pbkdf2('admin123'), 'Innovis Admin', 'admin'])
cur.execute("INSERT INTO users (id, tenant_id, email, password, full_name, role) VALUES (?, ?, ?, ?, ?, ?)",
    [SURVEYOR_ID, TENANT_ID, 'surveyor@innovis.com', pbkdf2('surveyor123'), 'John Kato', 'surveyor'])
conn.commit()
print('Users created')

# ──────────────────────────────────────────────────────────────────────────
# TEMPLATE 1: GROUND EQUIPMENT SCOPE
# ──────────────────────────────────────────────────────────────────────────
GE_TID = uid()
cur.execute("INSERT INTO survey_templates (id, tenant_id, name, record_type, description) VALUES (?, ?, ?, ?, ?)",
    [GE_TID, TENANT_ID, 'Ground Equipment Scope', 'ground_info',
     'Comprehensive ground equipment survey: site ID, GPS, tower specs, power, cabinets, IDU, slabs, redundancy, fiber.'])

sections_ge = []

# ── Section 1: Site Identification ──────────────────────────────────────
s1 = uid()
sections_ge.append((s1, 'Site Identification', 0))
cur.execute("INSERT INTO survey_sections (id, template_id, name, order_index) VALUES (?, ?, ?, ?)",
    [s1, GE_TID, 'Site Identification', 0])
insert_question(cur, s1, 'atc_id', 'ATC / Site ID', 'text', True, None, 'Site name plate ID (e.g. INV-KLA-001)', 0)
insert_question(cur, s1, 'site_name_plate_photo', 'Site Name Plate Photo', 'photo', True, None, None, 1)
insert_question(cur, s1, 'site_photo', 'General Site Overview Photo', 'photo', True, None, None, 2)

# ── Section 2: Survey Details ────────────────────────────────────────────
s2 = uid()
sections_ge.append((s2, 'Survey Details', 1))
cur.execute("INSERT INTO survey_sections (id, template_id, name, order_index) VALUES (?, ?, ?, ?)",
    [s2, GE_TID, 'Survey Details', 1])
insert_question(cur, s2, 'survey_date', 'Survey Date', 'date', True, None, 'Auto-filled by system', 0)
insert_question(cur, s2, 'technician_name', 'Survey Technician Name', 'text', True, None, 'Auto-filled from account', 1)
insert_question(cur, s2, 'technician_contact', 'Survey Technician Contact', 'text', True, None, 'Auto-filled from account', 2)
insert_question(cur, s2, 'contractor_name', 'Contractor Name', 'text', False,
    [{'value': 'Innovis', 'label': 'Innovis'}], 'Default: Innovis', 3)

# ── Section 3: GPS & Coordinates ─────────────────────────────────────────
s3 = uid()
sections_ge.append((s3, 'GPS & Coordinates', 2))
cur.execute("INSERT INTO survey_sections (id, template_id, name, order_index) VALUES (?, ?, ?, ?)",
    [s3, GE_TID, 'GPS & Coordinates', 2])
insert_question(cur, s3, 'latitude', 'Latitude', 'gps', True, None, 'Auto-captured from GPS', 0)
insert_question(cur, s3, 'longitude', 'Longitude', 'gps', True, None, 'Auto-captured from GPS', 1)
insert_question(cur, s3, 'gps_accuracy', 'GPS Accuracy (m)', 'number', False, None, 'Should be < 4m', 2)
insert_question(cur, s3, 'altitude', 'Altitude (m)', 'number', False, None, 'Above sea level', 3)
insert_question(cur, s3, 'gps_screenshot', 'GPS Screenshot', 'photo', True, None,
    'Screenshot showing lat, lon, accuracy < 4m, altitude, speed = 0', 4)

# ── Section 4: Tower & Site Information ─────────────────────────────────
s4 = uid()
sections_ge.append((s4, 'Tower & Site Information', 3))
cur.execute("INSERT INTO survey_sections (id, template_id, name, order_index) VALUES (?, ?, ?, ?)",
    [s4, GE_TID, 'Tower & Site Information', 3])
insert_question(cur, s4, 'tower_type', 'Tower Type', 'dropdown', True,
    [{'value': 'GBT', 'label': 'GBT'}, {'value': 'RTT', 'label': 'RTT'}, {'value': 'RTP', 'label': 'RTP'}], None, 0)
insert_question(cur, s4, 'tower_height', 'Tower Height (m)', 'number', True, None, 'Integer in metres', 1)
insert_question(cur, s4, 'building_height', 'Building Height (m)', 'number', False, None, 'Defaults to 0 if not captured', 2)
insert_question(cur, s4, 'total_height', 'Total Structure Height (m)', 'number', True, None,
    'Auto-calculated: Tower Height + Building Height', 3)
insert_question(cur, s4, 'site_indoor_outdoor', 'Site Location', 'dropdown', True,
    [{'value': 'Indoor', 'label': 'Indoor'}, {'value': 'Outdoor', 'label': 'Outdoor'}], None, 4)
insert_question(cur, s4, 'no_of_tenants', 'Number of Tenants', 'number', True, None, 'Integer count of co-located operators', 5)
insert_question(cur, s4, 'other_tenants', 'Names of Other Tenants', 'multiselect', False,
    [{'value': 'Lyca', 'label': 'Lyca'}, {'value': 'MTN', 'label': 'MTN'},
     {'value': 'UTL', 'label': 'UTL'}, {'value': 'Savanna', 'label': 'Savanna'},
     {'value': 'Other', 'label': 'Other'}, {'value': 'N/A', 'label': 'N/A (Single Tenant)'}],
    'Select all that apply; N/A if only 1 tenant', 6)

# ── Section 5: Power Infrastructure ──────────────────────────────────────
s5 = uid()
sections_ge.append((s5, 'Power Infrastructure', 4))
cur.execute("INSERT INTO survey_sections (id, template_id, name, order_index) VALUES (?, ?, ?, ?)",
    [s5, GE_TID, 'Power Infrastructure', 4])
insert_question(cur, s5, 'has_grid', 'Grid Power Available', 'dropdown', True,
    [{'value': 'Yes', 'label': 'Yes'}, {'value': 'No', 'label': 'No'}], None, 0)
insert_question(cur, s5, 'has_dg', 'Diesel Generator (DG)', 'dropdown', True,
    [{'value': 'Yes', 'label': 'Yes'}, {'value': 'No', 'label': 'No'}], None, 1)
insert_question(cur, s5, 'has_solar', 'Solar Power Installed', 'dropdown', True,
    [{'value': 'Yes', 'label': 'Yes'}, {'value': 'No', 'label': 'No'}], None, 2)
insert_question(cur, s5, 'grid_distance_to_3phase', 'Grid Distance to 3-Phase (m)', 'number', False,
    None, 'Integer in metres', 3)
insert_question(cur, s5, 'guard_at_site', 'Security Guard at Site', 'dropdown', True,
    [{'value': 'Yes', 'label': 'Yes'}, {'value': 'No', 'label': 'No'}], None, 4)

# ── Section 6: RRU Details ──────────────────────────────────────────────
s6 = uid()
sections_ge.append((s6, 'RRU Details', 5))
cur.execute("INSERT INTO survey_sections (id, template_id, name, order_index) VALUES (?, ?, ?, ?)",
    [s6, GE_TID, 'RRU Details', 5])
insert_question(cur, s6, 'rru_type', 'RRU Type / Model', 'text', True, None,
    'e.g. Huawei RRU, Nokia RRU — capture model plate', 0)
insert_question(cur, s6, 'rru_overview_photo', 'RRU Overview Photo', 'photo', True, None, None, 1)
insert_question(cur, s6, 'rru_model_photos', 'RRU Model Plate Photos', 'photo', False, None,
    'Up to 4 individual RRU model plate photos', 2)
insert_question(cur, s6, 'rru_count', 'RRU Count on Ground', 'number', True, None, 'Integer count', 3)

# ── Section 7: Cabinet Details ───────────────────────────────────────────
s7 = uid()
sections_ge.append((s7, 'Cabinet Details', 6))
cur.execute("INSERT INTO survey_sections (id, template_id, name, order_index) VALUES (?, ?, ?, ?)",
    [s7, GE_TID, 'Cabinet Details', 6])
insert_question(cur, s7, 'cabinet_types', 'Cabinet Types / Models', 'text', True, None,
    'e.g. Huawei Cabinet, Nokia Cabinet, Shared Cabinet', 0)
insert_question(cur, s7, 'cabinet_overview_photo', 'Cabinet Overview Photo', 'photo', True, None, None, 1)
insert_question(cur, s7, 'cabinet_model_photos', 'Cabinet Model Plate Photos', 'photo', False, None,
    'Up to 20 individual cabinet model plate photos', 2)
insert_question(cur, s7, 'cabinet_count', 'Number of Cabinets', 'number', True, None, 'Integer count', 3)
insert_question(cur, s7, 'equipment_labelled', 'All Equipment Labelled', 'dropdown', True,
    [{'value': 'Yes', 'label': 'Yes'}, {'value': 'No', 'label': 'No'}], None, 4)
insert_question(cur, s7, 'cabinet_comments', 'Cabinet Comments', 'textarea', False, None,
    'e.g. Redundant, Active, Requires Maintenance', 5)

# ── Section 8: BTS Cabinet Dimensions ───────────────────────────────────
s8 = uid()
sections_ge.append((s8, 'BTS Cabinet Dimensions', 7))
cur.execute("INSERT INTO survey_sections (id, template_id, name, order_index) VALUES (?, ?, ?, ?)",
    [s8, GE_TID, 'BTS Cabinet Dimensions', 7])
insert_question(cur, s8, 'bts_cabinet_dimensions', 'BTS Cabinet Dimensions (LxWxH)', 'text', False, None,
    'Format: LxWxH in metres, e.g. 0.6x0.5x1.2', 0)
insert_question(cur, s8, 'cabinet_length_photo', 'Length Measurement Photo', 'photo', False, None, None, 1)
insert_question(cur, s8, 'cabinet_width_photo', 'Width Measurement Photo', 'photo', False, None, None, 2)
insert_question(cur, s8, 'cabinet_height_photo', 'Height Measurement Photo', 'photo', False, None, None, 3)

# ── Section 9: IDU Equipment ────────────────────────────────────────────
s9 = uid()
sections_ge.append((s9, 'IDU Equipment', 8))
cur.execute("INSERT INTO survey_sections (id, template_id, name, order_index) VALUES (?, ?, ?, ?)",
    [s9, GE_TID, 'IDU Equipment', 8])
insert_question(cur, s9, 'active_idu_types', 'Active IDU Types / Models', 'text', True, None,
    'e.g. ATN910C, NE8000, CX600, RTN910', 0)
insert_question(cur, s9, 'non_active_idu_types', 'Non-Active IDU Types / Models', 'text', False, None,
    'e.g. ATN910C, NE8000, CX600, RTN910', 1)
insert_question(cur, s9, 'non_active_idu_count', 'Non-Active IDU Count', 'number', False, None, 'Integer count', 2)
insert_question(cur, s9, 'non_active_idu_photos', 'Non-Active IDU Support Photos', 'photo', False, None,
    'Up to 5 supporting photos', 3)

# ── Section 10: Slab Dimensions ──────────────────────────────────────────
s10 = uid()
sections_ge.append((s10, 'Slab Dimensions', 9))
cur.execute("INSERT INTO survey_sections (id, template_id, name, order_index) VALUES (?, ?, ?, ?)",
    [s10, GE_TID, 'Slab Dimensions', 9])
insert_question(cur, s10, 'slab_dimensions', 'Slab Dimensions (LxW in m)', 'text', False, None,
    'Format: LxW in metres, e.g. 2.0x1.5', 0)
insert_question(cur, s10, 'slab_overview_photo', 'Slab Overview Photo', 'photo', False, None, None, 1)
insert_question(cur, s10, 'slab_dimension_photos', 'Slab Dimension Photos', 'photo', False, None,
    'Up to 2 dimension measurement photos', 2)

# ── Section 11: Redundant Equipment ─────────────────────────────────────
s11 = uid()
sections_ge.append((s11, 'Redundant Equipment', 10))
cur.execute("INSERT INTO survey_sections (id, template_id, name, order_index) VALUES (?, ?, ?, ?)",
    [s11, GE_TID, 'Redundant Equipment', 10])
insert_question(cur, s11, 'redundant_equipment_count', 'Redundant Equipment Count', 'number', False, None, 'Integer count', 0)
insert_question(cur, s11, 'redundant_item_name_model', 'Redundant Item Name & Model', 'text', False, None, 'Description of redundant equipment', 1)
insert_question(cur, s11, 'redundant_equipment_photos', 'Redundant Equipment Photos', 'photo', False, None,
    'Up to 3 supporting photos', 2)

# ── Section 12: Transmission & Remarks ──────────────────────────────────
s12 = uid()
sections_ge.append((s12, 'Transmission & Remarks', 11))
cur.execute("INSERT INTO survey_sections (id, template_id, name, order_index) VALUES (?, ?, ?, ?)",
    [s12, GE_TID, 'Transmission & Remarks', 11])
insert_question(cur, s12, 'is_on_fiber', 'Site on Fiber (TRM Media)', 'dropdown', True,
    [{'value': 'Yes', 'label': 'Yes'}, {'value': 'No', 'label': 'No'}], None, 0)
insert_question(cur, s12, 'overall_remarks', 'Overall Remarks', 'textarea', False, None,
    'Any additional observations or comments', 1)

conn.commit()
print(f'Ground Equipment template: {GE_TID[:8]}... ({len(sections_ge)} sections)')

# ──────────────────────────────────────────────────────────────────────────
# TEMPLATE 2: DCDB INFORMATION
# ──────────────────────────────────────────────────────────────────────────
DCDB_TID = uid()
cur.execute("INSERT INTO survey_templates (id, tenant_id, name, record_type, description) VALUES (?, ?, ?, ?, ?)",
    [DCDB_TID, TENANT_ID, 'DCDB Information', 'dcdb_info',
     'DCDB power audit: cable sizes, breaker ratings, load measurements, DCDU, RRU, AAU, BTS earthing.'])

sections_dcdb = []

# ── Section 1: Power Source ──────────────────────────────────────────────
d1 = uid()
sections_dcdb.append((d1, 'Power Source', 0))
cur.execute("INSERT INTO survey_sections (id, template_id, name, order_index) VALUES (?, ?, ?, ?)",
    [d1, DCDB_TID, 'Power Source', 0])
insert_question(cur, d1, 'grid_distance_to_3phase_dcdb', 'Grid Distance to 3-Phase (m)', 'number', False, None,
    'Pulled from Ground Equipment scope — readonly', 0)

# ── Section 2: Non-Priority Cable & Breaker ─────────────────────────────
d2 = uid()
sections_dcdb.append((d2, 'Non-Priority Cable, Load & Breaker', 1))
cur.execute("INSERT INTO survey_sections (id, template_id, name, order_index) VALUES (?, ?, ?, ?)",
    [d2, DCDB_TID, 'Non-Priority Cable, Load & Breaker', 1])
insert_question(cur, d2, 'np_cable_size_dcdb', 'Supply Cable Size to DCDB (mm²)', 'number', False, None, 'Integer mm²', 0)
insert_question(cur, d2, 'np_breaker1_mcb', 'Breaker 1 — Supply Cable MCB (A)', 'number', False, None, 'Integer Amps', 1)
insert_question(cur, d2, 'np_dcdu1_cable_size', 'Supply Cable Size to DCDU1 (mm²)', 'number', False, None, 'Integer mm²', 2)
insert_question(cur, d2, 'np_breaker2_dcdu1', 'Breaker 2 — DCDU1 MCB (A)', 'number', False, None, 'Integer Amps', 3)
insert_question(cur, d2, 'np_dcdu2_cable_size', 'Supply Cable Size to DCDU2 (mm²)', 'number', False, None, 'Integer mm²', 4)
insert_question(cur, d2, 'np_breaker3_dcdu2', 'Breaker 3 — DCDU2 MCB (A)', 'number', False, None, 'Integer Amps', 5)
insert_question(cur, d2, 'np_dcdu_rows', 'dcdb_dcdu_entries', 'text', False, None,
    'JSON: [{dcdu_name, cable_size_mm2, breaker_amps, photo_url}] — add/remove rows in app', 6)
insert_question(cur, d2, 'np_dcdb_photo', 'Non-Priority DCDB Section Photo', 'photo', False, None, None, 7)
insert_question(cur, d2, 'np_load_measurement', 'Supply Load Measurement — Non-Priority Incoming (A)', 'number', False, None,
    'Meter reading in Amps', 8)
insert_question(cur, d2, 'np_load_photo', 'Non-Priority Load Measurement Photo', 'photo', False, None, None, 9)
insert_question(cur, d2, 'np_load_measured_at', 'Load Measurement Time', 'text', False, None,
    'Auto-captured at time of photo', 10)

# ── Section 3: Priority Cable & Breaker ──────────────────────────────────
d3 = uid()
sections_dcdb.append((d3, 'Priority Cable, Load & Breaker', 2))
cur.execute("INSERT INTO survey_sections (id, template_id, name, order_index) VALUES (?, ?, ?, ?)",
    [d3, DCDB_TID, 'Priority Cable, Load & Breaker', 2])
insert_question(cur, d3, 'p_cable_size_dcdb', 'Supply Cable Size to DCDB (mm²)', 'number', False, None, 'Integer mm²', 0)
insert_question(cur, d3, 'p_breaker1_mcb', 'Breaker 1 — Supply Cable MCB (A)', 'number', False, None, 'Integer Amps', 1)
insert_question(cur, d3, 'p_dcdu1_cable_size', 'Supply Cable Size to DCDU1 (mm²)', 'number', False, None, 'Integer mm²', 2)
insert_question(cur, d3, 'p_breaker2_dcdu1', 'Breaker 2 — DCDU1 MCB (A)', 'number', False, None, 'Integer Amps', 3)
insert_question(cur, d3, 'p_dcdu2_cable_size', 'Supply Cable Size to DCDU2 (mm²)', 'number', False, None, 'Integer mm²', 4)
insert_question(cur, d3, 'p_breaker3_dcdu2', 'Breaker 3 — DCDU2 MCB (A)', 'number', False, None, 'Integer Amps', 5)
insert_question(cur, d3, 'p_dcdu_rows', 'dcdb_dcdu_entries', 'text', False, None,
    'JSON: [{dcdu_name, cable_size_mm2, breaker_amps, photo_url}] — add/remove rows in app', 6)
insert_question(cur, d3, 'p_dcdb_photo', 'Priority DCDB Section Photo', 'photo', False, None, None, 7)
insert_question(cur, d3, 'p_load_measurement', 'Supply Load Measurement — Priority Incoming (A)', 'number', False, None,
    'Meter reading in Amps', 8)
insert_question(cur, d3, 'p_load_photo', 'Priority Load Measurement Photo', 'photo', False, None, None, 9)
insert_question(cur, d3, 'p_load_measured_at', 'Load Measurement Time', 'text', False, None,
    'Auto-captured at time of photo', 10)

# ── Section 4: DCDU Connections ──────────────────────────────────────────
d4 = uid()
sections_dcdb.append((d4, 'DCDU Connections', 3))
cur.execute("INSERT INTO survey_sections (id, template_id, name, order_index) VALUES (?, ?, ?, ?)",
    [d4, DCDB_TID, 'DCDU Connections', 3])
insert_question(cur, d4, 'np_dcdu_breakers', 'Non-Priority DCDU Breaker List', 'text', False, None,
    'JSON: [{breaker_name, photo_url}] — add/remove rows in app', 0)
insert_question(cur, d4, 'p_dcdu_breakers', 'Priority DCDU Breaker List', 'text', False, None,
    'JSON: [{breaker_name, photo_url}] — add/remove rows in app', 1)
insert_question(cur, d4, 'total_dcdu_count', 'Total DCDU Count', 'number', False, None,
    'Must equal sum of all DCDU breakers (NP + Priority)', 2)

# ── Section 5: RRU Sub-section ──────────────────────────────────────────
d5 = uid()
sections_dcdb.append((d5, 'RRU Power & Earthing', 4))
cur.execute("INSERT INTO survey_sections (id, template_id, name, order_index) VALUES (?, ?, ?, ?)",
    [d5, DCDB_TID, 'RRU Power & Earthing', 4])
insert_question(cur, d5, 'dcdb_rru_count', 'RRU Count', 'number', False, None,
    'Should tally with Tower Equipment scope', 0)
insert_question(cur, d5, 'rru_power_cable_count', 'RRU Power Cable Count', 'number', False, None, 'Integer', 1)
insert_question(cur, d5, 'rru_power_cable_missing', 'RRU Power Cable Count Missing', 'number', False, None, 'Integer', 2)
insert_question(cur, d5, 'rru_power_cable_length_per_run', 'RRU Power Cable Length per Run (m)', 'number', False, None, 'Integer metres', 3)
insert_question(cur, d5, 'rru_power_cable_total_missing', 'RRU Power Cable Total Length Missing (m)', 'number', False, None, 'Integer metres', 4)
insert_question(cur, d5, 'rru_earth_cable_count', 'RRU Earthing Cable Count (pcs)', 'number', False, None, 'Integer', 5)
insert_question(cur, d5, 'rru_earth_cable_missing', 'RRU Earthing Cable Count Missing (pcs)', 'number', False, None, 'Integer', 6)
insert_question(cur, d5, 'rru_earth_cable_length', 'RRU Earthing Cable Length per Run (m)', 'number', False, None, 'Integer metres', 7)

# ── Section 6: AAU Sub-section ──────────────────────────────────────────
d6 = uid()
sections_dcdb.append((d6, 'AAU Power & Earthing', 5))
cur.execute("INSERT INTO survey_sections (id, template_id, name, order_index) VALUES (?, ?, ?, ?)",
    [d6, DCDB_TID, 'AAU Power & Earthing', 5])
insert_question(cur, d6, 'aau_count', 'AAU Count', 'number', False, None,
    'Should tally with Tower Equipment scope', 0)
insert_question(cur, d6, 'aau_power_cable_count', 'AAU Power Cable Count', 'number', False, None, 'Integer', 1)
insert_question(cur, d6, 'aau_power_cable_missing', 'AAU Power Cable Count Missing', 'number', False, None, 'Integer', 2)
insert_question(cur, d6, 'aau_power_cable_length_per_run', 'AAU Power Cable Length per Run (m)', 'number', False, None, 'Integer metres', 3)
insert_question(cur, d6, 'aau_power_cable_total_missing', 'AAU Power Cable Total Length Missing (m)', 'number', False, None, 'Integer metres', 4)
insert_question(cur, d6, 'aau_earth_cable_count', 'AAU Earthing Cable Count (pcs)', 'number', False, None, 'Integer', 5)
insert_question(cur, d6, 'aau_earth_cable_missing', 'AAU Earthing Cable Count Missing (pcs)', 'number', False, None, 'Integer', 6)
insert_question(cur, d6, 'aau_earth_cable_length', 'AAU Earthing Cable Length per Run (m)', 'number', False, None, 'Integer metres', 7)

# ── Section 7: BTS Earthing ─────────────────────────────────────────────
d7 = uid()
sections_dcdb.append((d7, 'BTS Earthing', 6))
cur.execute("INSERT INTO survey_sections (id, template_id, name, order_index) VALUES (?, ?, ?, ?)",
    [d7, DCDB_TID, 'BTS Earthing', 6])
insert_question(cur, d7, 'bts_earth_cable_count', 'BTS Earthing Cable Count', 'number', False, None, 'Integer', 0)
insert_question(cur, d7, 'bts_earth_cable_missing', 'BTS Earthing Cable Count Missing', 'number', False, None, 'Integer', 1)
insert_question(cur, d7, 'bts_earth_length_per_run', 'BTS Earthing Length per Run (m)', 'number', False, None, 'Integer metres', 2)
insert_question(cur, d7, 'bts_earth_total_missing', 'BTS Earthing Total Length Missing (m)', 'number', False, None, 'Integer metres', 3)

conn.commit()
print(f'DCDB Information template: {DCDB_TID[:8]}... ({len(sections_dcdb)} sections)')

# ──────────────────────────────────────────────────────────────────────────
# TEMPLATE 3: TOWER EQUIPMENT SCOPE
# ──────────────────────────────────────────────────────────────────────────
TW_TID = uid()
cur.execute("INSERT INTO survey_templates (id, tenant_id, name, record_type, description) VALUES (?, ?, ?, ?, ?)",
    [TW_TID, TENANT_ID, 'Tower Equipment Scope', 'tower_info',
     'Tower equipment survey: antenna, RRU, AAU with sector, azimuth, dimensions, and photo documentation.'])

sections_tw = []

# ── Section 1: Antenna Sub-section ───────────────────────────────────────
t1 = uid()
sections_tw.append((t1, 'Antenna', 0))
cur.execute("INSERT INTO survey_sections (id, template_id, name, order_index) VALUES (?, ?, ?, ?)",
    [t1, TW_TID, 'Antenna', 0])
insert_question(cur, t1, 'antenna_rows', 'antenna_entries', 'text', False, None,
    'JSON: [{rf_type, manufacturer, model, sector, azimuth, height_centre, length_mm, width_mm, height_mm, active, labelled, photos}] — add/remove rows in app', 0)
insert_question(cur, t1, 'antenna_count', 'Total Antenna Count', 'number', False, None, 'Integer count of all antenna entries', 1)

# ── Section 2: RRU Sub-section ──────────────────────────────────────────
t2 = uid()
sections_tw.append((t2, 'RRU', 1))
cur.execute("INSERT INTO survey_sections (id, template_id, name, order_index) VALUES (?, ?, ?, ?)",
    [t2, TW_TID, 'RRU', 1])
insert_question(cur, t2, 'rru_rows', 'rru_entries', 'text', False, None,
    'JSON: [{rf_type, manufacturer, model, sector, length_mm, width_mm, height_mm, active, labelled, photos}] — add/remove rows in app', 0)
insert_question(cur, t2, 'rru_count_total', 'Total RRU Count', 'number', False, None, 'Integer count of all RRU entries', 1)

conn.commit()
print(f'Tower Equipment template: {TW_TID[:8]}... ({len(sections_tw)} sections)')

# ──────────────────────────────────────────────────────────────────────────
# SITES + ASSIGNMENTS
# ──────────────────────────────────────────────────────────────────────────
SITES = [
    ('INV-KLA-001', 'Kampala Central BTS', 0.3136, 32.5812, 'Kampala Road, Kampala CBD, Uganda'),
    ('INV-ENT-001', 'Entebbe Airport Tower', 0.0425, 32.4446, 'Airport Road, Entebbe, Uganda'),
    ('INV-JIN-001', 'Jinja Industrial BTS', 0.4249, 33.2042, 'Industrial Area, Jinja, Uganda'),
]

due = (datetime.utcnow() + timedelta(days=7)).strftime('%Y-%m-%d')

for site_code, name, lat, lng, addr in SITES:
    site_uuid = uid()
    cur.execute(
        "INSERT INTO sites (id, tenant_id, site_id, name, latitude, longitude, address) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [site_uuid, TENANT_ID, site_code, name, lat, lng, addr]
    )
    conn.commit()
    # Ground Equipment assignment
    cur.execute(
        "INSERT INTO survey_assignments (id, tenant_id, template_id, site_id, assigned_to, assigned_by, status, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [uid(), TENANT_ID, GE_TID, site_uuid, SURVEYOR_ID, ADMIN_ID, 'pending', due]
    )
    # DCDB assignment
    cur.execute(
        "INSERT INTO survey_assignments (id, tenant_id, template_id, site_id, assigned_to, assigned_by, status, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [uid(), TENANT_ID, DCDB_TID, site_uuid, SURVEYOR_ID, ADMIN_ID, 'pending', due]
    )
    # Tower Equipment assignment
    cur.execute(
        "INSERT INTO survey_assignments (id, tenant_id, template_id, site_id, assigned_to, assigned_by, status, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [uid(), TENANT_ID, TW_TID, site_uuid, SURVEYOR_ID, ADMIN_ID, 'pending', due]
    )
    conn.commit()
    print(f'Site: {site_code} — {name} (uuid={site_uuid[:8]}...) + 3 assignments')

print(f'\n=== DONE ===')
print(f'Ground Equipment: {GE_TID}')
print(f'DCDB Information: {DCDB_TID}')
print(f'Tower Equipment:  {TW_TID}')
print(f'\nSurveyor: surveyor@innovis.com / surveyor123')
print(f'Admin:    admin@innovis.com / admin123')
conn.close()
