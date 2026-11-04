// ใส่ค่าจาก Supabase > Project Settings > API (ใช้ anon/publishable key เท่านั้น ห้ามใส่ service_role)
// หรือเปิดเว็บแล้วกด "⚙ ตั้งค่าการเชื่อมต่อ" ในหน้าล็อกอินเพื่อกรอกแทนได้
window.CFG = { SUPABASE_URL: "https://YOUR-PROJECT.supabase.co", SUPABASE_ANON_KEY: "YOUR-ANON-KEY",
  // เซิร์ฟเวอร์ TURN (ไม่บังคับ แต่ช่วยให้ห้องเสียงต่อติดทุกเครือข่าย) เช่น:
  // ICE: [{urls:"stun:stun.l.google.com:19302"},{urls:"turn:YOUR_TURN_HOST:3478",username:"u",credential:"p"}]
};
