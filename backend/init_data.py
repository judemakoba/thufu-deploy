"""Thufu Deploy - Clean SQLite init + seed using explicit column names"""
import sqlite3, hashlib, os, uuid, json, sys

DB = r"C:\Users\Jude M\Documents\Report Project\thufu-deploy\backend\data\thufu_deploy.db"
if os.path.exists(DB):
    os.remove(DB)
print("[1/6] Removed stale DB")

conn = sqlite3.connect(DB)
cur = conn.cursor()

# ── Schema ──
SCHEMA = """
CREATE TABLE tenants (id,name,slug,plan,logo_url,settings,created_at,updated_at);
CREATE TABLE users (id,tenant_id,email,password,full_name,phone,role,avatar_url,is_active,created_at,updated_at);
CREATE TABLE sites (id,tenant_id,site_id,name,latitude,longitude,altitude,gps_accuracy,address,created_at,updated_at);
CREATE TABLE survey_templates (id,tenant_id,name,record_type,description,sections,is_active,version,created_at,updated_at);
CREATE TABLE survey_sections (id,template_id,name,order_index,description,created_at);
CREATE TABLE survey_questions (id,section_id,field_name,label,input_type,description,required,order_index,options,validation,depends_on,depends_value,created_at);
CREATE TABLE survey_assignments (id,tenant_id,template_id,site_id,assigned_to,assigned_by,status,due_date,submitted_at,reviewed_at,reviewed_by,review_notes,created_at,updated_at);
CREATE TABLE submissions (id,tenant_id,assignment_id,site_id,template_id,record_type,status,answers,technician_id,submitted_at,reviewed_at,reviewed_by,review_notes,created_at,updated_at);
CREATE TABLE photos (id,tenant_id,submission_id,site_id,field_name,original_name,stored_name,file_path,file_size,mime_type,width,height,latitude,longitude,captured_at,uploaded_at);
CREATE TABLE ground_equipment (id,submission_id,tenant_id,site_id,site_name_plate_photo_id,survey_date,technician_name,technician_contact,contractor_name,latitude,longitude,gps_accuracy,altitude,gps_screenshot_id,tower_type,tower_height,building_height,total_height,site_indoor_outdoor,no_of_tenants,other_tenants,site_photo_id,has_grid,has_dg,has_solar,grid_distance_to_3phase,guard_at_site,rru_type,rru_count,cabinet_types,cabinet_count,equipment_labelled,cabinet_comments,cabinet_dimensions,active_idu_types,non_active_idu_types,non_active_idu_count,slab_dimensions,redundant_equipment_count,is_on_fiber,overall_remarks,created_at,updated_at);
CREATE TABLE dcdb_records (id,submission_id,tenant_id,grid_distance_to_3phase,np_cable_size_dcdb,np_breaker1_mcb,np_dcdus,pp_cable_size_dcdb,pp_breaker1_mcb,pp_dcdus,dcdus,rru_dcdus,aau_dcdus,bts_earthing,created_at,updated_at);
CREATE TABLE tower_equipment (id,submission_id,tenant_id,antennas,rrus,created_at,updated_at);
CREATE TABLE notifications (id,tenant_id,user_id,title,message,type,is_read,link,created_at);
CREATE TABLE audit_logs (id,tenant_id,user_id,action,entity_type,entity_id,details,ip_address,created_at);
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_sites_tenant ON sites(tenant_id);
CREATE INDEX idx_submissions_tenant ON submissions(tenant_id);
CREATE INDEX idx_submissions_status ON submissions(status);
CREATE INDEX idx_submissions_site ON submissions(site_id);
CREATE INDEX idx_submissions_type ON submissions(record_type);
CREATE INDEX idx_photos_submission ON photos(submission_id);
CREATE INDEX idx_photos_site ON photos(site_id);
CREATE INDEX idx_assignments_assigned_to ON survey_assignments(assigned_to);
CREATE INDEX idx_assignments_status ON survey_assignments(status);
CREATE INDEX idx_ground_submission ON ground_equipment(submission_id);
CREATE INDEX idx_dcdb_submission ON dcdb_records(submission_id);
CREATE INDEX idx_tower_submission ON tower_equipment(submission_id);
"""
for stmt in SCHEMA.strip().split(";"):
    s = stmt.strip()
    if s:
        cur.execute(s)
conn.commit()
print("[2/6] Schema created")

def ts():
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

def pw(p):
    return hashlib.pbkdf2_hmac("sha256", p.encode(), b"thufu-salt-v1", 100000).hex()

def insert(table, **kwargs):
    cols = list(kwargs.keys())
    vals = [kwargs[c] for c in cols]
    cur.execute(f"INSERT INTO {table} ({','.join(cols)}) VALUES ({','.join(['?' for _ in cols])})", vals)

# ── Seed Data ──
tenant_id = "seed-tenant-001"
insert("tenants", id=tenant_id, name="Innovis Demo", slug="innovis-demo",
       plan="professional", logo_url=None, settings="{}", created_at=ts(), updated_at=ts())
print("[3/6] Tenant created")

