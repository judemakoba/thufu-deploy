import sqlite3

db = r'C:\Users\Jude M\Documents\Report Project\thufu-deploy\backend\data\thufu_deploy.db'
conn = sqlite3.connect(db)
cur = conn.cursor()

# Rename columns
cur.execute('ALTER TABLE sites RENAME COLUMN atc_id TO site_id')
cur.execute('ALTER TABLE ground_equipment RENAME COLUMN atc_id TO site_id')
conn.commit()

# Verify
cur.execute('PRAGMA table_info(sites)')
print('sites cols:', [r[1] for r in cur.fetchall()])
cur.execute('SELECT id, site_id, name FROM sites')
print('site data:')
for row in cur.fetchall():
    print(' ', row)
conn.close()
print('Migration complete')
