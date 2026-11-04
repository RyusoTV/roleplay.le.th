const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const RANK={member:1,staff:2,board:3,vice_ceo:4,ceo:5},LABEL={member:'สมาชิก',staff:'ทีมงาน',board:'คณะบริหาร',vice_ceo:'รองCEO',ceo:'CEO'};
const EMO=['👍','❤️','😂','😮','😢','🔥','🎉','👀','🙏','💯','😍','🤔','😎','🥺','😭','😡','✨','💀','🫡','🤝','👏','💜','🌟','😴'];
function toast(m,t=''){const e=document.createElement('div');e.className='toast '+t;e.textContent=m;$('#toasts').appendChild(e);setTimeout(()=>{e.classList.add('out');setTimeout(()=>e.remove(),320)},3800)}
const err=m=>$('#err').textContent=m||'';
// ---------- Config ----------
const LS=(()=>{try{return JSON.parse(localStorage.getItem('civ_cfg')||'null')}catch{return null}})(),C={...CFG,...(LS||{})};
const isSvc=k=>{try{return JSON.parse(atob(k.split('.')[1])).role==='service_role'}catch{return false}};
const okCfg=/^https:\/\/\S+$/.test(C.SUPABASE_URL||'')&&!/YOUR-/.test(C.SUPABASE_URL+C.SUPABASE_ANON_KEY)&&(C.SUPABASE_ANON_KEY||'').length>20&&!isSvc(C.SUPABASE_ANON_KEY);
const sb=okCfg?supabase.createClient(C.SUPABASE_URL.replace(/\/+$/,''),C.SUPABASE_ANON_KEY):null;
const em=m=>/fetch|network/i.test(m)?'เชื่อมต่อ Supabase ไม่ได้ — ตรวจ Project URL/anon key (กด ⚙ ตั้งค่า) และดูว่าโปรเจกต์ไม่ถูก pause':/invalid login/i.test(m)?'อีเมลหรือรหัสผ่านไม่ถูกต้อง':/not confirmed/i.test(m)?'บัญชียังไม่ถูกยืนยัน — รัน supabase/patch_no_otp.sql ใน Supabase (ดู README)':/already registered/i.test(m)?'อีเมลนี้สมัครไว้แล้ว':/rate limit|too many/i.test(m)?'ทำรายการถี่เกินไป รอสักครู่แล้วลองใหม่':m;
window.setupCfg=()=>openModal(`<h3>เชื่อมต่อ Supabase</h3><p class="mu">Supabase → Project Settings → API: คัดลอก Project URL และ anon (publishable) key</p><input id="cu" placeholder="https://xxxx.supabase.co" value="${okCfg?esc(C.SUPABASE_URL):''}"><input id="ck2" placeholder="anon public key"><div class="row"><button onclick="saveCfg()">บันทึก</button><button class="g" onclick="localStorage.removeItem('civ_cfg');location.reload()">ล้างค่า</button></div>`);
window.saveCfg=()=>{const u=$('#cu').value.trim().replace(/\/+$/,''),k=$('#ck2').value.trim();if(!/^https:\/\/\S+$/.test(u)||k.length<20)return toast('URL หรือ key ไม่ถูกต้อง','err');if(isSvc(k))return toast('นี่คือ service_role key ห้ามใช้ในเว็บ ให้ใช้ anon key','err');localStorage.setItem('civ_cfg',JSON.stringify({SUPABASE_URL:u,SUPABASE_ANON_KEY:k}));location.reload()};
const need=()=>{if(sb)return false;err('ยังไม่ได้ตั้งค่า Supabase');setupCfg();return true};
// ---------- State & helpers ----------
let me,srv,ch,srvs=[],allSrv=[],chs=[],members=[],roles=[],mroles=[],P={},MC={},online=new Set(),sub,homeSub,replyTo=null,pend=null,view='srv',lastCh={},mentionRe=null,presenceOn=false;
const rank=u=>RANK[u?.status]||1,isMgr=()=>!!srv&&(srv.owner==me.id||rank(me)==5),canPost=()=>ch&&(ch.kind!='announce'||rank(me)>=2||isMgr());
const roleOf=id=>mroles.filter(m=>m.user_id==id).map(m=>roles.find(r=>r.id==m.role_id)).filter(Boolean);
const dn=u=>esc(u?.alias||u?.display_name||'?'),colr=u=>/^#[0-9a-f]{6}$/i.test(roleOf(u?.id)[0]?.color||'')?roleOf(u.id)[0].color:'';
const name=u=>`<span ${colr(u)?`style="color:${colr(u)}"`:''}>${dn(u)}</span> <span class="xb">(${esc(u?.display_name)})</span>`;
const avatar=(u,c='')=>`<div class="av ${c} ${online.has(u?.id)?'on':''}" ${u?.avatar_url?`style="background-image:url('${esc(u.avatar_url)}')"`:''} onclick="showProfile('${u?.id}')">${u?.avatar_url?'':esc((u?.alias||'?')[0].toUpperCase())}</div>`;
const badge=u=>`${u?.verified?'<span class="ver" title="ยืนยันตัวตน">✔</span>':''}${rank(u)>1?`<span class="tag">${LABEL[u.status]}</span>`:''}`;
const tm=d=>{const x=new Date(d),t=x.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});return x.toDateString()==new Date().toDateString()?t:x.toLocaleDateString('th-TH',{day:'numeric',month:'short'})+' '+t};
async function user(id,fresh){if(fresh||!P[id]){const {data}=await sb.from('profiles').select('*').eq('id',id).maybeSingle();if(data)P[id]=data}return P[id]}
const escRe=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function buildMention(){const n=['everyone',...members.map(u=>u.alias).filter(Boolean)].map(esc).sort((a,b)=>b.length-a.length);mentionRe=new RegExp('@('+n.map(escRe).join('|')+')','g')}
const fmt=t=>{let s=esc(t).replace(/`([^`\n]+)`/g,'<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g,'<b>$1</b>').replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');if(mentionRe)s=s.replace(mentionRe,'<span class="men">@$1</span>');return s.replace(/\n/g,'<br>')};
function openModal(h){$('#mbody').innerHTML=h;$('#modal').classList.remove('hide')}
const closeModal=()=>$('#modal').classList.add('hide');$('#mx').onclick=closeModal;$('#modal').onmousedown=e=>{if(e.target.id=='modal')closeModal()};
const closeNav=()=>{$('#app').classList.remove('nav','memo');$('#scrim').classList.add('hide')};
function shrink(file,max){return new Promise(res=>{if(!/^image\/(png|jpe?g|webp)$/.test(file.type))return res(file);const i=new Image(),u=URL.createObjectURL(file);i.onload=()=>{const k=Math.min(1,max/Math.max(i.width,i.height)),c=document.createElement('canvas');c.width=Math.round(i.width*k);c.height=Math.round(i.height*k);c.getContext('2d').drawImage(i,0,0,c.width,c.height);URL.revokeObjectURL(u);c.toBlob(b=>res(b?new File([b],file.name.replace(/\.\w+$/,'')+'.webp',{type:'image/webp'}):file),'image/webp',.9)};i.onerror=()=>res(file);i.src=u})}
async function upload(file){if(file.size>50*1024*1024)throw new Error('ไฟล์ใหญ่เกิน 50MB');const path=`${me.id}/${Date.now()}_${file.name.replace(/[^\w.-]/g,'_')}`;const {error}=await sb.storage.from('uploads').upload(path,file,{contentType:file.type||'application/octet-stream',cacheControl:'3600'});if(error)throw error;return sb.storage.from('uploads').getPublicUrl(path).data.publicUrl}
const must=r=>{if(r.error)throw r.error;if(Array.isArray(r.data)&&!r.data.length)throw new Error('ไม่มีสิทธิ์หรือไม่พบข้อมูล');return r.data};
window.viewImg=u=>openModal(`<img class="big" src="${esc(u)}"><a href="${esc(u)}" target="_blank" rel="noopener">เปิดภาพเต็ม</a>`);
// ---------- Boot / Auth (ไม่มี OTP) ----------
let ld=0;const li=setInterval(()=>{ld=Math.min(ld+Math.random()*12,95);$('#bar').style.width=ld+'%';$('#pct').textContent=Math.floor(ld)+'%'},120);
function show(id){['#auth','#app'].forEach(x=>$(x).classList.add('hide'));$(id).classList.remove('hide')}
async function boot(){
  try{if(!sb){show('#auth');err('ยังไม่ได้ตั้งค่า Supabase — กด “⚙ ตั้งค่าการเชื่อมต่อ” ด้านล่าง')}
   else{const {data:{session}}=await sb.auth.getSession();session?await enter():show('#auth')}}catch(e){show('#auth');err(em(e.message))}
  clearInterval(li);$('#bar').style.width='100%';$('#pct').textContent='100%';setTimeout(()=>{$('#splash').style.opacity=0;setTimeout(()=>$('#splash').remove(),600)},250)}
const tab=t=>{$('#tabs').dataset.t=t;$('#fL').classList.toggle('hide',t!='L');$('#fR').classList.toggle('hide',t!='R');err()};$('#tL').onclick=()=>tab('L');$('#tR').onclick=()=>tab('R');
$('#fR').onsubmit=async e=>{e.preventDefault();err();if(need())return;const f=Object.fromEntries(new FormData(e.target)),b=e.submitter;f.email=f.email.trim().toLowerCase();b.disabled=true;
  try{const {data,error}=await sb.auth.signUp({email:f.email,password:f.password,options:{data:{display_name:f.display_name.trim(),age:f.age.trim(),alias:f.alias.trim()}}});
  if(error)return err(em(error.message));
  if(data.user?.identities?.length==0)return err('อีเมลนี้สมัครไว้แล้ว กรุณาเข้าสู่ระบบ');
  if(!data.session)return err('Supabase ยังเปิด "Confirm email" อยู่ — ไปปิดที่ Authentication → Sign In / Providers → Email แล้วสมัครใหม่ (ดู README)');
  await enter()}catch(x){err(em(x.message))}finally{b.disabled=false}};
$('#fL').onsubmit=async e=>{e.preventDefault();err();if(need())return;const f=Object.fromEntries(new FormData(e.target)),b=e.submitter;f.email=f.email.trim().toLowerCase();b.disabled=true;
  try{const {error}=await sb.auth.signInWithPassword(f);error?err(em(error.message)):await enter()}catch(x){err(em(x.message))}finally{b.disabled=false}};
async function enter(){
  const {data:{user:au}}=await sb.auth.getUser();
  let {data}=await sb.from('profiles').select('*').eq('id',au.id).maybeSingle();
  if(!data){const m=au.user_metadata||{};const r=await sb.from('profiles').insert({id:au.id,display_name:m.display_name||au.email.split('@')[0],xbox_name:m.display_name,age:m.age,alias:m.alias||m.display_name||'user'}).select().single();data=r.data}
  me=data;if(!me||me.banned){await sb.auth.signOut();show('#auth');return err('บัญชีนี้ถูกระงับ หรือโหลดโปรไฟล์ไม่ได้ (ตรวจว่ารัน schema.sql แล้ว)')}
  P[me.id]=me;show('#app');initPresence();await loadServers()}
function initPresence(){if(presenceOn)return;presenceOn=true;const c=sb.channel('online',{config:{presence:{key:me.id}}});c.on('presence',{event:'sync'},()=>{online=new Set(Object.keys(c.presenceState()));srv&&view=='srv'&&renderMembers()}).subscribe(s=>s=='SUBSCRIBED'&&c.track({t:Date.now()}))}
const logout=async()=>{await sb.auth.signOut();location.reload()};
// ---------- Servers ----------
async function loadServers(sel){
  const [{data:s},{data:m}]=await Promise.all([sb.from('servers').select('*').order('created_at'),sb.from('members').select('server_id').eq('user_id',me.id)]);
  const mine=new Set((m||[]).map(x=>x.server_id));allSrv=s||[];srvs=allSrv.filter(x=>mine.has(x.id));renderMe();
  if(sel)return pickSrv(sel);if(srv&&srvs.find(x=>x.id==srv.id)&&view=='srv'){renderRail();return}
  srvs[0]?pickSrv(srvs[0].id):(srv=null,showHome())}
function renderRail(){$('#rail').innerHTML=`<div class="s ${view=='home'?'on':''}" onclick="showHome()" title="หน้าหลัก">🏠</div><div class="sep"></div>`+srvs.map(x=>`<div class="s ${view=='srv'&&srv?.id==x.id?'on':''}" title="${esc(x.name)}" onclick="pickSrv('${x.id}')">${x.icon_url?`<img src="${esc(x.icon_url)}">`:esc(x.name[0])}</div>`).join('')+`<div class="s add" onclick="srvMenu()" title="สร้าง / เข้าร่วมชุมชน">＋</div>`}
function renderMe(){renderRail();$('#me').innerHTML=`${avatar(me,'sm')}<div class="t"><b>${dn(me)}</b><div class="mu">${LABEL[me.status]}</div></div>${rank(me)>=3?'<button class="ib" title="หลังบ้าน" onclick="event.stopPropagation();adminPanel()">⚙</button>':''}<button class="ib" title="ออกจากระบบ" onclick="event.stopPropagation();logout()">⏻</button>`;$('#me').onclick=()=>showProfile(me.id)}
window.pickSrv=async id=>{
  srv=srvs.find(x=>x.id==id)||allSrv.find(x=>x.id==id);if(!srv)return;view='srv';$('#app').classList.remove('home');$('#homeView').classList.add('hide');$('#chatView').classList.remove('hide');closeNav();renderRail();
  $('#srvName').innerHTML=`<span>${esc(srv.name)}</span><button class="ib" title="${isMgr()?'ตั้งค่าชุมชน':'ตัวเลือก'}" onclick="srvAdmin()">${isMgr()?'⚙':'⋯'}</button>`;
  const [c,r,mr]=await Promise.all([sb.from('channels').select('*').eq('server_id',id),sb.from('roles').select('*').eq('server_id',id),sb.from('member_roles').select('*').eq('server_id',id)]);
  if(srv?.id!=id)return;chs=(c.data||[]).sort((a,b)=>(a.kind=='voice')-(b.kind=='voice')||a.name.localeCompare(b.name));roles=r.data||[];mroles=mr.data||[];
  await loadMembers();renderChans();const f=chs.find(x=>x.id==lastCh[id])||chs.find(x=>x.kind!='voice')||chs[0];f?pickCh(f.id):($('#msgs').innerHTML='<div class="empty">🪐<h3>ยังไม่มีห้อง</h3></div>')};
const icon=c=>c.kind=='voice'?'🔊':c.kind=='announce'?'📢':'#';
function renderChans(){const t=chs.filter(c=>c.kind!='voice'),v=chs.filter(c=>c.kind=='voice'),row=c=>`<div class="ch ${ch?.id==c.id?'on':''}" data-id="${c.id}" onclick="pickCh('${c.id}')"><span>${icon(c)}</span><span>${esc(c.name)}</span>${isMgr()?`<button class="del" title="ลบห้อง" onclick="event.stopPropagation();delCh('${c.id}')">✕</button>`:''}</div>`;
  $('#chans').innerHTML=(t.length?'<div class="cat">ห้องข้อความ</div>'+t.map(row).join(''):'')+(v.length?'<div class="cat">ห้องเสียง</div>'+v.map(row).join(''):'')}
async function loadMembers(){const {data}=await sb.from('members').select('user_id').eq('server_id',srv.id);const ids=(data||[]).map(x=>x.user_id);
  const {data:us}=ids.length?await sb.from('profiles').select('*').in('id',ids):{data:[]};members=us||[];members.forEach(u=>P[u.id]=u);buildMention();renderMembers()}
function renderMembers(){const s=[...members].sort((a,b)=>(online.has(b.id)-online.has(a.id))||(rank(b)-rank(a)));const n=s.filter(u=>online.has(u.id)).length;
  $('#mem').innerHTML=`<div class="cat">ออนไลน์ ${n} · ทั้งหมด ${s.length}</div>`+s.map(u=>`<div class="u ${online.has(u.id)?'':'off'}" onclick="showProfile('${u.id}')">${avatar(u,'sm')}<div style="min-width:0"><div>${name(u)}</div><div>${badge(u)}</div></div></div>`).join('')}
window.pickCh=async id=>{
  ch=chs.find(c=>c.id==id);if(!ch)return;lastCh[srv.id]=id;closeNav();renderChans();$('#chName').innerHTML=`${icon(ch)} ${esc(ch.name)}`;
  const v=ch.kind=='voice';$('#vcBtn').classList.toggle('hide',!v);$('#vcBtn').textContent=(vch&&vchId==ch.id)?'📴 ออกจากห้อง':'🎤 เข้าห้องเสียง';$('#send').classList.toggle('hide',v||!canPost());
  if(sub){sb.removeChannel(sub);sub=null}MC={};
  if(v){$('#msgs').innerHTML=`<div class="empty">🔊<h3>${esc(ch.name)}</h3><p>กด “เข้าห้องเสียง” — เข้าได้ไม่จำกัดจำนวนคน</p></div>`;return}
  $('#msgs').innerHTML='<div class="skel"></div><div class="skel"></div><div class="skel"></div>';
  const cur=ch.id,{data,error}=await sb.from('messages').select('*,reactions(*)').eq('channel_id',id).order('created_at',{ascending:false}).limit(80);
  if(ch?.id!=cur)return;if(error){$('#msgs').innerHTML='';return toast('โหลดข้อความไม่สำเร็จ: '+error.message,'err')}
  $('#msgs').innerHTML='';const list=(data||[]).reverse();await Promise.all([...new Set(list.map(m=>m.user_id))].map(u=>user(u)));for(const m of list)await addMsg(m,true);
  if(!list.length)$('#msgs').innerHTML=`<div class="empty">✨<h3>เริ่มต้นที่ #${esc(ch.name)}</h3><p>ยังไม่มีข้อความ ทักทายคนแรกเลย</p></div>`;$('#msgs').scrollTop=1e9;
  sub=sb.channel('c'+id).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:'channel_id=eq.'+id},p=>addMsg({...p.new,reactions:[]}))
   .on('postgres_changes',{event:'DELETE',schema:'public',table:'messages'},p=>document.getElementById('m'+p.old.id)?.remove())
   .on('postgres_changes',{event:'*',schema:'public',table:'reactions'},async p=>{const mid=p.new?.message_id||p.old?.message_id;if(!mid||!document.getElementById('m'+mid))return;const {data}=await sb.from('reactions').select('*').eq('message_id',mid);drawRx(mid,data||[])}).subscribe()};
