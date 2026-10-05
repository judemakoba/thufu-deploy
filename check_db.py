import sqlite3

db_path = r"C:\Users\Jude M\Documents\Report Project\thufu-deploy\backend\data\thufu_deploy.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()

# Check tables
cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cur.fetchall()
print("Tables:", [t[0] for t in tables])

# Check users
cur.execute("SELECT id, email, full_name, role FROM users LIMIT 5")
users = cur.fetchall()
print("\nUsers:", users)

# Check templates
cur.execute("SELECT id, name, record_type FROM survey_templates")
templates = cur.fetchall()
print("\nTemplates:", templates)

conn.close()
