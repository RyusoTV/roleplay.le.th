#!/usr/bin/env python3
"""เครื่องมือแอดมินสำหรับ RolePlay Civitas (รันบนเครื่องคุณเท่านั้น)
ใช้ service_role key ห้ามใส่ไว้ในเว็บหรือ push ขึ้น GitHub
  export SUPABASE_URL=https://xxxx.supabase.co
  export SUPABASE_SERVICE_KEY=...
  python admin_tool.py list | ban <email> | unban <email> | verify <email>
"""
import json, os, sys, urllib.parse, urllib.request

URL = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1/profiles"
KEY = os.environ["SUPABASE_SERVICE_KEY"]
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json", "Prefer": "return=minimal"}

def call(method, query="", body=None):
    req = urllib.request.Request(URL + query, method=method, headers=H, data=json.dumps(body).encode() if body else None)
    with urllib.request.urlopen(req) as r:
        raw = r.read()
        return json.loads(raw) if raw else None

def by_email(e): return "?email=eq." + urllib.parse.quote(e.lower())

if __name__ == "__main__":
    cmd, *a = sys.argv[1:] or ["list"]
    if cmd == "list":
        for p in call("GET", "?select=display_name,email,role,banned,verified&order=created_at"):
            print(f"{p['display_name']} (xbox) | {p['email']} | {p['role']}{' | BANNED' if p['banned'] else ''}{' | verified' if p['verified'] else ''}")
    elif cmd in ("ban", "unban") and a: call("PATCH", by_email(a[0]) + "&role=neq.ceo", {"banned": cmd == "ban"}); print("ok")
    elif cmd == "verify" and a: call("PATCH", by_email(a[0]), {"verified": True}); print("ok")
    else: print(__doc__)