admin_id = str(uuid.uuid4())
surveyor_id = str(uuid.uuid4())
reviewer_id = str(uuid.uuid4())
for uid, email, pwd, name, phone, role in [
    (admin_id, "admin@thufu.com", "admin123", "Admin User", "+256700000001", "admin"),
    (surveyor_id, "surveyor@thufu.com", "surveyor123", "Field Surveyor", "+256700000002", "surveyor"),
    (reviewer_id, "reviewer@thufu.com", "surveyor123", "QA Reviewer", "+256700000003", "reviewer"),
]:
    insert("users", id=uid, tenant_id=tenant_id, email=email, password=pw(pwd),
           full_name=name, phone=phone, role=role, avatar_url=None,
           is_active=1, created_at=ts(), updated_at=ts())
print("[4/6] 3 users created")

site_ids = []
site_data = [
    ("ATC-KLA-001", "Kampala CBD Tower", 0.3476, 32.5825, "Kampala, Uganda"),
    ("ATC-KLA-002", "Ntinda Grid Site", 0.3589, 32.6012, "Ntinda, Kampala"),
    ("ATC-MBA-001", "Mbarara Hub", -0.6074, 30.6545, "Mbarara, Uganda"),
    ("ATC-EBB-001", "Entebbe Airport", 0.0424, 32.4435, "Entebbe, Uganda"),
    ("ATC-JIN-001", "Jinja Industrial", 0.4237, 33.2040, "Jinja, Uganda"),
]
for site_id_val, name, lat, lng, addr in site_data:
    sid = str(uuid.uuid4())
    site_ids.append(sid)
    insert("sites", id=sid, tenant_id=tenant_id, site_id=site_id_val, name=name,
           latitude=lat, longitude=lng, altitude=None, gps_accuracy=None,
           address=addr, created_at=ts(), updated_at=ts())
print(f"[5/6] {len(site_ids)} sites created")

# Templates — one combined Innovis Survey Template
innovis_tid = str(uuid.uuid4())
insert("survey_templates", id=innovis_tid, tenant_id=tenant_id,
       name="Innovis Survey Template", record_type="innovis_survey",
       description="Combined BTS field audit covering site identification, ground equipment, DCDB power audit, and tower equipment.",
       sections="[]", is_active=1, version=1, created_at=ts(), updated_at=ts())

def add_section(template_id, name, order):
    sid = str(uuid.uuid4())
    insert("survey_sections", id=sid, template_id=template_id, name=name,
           order_index=order, description=None, created_at=ts())
    return sid

def add_q(section_id, field_name, label, input_type, required, order, options=None):
    qid = str(uuid.uuid4())
    insert("survey_questions", id=qid, section_id=section_id, field_name=field_name,
           label=label, input_type=input_type, description=None, required=required,
           order_index=order, options=json.dumps(options) if options else None,
           validation=None, depends_on=None, depends_value=None, created_at=ts())

