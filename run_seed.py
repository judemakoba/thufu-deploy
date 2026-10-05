import subprocess, os

# Clean up old DB
db_file = r"C:\Users\Jude M\Documents\Report Project\thufu-deploy\backend\data\thufu_deploy.db"
if os.path.exists(db_file):
    os.remove(db_file)
    print(f"Deleted: {db_file}")
else:
    print("DB file not found, will create fresh")

os.chdir(r"C:\Users\Jude M\Documents\Report Project\thufu-deploy\backend")
result = subprocess.run(
    [r"C:\Program Files\nodejs\npx.cmd", "tsx", "src/db/seed.ts"],
    capture_output=True, text=True, timeout=90
)
print("\nSTDOUT:", result.stdout[-3000:])
print("\nSTDERR:", result.stderr[-1000:])
print("Return code:", result.returncode)

# Verify data
import sqlite3
conn = sqlite3.connect(db_file)
cur = conn.cursor()
cur.execute("SELECT COUNT(*) FROM users")
print(f"\nUsers in DB: {cur.fetchone()[0]}")
cur.execute("SELECT COUNT(*) FROM survey_templates")
print(f"Templates in DB: {cur.fetchone()[0]}")
conn.close()