window.delCh=async id=>{if(!confirm('ลบห้องนี้และข้อความทั้งหมด?'))return;try{must(await sb.from('channels').delete().eq('id',id).select());toast('ลบห้องแล้ว','ok');if(vchId==id)leave();pickSrv(srv.id)}catch(x){toast(x.message,'err')}};
// ---------- Messages ----------
const atBottom=()=>{const e=$('#msgs');return e.scrollHeight-e.scrollTop-e.clientHeight<160};
async function addMsg(m,init){if(document.getElementById('m'+m.id)||(ch&&m.channel_id!=ch.id))return;MC[m.id]=m;$('#msgs .empty')?.remove();
  const u=await user(m.user_id);let rp='';
  if(m.reply_to){let r=MC[m.reply_to];if(!r){const {data}=await sb.from('messages').select('id,content,user_id,file_name').eq('id',m.reply_to).maybeSingle();r=data}if(r){const ru=await user(r.user_id);rp=`<div class="rep">↪ <b>${dn(ru)}</b> ${esc((r.content||r.file_name||'ไฟล์').slice(0,70))}</div>`}}
  const f=m.file_url?(/\.(png|jpe?g|gif|webp|avif)$/i.test(m.file_url)?`<img class="msg" loading="lazy" src="${esc(m.file_url)}" onclick="viewImg('${esc(m.file_url)}')">`:`<a class="file" href="${esc(m.file_url)}" target="_blank" rel="noopener">📎 ${esc(m.file_name||'ไฟล์')}</a>`):'';
  const men=m.user_id!=me.id&&((m.content||'').includes('@'+me.alias)||(m.content||'').includes('@everyone'));const stick=!init&&(atBottom()||m.user_id==me.id);
  const el=document.createElement('div');el.className='m'+(men?' me-men':'');el.id='m'+m.id;
  el.innerHTML=`${avatar(u)}<div class="b">${rp}<span class="nm" onclick="showProfile('${u?.id}')">${name(u)}</span>${badge(u)} <span class="mu">${tm(m.created_at)}</span><div>${fmt(m.content)}</div>${f}<div class="rxs"></div></div>
  <div class="act"><button title="ตอบกลับ" onclick="setReply('${m.id}')">↪</button><button title="รีแอค" onclick="emojiFor('${m.id}')">😀</button>${m.user_id==me.id||rank(me)>=2||isMgr()?`<button title="ลบ" onclick="delMsg('${m.id}')">🗑</button>`:''}</div>`;
  $('#msgs').appendChild(el);drawRx(m.id,m.reactions||[]);if(stick)$('#msgs').scrollTop=1e9}
