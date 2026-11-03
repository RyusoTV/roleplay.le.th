// ใส่ค่าจาก Supabase > Project Settings > API (anon key เปิดเผยได้ ความปลอดภัยอยู่ที่ RLS ใน schema.sql)
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ROLES = {member:'สมาชิก', staff:'ทีมงาน', exec:'คณะบริหาร', vice:'รองCEO', ceo:'CEO'};
const RANK = {member:0, staff:1, exec:2, vice:3, ceo:4};
const EMOJI = ['👍','❤️','😂','🎉','😮','😢'];
let me, servers = [], server, chans = [], channel, chatSub, replyTo, pendingMail;

function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('on'),4000)}
function fail(e){const m=e?.message||String(e);
  toast(/Invalid login/i.test(m)?'อีเมลหรือรหัสผ่านไม่ถูกต้อง':/rate limit/i.test(m)?'ส่งอีเมลถี่เกินไป รอสักครู่แล้วลองใหม่':/Token has expired|invalid/i.test(m)?'รหัส OTP ไม่ถูกต้องหรือหมดอายุ':m);console.error(e)}
const rank = p => RANK[p?.role] ?? 0;
const dname = p => `${esc(p.display_name)} (xbox)`;
const avatar = (p, cls='') => `<div class="av ${cls}" style="${p.avatar_url?`background-image:url('${esc(p.avatar_url)}')`:''}">${p.avatar_url?'':esc((p.display_name||'?')[0])}</div>`;
const tag = p => `${p.verified?'<span class="ok" title="ยืนยันตัวตนแล้ว">✔</span>':''}${p.role!=='member'?`<span class="badge">${ROLES[p.role]}</span>`:''}`;

/* ---------- สมัคร / OTP / เข้าสู่ระบบ ---------- */
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => showPane(b.dataset.t));
function showPane(t){
  document.querySelectorAll('.pane').forEach(p => p.classList.toggle('on', p.id === 'f-'+t));
  document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x.dataset.t === t));
  document.querySelector('.tabs').style.display = t === 'otp' ? 'none' : 'flex';
}
const val = e => (e.preventDefault(), Object.fromEntries(new FormData(e.target)));

$('#f-signup').onsubmit = async e => {
  const f = val(e), btn = e.submitter; btn.disabled = true;
  try {
    const {data, error} = await sb.auth.signUp({email:f.email.trim(), password:f.password,
      options:{data:{display_name:f.name.trim(), age:f.age, nickname:f.nickname.trim()}}});
    if (error) throw error;
    if (data.user?.identities?.length === 0) return toast('อีเมลนี้สมัครไว้แล้ว ให้เข้าสู่ระบบ');
    if (data.session) return boot();               // กรณีปิดการยืนยันอีเมลใน Supabase
    pendingMail = f.email.trim(); $('#otp-mail').textContent = pendingMail; showPane('otp');
  } catch (err) { fail(err) } finally { btn.disabled = false }
};
$('#f-otp').onsubmit = async e => {
  const f = val(e);
  const {error} = await sb.auth.verifyOtp({email:pendingMail, token:f.code.trim(), type:'signup'});
  error ? fail(error) : boot();
};
$('#resend').onclick = async () => {
  const {error} = await sb.auth.resend({type:'signup', email:pendingMail});
  error ? fail(error) : toast('ส่งรหัสใหม่แล้ว');
};
$('#f-login').onsubmit = async e => {
  const f = val(e);
  const {error} = await sb.auth.signInWithPassword({email:f.email.trim(), password:f.password});
  if (!error) return boot();
  if (/not confirmed/i.test(error.message)) {            // สมัครแล้วแต่ยังไม่ยืนยัน OTP
    pendingMail = f.email.trim(); $('#otp-mail').textContent = pendingMail;
    await sb.auth.resend({type:'signup', email:pendingMail}); showPane('otp'); return toast('ยังไม่ได้ยืนยันอีเมล ส่งรหัส OTP ใหม่แล้ว');
  }
  fail(error);
};

