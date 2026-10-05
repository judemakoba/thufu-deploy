import urllib.request, json, urllib.error

def post_json(url, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read()), r.status
    except urllib.error.HTTPError as e:
        return json.loads(e.read()), e.code

BASE = "http://localhost:3001/api/admin"

# Login
result, status = post_json(f"{BASE}/auth/login", {"email": "admin@thufu.com", "password": "admin123"})
print(f"Status: {status}")
print(json.dumps(result, indent=2))

if result.get("success"):
    token = result["data"]["token"]
    print(f"\n✅ LOGIN SUCCESS! Token: {token[:40]}...")

    headers = {"Authorization": f"Bearer {token}"}

    def get(url):
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())

    r = get(f"{BASE}/analytics")
    a = r["data"]
    print(f"\n--- Analytics ---")
    print(f"  Sites: {a['total_sites']}, Templates: ?, Submissions: {a['total_submissions']}, Pending: {a['pending_review']}, Approved: {a['approved']}")

    r = get(f"{BASE}/sites")
    print(f"\n--- Sites ({r['pagination']['total']} total) ---")
    for s in r["data"][:3]:
        print(f"  {s['atc_id']} | {s['name']}")

    r = get(f"{BASE}/templates")
    print(f"\n--- Templates ---")
    for t in r["data"]:
        print(f"  {t['name']} ({t['record_type']})")
else:
    print(f"\n❌ LOGIN FAILED: {result.get('error')}")
