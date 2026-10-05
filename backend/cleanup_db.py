import os, glob

# Remove all sqlite files to get clean start
for f in glob.glob(r"C:\Users\Jude M\Documents\Report Project\thufu-deploy\backend\data\*.db*"):
    os.remove(f)
    print(f"Deleted: {f}")
print("Done - DB will be recreated fresh on next start")
