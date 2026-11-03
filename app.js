import { supabase } from './supabase.js';

const view = document.getElementById('view');
const state = { me: null, communityId: null, channelId: null, sub: null };

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const ROLE_LABEL = { member: 'สมาชิก', staff: 'ทีมงาน', admin: 'คณะบริหาร', vice_ceo: 'รองCEO', ceo: 'CEO' };
const STAFF = ['staff', 'admin', 'vice_ceo', 'ceo'];
const CAN_ASSIGN = ['vice_ceo', 'admin', 'ceo'];
const ALIAS_RE = /^[A-Za-z0-9_]{3,20}$/;

const fmtTime = (t) => new Date(t).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
const displayName = (p) => esc(p?.display_name || p?.alias || '?');
const verifiedMark = (p) => (p?.verified ? ' <span class="verified" title="ยืนยันตัวตนแล้ว">✔</span>' : '');
const lineHTML = (m) => `
  <div class="chat-line fade-up">
    <b>${displayName(m.author)}</b><time>${fmtTime(m.created_at)}</time>
    <p>${esc(m.body)}</p>
  </div>`;

function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

function clearSub() {
  if (state.sub) {
    state.sub.unsubscribe();
    state.sub = null;
  }
}

// Exact, case-insensitive alias lookup (escapes LIKE wildcard "_")
async function findByAlias(alias) {
  const clean = alias.trim();
  if (!ALIAS_RE.test(clean)) return null;
  const { data } = await supabase.from('profiles').select('id')
    .ilike('alias', clean.replace(/_/g, '\\_')).maybeSingle();
  return data;
}

// ---------- BOOT ----------
async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return location.replace('index.html');

  const { data: me } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
  if (!me || me.banned) {
    await supabase.auth.signOut();
    return location.replace('index.html');
  }
  state.me = me;
  renderMe();
  if (STAFF.includes(me.role)) document.getElementById('nav-admin').classList.remove('hidden');

  document.querySelectorAll('[data-view]').forEach((b) =>
    b.addEventListener('click', () => go(b.dataset.view)));
  document.getElementById('logout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    location.replace('index.html');
  });
  document.getElementById('new-community').addEventListener('click', createCommunity);
  document.getElementById('join-community').addEventListener('click', joinCommunity);

  await loadCommunities();
  go('feed');
}

function renderMe() {
  const m = state.me;
  document.getElementById('me').innerHTML =
    `<b>${displayName(m)}</b>${verifiedMark(m)}<div class="muted">${ROLE_LABEL[m.role]}</div>`;
}

const VIEWS = { feed: renderFeed, profile: renderProfile, admin: renderAdmin };

function go(name, arg) {
  clearSub();
  document.querySelectorAll('[data-view]').forEach((b) =>
    b.classList.toggle('active', b.dataset.view === name));
  if (name === 'community') return renderCommunity(arg);
  VIEWS[name]?.();
}

// ---------- COMMUNITIES ----------
async function loadCommunities() {
  const { data, error } = await supabase.from('community_members')
    .select('community:communities(id, name)').eq('user_id', state.me.id);
  if (error) return toast(error.message);
  const ul = document.getElementById('community-list');
  ul.innerHTML = (data || []).map((r) =>
    `<li><button class="nav-btn" data-community="${esc(r.community.id)}">${esc(r.community.name)}</button></li>`
  ).join('') || '<li class="muted">ยังไม่มีชุมชน</li>';
  ul.querySelectorAll('[data-community]').forEach((b) =>
    b.addEventListener('click', () => go('community', b.dataset.community)));
}

async function createCommunity() {
  const name = prompt('ชื่อชุมชน (2–60 ตัวอักษร)');
  if (!name || name.trim().length < 2) return;
  const { data, error } = await supabase.from('communities')
    .insert({ name: name.trim(), owner_id: state.me.id }).select().single();
  if (error) return toast(error.message);
  await loadCommunities();
  go('community', data.id);
}

async function joinCommunity() {
  const id = prompt('วางรหัสชุมชนที่ต้องการเข้าร่วม');
  if (!id) return;
  const { error } = await supabase.from('community_members')
    .insert({ community_id: id.trim(), user_id: state.me.id });
  if (error) return toast('ไม่พบชุมชนหรือเข้าร่วมไม่สำเร็จ');
  await loadCommunities();
  go('community', id.trim());
}