async function boot(){
  const {data:{session}} = await sb.auth.getSession();
  if (!session) return;
  let p = null;
  for (let i = 0; i < 5 && !p; i++) {                    // รอ trigger สร้างโปรไฟล์
    ({data:p} = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle());
    if (!p) await new Promise(r => setTimeout(r, 600));
  }
  if (!p) { await sb.auth.signOut(); return toast('ไม่พบโปรไฟล์ — ให้รัน supabase/schema.sql ก่อน') }
  if (p.banned) { await sb.auth.signOut(); return toast('บัญชีนี้ถูกระงับ') }
  me = p; $('#auth').hidden = true; $('#app').hidden = false;
  renderMe(); await loadServers(); goHome();
}
function renderMe(){
  $('#me').innerHTML = `${avatar(me)}<div class="grow"><div>${dname(me)}</div><small>${ROLES[me.role]}</small></div>`;
  $('#me').onclick = () => openProfile(me.id);
}
sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') location.reload() });
$('#burger').onclick = () => $('#side').classList.toggle('open');

/* ---------- ชุมชน / ช่อง ---------- */
async function loadServers(){
  ({data:servers} = await sb.from('servers').select('*').order('created_at'));
  $('#rail').innerHTML = `<button id="r-home" title="หน้าแรก">🏛</button>` +
    (servers||[]).map(s => `<button data-s="${s.id}" title="${esc(s.name)}">${esc(s.name[0])}</button>`).join('') +
    `<button id="r-new" title="สร้างชุมชน">＋</button>`;
  $('#r-home').onclick = goHome;
  $('#r-new').onclick = async () => { const n = prompt('ชื่อชุมชน'); if (!n?.trim()) return;
    const {data,error} = await sb.rpc('create_server',{n:n.trim()}); if (error) return fail(error);
    await loadServers(); openServer(data) };
  $('#rail').querySelectorAll('[data-s]').forEach(b => b.onclick = () => openServer(b.dataset.s));
}
function mark(sel, on){ document.querySelectorAll('#rail button').forEach(b => b.classList.remove('on')); if (on) on.classList.add('on') }
async function openServer(id){
  leaveVoice(); server = servers.find(s => s.id === id); mark(0, $(`[data-s="${id}"]`));
  ({data:chans} = await sb.from('channels').select('*').eq('server_id', id).order('type',{ascending:false}).order('name'));
  const canAdd = server.owner_id === me.id || me.role === 'ceo';
  $('#side-h').textContent = server.name;
  $('#chans').innerHTML = chans.map(c => `<button data-c="${c.id}">${c.type==='voice'?'🔊':'#'} ${esc(c.name)}</button>`).join('') +
    (canAdd ? `<button id="add-ch" class="ghost">＋ เพิ่มช่อง</button>` : '');
  $('#chans').querySelectorAll('[data-c]').forEach(b => b.onclick = () => openChannel(b.dataset.c));
  if (canAdd) $('#add-ch').onclick = async () => {
    const name = prompt('ชื่อช่อง'); if (!name) return; const voice = confirm('ช่องเสียงใช่ไหม? (ตกลง = เสียง, ยกเลิก = ข้อความ)');
    const {error} = await sb.from('channels').insert({server_id:id, name, type: voice?'voice':'text'}); error ? fail(error) : openServer(id) };
  const first = chans.find(c => c.type === 'text') || chans[0]; first ? openChannel(first.id) : ($('#title').textContent = server.name, $('#view').innerHTML = '');
}
async function openChannel(id){
  leaveVoice(); chatSub?.unsubscribe(); channel = chans.find(c => c.id === id); replyTo = null;
  document.querySelectorAll('#chans [data-c]').forEach(b => b.classList.toggle('on', b.dataset.c === id));
  $('#side').classList.remove('open'); $('#title').textContent = (channel.type==='voice'?'🔊 ':'# ') + channel.name;
  channel.type === 'voice' ? renderVoice() : renderChat();
}