function drawRx(id,rs){const g={};rs.forEach(r=>(g[r.emoji]??=[]).push(r.user_id));const el=document.querySelector('#m'+id+' .rxs');if(el)el.innerHTML=Object.entries(g).map(([e,u])=>`<span class="rx ${u.includes(me.id)?'me':''}" onclick="toggleRx('${id}','${e}')">${e} ${u.length}</span>`).join('')}
window.toggleRx=async(id,e)=>{closeModal();const {data}=await sb.from('reactions').select('*').eq('message_id',id);const has=(data||[]).some(r=>r.emoji==e&&r.user_id==me.id);
  const r=has?await sb.from('reactions').delete().match({message_id:id,user_id:me.id,emoji:e}):await sb.from('reactions').insert({message_id:id,user_id:me.id,emoji:e});if(r.error)return toast(r.error.message,'err');
  const {data:d2}=await sb.from('reactions').select('*').eq('message_id',id);drawRx(id,d2||[])};
window.emojiFor=id=>openModal(`<h3>รีแอค</h3><div class="grid">${EMO.map(e=>`<button onclick="toggleRx('${id}','${e}')">${e}</button>`).join('')}</div>`);
$('#emo').onclick=()=>openModal(`<h3>อีโมจิ</h3><div class="grid">${EMO.map(e=>`<button onclick="insEmo('${e}')">${e}</button>`).join('')}</div>`);window.insEmo=e=>{$('#txt').value+=e;closeModal();$('#txt').focus()};
window.delMsg=async id=>{try{must(await sb.from('messages').delete().eq('id',id).select());document.getElementById('m'+id)?.remove()}catch(x){toast('ลบไม่ได้: '+x.message,'err')}};
window.setReply=id=>{replyTo=id;const m=MC[id];$('#reply').classList.remove('hide');$('#reply').innerHTML=`<span style="flex:1">↪ ตอบกลับ ${dn(P[m?.user_id])}: ${esc((m?.content||m?.file_name||'').slice(0,60))}</span><button class="ib" type="button" onclick="replyTo=null;$('#reply').classList.add('hide')">✕</button>`;$('#txt').focus()};
window.setPend=f=>{pend=f;const c=$('#chip');if(!f){c.classList.add('hide');return}c.classList.remove('hide');c.innerHTML=`${f.type.startsWith('image/')?`<img src="${URL.createObjectURL(f)}">`:'📎'}<span>${esc(f.name)}</span><button class="ib" type="button" onclick="setPend(null)">✕</button>`};
$('#file').onchange=e=>{setPend(e.target.files[0]||null);e.target.value=''};
$('#txt').addEventListener('paste',e=>{const f=e.clipboardData?.files?.[0];if(f){e.preventDefault();setPend(f)}});
$('#chatView').addEventListener('dragover',e=>e.preventDefault());$('#chatView').addEventListener('drop',e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f&&ch&&canPost())setPend(f)});
$('#txt').oninput=()=>{const m=/@([^\s@]*)$/.exec($('#txt').value),b=$('#mpop');if(!m)return b.classList.add('hide');const q=m[1].toLowerCase(),l=[{alias:'everyone'},...members].filter(u=>u.alias&&u.alias.toLowerCase().startsWith(q)).slice(0,6);if(!l.length)return b.classList.add('hide');b.innerHTML=l.map(u=>`<div data-a="${esc(u.alias)}">@${esc(u.alias)}</div>`).join('');b.classList.remove('hide')};
$('#mpop').onclick=e=>{const a=e.target.dataset?.a;if(!a)return;const t=$('#txt');t.value=t.value.replace(/@([^\s@]*)$/,'@'+a+' ');$('#mpop').classList.add('hide');t.focus()};
const spam=t=>/(.)\1{24,}/.test(t);
$('#send').onsubmit=async e=>{e.preventDefault();if(!ch||ch.kind=='voice')return;const content=$('#txt').value.trim();if(!content&&!pend)return;if(spam(content))return toast('ข้อความคล้ายสแปม','err');
  const btn=$('.go');btn.disabled=true;
  try{const row={channel_id:ch.id,user_id:me.id,content,reply_to:replyTo};
   if(pend){let f=pend;if(f.type.startsWith('image/'))f=await shrink(f,2048);row.file_url=await upload(f);row.file_name=pend.name}
   const {data,error}=await sb.from('messages').insert(row).select().single();if(error)throw error;
   $('#txt').value='';setPend(null);replyTo=null;$('#reply').classList.add('hide');$('#mpop').classList.add('hide');await addMsg({...data,reactions:[]})}
  catch(x){toast('ส่งไม่สำเร็จ: '+x.message,'err')}finally{btn.disabled=false}};