async function renderCommunity(id) {
  state.communityId = id;
  const [{ data: c }, { data: chans }, { data: members }] = await Promise.all([
    supabase.from('communities').select('*').eq('id', id).single(),
    supabase.from('channels').select('*').eq('community_id', id).order('created_at'),
    supabase.from('community_members')
      .select('community_role, user:profiles(id, alias, display_name, role, verified)')
      .eq('community_id', id),
  ]);
  if (!c) return toast('ไม่พบชุมชน');

  const mine = (members || []).find((m) => m.user.id === state.me.id);
  const canMod = ['owner', 'mod'].includes(mine?.community_role) || state.me.role === 'ceo';

  view.innerHTML = `
    <div class="community fade-up">
      <aside class="card">
        <h3>${esc(c.name)}</h3>
        <ul id="chan-list" class="stack"></ul>
        ${canMod ? '<button id="add-channel" class="btn ghost" type="button">+ ช่องใหม่</button>' : ''}
        <p class="muted small">รหัสชุมชน: <code>${esc(c.id)}</code></p>
      </aside>

      <section class="card chat">
        <div id="messages"></div>
        <form id="msg-form" class="row" style="margin-top:12px">
          <input name="body" maxlength="2000" placeholder="ส่งข้อความ..." autocomplete="off" style="flex:1" required>
          <button class="btn primary" type="submit">ส่ง</button>
        </form>
      </section>

      <aside class="card">
        <h4>สมาชิก (${(members || []).length})</h4>
        <ul id="member-list" class="stack"></ul>
      </aside>
    </div>`;

  // channels
  const ul = document.getElementById('chan-list');
  ul.innerHTML = (chans || []).map((ch) =>
    `<li><button class="nav-btn" data-ch="${esc(ch.id)}" data-kind="${esc(ch.kind)}" type="button">`
    + `${ch.kind === 'voice' ? '🔊' : '#'} ${esc(ch.name)}</button></li>`).join('');
  ul.querySelectorAll('[data-ch]').forEach((btn) => btn.addEventListener('click', () => {
    if (btn.dataset.kind === 'voice') return toast('ช่องเสียงอยู่ระหว่างพัฒนา (ต้องใช้ WebRTC)');
    ul.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    openChannel(btn.dataset.ch);
  }));

  // members
  document.getElementById('member-list').innerHTML = (members || []).map((m) =>
    `<li class="row"><span>${displayName(m.user)}${verifiedMark(m.user)}</span>`
    + `<small class="muted">${esc(m.community_role)}</small></li>`).join('');

  // send message
  document.getElementById('msg-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = e.target.elements.body;
    const body = input.value.trim();
    if (!body || !state.channelId) return;
    const { error } = await supabase.from('messages')
      .insert({ channel_id: state.channelId, author_id: state.me.id, body });
    if (error) return toast(error.message);
    input.value = '';
  });

  // add channel (owner / mod / CEO)
  document.getElementById('add-channel')?.addEventListener('click', async () => {
    const name = prompt('ชื่อช่องข้อความ (1–40 ตัวอักษร)');
    if (!name) return;
    const { error } = await supabase.from('channels')
      .insert({ community_id: id, name: name.trim(), kind: 'text' });
    if (error) return toast(error.message);
    renderCommunity(id);
  });

  const firstText = (chans || []).find((ch) => ch.kind === 'text');
  if (firstText) ul.querySelector(`[data-ch="${firstText.id}"]`)?.click();
}

async function openChannel(chId) {
  clearSub();
  state.channelId = chId;
  const box = document.getElementById('messages');
  box.innerHTML = '<p class="muted">กำลังโหลด...</p>';

  const { data, error } = await supabase.from('messages')
    .select('id, body, created_at, author:profiles(alias, display_name)')
    .eq('channel_id', chId).order('id', { ascending: true }).limit(100);
  if (error) return toast(error.message);
  box.innerHTML = (data || []).map(lineHTML).join('');
  box.scrollTop = box.scrollHeight;

  // realtime: new messages in this channel appear instantly
  state.sub = supabase.channel(`chan-${chId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${chId}`,
    }, async ({ new: m }) => {
      const { data: author } = await supabase.from('profiles')
        .select('alias, display_name').eq('id', m.author_id).single();
      if (state.channelId !== chId) return;
      box.insertAdjacentHTML('beforeend', lineHTML({ ...m, author }));
      box.scrollTop = box.scrollHeight;
    })
    .subscribe();
}

// ---------- FEED ----------
function renderFeed() {
  view.innerHTML = `
    <section class="card fade-up">
      <form id="post-form" class="stack">
        <textarea name="body" maxlength="1000" placeholder="มีอะไรใหม่?" required></textarea>
        <div><button class="btn primary" type="submit">โพสต์</button></div>
      </form>
    </section>
    <section id="posts" class="stack"></section>`;

  document.getElementById('post-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = new FormData(e.target).get('body').trim();
    const { error } = await supabase.from('posts').insert({ author_id: state.me.id, body });
    if (error) return toast(error.message);
    e.target.reset();
    loadPosts();
  });
  loadPosts();
}

