"""Python: สร้างเซิร์ฟเวอร์เริ่มต้น "Project RP ~ Civitas" และยืนยันสิทธิ์ CEO
ใช้: pip install supabase ; SUPABASE_URL=... SERVICE_KEY=... python tools/setup_admin.py
(SERVICE_KEY ใช้บนเครื่องคุณเท่านั้น ห้ามใส่ในเว็บ/GitHub)"""
import os
from supabase import create_client
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SERVICE_KEY"])
p = sb.table("profiles").select("id").eq("email", "luminaethercompany@gmail.com").execute().data
if not p: raise SystemExit("สมัครบัญชี CEO ในเว็บก่อน แล้วรันใหม่")
uid = p[0]["id"]; sb.table("profiles").update({"status": "ceo"}).eq("id", uid).execute()
s = sb.table("servers").insert({"name": "Project RP ~ Civitas", "owner": uid}).execute().data[0]
sb.table("members").insert({"server_id": s["id"], "user_id": uid}).execute()
for n, k in [("welcome","text"),("announce-important","announce"),("general","text"),("ห้องเสียง 1","voice")]:
    sb.table("channels").insert({"server_id": s["id"], "name": n, "kind": k}).execute()
print("เรียบร้อย:", s["id"])