// ---------- Voice (WebRTC mesh, perfect negotiation) — ไม่จำกัดจำนวนคน ----------
let vch,vchId,peers={},mic,screen;const ICE={iceServers:C.ICE||[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}]};
function vcCount(){const ids=[me.id,...Object.keys(peers)];$('#vcInfo')&&($('#vcInfo').innerHTML=`🔊 ในห้อง ${ids.length} คน `+ids.map(i=>`<span class="chipu">${dn(P[i])}</span>`).join(''))}
$('#vcBtn').onclick=async()=>{if(vch&&vchId==ch.id)return leave();if(vch)leave();await joinVoice()};
async function joinVoice(){
  try{mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}})}catch{return toast('ต้องอนุญาตไมค์ และเปิดเว็บผ่าน https','err')}
  vchId=ch.id;$('#vcBtn').textContent='📴 ออกจากห้อง';['#scr','#mute'].forEach(s=>$(s).classList.remove('hide'));$('#vc').classList.remove('hide');$('#vc').innerHTML='<div id="vcInfo"></div>';vcCount();
  vch=sb.channel('voice:'+vchId,{config:{presence:{key:me.id},broadcast:{self:false}}});
  vch.on('broadcast',{event:'sig'},({payload:p})=>{if(p.to==me.id)onSig(p)}).on('presence',{event:'join'},({key})=>{if(key!=me.id){user(key).then(vcCount);pc(key)}}).on('presence',{event:'leave'},({key})=>drop(key))
   .subscribe(s=>{if(s=='SUBSCRIBED')vch.track({u:me.id})})}
