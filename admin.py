"""เครื่องมือหลังบ้าน (รันบนเครื่องคุณ ห้ามเอา service key ขึ้นเว็บ)
  export SUPABASE_URL=... SUPABASE_SERVICE_KEY=...
  python admin.py list | rank <email> <member|staff|exec|deputy> | ban <email> | unban <email>"""
import os, sys, requests
U, K = os.environ["SUPABASE_URL"] + "/rest/v1/profiles", os.environ["SUPABASE_SERVICE_KEY"]
H = {"apikey": K, "Authorization": f"Bearer {K}", "Content-Type": "application/json", "Prefer": "return=representation"}
def patch(email, data):
    r = requests.patch(U, headers=H, params={"email": f"eq.{email}"}, json=data); r.raise_for_status(); print(r.json())
a = sys.argv[1:]
if a[:1] == ["list"]:
    for p in requests.get(U, headers=H, params={"select": "nick,xbox,email,rank,banned"}).json(): print(p)
elif a[:1] == ["rank"]: patch(a[1], {"rank": a[2]})
elif a[:1] == ["ban"]: patch(a[1], {"banned": True})
elif a[:1] == ["unban"]: patch(a[1], {"banned": False})
else: print(__doc__)