/* ---------- แชท: ตอบกลับ + อีโมจิ ---------- */
function renderChat(){
  $('#view').innerHTML = `<div class="msgs" id="msgs"></div><div class="composer"><div class="rp" id="rp" hidden></div>
    <form id="send"><input id="txt" placeholder="พิมพ์ข้อความใน #${esc(channel.name)}" autocomplete="off" maxlength="2000"><button class="primary">ส่ง</button></form></div>`;
  $('#send').onsubmit = async e => { e.preventDefault(); const c = $('#txt').value.trim(); if (!c) return;
    $('#txt').value = ''; const rt = replyTo; setReply(null);
    const {error} = await sb.from('messages').insert({channel_id:channel.id, user_id:me.id, content:c, reply_to:rt}); if (error) fail(error) };
  chatSub = sb.channel('chat:'+channel.id)
    .on('postgres_changes',{event:'*',schema:'public',table:'messages',filter:'channel_id=eq.'+channel.id}, loadMsgs)
    .on('postgres_changes',{event:'*',schema:'public',table:'reactions'}, loadMsgs).subscribe();
  loadMsgs();
}
function setReply(m){ replyTo = m?.id || null; const r = $('#rp'); if (!r) return; r.hidden = !m;
  if (m) { r.innerHTML = `ตอบกลับ ${esc(m.profiles.display_name)}: ${esc(m.content.slice(0,60))} <button class="ghost" id="x">✕</button>`; $('#x').onclick = () => setReply(null); $('#txt').focus() } }
async function loadMsgs(){
  const box = $('#msgs'); if (!box || !channel) return;
  const {data:ms,error} = await sb.from('messages').select('*,profiles(id,display_name,avatar_url,role,verified)').eq('channel_id',channel.id).order('created_at',{ascending:false}).limit(100);
  if (error) return fail(error); ms.reverse();
  const ids = ms.map(m => m.id), {data:rx} = ids.length ? await sb.from('reactions').select('*').in('message_id', ids) : {data:[]};
  const byId = Object.fromEntries(ms.map(m => [m.id, m])), atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  box.innerHTML = ms.map(m => {
    const grp = {}; rx.filter(r => r.message_id === m.id).forEach(r => (grp[r.emoji] ||= []).push(r.user_id));
    const rp = m.reply_to && byId[m.reply_to];
    return `<div class="msg" data-id="${m.id}">${avatar(m.profiles)}<div class="b">
      ${m.reply_to ? `<div class="reply">${rp ? `${esc(rp.profiles.display_name)}: ${esc(rp.content.slice(0,80))}` : 'ข้อความต้นฉบับถูกลบแล้ว'}</div>` : ''}
      <div class="meta"><b data-u="${m.profiles.id}">${dname(m.profiles)}</b>${tag(m.profiles)} · ${new Date(m.created_at).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short'})}</div>
      <div class="txt">${esc(m.content)}</div>
      <div class="rx">${Object.entries(grp).map(([e,u]) => `<button data-r="${e}" class="${u.includes(me.id)?'me':''}">${e} ${u.length}</button>`).join('')}</div>
      <div class="acts">${EMOJI.map(e => `<button data-r="${e}">${e}</button>`).join('')}<button data-reply>↩ ตอบกลับ</button>${m.user_id===me.id||rank(me)>=1?'<button data-del class="danger">ลบ</button>':''}</div>
    </div></div>`}).join('');
  box.querySelectorAll('.msg').forEach(el => {
    const m = byId[el.dataset.id];
    el.querySelector('[data-u]').onclick = e => openProfile(e.target.dataset.u);
    el.querySelectorAll('[data-r]').forEach(b => b.onclick = () => toggleReact(m.id, b.dataset.r, rx));
    el.querySelector('[data-reply]').onclick = () => setReply(m);
    el.querySelector('[data-del]')?.addEventListener('click', async () => { const {error} = await sb.from('messages').delete().eq('id', m.id); error && fail(error) });
  });
  if (atBottom) box.scrollTop = box.scrollHeight;
}
async function toggleReact(mid, emoji, rx){
  const has = rx.some(r => r.message_id === mid && r.user_id === me.id && r.emoji === emoji);
  const q = has ? sb.from('reactions').delete().match({message_id:mid, user_id:me.id, emoji}) : sb.from('reactions').insert({message_id:mid, user_id:me.id, emoji});
  const {error} = await q; error && fail(error);
}