const sig=(to,x)=>vch&&vch.send({type:'broadcast',event:'sig',payload:{to,from:me.id,...x}});
function pc(id){if(peers[id])return peers[id].p;const p=new RTCPeerConnection(ICE),st={p,polite:me.id<id,making:false,ignore:false,els:[]};peers[id]=st;vcCount();
  mic.getTracks().forEach(t=>p.addTrack(t,mic));if(screen)screen.getTracks().forEach(t=>p.addTrack(t,screen));
  p.onicecandidate=e=>e.candidate&&sig(id,{c:e.candidate});
  p.ontrack=e=>{const s=e.streams[0];if(!s)return;let v=document.getElementById('s'+s.id);if(!v){v=document.createElement('video');v.id='s'+s.id;v.autoplay=true;v.playsInline=true;v.srcObject=s;$('#vc').appendChild(v);st.els.push(v);s.onremovetrack=()=>{if(!s.getTracks().length)v.remove()}}v.style.display=s.getVideoTracks().length?'':'none';v.play?.().catch(()=>{})};
  p.onnegotiationneeded=async()=>{try{st.making=true;await p.setLocalDescription();sig(id,{d:p.localDescription})}catch(e){console.warn(e)}finally{st.making=false}};
  p.onconnectionstatechange=()=>{if(p.connectionState=='failed')p.restartIce()};return p}
async function onSig(m){pc(m.from);const s=peers[m.from],p=s.p;
  try{if(m.d){const col=m.d.type=='offer'&&(s.making||p.signalingState!='stable');s.ignore=!s.polite&&col;if(s.ignore)return;await p.setRemoteDescription(m.d);if(m.d.type=='offer'){await p.setLocalDescription();sig(m.from,{d:p.localDescription})}}
   else if(m.c){try{await p.addIceCandidate(m.c)}catch(e){if(!s.ignore)throw e}}}catch(e){console.warn(e)}}
function drop(id){const s=peers[id];if(!s)return;s.p.close();s.els.forEach(v=>v.remove());delete peers[id];vch&&vcCount()}
function leave(){stopScreen();Object.keys(peers).forEach(drop);mic?.getTracks().forEach(t=>t.stop());vch&&sb.removeChannel(vch);vch=null;vchId=null;$('#vc').innerHTML='';$('#vc').classList.add('hide');['#scr','#mute'].forEach(s=>$(s).classList.add('hide'));$('#vcBtn').textContent='🎤 เข้าห้องเสียง'}
$('#mute').onclick=()=>{const t=mic?.getAudioTracks()[0];if(!t)return;t.enabled=!t.enabled;$('#mute').textContent=t.enabled?'🔇 ปิดไมค์':'🎙 เปิดไมค์'};
function stopScreen(){if(!screen)return;const tr=screen.getTracks();tr.forEach(t=>t.stop());Object.values(peers).forEach(st=>st.p.getSenders().filter(s=>s.track&&tr.includes(s.track)).forEach(s=>st.p.removeTrack(s)));screen=null;$('#scr').textContent='🖥 แชร์จอ'}
$('#scr').onclick=async()=>{if(screen)return stopScreen();try{screen=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true})}catch{return toast('แชร์หน้าจอไม่ได้ (บางเบราว์เซอร์บนมือถือไม่รองรับ)','err')}
  screen.getVideoTracks()[0].onended=stopScreen;Object.values(peers).forEach(st=>screen.getTracks().forEach(t=>st.p.addTrack(t,screen)));$('#scr').textContent='⏹ หยุดแชร์'};
