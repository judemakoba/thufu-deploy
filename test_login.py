import urllib.request, json

def post(url, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

BASE = "http://localhost:3001/api/admin"

# Login
r = post(f"{BASE}/auth/login", {"email": "admin@thufu.com", "password": "admin123"})
print(json.dumps(r, indent=2))
if r.get("success"):
    print("\n✅ LOGIN SUCCESS!")
    token = r["data"]["token"]
    print(f"Token: {token[:40]}...")

    # Test protected endpoints
    headers = {"Authorization": f"Bearer {token}"}
    def get(url):
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())

    print("\n--- Sites ---")
    sites = get(f"{BASE}/sites")
    print(f"  Total sites: {sites['pagination']['total']}")
    for s in sites["data"][:3]:
        print(f"  - {s['atc_id']} | {s['name']}")

    print("\n--- Templates ---")
    templates = get(f"{BASE}/templates")
    for t in templates["data"]:
        print(f"  - {t['name']} ({t['record_type']})")

    print("\n--- Analytics ---")
    analytics = get(f"{BASE}/analytics")
    a = analytics["data"]
    print(f"  Sites: {a['total_sites']}, Submissions: {a['total_submissions']}, "
          f"Pending: {a['pending_review']}, Approved: {a['approved']}")
else:
    print(f"\n❌ LOGIN FAILED: {r.get('error')}")
