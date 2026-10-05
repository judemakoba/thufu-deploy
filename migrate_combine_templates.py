"""Combine 3 BTS templates into one Innovis Survey Template"""
import sqlite3, uuid, os

DB = r"C:\Users\Jude M\Documents\Report Project\thufu-deploy\backend\data\thufu_deploy.db"
conn = sqlite3.connect(DB)
cur = conn.cursor()

def ts():
    return "2026-10-05 08:29:55"

# 1. Get IDs of the 3 old templates
cur.execute("SELECT id, name FROM survey_templates")
templates = {name: rid for rid, name, in cur.fetchall()}
print("Found templates:", templates)

gtid = templates["Ground Equipment Scope"]   # ground
dtid = templates["DCDB Power Audit"]        # dcdb
ttid = templates["Tower Equipment Scope"]    # tower

# 2. Create new combined template
new_id = str(uuid.uuid4())
cur.execute(
    """INSERT INTO survey_templates
       (id, tenant_id, name, record_type, description, sections, is_active, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
    [new_id, "seed-tenant-001",
     "Innovis Survey Template",
     "innovis_survey",
     "Combined BTS field audit covering site identification, ground equipment, DCDB power audit, and tower equipment.",
     "[]", 1, 1, ts(), ts()]
)
print(f"Created: Innovis Survey Template {new_id}")

# 3. Map: (old_template_id, old_order_index) -> (new_section_name, new_order_index)
# Ground sections (0-7) — names unchanged
# DCDB sections (0-5) — rename "RRU Sub-section" to "DCDB RRU Sub-section"
# Tower sections (0-1) — rename "RRU Sub-section" to "Tower RRU Sub-section"
section_map = [
    # Ground (order 0-7)
    (gtid, 0, "Site Identification",        0),
    (gtid, 1, "Survey Details",            1),
    (gtid, 2, "Tower & Site Information",  2),
    (gtid, 3, "Power Infrastructure",      3),
    (gtid, 4, "RRU & Cabinets",            4),
    (gtid, 5, "Slab Foundation",           5),
    (gtid, 6, "Redundant Equipment",        6),
    (gtid, 7, "Media & Remarks",           7),
    # DCDB (order 0-5 -> 8-13)
    (dtid, 0, "DCDB Non-Priority Section", 8),
    (dtid, 1, "DCDB Priority Section",     9),
    (dtid, 2, "DCDU Sub-section",         10),
    (dtid, 3, "DCDB RRU Sub-section",    11),   # renamed from "RRU Sub-section"
    (dtid, 4, "AAU Sub-section",          12),
    (dtid, 5, "BTS Earthing",             13),
    # Tower (order 0-1 -> 14-15)
    (ttid, 0, "Antenna Sub-section",      14),
    (ttid, 1, "Tower RRU Sub-section",   15),   # renamed from "RRU Sub-section"
]

for old_tid, old_order, new_name, new_order in section_map:
    cur.execute(
        "SELECT id FROM survey_sections WHERE template_id = ? AND order_index = ?",
        [old_tid, old_order]
    )
    row = cur.fetchone()
    if row:
        sid = row[0]
        cur.execute(
            "UPDATE survey_sections SET template_id = ?, name = ?, order_index = ? WHERE id = ?",
            [new_id, new_name, new_order, sid]
        )
        print(f"  [{new_order:02d}] {new_name}")
    else:
        print(f"  WARNING: section not found ({old_tid[:8]}, order {old_order})")

# 4. Update assignments to use the new template
cur.execute(
    "UPDATE survey_assignments SET template_id = ? WHERE template_id IN (?, ?, ?)",
    [new_id, gtid, dtid, ttid]
)
affected = cur.rowcount
print(f"\nUpdated {affected} assignments -> Innovis Survey Template")

# 5. Delete old templates (sections already re-assigned)
cur.execute("DELETE FROM survey_templates WHERE id IN (?, ?, ?)", [gtid, dtid, ttid])
print("Deleted 3 old template rows")

conn.commit()

# 6. Verify
cur.execute("SELECT id, name, record_type FROM survey_templates")
print("\nTemplates:", cur.fetchall())

cur.execute("SELECT name, order_index FROM survey_sections WHERE template_id = ? ORDER BY order_index", [new_id])
print("\nInnovis Survey Template sections:")
for row in cur.fetchall():
    print(f"  [{row[1]:02d}] {row[0]}")

cur.execute("SELECT COUNT(*) FROM survey_questions q JOIN survey_sections s ON q.section_id = s.id WHERE s.template_id = ?", [new_id])
print(f"\nTotal questions: {cur.fetchone()[0]}")

conn.close()
print("\nMigration complete!")
