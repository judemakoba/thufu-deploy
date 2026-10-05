# Append closing brace and main call to seed.ts
seed_path = r"C:\Users\Jude M\Documents\Report Project\thufu-deploy\backend\src\db\seed.ts"
append = "\n}\nmain().catch(err => { console.error('Seed failed:', err); process.exit(1); });\n"

with open(seed_path, "a", encoding="utf-8") as f:
    f.write(append)

print("Done")