async function loadPosts() {
  const { data, error } = await supabase.from('posts')
    .select('id, body, created_at, author:profiles(id, alias, display_name, verified)')
    .order('created_at', { ascending: false }).limit(50);
  if (error) return toast(error.message);

  const box = document.getElementById('posts');
  box.innerHTML = (data || []).map((p, i) => `
    <article class="card fade-up" style="animation-delay:${Math.min(i, 8) * 60}ms">
      <header class="row">
        <b>${displayName(p.author)}</b>${verifiedMark(p.author)}
        <span class="muted">· ${fmtTime(p.created_at)}</span>
        ${p.author.id !== state.me.id
          ? `<button class="btn ghost" data-follow="${esc(p.author.id)}" type="button">ติดตาม</button>` : ''}
      </header>
      <p>${esc(p.body)}</p>
    </article>`).join('') || '<p class="muted">ยังไม่มีโพสต์</p>';

  box.querySelectorAll('[data-follow]').forEach((b) => b.addEventListener('click', async () => {
    const { error: e2 } = await supabase.from('follows')
      .insert({ follower_id: state.me.id, followed_id: b.dataset.follow });
    if (e2) return toast('ติดตามไม่สำเร็จ (อาจติดตามไปแล้ว)');
    b.disabled = true;
    b.textContent = 'ติดตามแล้ว';
  }));
}

// ---------- PROFILE ----------
function renderProfile() {
  const m = state.me;
  view.innerHTML = `
    <section class="card profile fade-up">
      <div class="profile-bg"></div>
      <div class="profile-head">
        <div class="avatar">${esc((m.display_name || m.alias).charAt(0).toUpperCase())}</div>
        <div>
          <h2>${displayName(m)} <span class="xbox">(${esc(m.xbox_name)})</span>${verifiedMark(m)}</h2>
          <p class="muted">@${esc(m.alias)} · สถานะ: ${ROLE_LABEL[m.role]} · ผู้ติดตาม ${m.followers_count} · อายุ ${m.age}</p>
          <p>${esc(m.bio) || '<span class="muted">ยังไม่มีคำอธิบายโปรไฟล์</span>'}</p>
          <p class="muted small">${m.verified
            ? 'ยืนยันตัวตนแล้ว'
            : 'ยังไม่ยืนยันตัวตน (ต้องมีลิงก์ช่องสตรีม/ติดตาม และผู้ติดตาม 200 คนขึ้นไป)'}</p>
        </div>
      </div>

      <form id="profile-form" class="stack" style="margin-top:20px">
        <label>ชื่อที่แสดง
          <input name="display_name" maxlength="32" value="${esc(m.display_name || '')}">
        </label>
        <label>อธิบายโปรไฟล์
          <textarea name="bio" maxlength="500">${esc(m.bio)}</textarea>
        </label>
        <label>ลิงก์ช่องสตรีม / ช่องติดตาม
          <input name="stream_url" type="url" value="${esc(m.stream_url || '')}" placeholder="https://...">
        </label>
        <label>พื้นหลังโปรไฟล์ (รูปไม่เกิน 5MB)
          <input name="bg" type="file" accept="image/*">
        </label>
        <div><button class="btn primary" type="submit">บันทึก</button></div>
      </form>
    </section>`;

  const bg = view.querySelector('.profile-bg');
  if (m.background_url) bg.style.backgroundImage = `url("${m.background_url.replace(/["()\\]/g, '')}")`;

  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const patch = {
      display_name: f.get('display_name').trim() || null,
      bio: f.get('bio').trim(),
      stream_url: f.get('stream_url').trim() || null,
    };

    const file = f.get('bg');
    if (file && file.size) {
      if (file.size > 5 * 1024 * 1024) return toast('ไฟล์ใหญ่เกิน 5MB');
      const path = `${state.me.id}/bg-${Date.now()}`;
      const { error: upErr } = await supabase.storage.from('profile-media')
        .upload(path, file, { contentType: file.type });
      if (upErr) return toast(upErr.message);
      patch.background_url = supabase.storage.from('profile-media').getPublicUrl(path).data.publicUrl;
    }

    const { data, error } = await supabase.from('profiles')
      .update(patch).eq('id', state.me.id).select().single();
    if (error) return toast(error.message);
    state.me = data;
    renderMe();
    toast('บันทึกแล้ว');
    renderProfile();
  });
}

