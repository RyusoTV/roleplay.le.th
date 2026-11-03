import { supabase } from './supabase.js';

const $ = (sel) => document.querySelector(sel);
const ALIAS_RE = /^[A-Za-z0-9_]{3,20}$/;

function setMsg(text, ok = false) {
  const el = $('#auth-msg');
  el.textContent = text;
  el.className = 'msg ' + (ok ? 'ok' : 'err');
}

// Already signed in? Go straight to the app.
supabase.auth.getSession().then(({ data }) => {
  if (data.session) location.replace('app.html');
});

function showTab(mode) {
  const signup = mode === 'signup';
  $('#signup-form').classList.toggle('hidden', !signup);
  $('#login-form').classList.toggle('hidden', signup);
  $('#tab-signup').classList.toggle('active', signup);
  $('#tab-login').classList.toggle('active', !signup);
  setMsg('');
}
$('#tab-signup').addEventListener('click', () => showTab('signup'));
$('#tab-login').addEventListener('click', () => showTab('login'));

$('#signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  const age = Number(f.age);
  const alias = f.alias.trim();

  if (!ALIAS_RE.test(alias)) return setMsg('นามแฝงต้องเป็น a-z 0-9 _ ความยาว 3–20 ตัว');
  if (!(age >= 13 && age <= 120)) return setMsg('อายุต้องอยู่ระหว่าง 13–120 ปี');

  setMsg('กำลังตรวจสอบนามแฝง...', true);
  const { data: free, error: checkErr } = await supabase.rpc('alias_available', { p_alias: alias });
  if (checkErr) return setMsg('ตรวจสอบนามแฝงไม่สำเร็จ ลองใหม่อีกครั้ง');
  if (!free) return setMsg('นามแฝงนี้ใช้ไม่ได้ (มีคนใช้แล้วหรือเป็นชื่อสงวน)');

  setMsg('กำลังสร้างบัญชี...', true);
  const { error } = await supabase.auth.signUp({
    email: f.email.trim(),
    password: f.password,
    options: {
      data: { xbox_name: f.xbox_name.trim(), age, alias },
      emailRedirectTo: new URL('app.html', location.href).href,
    },
  });
  if (error) return setMsg(error.message);

  setMsg('สร้างบัญชีแล้ว กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ', true);
});

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  const { error } = await supabase.auth.signInWithPassword({
    email: f.email.trim(),
    password: f.password,
  });
  if (error) return setMsg('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
  location.replace('app.html');
});
