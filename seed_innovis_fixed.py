"""
Thufu Deploy — Innovis tenant seed (Python)
PBKDF2-SHA256 matching backend/src/controllers/authController.ts exactly:
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

# ── Tenant ──────────────────────────────────────────────────────────────
TENANT_ID = 'innovis-tenant-001'
cur.execute("SELECT id FROM tenants WHERE id = ?", (TENANT_ID,))
if not cur.fetchone():
    cur.execute(
        "INSERT INTO tenants (id, name, slug, plan, settings) VALUES (?, ?, ?, ?, ?)",
        (TENANT_ID, 'Innovis Uganda', 'innovis', 'professional', json.dumps({'theme': 'innovis'}))
    )
    print("Tenant created")
else:
    print("Tenant already exists, deleting for clean seed")
    cur.execute("DELETE FROM survey_assignments WHERE tenant_id = ?", (TENANT_ID,))
    cur.execute("DELETE FROM survey_questions WHERE section_id IN (SELECT id FROM survey_sections WHERE template_id IN (SELECT id FROM survey_templates WHERE tenant_id = ?))", (TENANT_ID,))
    cur.execute("DELETE FROM survey_sections WHERE template_id IN (SELECT id FROM survey_templates WHERE tenant_id = ?)", (TENANT_ID,))
    cur.execute("DELETE FROM survey_templates WHERE tenant_id = ?", (TENANT_ID,))
    cur.execute("DELETE FROM sites WHERE tenant_id = ?", (TENANT_ID,))
    cur.execute("DELETE FROM users WHERE tenant_id = ?", (TENANT_ID,))
    cur.execute("DELETE FROM tenants WHERE id = ?", (TENANT_ID,))
    cur.execute(
        "INSERT INTO tenants (id, name, slug, plan, settings) VALUES (?, ?, ?, ?, ?)",
        (TENANT_ID, 'Innovis Uganda', 'innovis', 'professional', json.dumps({'theme': 'innovis'}))
    )
conn.commit()

# ── Users ────────────────────────────────────────────────────────────────
ADMIN_ID = 'innovis-admin-001'
SURVEYOR_ID = 'innovis-surveyor-001'

# Delete existing
cur.execute("DELETE FROM users WHERE tenant_id = ?", (TENANT_ID,))
conn.commit()

cur.execute(
    "INSERT INTO users (id, tenant_id, email, password, full_name, role) VALUES (?, ?, ?, ?, ?, ?)",
    [ADMIN_ID, TENANT_ID, 'admin@innovis.com', pbkdf2('admin123'), 'Innovis Admin', 'admin']
)
cur.execute(
    "INSERT INTO users (id, tenant_id, email, password, full_name, role) VALUES (?, ?, ?, ?, ?, ?)",
    [SURVEYOR_ID, TENANT_ID, 'surveyor@innovis.com', pbkdf2('surveyor123'), 'John Kato', 'surveyor']
)
conn.commit()
print("Users created: admin@innovis.com / admin123, surveyor@innovis.com / surveyor123")

# ── Template ────────────────────────────────────────────────────────────
TEMPLATE_ID = uid()

# Map app input types to our schema
def map_type(t):
    return {'select': 'dropdown', 'textarea': 'textarea', 'text': 'text',
            'number': 'number', 'date': 'date', 'photo': 'photo',
            'checkbox': 'checkbox', 'gps': 'gps'}.get(t, 'text')

SECTIONS = [
    {
        'name': 'Site Details',
        'questions': [
            ('tower_type', 'Tower Type', 'select', True,
             [{'value': 'BTS Tower', 'label': 'BTS Tower'},
              {'value': 'Rooftop', 'label': 'Rooftop'},
              {'value': 'Greenfield', 'label': 'Greenfield'},
              {'value': 'Indoor', 'label': 'Indoor'}]),
            ('tower_height', 'Tower Height (m)', 'number', True, None),
            ('building_height', 'Building Height (m)', 'number', False, None),
            ('total_height', 'Total Structure Height (m)', 'number', True, None),
            ('site_indoor_outdoor', 'Site Location', 'select', True,
             [{'value': 'Indoor', 'label': 'Indoor'},
              {'value': 'Outdoor', 'label': 'Outdoor'}]),
            ('no_of_tenants', 'Number of Tenants', 'number', False, None),
        ]
    },
    {
        'name': 'Power Infrastructure',
        'questions': [
            ('has_grid', 'Grid Power Available', 'select', True,
             [{'value': 'Yes', 'label': 'Yes'},
              {'value': 'No', 'label': 'No'}]),
            ('has_dg', 'Diesel Generator', 'select', True,
             [{'value': 'Yes', 'label': 'Yes'},
              {'value': 'No', 'label': 'No'}]),
            ('has_solar', 'Solar Power', 'select', True,
             [{'value': 'Yes', 'label': 'Yes'},
              {'value': 'No', 'label': 'No'}]),
            ('grid_distance_to_3phase', 'Grid Distance to 3-Phase (m)', 'number', False, None),
            ('guard_at_site', 'Security Guard', 'select', True,
             [{'value': 'Yes', 'label': 'Yes'},
              {'value': 'No', 'label': 'No'}]),
        ]
    },
    {
        'name': 'Equipment Inventory',
        'questions': [
            ('rru_type', 'RRU Type', 'select', True,
             [{'value': 'Huawei RRU', 'label': 'Huawei RRU'},
              {'value': 'Nokia RRU', 'label': 'Nokia RRU'},
              {'value': 'Ericsson RRU', 'label': 'Ericsson RRU'},
              {'value': 'ZTE RRU', 'label': 'ZTE RRU'},
              {'value': 'Not Visible', 'label': 'Not Visible'}]),
            ('rru_count', 'RRU Count', 'number', True, None),
            ('cabinet_types', 'Cabinet Types', 'select', True,
             [{'value': 'Huawei Cabinet', 'label': 'Huawei Cabinet'},
              {'value': 'Nokia Cabinet', 'label': 'Nokia Cabinet'},
              {'value': 'Shared Cabinet', 'label': 'Shared Cabinet'}]),
            ('cabinet_count', 'Number of Cabinets', 'number', True, None),
            ('equipment_labelled', 'Equipment Labelled', 'select', True,
             [{'value': 'Yes', 'label': 'Yes'},
              {'value': 'Partially', 'label': 'Partially'},
              {'value': 'No', 'label': 'No'}]),
            ('cabinet_comments', 'Cabinet Comments', 'textarea', False, None),
            ('active_idu_types', 'Active IDU Types', 'text', True, None),
            ('non_active_idu_count', 'Non-Active IDU Count', 'number', False, None),
            ('redundant_equipment_count', 'Redundant Equipment Count', 'number', False, None),
        ]
    },
    {
        'name': 'Site Assessment',
        'questions': [
            ('overall_rating', 'Site Condition Rating', 'select', True,
             [{'value': 'Excellent', 'label': 'Excellent'},
              {'value': 'Good', 'label': 'Good'},
              {'value': 'Fair', 'label': 'Fair'},
              {'value': 'Poor', 'label': 'Poor'},
              {'value': 'Critical', 'label': 'Critical'}]),
            ('is_on_fiber', 'Fiber Connectivity', 'select', True,
             [{'value': 'Yes', 'label': 'Yes'},
              {'value': 'No', 'label': 'No'},
              {'value': 'Planned', 'label': 'Planned'}]),
            ('overall_remarks', 'General Remarks', 'textarea', False, None),
        ]
    },
]

# Template row
cur.execute(
    "INSERT INTO survey_templates (id, tenant_id, name, record_type, description) VALUES (?, ?, ?, ?, ?)",
    [TEMPLATE_ID, TENANT_ID, 'Innovis Site Survey', 'ground_info',
     'Comprehensive tower and ground equipment survey for Innovis Uganda network.']
)
conn.commit()

# Sections + questions
for sec_idx, section in enumerate(SECTIONS):
    sec_id = uid()
    cur.execute(
        "INSERT INTO survey_sections (id, template_id, name, order_index, description) VALUES (?, ?, ?, ?, ?)",
        [sec_id, TEMPLATE_ID, section['name'], sec_idx,
         f"Section {sec_idx+1}: {section['name']}"]
    )
    for q_idx, q in enumerate(section['questions']):
        fname, flabel, ftype, freq = q[0], q[1], map_type(q[2]), q[3]
        opts = json.dumps(q[4]) if len(q) > 4 and q[4] else None
        cur.execute(
            "INSERT INTO survey_questions (id, section_id, field_name, label, input_type, required, order_index, options) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [uid(), sec_id, fname, flabel, ftype, 1 if freq else 0, q_idx, opts]
        )
    conn.commit()

print(f"Template seeded: '{SECTIONS[0]['name']}' + {len(SECTIONS)} sections, {sum(len(s['questions']) for s in SECTIONS)} questions")

# ── Sites + Assignments ─────────────────────────────────────────────────
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
    conn.commit()  # Commit site first so site_uuid is finalized
    cur.execute(
        "INSERT INTO survey_assignments (id, tenant_id, template_id, site_id, assigned_to, assigned_by, status, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [uid(), TENANT_ID, TEMPLATE_ID, site_uuid, SURVEYOR_ID, ADMIN_ID, 'pending', due]
    )
    conn.commit()
    print(f"  Site {site_code}: {name} (uuid={site_uuid[:8]}...)")

print(f"\nAssignments seeded: {len(SITES)} sites, due {due}")
print("\nInnovis Surveyor: surveyor@innovis.com / surveyor123")
conn.close()