// ---------- ADMIN (team / executives / vice CEO / CEO) ----------
async function renderAdmin() {
  const role = state.me.role;
  if (!STAFF.includes(role)) return toast('สิทธิ์ไม่เพียงพอ');

  const canAssign = CAN_ASSIGN.includes(role);
  const roleOpts = (role === 'ceo' ? Object.keys(ROLE_LABEL) : ['member', 'staff'])
    .map((r) => `<option value="${r}">${ROLE_LABEL[r]}</option>`).join('');

  view.innerHTML = `
    <section class="card fade-up">
      <h2>ระบบทีมงาน</h2>
      <p class="muted">สิทธิ์ของคุณ: ${ROLE_LABEL[role]}</p>
      <h3>แจ้งข่าวสาร</h3>
      <form id="ann-form" class="stack">
        <input name="title" maxlength="120" placeholder="หัวข้อ" required>
        <textarea name="body" maxlength="2000" placeholder="เนื้อหาข่าวสาร" required></textarea>
        <div><button class="btn primary" type="submit">ประกาศ</button></div>
      </form>
      <ul id="ann-list" class="stack"></ul>
    </section>

    ${canAssign ? `
    <section class="card fade-up">
      <h3>ปรับยศ / เพิ่มทีมงาน</h3>
      <form id="role-form" class="row">
        <input name="alias" placeholder="นามแฝง" required>
        <select name="role">${roleOpts}</select>
        <button class="btn primary" type="submit">บันทึก</button>
      </form>
    </section>
    <section class="card fade-up">
      <h3>พันธมิตร</h3>
      <form id="partner-form" class="stack">
        <input name="name" maxlength="80" placeholder="ชื่อพันธมิตร" required>
        <input name="url" type="url" placeholder="https://..." required>
        <div><button class="btn primary" type="submit">เพิ่ม</button></div>
      </form>
      <ul id="partner-list" class="stack"></ul>
    </section>` : ''}

    ${role === 'ceo' ? `
    <section class="card fade-up">
      <h3>CEO: แบน / ปลดแบน / ลบโปรไฟล์</h3>
      <form id="ban-form" class="row">
        <input name="alias" placeholder="นามแฝง" required>
        <button class="btn ghost" name="act" value="ban" type="submit">แบน</button>
        <button class="btn ghost" name="act" value="unban" type="submit">ปลดแบน</button>
        <button class="btn ghost" name="act" value="delete" type="submit">ลบโปรไฟล์</button>
      </form>
    </section>` : ''}`;

  document.getElementById('ann-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const { error } = await supabase.from('announcements')
      .insert({ author_id: state.me.id, title: f.title.trim(), body: f.body.trim() });
    if (error) return toast(error.message);
    e.target.reset();
    toast('ประกาศแล้ว');
    loadAdminLists();
  });

  document.getElementById('role-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const target = await findByAlias(f.get('alias'));
    if (!target) return toast('ไม่พบนามแฝงนี้');
    const { error } = await supabase.from('profiles')
      .update({ role: f.get('role') }).eq('id', target.id);
    if (error) return toast(error.message);
    e.target.reset();
    toast('อัปเดตยศแล้ว');
  });

  document.getElementById('partner-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    if (!/^https:\/\//i.test(f.url.trim())) return toast('ลิงก์ต้องขึ้นต้นด้วย https://');
    const { error } = await supabase.from('partners')
      .insert({ name: f.name.trim(), url: f.url.trim(), added_by: state.me.id });
    if (error) return toast(error.message);
    e.target.reset();
    toast('เพิ่มพันธมิตรแล้ว');
    loadAdminLists();
  });

  document.getElementById('ban-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const alias = new FormData(e.target).get('alias');
    const act = e.submitter.value;
    const target = await findByAlias(alias);
    if (!target) return toast('ไม่พบนามแฝงนี้');
    const res = act === 'delete'
      ? await supabase.from('profiles').delete().eq('id', target.id)
      : await supabase.from('profiles').update({ banned: act === 'ban' }).eq('id', target.id);
    if (res.error) return toast(res.error.message);
    e.target.reset();
    toast('ดำเนินการแล้ว');
  });

  loadAdminLists();
}

async function loadAdminLists() {
  const [{ data: anns }, { data: partners }] = await Promise.all([
    supabase.from('announcements').select('id, title, body, created_at')
      .order('created_at', { ascending: false }).limit(20),
    supabase.from('partners').select('name, url').order('created_at'),
  ]);
  document.getElementById('ann-list').innerHTML = (anns || []).map((a) =>
    `<li class="card"><b>${esc(a.title)}</b> <span class="muted">${fmtTime(a.created_at)}</span>`
    + `<p>${esc(a.body)}</p></li>`).join('');

  const pl = document.getElementById('partner-list');
  if (pl) {
    pl.innerHTML = (partners || [])
      .filter((p) => /^https:\/\//i.test(p.url))
      .map((p) => `<li><a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${esc(p.name)}</a></li>`)
      .join('');
  }
}

init();