/* ---------- ช่องเสียง + แชร์หน้าจอ (WebRTC, สัญญาณผ่าน Supabase Realtime) ---------- */
let vch, mic, screen, peers = {}, inVoice = false;
const ICE = {iceServers:[{urls:'stun:stun.l.google.com:19302'}]};
function renderVoice(){
  const canShare = !!navigator.mediaDevices?.getDisplayMedia;
  $('#view').innerHTML = `<div class="pad"><div class="box"><h3>${esc(channel.name)}</h3>
    <div class="row"><button class="primary" id="v-join">เข้าร่วมช่องเสียง</button><button id="v-mute" hidden>ปิดไมค์</button>
    <button id="v-share" hidden ${canShare?'':'disabled title="เบราว์เซอร์นี้ไม่รองรับการแชร์หน้าจอ (มือถือส่วนใหญ่ยังไม่รองรับ)"'}>แชร์หน้าจอ</button><button id="v-leave" class="danger" hidden>ออก</button></div>
    <div id="v-users" class="meta">ยังไม่มีใครในห้อง</div></div></div><div class="stage" id="stage"></div><div id="audios"></div>`;
  $('#v-join').onclick = joinVoice; $('#v-leave').onclick = leaveVoice;
  $('#v-mute').onclick = () => { const t = mic.getAudioTracks()[0]; t.enabled = !t.enabled; $('#v-mute').textContent = t.enabled ? 'ปิดไมค์' : 'เปิดไมค์' };
  $('#v-share').onclick = toggleShare;
  // ดูรายชื่อคนในห้องได้โดยไม่ต้องเข้า
  vch = sb.channel('voice:'+channel.id, {config:{presence:{key:me.id}}});
  bindVoice(vch); vch.subscribe();
}
function bindVoice(c){
  c.on('broadcast',{event:'sig'},({payload}) => onSig(payload))
   .on('presence',{event:'sync'}, () => { const s = c.presenceState(); const n = Object.values(s).map(a => a[0].name);
      const el = $('#v-users'); if (el) el.textContent = n.length ? '🔊 ในห้อง: ' + n.join(', ') : 'ยังไม่มีใครในห้อง' })
   .on('presence',{event:'join'}, ({key}) => { if (inVoice && key !== me.id && me.id > key) peer(key) })
   .on('presence',{event:'leave'}, ({key}) => closePeer(key));
}
async function joinVoice(){
  try { mic = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}}) } catch { return toast('ไม่ได้รับอนุญาตใช้ไมโครโฟน') }
  inVoice = true; await vch.track({name:me.display_name});
  Object.keys(vch.presenceState()).forEach(k => k !== me.id && me.id > k && peer(k));
  ['#v-join'].forEach(s => $(s).hidden = true); ['#v-mute','#v-share','#v-leave'].forEach(s => $(s).hidden = false);
}
function sig(to, o){ vch.send({type:'broadcast', event:'sig', payload:{from:me.id, to, ...o}}) }
function peer(k){
  if (peers[k]) return peers[k];
  const pc = new RTCPeerConnection(ICE), o = peers[k] = {pc, polite: me.id < k, making:false, senders:[]};
  [mic, screen].filter(Boolean).forEach(s => s.getTracks().forEach(t => o.senders.push(pc.addTrack(t, s))));
  pc.onicecandidate = e => e.candidate && sig(k, {c:e.candidate});
  pc.onnegotiationneeded = async () => { try { o.making = true; await pc.setLocalDescription(); sig(k, {d:pc.localDescription}) } finally { o.making = false } };
  pc.ontrack = e => { const st = e.streams[0]; if (!st || document.getElementById('s'+st.id)) return;
    const el = document.createElement(e.track.kind === 'video' ? 'video' : 'audio'); el.id = 's'+st.id; el.dataset.peer = k;
    el.srcObject = st; el.autoplay = true; el.playsInline = true; if (el.tagName === 'VIDEO') el.controls = true;
    (el.tagName === 'VIDEO' ? $('#stage') : $('#audios')).append(el); st.onremovetrack = () => el.remove(); e.track.onended = () => el.remove() };
  return o;
}
async function onSig({from, to, d, c}){
  if (to !== me.id || !inVoice) return;
  const o = peer(from), pc = o.pc;
  try {
    if (d) { const clash = d.type === 'offer' && (o.making || pc.signalingState !== 'stable'); o.ignore = !o.polite && clash; if (o.ignore) return;
      await pc.setRemoteDescription(d); if (d.type === 'offer') { await pc.setLocalDescription(); sig(from, {d:pc.localDescription}) } }
    else if (c) { try { await pc.addIceCandidate(c) } catch (e) { if (!o.ignore) throw e } }
  } catch (e) { console.warn(e) }
}
function closePeer(k){ peers[k]?.pc.close(); delete peers[k]; document.querySelectorAll(`[data-peer="${k}"]`).forEach(e => e.remove()) }
async function toggleShare(){
  if (screen) return stopShare();
  try { screen = await navigator.mediaDevices.getDisplayMedia({video:true, audio:true}) } catch { return }
  Object.values(peers).forEach(o => screen.getTracks().forEach(t => o.senders.push(o.pc.addTrack(t, screen))));
  const v = document.createElement('video'); v.srcObject = screen; v.muted = true; v.autoplay = true; v.id = 'mine'; $('#stage').prepend(v);
  screen.getVideoTracks()[0].onended = stopShare; $('#v-share').textContent = 'หยุดแชร์';
}
function stopShare(){
  if (!screen) return; screen.getTracks().forEach(t => t.stop());
  Object.values(peers).forEach(o => { o.senders.filter(s => s.track && screen.getTracks().includes(s.track) || s.track === null).forEach(s => { try { o.pc.removeTrack(s) } catch {} }) });
  screen = null; $('#mine')?.remove(); const b = $('#v-share'); if (b) b.textContent = 'แชร์หน้าจอ';
}
function leaveVoice(){
  inVoice = false; Object.keys(peers).forEach(closePeer); mic?.getTracks().forEach(t => t.stop()); screen?.getTracks().forEach(t => t.stop());
  mic = screen = null; if (vch) { vch.untrack?.(); vch.unsubscribe(); vch = null }
}