# All 16 sections for Innovis Survey Template (order 00–15)
sections_def = [
    # 00–07: Site & Ground Equipment
    ("Site Identification", [
        ("site_id", "Site ID", "text", 1),
        ("site_name_plate_photo_id", "Site Name Plate Photo", "photo", 1),
    ]),
    ("Survey Details", [
        ("survey_date", "Survey Date", "date", 1),
        ("technician_name", "Technician Name", "text", 1),
        ("technician_contact", "Technician Contact", "text", 1),
        ("contractor_name", "Contractor Name", "text", 0),
    ]),
    ("Tower & Site Information", [
        ("latitude", "Latitude", "gps", 1),
        ("longitude", "Longitude", "gps", 1),
        ("gps_accuracy", "GPS Accuracy (m)", "number", 0),
        ("altitude", "Altitude (m)", "number", 0),
        ("gps_screenshot_id", "GPS Screenshot", "photo", 1),
        ("tower_type", "Tower Type", "dropdown", 1),
        ("tower_height", "Tower Height (m)", "number", 1),
        ("building_height", "Building Height (m)", "number", 0),
        ("total_height", "Total Height (m)", "number", 0),
        ("site_indoor_outdoor", "Site Location", "dropdown", 1),
        ("no_of_tenants", "Number of Tenants", "number", 1),
        ("other_tenants", "Other Telecom Operators", "multiselect", 0),
        ("site_photo_id", "General Site Photo", "photo", 1),
    ]),
    ("Power Infrastructure", [
        ("has_grid", "Mains Grid Available", "checkbox", 1),
        ("has_dg", "Diesel Generator Present", "checkbox", 1),
        ("has_solar", "Solar System Installed", "checkbox", 1),
        ("grid_distance_to_3phase", "Distance to 3-Phase Grid (m)", "number", 0),
    ]),
    ("RRU & Cabinets", [
        ("guard_at_site", "Security Guard at Site", "checkbox", 1),
        ("rru_type", "RRU Type/Model", "text", 1),
        ("rru_count", "Number of RRU Units", "number", 1),
        ("rru_photo_paths", "RRU Photos (up to 4)", "photo", 1),
        ("cabinet_types", "Cabinet Types/Models", "text", 1),
        ("cabinet_count", "Number of Cabinets", "number", 1),
        ("cabinet_photo_paths", "Cabinet Photos", "photo", 1),
        ("equipment_labelled", "All Equipment Labelled", "checkbox", 1),
        ("cabinet_dimensions", "Cabinet Dimensions (L x W)", "text", 1),
        ("cabinet_dimension_photo_paths", "Cabinet Dimension Photos", "photo", 1),
        ("active_idu_types", "Active IDU Types", "text", 0),
        ("non_active_idu_types", "Non-Active IDU Types", "text", 0),
        ("non_active_idu_count", "Non-Active IDU Count", "number", 0),
        ("non_active_idu_photo_paths", "Non-Active IDU Photos", "photo", 0),
        ("cabinet_comments", "Cabinet Comments", "textarea", 0),
    ]),
    ("Slab Foundation", [
        ("slab_dimensions", "Slab Dimensions (L x W x H)", "text", 1),
        ("slab_photo_paths", "Slab Photos (3)", "photo", 1),
    ]),
    ("Redundant Equipment", [
        ("redundant_equipment_count", "Redundant Equipment Count", "number", 1),
        ("redundant_item_name", "Redundant Item Description", "text", 0),
        ("redundant_photo_paths", "Redundant Equipment Photos", "photo", 0),
    ]),
    ("Media & Remarks", [
        ("is_on_fiber", "Connected to Fiber Network", "checkbox", 1),
        ("overall_remarks", "Overall Remarks", "textarea", 0),
    ]),
    # 08–13: DCDB Power Audit
    ("DCDB Non-Priority Section", [
        ("grid_distance_to_3phase", "Distance to 3-Phase Grid (m)", "number", 1),
        ("np_cable_size_dcdb", "Non-Priority Cable Size (mm2)", "text", 1),
        ("np_breaker1_mcb", "MCB-1 Rating (A)", "text", 1),
    ]),
    ("DCDB Priority Section", [
        ("pp_cable_size_dcdb", "Priority Cable Size (mm2)", "text", 0),
        ("pp_breaker1_mcb", "MCB-1 Rating - Priority (A)", "text", 0),
    ]),
    ("DCDU Sub-section", [
        ("dcdus", "DCDU Details", "textarea", 0),
    ]),
    ("DCDB RRU Sub-section", [
        ("rru_dcdus", "RRU DCDU Connections", "textarea", 0),
    ]),
    ("AAU Sub-section", [
        ("aau_dcdus", "AAU DCDU Connections", "textarea", 0),
    ]),
    ("BTS Earthing", [
        ("bts_earthing", "Earthing Details", "textarea", 0),
    ]),
    # 14–15: Tower Equipment
    ("Antenna Sub-section", [
        ("antennas", "Antenna Array", "textarea", 1),
    ]),
    ("Tower RRU Sub-section", [
        ("rrus", "RRU Array", "textarea", 1),
    ]),
]

for oi, (sname, fields) in enumerate(sections_def):
    sid = add_section(innovis_tid, sname, oi)
    for fi, (fname, flabel, ftype, freq) in enumerate(fields):
        opts = None
        if fname == "tower_type":
            opts = [{"value": "GBT", "label": "Greenfield Tower"},
                    {"value": "RTT", "label": "Rooftop Tower"},
                    {"value": "RTP", "label": "Rooftop Pole"}]
        elif fname == "site_indoor_outdoor":
            opts = [{"value": "Indoor", "label": "Indoor"}, {"value": "Outdoor", "label": "Outdoor"}]
        elif fname == "other_tenants":
            opts = [{"value": "Lyca", "label": "Lyca"}, {"value": "MTN", "label": "MTN"},
                    {"value": "UTL", "label": "UTL"}, {"value": "Savanna", "label": "Savanna"}]
        add_q(sid, fname, flabel, ftype, freq, fi, opts)

# Assignments (3 sites assigned to surveyor — now using Innovis Survey Template)
for sid in site_ids[:3]:
    aid = str(uuid.uuid4())
    insert("survey_assignments", id=aid, tenant_id=tenant_id, template_id=innovis_tid,
           site_id=sid, assigned_to=surveyor_id, assigned_by=admin_id,
           status="pending", due_date=None, submitted_at=None, reviewed_at=None,
           reviewed_by=None, review_notes=None, created_at=ts(), updated_at=ts())

conn.commit()
cur.execute("SELECT COUNT(*) FROM users"); u = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM survey_templates"); t = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM sites"); s = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM survey_assignments"); a = cur.fetchone()[0]
conn.close()

print(f"[6/6] {u} users, {t} templates, {s} sites, {a} assignments")
print(f"\nDB: {DB}")
print(f"Size: {os.path.getsize(DB):,} bytes\n")
print("=" * 50)
print("Thufu Deploy - Seeded successfully!")
print("=" * 50)
print("LOGIN CREDENTIALS:")
print("  Admin:    admin@thufu.com / admin123")
print("  Surveyor:  surveyor@thufu.com / surveyor123")
print("  Reviewer:  reviewer@thufu.com / surveyor123")
print("=" * 50)