addEventListener('pagehide',()=>vch&&leave());
// ---------- Profile ----------
window.showProfile=async id=>{
  const u=await user(id,true);if(!u)return toast('ไม่พบผู้ใช้','err');const own=id==me.id,{data:ps}=await sb.from('posts').select('*').eq('user_id',id).order('created_at',{ascending:false}).limit(20);const rs=srv?roleOf(id):[];
  openModal(`<div class="ban" style="${u.banner_url?`background-image:url('${esc(u.banner_url)}')`:''}">${own?`<label class="edit">🖼 เปลี่ยนพื้นหลัง<input type="file" accept="image/*" hidden onchange="setImg('banner_url',this.files[0])"></label>`:''}</div>
  <div class="pfh"><div class="av xl ${online.has(id)?'on':''}" ${u.avatar_url?`style="background-image:url('${esc(u.avatar_url)}')"`:''}>${u.avatar_url?'':esc((u.alias||'?')[0].toUpperCase())}${own?`<label class="cam" title="เปลี่ยนรูปโปรไฟล์">📷<input type="file" accept="image/*" hidden onchange="setImg('avatar_url',this.files[0])"></label>`:''}</div>
  <div><h3 style="margin:0">${dn(u)} ${badge(u)}</h3><span class="mu">${esc(u.display_name)} (xbox) · อายุ ${esc(u.age)} · ${LABEL[u.status]}</span></div></div>
  ${rs.length?`<div class="row">${rs.map(r=>`<span class="tag" style="background:${/^#[0-9a-f]{6}$/i.test(r.color)?r.color:'#5865f2'}">${esc(r.name)}</span>`).join('')}</div>`:''}
  ${own?`<label>นามแฝง<input id="pa" value="${esc(u.alias)}" maxlength="32"></label><label>ชื่อ (xbox)<input id="px" value="${esc(u.display_name)}" maxlength="32"></label><label>อธิบายโปรไฟล์<textarea id="bio" rows="3" maxlength="500">${esc(u.bio)}</textarea></label><button onclick="saveProfile()">บันทึกโปรไฟล์</button>
  ${u.verified?'':`<h3>ยืนยันตัวตน</h3><p class="mu">ต้องมีช่องสตรีมหรือช่องติดตามที่มีผู้ติดตามอย่างน้อย 200 คน</p><div class="row"><input id="vu" placeholder="ลิงก์ช่อง"><input id="vf" type="number" placeholder="ผู้ติดตาม" style="max-width:130px"><button onclick="reqVerify()">ส่งคำขอ</button></div>`}
  <h3>โพสต์ใหม่</h3><textarea id="pt" rows="2" placeholder="เขียนอะไรสักหน่อย…"></textarea><div class="row"><input type="file" id="pi" accept="image/*"><button onclick="newPost('profile')">โพสต์</button></div>`:`<p>${esc(u.bio)||'<span class="mu">ยังไม่มีคำอธิบาย</span>'}</p>`}
  <h3>โพสต์</h3>${(ps||[]).map(p=>postHtml(p,u)).join('')||'<span class="mu">ยังไม่มีโพสต์</span>'}`)};
window.saveProfile=async()=>{const alias=$('#pa').value.trim(),x=$('#px').value.trim();if(!alias||!x)return toast('กรอกนามแฝงและชื่อ','err');
  try{const d=must(await sb.from('profiles').update({alias,display_name:x,xbox_name:x,bio:$('#bio').value}).eq('id',me.id).select());me=d[0];P[me.id]=me;renderMe();srv&&loadMembers();toast('บันทึกแล้ว','ok')}catch(e){toast('บันทึกไม่ได้: '+e.message,'err')}};
window.setImg=async(k,f)=>{if(!f)return;if(!f.type.startsWith('image/'))return toast('เลือกไฟล์รูปภาพเท่านั้น','err');toast('กำลังอัปโหลด…');
  try{const url=await upload(await shrink(f,k=='avatar_url'?512:1600)),d=must(await sb.from('profiles').update({[k]:url}).eq('id',me.id).select());me=d[0];P[me.id]=me;toast('อัปเดตรูปแล้ว','ok');renderMe();srv&&renderMembers();showProfile(me.id)}catch(e){toast('อัปโหลดไม่สำเร็จ: '+e.message,'err')}};
window.reqVerify=async()=>{const n=+$('#vf').value;if(n<200)return toast('ต้องมีผู้ติดตามอย่างน้อย 200 คน','err');const r=await sb.from('verify_requests').insert({user_id:me.id,channel_url:$('#vu').value.trim(),followers:n});r.error?toast(r.error.message,'err'):toast('ส่งคำขอแล้ว รอทีมงานตรวจสอบ','ok')};
const postHtml=(p,u)=>`<div class="panel post">${avatar(u,'sm')}<div class="b"><b>${dn(u)}</b> ${badge(u)} <span class="mu">${tm(p.created_at)}</span>${p.user_id==me.id||rank(me)>=3?` <a href="#" class="mu" onclick="delPost('${p.id}');return false">ลบ</a>`:''}<div>${fmt(p.content)}</div>${p.image_url?`<img src="${esc(p.image_url)}" loading="lazy" onclick="viewImg('${esc(p.image_url)}')">`:''}</div></div>`;
window.newPost=async from=>{const t=$('#pt').value.trim(),f=$('#pi').files[0];if(!t&&!f)return toast('เขียนข้อความหรือเลือกรูป','err');
  try{const img=f?await upload(await shrink(f,2048)):null;const r=await sb.from('posts').insert({user_id:me.id,content:t,image_url:img});if(r.error)throw r.error;toast('โพสต์แล้ว','ok');from=='home'?loadHome():showProfile(me.id)}catch(e){toast('โพสต์ไม่สำเร็จ: '+e.message,'err')}};
window.delPost=async id=>{try{must(await sb.from('posts').delete().eq('id',id).select());toast('ลบโพสต์แล้ว','ok');view=='home'?loadHome():closeModal()}catch(e){toast(e.message,'err')}};
// ---------- Home (ฟีด + ทีมงาน/พันธมิตร) ----------
window.showHome=async()=>{view='home';srv=null;closeNav();$('#app').classList.add('home');$('#chatView').classList.add('hide');$('#homeView').classList.remove('hide');if(sub){sb.removeChannel(sub);sub=null}renderRail();await loadHome();
  homeSub||(homeSub=sb.channel('posts').on('postgres_changes',{event:'*',schema:'public',table:'posts'},()=>view=='home'&&loadHome()).subscribe())};