/* ---------- โปรไฟล์ ---------- */
async function openProfile(id){
  const [{data:p},{data:posts}] = await Promise.all([sb.from('profiles').select('*').eq('id',id).single(), sb.from('posts').select('*').eq('user_id',id).order('created_at',{ascending:false}).limit(20)]);
  const mine = id === me.id;
  $('#sheet').innerHTML = `<div class="banner" style="${p.banner_url?`background-image:url('${esc(p.banner_url)}')`:''}"></div><div class="in">
    ${avatar(p,'big')}<h2 style="margin:0">${dname(p)} ${tag(p)}</h2><div class="meta">${esc(p.nickname||'')} · อายุ ${esc(p.age??'-')} (oc) · ${ROLES[p.role]}</div>
    <div class="txt">${esc(p.bio||'ยังไม่มีคำอธิบายโปรไฟล์')}</div>
    ${mine ? `<form id="pf" class="pane on"><input name="display_name" value="${esc(p.display_name)}" placeholder="ชื่อ"><input name="nickname" value="${esc(p.nickname||'')}" placeholder="นามแฝง">
      <input name="avatar_url" value="${esc(p.avatar_url||'')}" placeholder="ลิงก์รูปโปรไฟล์ (https://...)"><input name="banner_url" value="${esc(p.banner_url||'')}" placeholder="ลิงก์พื้นหลังโปรไฟล์">
      <textarea name="bio" rows="3" placeholder="อธิบายโปรไฟล์">${esc(p.bio||'')}</textarea><button class="primary">บันทึกโปรไฟล์</button></form>
      <form id="po" class="row"><input class="grow" name="c" placeholder="โพสต์อะไรสักอย่าง" required><button class="primary">โพสต์</button></form>
      <p class="meta">ยืนยันตัวตน: ช่องสตรีมต้องมีผู้ติดตาม 200 คน แล้วแจ้งทีมงานให้ตรวจสอบ</p>` : ''}
    <h3 style="margin:4px 0">โพสต์</h3>${(posts||[]).map(x => `<div class="box"><div class="txt">${esc(x.content)}</div><div class="meta">${new Date(x.created_at).toLocaleString('th-TH')}</div></div>`).join('') || '<div class="meta">ยังไม่มีโพสต์</div>'}
    <div class="row">${mine?'<button id="out" class="danger">ออกจากระบบ</button>':''}<button id="cl">ปิด</button></div></div>`;
  $('#modal').hidden = false; $('#cl').onclick = () => $('#modal').hidden = true;
  if (mine) {
    $('#out').onclick = () => sb.auth.signOut();
    $('#pf').onsubmit = async e => { const f = val(e); const {error} = await sb.from('profiles').update(f).eq('id',me.id); if (error) return fail(error); Object.assign(me,f); renderMe(); toast('บันทึกแล้ว'); openProfile(id) };
    $('#po').onsubmit = async e => { const f = val(e); const {error} = await sb.from('posts').insert({user_id:me.id, content:f.c}); error ? fail(error) : openProfile(id) };
  }
}
$('#modal').onclick = e => { if (e.target.id === 'modal') $('#modal').hidden = true };

