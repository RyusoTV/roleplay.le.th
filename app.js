// ตั้งค่า: ใส่ anon (public) key จาก Supabase > Project Settings > API  (ห้ามใส่ service_role key)
const SB_URL = 'https://tdygzzlhhoutzxctbscf.supabase.co', SB_KEY = 'PASTE_ANON_KEY_HERE';
const sb = supabase.createClient(SB_URL, SB_KEY);
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url = u => /^https?:\/\//i.test(u || '') ? esc(u) : '';
const RANK = {member:1,staff:2,admin:3,vice_ceo:4,ceo:5}, LABEL = {member:'สมาชิก',staff:'ทีมงาน',admin:'คณะบริหาร',vice_ceo:'รองCEO',ceo:'CEO'};
let me, comm, chan, ch, cache = {};
const rk = () => RANK[me?.role] || 0;
const nm = p => `${esc(p.alias || p.xbox)} <small>(${esc(p.xbox)})</small>${p.verified ? '<span class="tick" title="ยืนยันตัวตนแล้ว"> ✔</span>' : ''}<span class="badge">${LABEL[p.role]}</span>`;
const err = e => e && alert('ผิดพลาด: ' + (e.message || e));
const modal = h => { const m = $('#modal'); m.innerHTML = '<div class="card">' + h + '</div>'; m.style.display = 'grid'; m.onclick = e => e.target === m && (m.style.display = 'none'); };
const closeModal = () => $('#modal').style.display = 'none';

// ---------- เข้าสู่ระบบ / สมัคร ----------
let isReg = false;
$('#sw').onclick = e => { e.preventDefault(); isReg = !isReg; $('#reg').style.display = isReg ? 'block' : 'none';
  $('#go').textContent = isReg ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'; $('#sw').textContent = isReg ? 'มีบัญชีแล้ว? เข้าสู่ระบบ' : 'ยังไม่มีบัญชี? สมัครสมาชิก'; };
$('#go').onclick = async () => {
  const email = $('#email').value.trim(), password = $('#pw').value, msg = $('#amsg');
  if (isReg) {
    const xbox = $('#xbox').value.trim(), age = +$('#age').value, alias = $('#alias').value.trim();
    if (!xbox || !alias || !(age > 0 && age < 150) || password.length < 8 || !email) return msg.textContent = 'กรอกข้อมูลให้ครบ (รหัสผ่านอย่างน้อย 8 ตัว)';
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { xbox, age, alias } } });
    if (error) return msg.textContent = error.message;
    msg.textContent = data.session ? '' : 'สมัครแล้ว! ตรวจอีเมลเพื่อกดยืนยัน แล้วกลับมาเข้าสู่ระบบ';
  } else {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) msg.textContent = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
  }
};
$('#out').onclick = () => sb.auth.signOut();
sb.auth.onAuthStateChange((_, s) => setTimeout(() => boot(s), 0));

