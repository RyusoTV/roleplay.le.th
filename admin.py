#!/usr/bin/env python3
"""เครื่องมือแอดมินฝั่งเครื่องคุณ (ห้ามอัปโหลดขึ้น GitHub พร้อมคีย์!)
ใช้: SUPABASE_URL=... SERVICE_KEY=... python admin.py list | role <uuid> <member|staff|admin|vice_ceo|ceo> | ban <uuid> | unban <uuid>"""
import os, sys, json, urllib.request
URL, KEY = os.environ["SUPABASE_URL"].rstrip("/"), os.environ["SERVICE_KEY"]
def call(method, path, body=None):
    req = urllib.request.Request(f"{URL}/rest/v1/{path}", method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json", "Prefer": "return=representation"})
    with urllib.request.urlopen(req) as r: return json.loads(r.read() or b"[]")
a = sys.argv[1:]
if a[:1] == ["list"]:
    for p in call("GET", "profiles?select=id,xbox,alias,email,role,banned&order=created_at"):
        print(p["id"], p["role"].ljust(9), "BANNED" if p["banned"] else "      ", p["alias"], f'({p["xbox"]})', p["email"])
elif a[:1] == ["role"] and len(a) == 3: call("PATCH", f"profiles?id=eq.{a[1]}", {"role": a[2]}); print("ok")
elif a[:1] in (["ban"], ["unban"]) and len(a) == 2: call("PATCH", f"profiles?id=eq.{a[1]}", {"banned": a[0] == "ban"}); print("ok")
else: print(__doc__)