/* ---------- หน้าแรก + หลังบ้านทีมงาน ---------- */
async function goHome(){
  leaveVoice(); chatSub?.unsubscribe(); mark(0, $('#r-home')); server = channel = null;
  $('#side-h').textContent = 'RolePlay Civitas'; $('#title').textContent = 'หน้าแรก'; $('#side').classList.remove('open');
  $('#chans').innerHTML = '<div class="meta" style="padding:8px">เลือกชุมชนทางซ้าย หรือกด ＋ เพื่อสร้างชุมชนของคุณ</div>';
  const [an, pa, st] = await Promise.all([sb.from('announcements').select('*,profiles(display_name)').order('created_at',{ascending:false}).limit(10),
    sb.from('partners').select('*'), sb.from('profiles').select('*').in('role',['staff','exec','vice','ceo']).order('created_at')]);
  const R = rank(me);
  $('#view').innerHTML = `<div class="pad">
    <div class="box"><h3>ข่าวสาร</h3>${(an.data||[]).map(a => `<div class="row"><div class="grow"><b>${esc(a.title)}</b><div class="txt">${esc(a.body)}</div><div class="meta">${esc(a.profiles?.display_name||'')} · ${new Date(a.created_at).toLocaleDateString('th-TH')}</div></div>${R>=2?`<button data-da="${a.id}" class="danger">ลบ</button>`:''}</div>`).join('') || '<div class="meta">ยังไม่มีข่าวสาร</div>'}
      ${R>=1?`<form id="fa" class="pane on" style="margin-top:8px"><input name="title" placeholder="หัวข้อข่าว" required><textarea name="body" rows="2" placeholder="รายละเอียด" required></textarea><button class="primary">ประกาศข่าว</button></form>`:''}</div>
    <div class="box"><h3>รายชื่อทีมงาน</h3>${(st.data||[]).map(p => `<div class="row"><a href="#" data-u="${p.id}">${dname(p)}</a>${tag(p)}</div>`).join('')}</div>
    <div class="box"><h3>พันธมิตร</h3>${(pa.data||[]).map(p => `<div class="row"><a class="grow" href="${esc(p.url||'#')}" target="_blank" rel="noopener">${esc(p.name)}</a>${R>=2?`<button data-dp="${p.id}" class="danger">ลบ</button>`:''}</div>`).join('') || '<div class="meta">ยังไม่มีพันธมิตร</div>'}
      ${R>=2?`<form id="fp" class="row"><input class="grow" name="name" placeholder="ชื่อพันธมิตร" required><input class="grow" name="url" placeholder="ลิงก์ https://..."><button class="primary">เพิ่ม</button></form>`:''}</div>
    ${R>=2?'<div class="box" id="admin"><h3>ระบบหลังบ้าน</h3><div id="ulist" class="meta">กำลังโหลด...</div></div>':''}</div>`;
  document.querySelectorAll('[data-u]').forEach(a => a.onclick = e => { e.preventDefault(); openProfile(a.dataset.u) });
  $('#fa')&&($('#fa').onsubmit = async e => { const f = val(e); const {error} = await sb.from('announcements').insert({...f, user_id:me.id}); error ? fail(error) : goHome() });
  $('#fp')&&($('#fp').onsubmit = async e => { const f = val(e); const {error} = await sb.from('partners').insert(f); error ? fail(error) : goHome() });
  document.querySelectorAll('[data-da]').forEach(b => b.onclick = async () => { await sb.from('announcements').delete().eq('id',b.dataset.da); goHome() });
  document.querySelectorAll('[data-dp]').forEach(b => b.onclick = async () => { await sb.from('partners').delete().eq('id',b.dataset.dp); goHome() });
  if (R >= 2) loadAdmin();
}
async function loadAdmin(){
  const {data:us} = await sb.from('profiles').select('*').order('created_at',{ascending:false}).limit(200), R = rank(me), ceo = me.role === 'ceo';
  $('#ulist').innerHTML = us.map(u => {
    const canRole = u.role !== 'ceo' && (ceo || (R >= 2 && rank(u) < 2));
    const opts = (ceo ? ['member','staff','exec','vice'] : ['member','staff']).map(r => `<option value="${r}" ${u.role===r?'selected':''}>${ROLES[r]}</option>`).join('');
    return `<div class="row" data-id="${u.id}"><a href="#" data-u="${u.id}" class="grow">${dname(u)} ${tag(u)}${u.banned?'<span class="badge danger">ถูกแบน</span>':''}<div class="meta">${esc(u.email)}</div></a>
      ${canRole ? `<select data-role style="width:auto">${opts}</select>` : ''}
      ${ceo && u.role !== 'ceo' ? `<button data-f="verified" data-v="${!u.verified}">${u.verified?'ถอนยืนยัน':'ยืนยันตัวตน'}</button><button data-f="banned" data-v="${!u.banned}" class="danger">${u.banned?'ปลดแบน':'แบน'}</button><button data-del class="danger">ลบโปรไฟล์</button>` : ''}</div>`}).join('');
  $('#ulist').querySelectorAll('.row').forEach(r => { const id = r.dataset.id;
    r.querySelector('[data-u]').onclick = e => { e.preventDefault(); openProfile(id) };
    r.querySelector('[data-role]')?.addEventListener('change', async e => { const {error} = await sb.rpc('set_role',{target:id,new_role:e.target.value}); error ? fail(error) : toast('เปลี่ยนยศแล้ว') });
    r.querySelectorAll('[data-f]').forEach(b => b.onclick = async () => { const {error} = await sb.rpc('set_flag',{target:id,flag:b.dataset.f,val:b.dataset.v==='true'}); error ? fail(error) : loadAdmin() });
    r.querySelector('[data-del]')?.addEventListener('click', async () => { if (!confirm('ลบโปรไฟล์นี้ถาวร?')) return; const {error} = await sb.rpc('delete_profile',{target:id}); error ? fail(error) : loadAdmin() });
  });
}

boot();