async function loadHome(){const [{data:ps},{data:tl}]=await Promise.all([sb.from('posts').select('*').order('created_at',{ascending:false}).limit(40),sb.from('team_list').select('*').order('name')]);
  await Promise.all([...new Set((ps||[]).map(p=>p.user_id))].map(i=>user(i)));const L=k=>(tl||[]).filter(x=>x.kind==k).map(x=>`<div class="row" style="padding:4px 0">${x.link?`<a href="${esc(x.link)}" target="_blank" rel="noopener">${esc(x.name)}</a>`:esc(x.name)}</div>`).join('')||'<span class="mu">ยังไม่มี</span>';
  if(view!='home')return;$('#homeView').innerHTML=`<div class="home2"><div><h2 style="margin-top:0">หน้าหลัก <b class="x">RolePlay Civitas</b></h2>
  <div class="panel"><textarea id="pt" rows="2" placeholder="มีอะไรอยากบอกชาว Civitas?"></textarea><div class="row" style="margin-top:8px"><input type="file" id="pi" accept="image/*"><button onclick="newPost('home')">โพสต์</button></div></div>
  ${(ps||[]).map(p=>postHtml(p,P[p.user_id])).join('')||'<div class="empty">📝<h3>ยังไม่มีโพสต์</h3></div>'}</div>
  <div><div class="panel"><h3 style="margin-top:0">ทีมงาน</h3>${L('staff')}</div><div class="panel"><h3 style="margin-top:0">พันธมิตร</h3>${L('partner')}</div><button class="g" onclick="srvMenu()" style="width:100%">＋ สร้าง / เข้าร่วมชุมชน</button></div></div>`}
// ---------- สร้าง / เข้าร่วม / ตั้งค่าชุมชน ----------
window.srvMenu=()=>openModal(`<h3>สร้างชุมชนของคุณ</h3><label>ชื่อชุมชน<input id="sn" maxlength="40"></label><label>ไอคอน (ไม่บังคับ)<input type="file" id="si" accept="image/*"></label><button onclick="mkSrv(this)">สร้างชุมชน</button>
  <h3>เข้าร่วมชุมชน</h3>${allSrv.filter(s=>!srvs.find(x=>x.id==s.id)).map(s=>`<div class="row"><div class="av sm" ${s.icon_url?`style="background-image:url('${esc(s.icon_url)}')"`:''}>${s.icon_url?'':esc(s.name[0])}</div><b style="flex:1">${esc(s.name)}</b><button onclick="joinSrv('${s.id}')">เข้าร่วม</button></div>`).join('')||'<span class="mu">ยังไม่มีชุมชนให้เข้าร่วม</span>'}`);
window.mkSrv=async b=>{const n=$('#sn').value.trim();if(!n)return toast('ใส่ชื่อชุมชน','err');b.disabled=true;
  try{const f=$('#si').files[0],icon=f?await upload(await shrink(f,256)):null,{data,error}=await sb.from('servers').insert({name:n,owner:me.id,icon_url:icon}).select().single();if(error)throw error;
   const r1=await sb.from('members').insert({server_id:data.id,user_id:me.id});if(r1.error)throw r1.error;
   const r2=await sb.from('channels').insert([{server_id:data.id,name:'welcome',kind:'text'},{server_id:data.id,name:'ประกาศ',kind:'announce'},{server_id:data.id,name:'general',kind:'text'},{server_id:data.id,name:'ห้องเสียง',kind:'voice'}]);if(r2.error)throw r2.error;
   closeModal();toast('สร้างชุมชนแล้ว','ok');await loadServers(data.id)}catch(x){toast('สร้างไม่สำเร็จ: '+x.message,'err');b.disabled=false}};
window.joinSrv=async id=>{const r=await sb.from('members').insert({server_id:id,user_id:me.id});if(r.error)return toast(r.error.message,'err');closeModal();toast('เข้าร่วมแล้ว','ok');await loadServers(id)};
window.srvAdmin=()=>{if(!isMgr())return openModal(`<h3>${esc(srv.name)}</h3><button class="d" onclick="leaveSrv()">ออกจากชุมชน</button>`);
  const mo=members.map(u=>`<option value="${u.id}">${dn(u)}</option>`).join(''),ro=roles.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('');
  openModal(`<h3>ตั้งค่าชุมชน</h3><label>ชื่อชุมชน<input id="sn" value="${esc(srv.name)}" maxlength="40"></label><label>เปลี่ยนไอคอน<input type="file" id="si" accept="image/*"></label><button onclick="saveSrv()">บันทึก</button>
  <h3>สร้างห้อง</h3><div class="row"><input id="cn" placeholder="ชื่อห้อง"><select id="ck"><option value="text">ข้อความ</option><option value="voice">เสียง</option><option value="announce">ประกาศ</option></select><button onclick="addCh()">เพิ่ม</button></div>
  <h3>ยศในชุมชน</h3>${roles.map(r=>`<div class="row"><span class="tag" style="background:${/^#[0-9a-f]{6}$/i.test(r.color)?r.color:'#5865f2'}">${esc(r.name)}</span><span class="sp"></span><button class="d" onclick="delRole('${r.id}')">ลบ</button></div>`).join('')||'<span class="mu">ยังไม่มียศ</span>'}
  <div class="row"><input id="rn" placeholder="ชื่อยศ"><input id="rc" type="color" value="#7c5cff"><button onclick="addRole()">สร้างยศ</button></div>
  <div class="row"><select id="ru">${mo}</select><select id="rr">${ro}</select><button onclick="giveRole(1)">มอบ</button><button class="g" onclick="giveRole(0)">ถอน</button></div>
  ${srv.owner==me.id||rank(me)==5?'<h3>โซนอันตราย</h3><button class="d" onclick="delSrv()">ลบชุมชนนี้ทั้งหมด</button>':'<button class="d" onclick="leaveSrv()">ออกจากชุมชน</button>'}`)};
