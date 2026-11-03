"""บอตดูแลชุมชน (Python): ลบข้อความที่มีคำต้องห้าม + ทักทายสมาชิกใหม่
pip install supabase ; ตั้ง env: SUPABASE_URL, SERVICE_KEY (service_role — ห้ามใส่ในเว็บ), BOT_USER_ID, WELCOME_CHANNEL_ID"""
import os, time
from supabase import create_client
db = create_client(os.environ["SUPABASE_URL"], os.environ["SERVICE_KEY"])
BAD = {"badword1", "badword2"}
last_msg = last_mem = 0
while True:
    for m in db.table("messages").select("id,content,user_id").gt("id", last_msg).order("id").execute().data:
        last_msg = m["id"]
        if m["user_id"] != os.environ["BOT_USER_ID"] and any(w in (m["content"] or "").lower() for w in BAD):
            db.table("messages").delete().eq("id", m["id"]).execute()
    for p in db.table("profiles").select("id,display_name,created_at").order("created_at", desc=True).limit(5).execute().data:
        if p["created_at"] > str(last_mem):
            last_mem = p["created_at"]
            db.table("messages").insert({"channel_id": int(os.environ["WELCOME_CHANNEL_ID"]), "user_id": os.environ["BOT_USER_ID"],
                "content": f"ยินดีต้อนรับ {p['display_name']} (xbox) สู่ RolePlay Civitas!"}).execute()
    time.sleep(3)
