-- ============================================================
-- Thufu Deploy — Database Schema (SQLite / sql.js compatible)
-- ============================================================

-- Tenants (multi-tenant root)
CREATE TABLE IF NOT EXISTS tenants (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  plan        TEXT NOT NULL DEFAULT 'starter',
  logo_url    TEXT,
  settings    TEXT DEFAULT '{}',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  email        TEXT NOT NULL,
  password     TEXT NOT NULL,
  full_name    TEXT NOT NULL,
  phone        TEXT,
  role         TEXT NOT NULL DEFAULT 'surveyor',
  avatar_url   TEXT,
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, email)
);

-- Sites
CREATE TABLE IF NOT EXISTS sites (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  site_id       TEXT NOT NULL,
  name          TEXT NOT NULL,
  latitude      REAL,
  longitude     REAL,
  altitude      REAL,
  gps_accuracy  REAL,
  address       TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, site_id)
);

-- Survey Templates
CREATE TABLE IF NOT EXISTS survey_templates (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL,
  name           TEXT NOT NULL,
  record_type    TEXT NOT NULL,
  description    TEXT,
  sections       TEXT NOT NULL DEFAULT '[]',
  is_active      INTEGER NOT NULL DEFAULT 1,
  version        INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Survey Sections
CREATE TABLE IF NOT EXISTS survey_sections (
  id             TEXT PRIMARY KEY,
  template_id    TEXT NOT NULL,
  name           TEXT NOT NULL,
  order_index    INTEGER NOT NULL DEFAULT 0,
  description    TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Survey Questions
CREATE TABLE IF NOT EXISTS survey_questions (
  id             TEXT PRIMARY KEY,
  section_id     TEXT NOT NULL,
  field_name     TEXT NOT NULL,
  label          TEXT NOT NULL,
  input_type     TEXT NOT NULL,
  description    TEXT,
  required       INTEGER NOT NULL DEFAULT 0,
  order_index    INTEGER NOT NULL DEFAULT 0,
  options        TEXT,
  validation     TEXT,
  depends_on     TEXT,
  depends_value  TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Survey Assignments
CREATE TABLE IF NOT EXISTS survey_assignments (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL,
  template_id    TEXT NOT NULL,
  site_id        TEXT NOT NULL,
  assigned_to    TEXT NOT NULL,
  assigned_by    TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending',
  due_date       TEXT,
  submitted_at   TEXT,
  reviewed_at    TEXT,
  reviewed_by    TEXT,
  review_notes   TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Survey Submissions
CREATE TABLE IF NOT EXISTS submissions (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL,
  assignment_id  TEXT NOT NULL,
  site_id        TEXT NOT NULL,
  template_id    TEXT NOT NULL,
  record_type    TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'draft',
  answers        TEXT NOT NULL DEFAULT '{}',
  technician_id  TEXT NOT NULL,
  submitted_at   TEXT,
  reviewed_at    TEXT,
  reviewed_by    TEXT,
  review_notes   TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Photos
CREATE TABLE IF NOT EXISTS photos (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL,
  submission_id  TEXT NOT NULL,
  site_id        TEXT NOT NULL,
  field_name     TEXT NOT NULL,
  original_name  TEXT,
  stored_name    TEXT NOT NULL,
  file_path      TEXT NOT NULL,
  file_size      INTEGER,
  mime_type      TEXT,
  width          INTEGER,
  height         INTEGER,
  latitude       REAL,
  longitude      REAL,
  captured_at    TEXT DEFAULT (datetime('now')),
  uploaded_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Ground Equipment
CREATE TABLE IF NOT EXISTS ground_equipment (
  id                 TEXT PRIMARY KEY,
  submission_id      TEXT NOT NULL,
  tenant_id          TEXT NOT NULL,
  site_id            TEXT NOT NULL DEFAULT '',
  site_name_plate_photo_id TEXT,
  survey_date        TEXT,
  technician_name    TEXT,
  technician_contact TEXT,
  contractor_name    TEXT DEFAULT 'Innovis',
  latitude           REAL,
  longitude          REAL,
  gps_accuracy       REAL,
  altitude           REAL,
  gps_screenshot_id  TEXT,
  tower_type         TEXT,
  tower_height       REAL,
  building_height    REAL DEFAULT 0,
  total_height      REAL,
  site_indoor_outdoor TEXT,
  no_of_tenants      INTEGER,
  other_tenants      TEXT,
  site_photo_id      TEXT,
  has_grid           INTEGER DEFAULT 0,
  has_dg             INTEGER DEFAULT 0,
  has_solar          INTEGER DEFAULT 0,
  grid_distance_to_3phase REAL,
  guard_at_site      INTEGER DEFAULT 0,
  rru_type           TEXT,
  rru_count          INTEGER,
  cabinet_types      TEXT,
  cabinet_count      INTEGER,
  equipment_labelled INTEGER DEFAULT 0,
  cabinet_comments   TEXT,
  cabinet_dimensions TEXT,
  active_idu_types   TEXT,
  non_active_idu_types TEXT,
  non_active_idu_count INTEGER,
  slab_dimensions    TEXT,
  redundant_equipment_count INTEGER,
  is_on_fiber        INTEGER,
  overall_remarks    TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- DCDB Records
CREATE TABLE IF NOT EXISTS dcdb_records (
  id                    TEXT PRIMARY KEY,
  submission_id         TEXT NOT NULL,
  tenant_id            TEXT NOT NULL,
  grid_distance_to_3phase REAL,
  np_cable_size_dcdb  TEXT,
  np_breaker1_mcb     TEXT,
  np_dcdus             TEXT DEFAULT '[]',
  pp_cable_size_dcdb   TEXT,
  pp_breaker1_mcb     TEXT,
  pp_dcdus             TEXT DEFAULT '[]',
  dcdus                TEXT DEFAULT '[]',
  rru_dcdus            TEXT DEFAULT '[]',
  aau_dcdus            TEXT DEFAULT '[]',
  bts_earthing         TEXT DEFAULT '{}',
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tower Equipment
CREATE TABLE IF NOT EXISTS tower_equipment (
  id                 TEXT PRIMARY KEY,
  submission_id      TEXT NOT NULL,
  tenant_id         TEXT NOT NULL,
  antennas          TEXT DEFAULT '[]',
  rrus              TEXT DEFAULT '[]',
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  user_id      TEXT NOT NULL,
  title        TEXT NOT NULL,
  message      TEXT NOT NULL,
  type         TEXT NOT NULL DEFAULT 'info',
  is_read      INTEGER NOT NULL DEFAULT 0,
  link         TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  user_id      TEXT,
  action       TEXT NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    TEXT,
  details      TEXT,
  ip_address   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
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