const reSrv=async()=>{const id=srv.id;await loadServers(id);srvAdmin()};
window.saveSrv=async()=>{const n=$('#sn').value.trim();if(!n)return toast('ใส่ชื่อ','err');try{const f=$('#si').files[0],p={name:n};if(f)p.icon_url=await upload(await shrink(f,256));must(await sb.from('servers').update(p).eq('id',srv.id).select());toast('บันทึกแล้ว','ok');await reSrv()}catch(x){toast(x.message,'err')}};
window.addCh=async()=>{const n=$('#cn').value.trim().toLowerCase().replace(/\s+/g,'-');if(!n)return toast('ใส่ชื่อห้อง','err');const r=await sb.from('channels').insert({server_id:srv.id,name:n,kind:$('#ck').value});if(r.error)return toast(r.error.message,'err');toast('เพิ่มห้องแล้ว','ok');await pickSrv(srv.id);srvAdmin()};
window.addRole=async()=>{const n=$('#rn').value.trim();if(!n)return toast('ใส่ชื่อยศ','err');const r=await sb.from('roles').insert({server_id:srv.id,name:n,color:$('#rc').value});if(r.error)return toast(r.error.message,'err');await pickSrv(srv.id);srvAdmin()};
window.delRole=async id=>{const r=await sb.from('roles').delete().eq('id',id);if(r.error)return toast(r.error.message,'err');await pickSrv(srv.id);srvAdmin()};
window.giveRole=async g=>{const u=$('#ru').value,r=$('#rr').value;if(!u||!r)return toast('เลือกสมาชิกและยศ','err');const x=g?await sb.from('member_roles').upsert({server_id:srv.id,user_id:u,role_id:r}):await sb.from('member_roles').delete().match({user_id:u,role_id:r});if(x.error)return toast(x.error.message,'err');toast(g?'มอบยศแล้ว':'ถอนยศแล้ว','ok');await pickSrv(srv.id);srvAdmin()};
window.delSrv=async()=>{if(!confirm('ลบชุมชนนี้ถาวร?'))return;try{must(await sb.from('servers').delete().eq('id',srv.id).select());closeModal();srv=null;toast('ลบชุมชนแล้ว','ok');await loadServers()}catch(x){toast(x.message,'err')}};
window.leaveSrv=async()=>{if(!confirm('ออกจากชุมชนนี้?'))return;const r=await sb.from('members').delete().match({server_id:srv.id,user_id:me.id});if(r.error)return toast(r.error.message,'err');closeModal();srv=null;await loadServers()};
// ---------- หลังบ้าน ----------
window.adminPanel=async q=>{q=typeof q=='string'?q.toLowerCase():'';const R=rank(me),[{data:us},{data:vr},{data:tl}]=await Promise.all([sb.from('profiles').select('*').order('created_at',{ascending:false}).limit(300),R>=4?sb.from('verify_requests').select('*').order('created_at',{ascending:false}).limit(30):{data:[]},sb.from('team_list').select('*').order('name')]);
  (us||[]).forEach(u=>P[u.id]=u);const list=(us||[]).filter(u=>!q||(u.alias+' '+u.display_name).toLowerCase().includes(q));
  openModal(`<h3>หลังบ้าน (${LABEL[me.status]})</h3>
  ${R>=3?`<h3>ทีมงาน / พันธมิตร</h3>${(tl||[]).map(x=>`<div class="row">${x.kind=='staff'?'👤':'🤝'} ${esc(x.name)}<span class="sp"></span><button class="d" onclick="delTeam('${x.id}')">ลบ</button></div>`).join('')}<div class="row"><input id="tn" placeholder="ชื่อ"><input id="tl" placeholder="ลิงก์ (ไม่บังคับ)"><select id="tk"><option value="staff">ทีมงาน</option><option value="partner">พันธมิตร</option></select><button onclick="addTeam()">เพิ่ม</button></div>`:''}
  ${(vr||[]).length?`<h3>คำขอยืนยันตัวตน</h3>${vr.map(v=>`<div class="row">${dn(P[v.user_id])} · ${v.followers} ผู้ติดตาม · <a href="${esc(v.channel_url)}" target="_blank" rel="noopener">ช่อง</a><span class="sp"></span>${R==5?`<button onclick="setV('${v.user_id}',true,'${v.id}')">อนุมัติ ✔</button>`:''}</div>`).join('')}`:''}
  <h3>สมาชิก (${list.length})</h3><input placeholder="ค้นหาชื่อ…" value="${esc(q)}" onchange="adminPanel(this.value)">
  ${list.map(u=>`<div class="row">${avatar(u,'sm')}<div style="flex:1;min-width:110px">${name(u)} ${u.banned?'🚫':''}</div>${R>=4?`<select style="max-width:130px" onchange="setSt('${u.id}',this.value)">${Object.entries(LABEL).map(([k,v])=>`<option value="${k}" ${u.status==k?'selected':''} ${(R<5&&(RANK[k]>2||RANK[u.status]>2))?'disabled':''}>${v}</option>`).join('')}</select>`:''}
  ${R==5&&u.id!=me.id?`<button class="g" onclick="setV('${u.id}',${!u.verified})">${u.verified?'ถอน✔':'✔'}</button><button class="g" onclick="ban('${u.id}',${!u.banned})">${u.banned?'ปลดแบน':'แบน'}</button><button class="g" onclick="blk('${u.id}')">บัญชีดำ</button><button class="d" onclick="delU('${u.id}')">ลบ</button>`:''}</div>`).join('')}`)};
const upd=async(id,p)=>{try{must(await sb.from('profiles').update(p).eq('id',id).select());delete P[id];toast('ทำรายการแล้ว','ok');return true}catch(e){toast(e.message,'err')}};
window.setSt=(id,s)=>upd(id,{status:s});window.ban=async(id,b)=>{await upd(id,{banned:b});adminPanel()};
window.setV=async(id,v,rid)=>{if(await upd(id,{verified:v})&&rid)await sb.from('verify_requests').delete().eq('id',rid);adminPanel()};
window.blk=async id=>{if(!confirm('ใส่บัญชีดำ (แบนและสมัครใหม่ไม่ได้)?'))return;const {data}=await sb.from('user_emails').select('email').eq('id',id).maybeSingle();if(data)await sb.from('blacklist').upsert({email:data.email.toLowerCase()});await upd(id,{banned:true});adminPanel()};
window.delU=async id=>{if(!confirm('ลบโปรไฟล์นี้ถาวร?'))return;try{must(await sb.from('profiles').delete().eq('id',id).select());toast('ลบแล้ว','ok');adminPanel()}catch(e){toast(e.message,'err')}};
window.addTeam=async()=>{const n=$('#tn').value.trim();if(!n)return toast('ใส่ชื่อ','err');const r=await sb.from('team_list').insert({kind:$('#tk').value,name:n,link:$('#tl').value.trim()||null});r.error?toast(r.error.message,'err'):(toast('เพิ่มแล้ว','ok'),adminPanel())};
window.delTeam=async id=>{await sb.from('team_list').delete().eq('id',id);adminPanel()};
// ---------- Mobile / layout ----------
$('#menu').onclick=()=>{$('#app').classList.add('nav');$('#scrim').classList.remove('hide')};$('#scrim').onclick=closeNav;
$('#memBtn').onclick=async()=>{const a=$('#app');if(innerWidth>=1100)a.classList.toggle('nomem');else{a.classList.toggle('memo');$('#scrim').classList.toggle('hide',!a.classList.contains('memo'))}srv&&loadMembers()};
boot();