async function boot(session) {
  $('#load').style.opacity = 0; setTimeout(() => $('#load').style.display = 'none', 600);
  if (!session) { $('#auth').style.display = 'grid'; $('#app').style.display = 'none'; return; }
  const { data } = await sb.from('profiles').select('*').eq('id', session.user.id).single();
  if (!data) return; // รอ trigger สร้างโปรไฟล์
  if (data.banned) { await sb.auth.signOut(); $('#amsg').textContent = 'บัญชีนี้ถูกแบน/บัญชีดำ'; return; }
  me = data; cache[me.id] = me;
  $('#auth').style.display = 'none'; $('#app').style.display = 'grid';
  $('#adminTab').style.display = rk() >= 2 ? '' : 'none';
  loadRail(); show('chat');
}
$$('nav [data-t]').forEach(b => b.onclick = () => show(b.dataset.t));
function show(t) {
  $$('nav [data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  $$('main').forEach(m => m.classList.toggle('on', m.id === t));
  ({ news: loadNews, me: () => loadProfile(me.id, '#me', true), people: loadPeople, admin: loadAdmin }[t] || (() => {}))();
}

// ---------- ชุมชน (แบบ Discord) ----------
async function loadRail() {
  const { data: mm } = await sb.from('community_members').select('community_id,communities(id,name)').eq('user_id', me.id);
  $('#rail').innerHTML = (mm || []).map(m => `<button class="${comm?.id === m.community_id ? 'on' : ''}" data-c="${m.community_id}" title="${esc(m.communities.name)}">${esc(m.communities.name[0])}</button>`).join('') +
    '<button class="g" id="addc" title="สร้างชุมชน">+</button><button class="g" id="findc" title="ค้นหาชุมชน">🧭</button>';
  $$('#rail [data-c]').forEach(b => b.onclick = () => openComm(b.dataset.c));
  $('#addc').onclick = async () => { const n = prompt('ชื่อชุมชน'); if (!n) return; const { data, error } = await sb.rpc('create_community', { n: n.slice(0, 50) }); err(error); if (data) { await loadRail(); openComm(data); } };
  $('#findc').onclick = async () => {
    const { data } = await sb.from('communities').select('id,name'); 
    modal('<h3>ชุมชนทั้งหมด</h3>' + (data || []).map(c => `<div class="row" data-j="${c.id}">${esc(c.name)} <small>— กดเพื่อเข้าร่วม</small></div>`).join(''));
    $$('#modal [data-j]').forEach(r => r.onclick = async () => { const { data: rl } = await sb.from('community_roles').select('id').eq('community_id', r.dataset.j).eq('name', 'สมาชิก').limit(1);
      const { error } = await sb.from('community_members').insert({ community_id: r.dataset.j, user_id: me.id, role_id: rl?.[0]?.id });
      if (error && !/duplicate/.test(error.message)) return err(error); closeModal(); await loadRail(); openComm(r.dataset.j); });
  };
  if (!comm && mm?.length) openComm(mm[0].community_id);
}
async function openComm(id) {
  const { data: c } = await sb.from('communities').select('*').eq('id', id).single(); comm = c;
  const [{ data: chs }, { data: roles }, { data: mem }] = await Promise.all([
    sb.from('channels').select('*').eq('community_id', id).order('name'), sb.from('community_roles').select('*').eq('community_id', id),
    sb.from('community_members').select('user_id,role_id,profiles(id,xbox,alias,role,verified)').eq('community_id', id)]);
  const owner = c.owner === me.id || rk() === 5, rl = Object.fromEntries((roles || []).map(r => [r.id, r]));
  $('#side').innerHTML = `<b>${esc(c.name)}</b>` + (chs || []).map(h => `<div class="row" data-h="${h.id}"># ${esc(h.name)}</div>`).join('') +
    (owner ? '<hr><button class="g" id="ach">+ ห้อง</button> <button class="g" id="aro">+ ยศ</button>' : '');
  $('#mem').innerHTML = '<b>สมาชิก</b>' + (mem || []).map(m => { const r = rl[m.role_id];
    return `<div class="row" data-u="${m.user_id}" style="color:${r?.color || 'inherit'}">${esc(m.profiles.alias || m.profiles.xbox)}<br><small>${esc(r?.name || '')}</small></div>`; }).join('');
  $$('#side [data-h]').forEach(r => r.onclick = () => openChan(r.dataset.h, r));
  $$('#mem [data-u]').forEach(r => r.onclick = () => owner ? setCRole(r.dataset.u, roles) : viewProfile(r.dataset.u));
  if (owner) {
    $('#ach').onclick = async () => { const n = prompt('ชื่อห้อง'); if (n) { err((await sb.from('channels').insert({ community_id: id, name: n.slice(0, 40) })).error); openComm(id); } };
    $('#aro').onclick = async () => { const n = prompt('ชื่อยศ'); if (!n) return; const col = prompt('สี (เช่น #ff5c7a)', '#4f8cff') || '#4f8cff';
      err((await sb.from('community_roles').insert({ community_id: id, name: n.slice(0, 30), color: /^#[0-9a-f]{6}$/i.test(col) ? col : '#4f8cff' })).error); openComm(id); };
  }
  $$('#rail [data-c]').forEach(b => b.classList.toggle('on', b.dataset.c === id));
  if (chs?.[0]) openChan(chs[0].id);
}
function setCRole(uid, roles) {
  modal('<h3>กำหนดยศ</h3>' + roles.map(r => `<div class="row" data-r="${r.id}" style="color:${r.color}">${esc(r.name)}</div>`).join('') + '<div class="row" data-p="1">ดูโปรไฟล์</div>');
  $$('#modal [data-r]').forEach(r => r.onclick = async () => { err((await sb.from('community_members').update({ role_id: r.dataset.r }).eq('community_id', comm.id).eq('user_id', uid)).error); closeModal(); openComm(comm.id); });
  $('#modal [data-p]').onclick = () => viewProfile(uid);
}
async function who(id) { if (!cache[id]) cache[id] = (await sb.from('profiles').select('*').eq('id', id).single()).data; return cache[id]; }
function line(m, p) { return `<div class="msg"><b>${nm(p)}</b> <small>${new Date(m.created_at).toLocaleTimeString('th')}</small><div>${esc(m.content)}</div></div>`; }
async function openChan(id, el) {
  chan = id; $$('#side [data-h]').forEach(r => r.classList.toggle('on', r.dataset.h === id));
  if (ch) sb.removeChannel(ch);
  const { data } = await sb.from('messages').select('*').eq('channel_id', id).order('created_at', { ascending: false }).limit(60);
  let h = ''; for (const m of (data || []).reverse()) h += line(m, await who(m.user_id) || {});
  $('#msgs').innerHTML = h; $('#msgs').scrollTop = 1e9;
  ch = sb.channel('m' + id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'channel_id=eq.' + id },
    async ({ new: m }) => { $('#msgs').insertAdjacentHTML('beforeend', line(m, await who(m.user_id) || {})); $('#msgs').scrollTop = 1e9; }).subscribe();
}
async function send() { const v = $('#mi').value.trim(); if (!v || !chan) return; $('#mi').value = ''; err((await sb.from('messages').insert({ channel_id: chan, content: v })).error); }
$('#sb').onclick = send; $('#mi').onkeydown = e => e.key === 'Enter' && send();

// ---------- ข่าวสาร ----------
async function loadNews() {
  const [{ data: n }, { data: pa }, { data: t }] = await Promise.all([sb.from('news').select('*').order('created_at', { ascending: false }).limit(30), sb.from('partners').select('*'), sb.from('team').select('*')]);
  $('#news').innerHTML = '<h2>ข่าวสาร</h2>' + (n || []).map(x => `<div class="box"><b>${esc(x.title)}</b> <small>${new Date(x.created_at).toLocaleDateString('th')}</small><div>${esc(x.body)}</div></div>`).join('') +
    '<h3>รายชื่อทีมงาน</h3>' + (t || []).map(x => `<div class="box">${esc(x.name)} <small>${esc(x.title)}</small></div>`).join('') +
    '<h3>พันธมิตร</h3>' + (pa || []).map(x => `<div class="box">${url(x.url) ? `<a style="color:var(--ac)" target="_blank" rel="noopener" href="${url(x.url)}">${esc(x.name)}</a>` : esc(x.name)}</div>`).join('');
}

// ---------- โปรไฟล์ ----------
async function loadProfile(id, sel, own) {
  const { data: p } = await sb.from('profiles').select('*').eq('id', id).single(); cache[id] = p;
  const { data: ps } = await sb.from('posts').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(30);
  $(sel).innerHTML = `<div class="card"><div class="banner" style="${url(p.banner_url) ? `background-image:url('${url(p.banner_url)}')` : ''}"></div>
   <div class="av" style="${url(p.avatar_url) ? `background-image:url('${url(p.avatar_url)}')` : ''}"></div>
   <h2>${nm(p)}</h2><p>${esc(p.bio)}</p>${url(p.channel_url) ? `<p>ช่องทางสตรีม: <a style="color:var(--ac)" target="_blank" rel="noopener" href="${url(p.channel_url)}">${url(p.channel_url)}</a> ${p.verified ? '' : '<small class="mu">(ต้องมีผู้ติดตาม 200 คนเพื่อยืนยันตัวตน)</small>'}</p>` : ''}
   ${own ? `<button class="g" id="ed">แก้ไขโปรไฟล์</button><div class="box"><textarea id="np" rows="2" maxlength="2000" placeholder="โพสต์อะไรสักอย่าง..."></textarea><button id="pp">โพสต์</button></div>` : ''}
   ${(ps || []).map(x => `<div class="box">${esc(x.content)}<br><small>${new Date(x.created_at).toLocaleString('th')}</small>${own || rk() >= 3 ? ` <a href="#" data-d="${x.id}" style="color:var(--bad)">ลบ</a>` : ''}</div>`).join('')}</div>`;
  $$(sel + ' [data-d]').forEach(a => a.onclick = async e => { e.preventDefault(); await sb.from('posts').delete().eq('id', a.dataset.d); loadProfile(id, sel, own); });
  if (!own) return;
  $('#pp').onclick = async () => { const c = $('#np').value.trim(); if (c) { err((await sb.from('posts').insert({ content: c })).error); loadProfile(id, sel, own); } };
  $('#ed').onclick = () => { modal(`<h3>แก้ไขโปรไฟล์</h3><input id="e1" placeholder="นามแฝง" value="${esc(p.alias)}"><input id="e2" placeholder="ลิงก์รูปโปรไฟล์ (https://...)" value="${esc(p.avatar_url)}"><input id="e3" placeholder="ลิงก์พื้นหลังโปรไฟล์" value="${esc(p.banner_url)}"><input id="e4" placeholder="ลิงก์ช่องสตรีม/ติดตาม" value="${esc(p.channel_url)}"><textarea id="e5" rows="3" placeholder="อธิบายโปรไฟล์">${esc(p.bio)}</textarea><button id="sv">บันทึก</button>`);
    $('#sv').onclick = async () => { const f = i => $('#' + i).value.trim(); const ok = u => !u || /^https?:\/\//i.test(u);
      if (![f('e2'), f('e3'), f('e4')].every(ok)) return alert('ลิงก์ต้องขึ้นต้นด้วย https://');
      const { data, error } = await sb.from('profiles').update({ alias: f('e1').slice(0, 32), avatar_url: f('e2'), banner_url: f('e3'), channel_url: f('e4'), bio: f('e5').slice(0, 500) }).eq('id', me.id).select().single();
      if (error) return err(error); me = data; cache[me.id] = me; closeModal(); loadProfile(me.id, sel, true); };
  };
}
function viewProfile(id) { modal('<div id="vp"></div>'); loadProfile(id, '#vp', false); }
async function loadPeople() {
  const { data } = await sb.from('profiles').select('*').order('created_at');
  $('#people').innerHTML = '<h2>สมาชิกทั้งหมด</h2>' + (data || []).map(p => `<div class="box row" data-u="${p.id}">${nm(p)}</div>`).join('');
  $$('#people [data-u]').forEach(r => r.onclick = () => viewProfile(r.dataset.u));
}

// ---------- หลังบ้าน ----------
async function loadAdmin() {
  const { data } = await sb.from('profiles').select('*').order('created_at');
  const roleOpts = r => (rk() === 5 ? Object.keys(LABEL) : ['member', 'staff']).map(k => `<option value="${k}" ${k === r ? 'selected' : ''}>${LABEL[k]}</option>`).join('');
  $('#admin').innerHTML = `<h2>หลังบ้าน (${LABEL[me.role]})</h2>
   <div class="box"><b>แจ้งข่าวสาร</b><input id="nt" placeholder="หัวข้อ"><textarea id="nb" rows="2" placeholder="รายละเอียด"></textarea><button id="na">โพสต์ข่าว</button></div>
   ${rk() >= 3 ? `<div class="box"><b>เพิ่มรายชื่อทีมงาน</b><input id="tn" placeholder="ชื่อ"><input id="tt" placeholder="ตำแหน่ง"><button id="ta">เพิ่ม</button></div>
   <div class="box"><b>เพิ่มพันธมิตร</b><input id="pn" placeholder="ชื่อ"><input id="pu" placeholder="ลิงก์ https://..."><button id="pa">เพิ่ม</button></div>` : ''}
   ${rk() >= 3 ? '<h3>จัดการสมาชิก</h3>' + (data || []).map(p => `<div class="box">${nm(p)} ${p.banned ? '<span style="color:var(--bad)">[แบน]</span>' : ''}<br>
     ${p.id !== me.id && (rk() === 5 || RANK[p.role] <= 2) ? `<select data-r="${p.id}">${roleOpts(p.role)}</select> <button class="g" data-v="${p.id}" data-s="${!p.verified}">${p.verified ? 'ถอดเครื่องหมายยืนยัน' : 'ยืนยันตัวตน'}</button>` : ''}
     ${rk() === 5 && p.id !== me.id ? `<button class="g" data-b="${p.id}" data-s="${!p.banned}">${p.banned ? 'ปลดแบน' : 'แบน/บัญชีดำ'}</button> <button class="g" data-x="${p.id}" style="color:var(--bad)">ลบโปรไฟล์</button>` : ''}</div>`).join('') : ''}`;
  const add = async (t, o, ids) => { err((await sb.from(t).insert(o)).error); ids.forEach(i => $(i).value = ''); alert('สำเร็จ'); };
  $('#na').onclick = () => $('#nt').value && add('news', { title: $('#nt').value, body: $('#nb').value }, ['#nt', '#nb']);
  if ($('#ta')) { $('#ta').onclick = () => $('#tn').value && add('team', { name: $('#tn').value, title: $('#tt').value }, ['#tn', '#tt']);
    $('#pa').onclick = () => { const u = $('#pu').value.trim(); if ($('#pn').value && (!u || /^https?:\/\//i.test(u))) add('partners', { name: $('#pn').value, url: u }, ['#pn', '#pu']); }; }
  $$('#admin [data-r]').forEach(s => s.onchange = async () => { err((await sb.rpc('set_role', { target: s.dataset.r, new_role: s.value })).error); loadAdmin(); });
  $$('#admin [data-v]').forEach(b => b.onclick = async () => { err((await sb.rpc('set_verified', { target: b.dataset.v, v: b.dataset.s === 'true' })).error); loadAdmin(); });
  $$('#admin [data-b]').forEach(b => b.onclick = async () => { err((await sb.rpc('set_ban', { target: b.dataset.b, b: b.dataset.s === 'true' })).error); loadAdmin(); });
  $$('#admin [data-x]').forEach(b => b.onclick = async () => { if (confirm('ลบโปรไฟล์นี้ถาวร?')) { err((await sb.from('profiles').delete().eq('id', b.dataset.x)).error); loadAdmin(); } });
}
sb.auth.getSession().then(({ data }) => { if (!data.session) boot(null); });
