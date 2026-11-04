const $=s=>document.querySelector(s), esc=t=>String(t??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const LS=(()=>{try{return JSON.parse(localStorage.getItem('civ_cfg')||'null')}catch{return null}})(),C={...CFG,...(LS||{})};
const isSvc=k=>{try{return JSON.parse(atob(k.split('.')[1])).role==='service_role'}catch{return false}};
const okCfg=/^https:\/\/\S+$/.test(C.SUPABASE_URL||'')&&!/YOUR-/.test(C.SUPABASE_URL+C.SUPABASE_ANON_KEY)&&(C.SUPABASE_ANON_KEY||'').length>20&&!isSvc(C.SUPABASE_ANON_KEY);
const sb=okCfg?supabase.createClient(C.SUPABASE_URL.replace(/\/+$/,''),C.SUPABASE_ANON_KEY):null;
const em=m=>/fetch|network/i.test(m)?'เชื่อมต่อ Supabase ไม่ได้ — ตรวจ Project URL/anon key (กด ⚙ ตั้งค่า) และดูว่าโปรเจกต์ไม่ถูก pause':/rate limit|seconds|too many/i.test(m)?'ขอรหัสถี่เกินไปหรือเกินโควตาอีเมล รอสักครู่ (ถ้าเกิดบ่อยให้ตั้ง SMTP ของตัวเองใน Supabase)':m;
window.setupCfg=()=>openModal(`<b>เชื่อมต่อ Supabase</b><p class="mu">Supabase → Project Settings → API: คัดลอก Project URL และ anon (publishable) key</p><input id="cu" placeholder="https://xxxx.supabase.co" value="${okCfg?esc(C.SUPABASE_URL):''}"><input id="ck2" placeholder="anon public key"><button onclick="saveCfg()">บันทึก</button><button onclick="localStorage.removeItem('civ_cfg');location.reload()" style="background:var(--bg);color:var(--tx)">ล้างค่า</button>`);
window.saveCfg=()=>{const u=$('#cu').value.trim().replace(/\/+$/,''),k=$('#ck2').value.trim();if(!/^https:\/\/\S+$/.test(u)||k.length<20)return alert('URL หรือ key ไม่ถูกต้อง');if(isSvc(k))return alert('นี่คือ service_role key ห้ามใช้ในเว็บ ให้ใช้ anon key');localStorage.setItem('civ_cfg',JSON.stringify({SUPABASE_URL:u,SUPABASE_ANON_KEY:k}));location.reload()};
const need=()=>{if(sb)return false;err('ยังไม่ได้ตั้งค่า Supabase');setupCfg();return true};
const RANK={member:1,staff:2,board:3,vice_ceo:4,ceo:5},LABEL={member:'สมาชิก',staff:'ทีมงาน',board:'คณะบริหาร',vice_ceo:'รองCEO',ceo:'CEO'};
const EMO=['👍','❤️','😂','😮','😢','🔥','🎉','👀'];
let me,srv,ch,srvs=[],chs=[],P={},sub,replyTo=null,pend=null;
const rank=u=>RANK[u?.status]||1, name=u=>u?`${esc(u.alias||u.display_name)} <span class="xb">(${esc(u.display_name)})</span>`:'?';
const avatar=(u,s)=>`<div class="av" ${u?.avatar_url?`style="background-image:url('${esc(u.avatar_url)}')"`:''} onclick="showProfile('${u?.id}')">${u?.avatar_url?'':esc((u?.alias||'?')[0])}</div>`;
const badge=u=>`${u?.verified?'<span class="ver" title="ยืนยันตัวตน">✔</span>':''}${rank(u)>1?`<span class="tag">${LABEL[u.status]}</span>`:''}`;
// ---------- Loading ----------
let ld=0;const li=setInterval(()=>{ld=Math.min(ld+Math.random()*12,95);$("#bar").style.width=ld+"%";$("#pct").textContent=Math.floor(ld)+"%"},120);
async function boot(){
  try{if(!sb){show('#auth');err('ยังไม่ได้ตั้งค่า Supabase — กด “⚙ ตั้งค่าการเชื่อมต่อ” ด้านล่าง')}
   else{const {data:{session}}=await sb.auth.getSession();session?await enter():show('#auth')}}catch(e){show('#auth');err(em(e.message))}
  clearInterval(li);$('#bar').style.width='100%';$('#pct').textContent='100%';setTimeout(()=>{$('#splash').style.opacity=0;setTimeout(()=>$('#splash').remove(),600)},300);
}
function show(id){['#auth','#app'].forEach(x=>$(x).classList.add('hide'));$(id).classList.remove('hide')}
// ---------- Auth (OTP ทั้งสมัครและเข้าสู่ระบบ) ----------
const err=m=>$('#err').textContent=m||'';let flow=null;
$('#tL').onclick=()=>{$('#fL').classList.remove('hide');$('#fR').classList.add('hide');$('#fO').classList.add('hide');$('#tL').classList.add('on');$('#tR').classList.remove('on')};
$('#tR').onclick=()=>{$('#fR').classList.remove('hide');$('#fL').classList.add('hide');$('#fO').classList.add('hide');$('#tR').classList.add('on');$('#tL').classList.remove('on')};
function askOtp(email,type){flow={email,type};$('#fL').classList.add('hide');$('#fR').classList.add('hide');$('#fO').classList.remove('hide');$('#otpMsg').textContent='ส่งรหัสไปที่ '+email+' แล้ว';err()}
$('#fR').onsubmit=async e=>{e.preventDefault();err();if(need())return;const f=Object.fromEntries(new FormData(e.target));f.email=f.email.trim().toLowerCase();
  try{const {data,error}=await sb.auth.signUp({email:f.email,password:f.password,options:{data:{display_name:f.display_name,age:f.age,alias:f.alias}}});
  if(error)return err(em(error.message));
  if(data.user&&data.user.identities&&data.user.identities.length==0)return err('อีเมลนี้สมัครไว้แล้ว กรุณาเข้าสู่ระบบ');
  if(data.session)return enter(); // กรณีปิด Confirm email ใน Supabase
  askOtp(f.email,'signup')}catch(x){err(em(x.message))}};
$('#fL').onsubmit=async e=>{e.preventDefault();err();if(need())return;const f=Object.fromEntries(new FormData(e.target));f.email=f.email.trim().toLowerCase();
  try{const {error}=await sb.auth.signInWithPassword(f);
  if(error){if(/not confirmed/i.test(error.message)){await sb.auth.resend({type:'signup',email:f.email});return askOtp(f.email,'signup')}return err(/invalid/i.test(error.message)?'อีเมลหรือรหัสผ่านไม่ถูกต้อง':em(error.message))}
  await sb.auth.signOut();const r=await sb.auth.signInWithOtp({email:f.email,options:{shouldCreateUser:false}});
  r.error?err(em(r.error.message)):askOtp(f.email,'email')}catch(x){err(em(x.message))}};
$('#fO').onsubmit=async e=>{e.preventDefault();err();if(need())return;const token=new FormData(e.target).get('token').trim();
  try{let r=await sb.auth.verifyOtp({email:flow.email,token,type:flow.type});
  if(r.error&&flow.type=='signup')r=await sb.auth.verifyOtp({email:flow.email,token,type:'email'});
  r.error?err('รหัสไม่ถูกต้องหรือหมดอายุ'):enter()}catch(x){err(em(x.message))}};
$('#rs').onclick=async()=>{if(!flow)return;const r=flow.type=='signup'?await sb.auth.resend({type:'signup',email:flow.email}):await sb.auth.signInWithOtp({email:flow.email,options:{shouldCreateUser:false}});err(r.error?em(r.error.message):'ส่งรหัสใหม่แล้ว')};
async function enter(){
  const {data:{user}}=await sb.auth.getUser();
  let {data}=await sb.from('profiles').select('*').eq('id',user.id).maybeSingle();
  if(!data){const m=user.user_metadata||{};const r=await sb.from('profiles').insert({id:user.id,display_name:m.display_name||user.email.split('@')[0],xbox_name:m.display_name,age:m.age,alias:m.alias||m.display_name||'user'}).select().single();data=r.data}
  me=data;if(!me||me.banned){await sb.auth.signOut();show('#auth');return err('บัญชีนี้ถูกระงับหรือโหลดโปรไฟล์ไม่ได้ (ตรวจว่ารัน schema.sql แล้ว)')}
  show('#app');await loadServers();
}
// ---------- Servers / Channels ----------
async function loadServers(){
  const [{data:s},{data:m}]=await Promise.all([sb.from('servers').select('*'),sb.from('members').select('server_id').eq('user_id',me.id)]);
  const mine=new Set((m||[]).map(x=>x.server_id));srvs=(s||[]).filter(x=>mine.has(x.id));window.allSrv=s||[];
  $('#rail').innerHTML=srvs.map(x=>`<div class="s ${srv?.id==x.id?'on':''}" title="${esc(x.name)}" onclick="pickSrv('${x.id}')">${x.icon_url?`<img src="${esc(x.icon_url)}" width=48 height=48>`:esc(x.name[0])}</div>`).join('')+`<div class="s" onclick="srvMenu()">＋</div>`;
  if(!srv&&srvs[0])pickSrv(srvs[0].id);
  $('#me').innerHTML=`${avatar(me)}<div><b>${name(me)}</b><div class="mu">${LABEL[me.status]}</div></div><span class="sp"></span><button onclick="event.stopPropagation();adminPanel()" ${rank(me)<3?'class="hide"':''}>⚙</button><button onclick="event.stopPropagation();sb.auth.signOut().then(()=>location.reload())">ออก</button>`;
  $('#me').onclick=()=>showProfile(me.id);
}
window.pickSrv=async id=>{srv=srvs.find(x=>x.id==id);$('#srvName').innerHTML=esc(srv.name)+(srv.owner==me.id||rank(me)==5?' <button onclick="srvAdmin()">จัดการ</button>':'');
  const {data}=await sb.from('channels').select('*').eq('server_id',id).order('name');chs=data||[];
  $('#chans').innerHTML=chs.map(c=>`<div class="ch" data-id="${c.id}" onclick="pickCh('${c.id}')">${c.kind=='voice'?'🔊':c.kind=='announce'?'📢':'#'} ${esc(c.name)}</div>`).join('');
  loadMembers();const f=chs.find(c=>c.kind!='voice');f&&pickCh(f.id);document.querySelectorAll('#rail .s').forEach((e,i)=>e.classList.toggle('on',srvs[i]?.id==id))};
async function loadMembers(){const {data}=await sb.from('members').select('profiles(*)').eq('server_id',srv.id);const us=(data||[]).map(x=>x.profiles).filter(Boolean);us.forEach(u=>P[u.id]=u);
  $('#mem').innerHTML=`<b>สมาชิก ${us.length}</b>`+us.map(u=>`<div class="u" onclick="showProfile('${u.id}')">${avatar(u)}<span>${name(u)}${badge(u)}</span></div>`).join('')}
window.pickCh=async id=>{ch=chs.find(c=>c.id==id);document.querySelectorAll('.ch').forEach(e=>e.classList.toggle('on',e.dataset.id==id));
  $('#side').classList.remove('open');$('#chName').textContent=ch.name;
  const v=ch.kind=='voice';$('#vcBtn').classList.toggle('hide',!v);$('#send').classList.toggle('hide',v||(ch.kind=='announce'&&rank(me)<2));$('#vcBtn').textContent=(vch&&vchId==ch.id)?'📴 ออกจากห้อง':'🎤 เข้าห้องเสียง';
  if(v){$('#msgs').innerHTML='<p class="mu" style="padding:14px">🔊 ห้องเสียง — กด “เข้าห้องเสียง” (เข้าได้ไม่จำกัดจำนวนคน)</p>';return}
  $('#msgs').innerHTML='';const {data}=await sb.from('messages').select('*,reactions(*)').eq('channel_id',id).order('created_at').limit(100);
  for(const m of data||[])await addMsg(m);$('#msgs').scrollTop=1e9;
  sub&&sb.removeChannel(sub);sub=sb.channel('c'+id).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:'channel_id=eq.'+id},async p=>{await addMsg({...p.new,reactions:[]});$('#msgs').scrollTop=1e9})
   .on('postgres_changes',{event:'*',schema:'public',table:'reactions'},async p=>{const id=p.new?.message_id||p.old?.message_id;if(!id||!document.getElementById('m'+id))return;const {data}=await sb.from('reactions').select('*').eq('message_id',id);drawRx(id,data||[])})
   .on('postgres_changes',{event:'DELETE',schema:'public',table:'messages'},p=>document.getElementById('m'+p.old.id)?.remove()).subscribe();
  $('#send').classList.toggle('hide',ch.kind=='announce'&&rank(me)<2)};
async function user(id){if(!P[id]){const {data}=await sb.from('profiles').select('*').eq('id',id).single();P[id]=data}return P[id]}
const fmt=t=>esc(t).replace(/@([^\s@]+)/g,'<span class="men">@$1</span>').replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" rel="noopener" style="color:#6ea8ff">$1</a>');
async function addMsg(m){const u=await user(m.user_id);const el=document.createElement('div');el.className='m';el.id='m'+m.id;
  let rp='';if(m.reply_to){const {data}=await sb.from('messages').select('content,user_id').eq('id',m.reply_to).maybeSingle();if(data){const r=await user(data.user_id);rp=`<div class="rep">↪ ${esc(r?.alias)}: ${esc((data.content||'ไฟล์').slice(0,60))}</div>`}}
  const f=m.file_url?(/\.(png|jpe?g|gif|webp)$/i.test(m.file_url)?`<img class="msg" src="${esc(m.file_url)}">`:`<a href="${esc(m.file_url)}" target="_blank" style="color:#6ea8ff">📎 ${esc(m.file_name)}</a>`):'';
  const mine=(m.content||'').includes('@'+(me.alias));if(mine)el.style.background='#faa61a22';
  el.innerHTML=`${avatar(u)}<div class="b">${rp}<span class="nm" onclick="showProfile('${u?.id}')">${name(u)}</span>${badge(u)} <span class="mu">${new Date(m.created_at).toLocaleString('th-TH')}</span><div>${fmt(m.content)}</div>${f}<div class="rxs"></div></div>
  <div class="act"><button onclick="setReply('${m.id}')">↪</button><button onclick="pickEmoji('${m.id}')">😀</button>${m.user_id==me.id||rank(me)>=2?`<button onclick="delMsg('${m.id}')">🗑</button>`:''}</div>`;
  $('#msgs').appendChild(el);drawRx(m.id,m.reactions||[]);if(mine&&document.hidden)try{new Notification('แท็กคุณ',{body:m.content})}catch{}}
function drawRx(id,rs){const g={};rs.forEach(r=>(g[r.emoji]??=[]).push(r.user_id));const el=document.querySelector('#m'+id+' .rxs');if(el)el.innerHTML=Object.entries(g).map(([e,u])=>`<span class="rx ${u.includes(me.id)?'me':''}" onclick="toggleRx('${id}','${e}')">${e} ${u.length}</span>`).join('')}
window.toggleRx=async(id,e)=>{const {data}=await sb.from('reactions').select('*').eq('message_id',id);const has=data.some(r=>r.emoji==e&&r.user_id==me.id);
  has?await sb.from('reactions').delete().match({message_id:id,user_id:me.id,emoji:e}):await sb.from('reactions').insert({message_id:id,user_id:me.id,emoji:e});
  const {data:d2}=await sb.from('reactions').select('*').eq('message_id',id);drawRx(id,d2)};
window.pickEmoji=id=>openModal(`<div class="row">${EMO.map(e=>`<button onclick="toggleRx('${id}','${e}');modal.classList.add('hide')">${e}</button>`).join('')}</div>`);
window.delMsg=id=>sb.from('messages').delete().eq('id',id);
window.setReply=id=>{replyTo=id;const t=document.querySelector('#m'+id+' .b div:nth-of-type(1)')?.textContent||'';$('#reply').classList.remove('hide');$('#reply').innerHTML=`ตอบกลับ: ${esc(t.slice(0,60))} <button onclick="replyTo=null;this.parentNode.classList.add('hide')">✕</button>`};
let wasm;WebAssembly.instantiateStreaming(fetch('filter.wasm'),{}).then(r=>wasm=r.instance.exports).catch(()=>{});
const spam=t=>wasm?.is_spam?false:/(.)\1{24,}/.test(t); // ถ้ามี filter.wasm (C++) จะใช้ตัวนั้นเพิ่มเติม
async function upload(file){const path=`${me.id}/${Date.now()}_${file.name.replace(/[^\w.-]/g,'_')}`;const {error}=await sb.storage.from('uploads').upload(path,file);if(error)throw error;return sb.storage.from('uploads').getPublicUrl(path).data.publicUrl}
$('#file').onchange=e=>{pend=e.target.files[0];$('#txt').placeholder=pend?'📎 '+pend.name+' (กดส่ง)':''};
$('#send').onsubmit=async e=>{e.preventDefault();const content=$('#txt').value.trim();if(!content&&!pend)return;if(spam(content))return alert('ข้อความเหมือนสแปม');
  const row={channel_id:ch.id,user_id:me.id,content,reply_to:replyTo};
  try{if(pend){row.file_url=await upload(pend);row.file_name=pend.name}}catch(x){return alert('อัปโหลดไม่สำเร็จ: '+x.message)}
  const {error}=await sb.from('messages').insert(row);if(error)return alert(error.message);
  $('#txt').value='';pend=null;$('#file').value='';$('#txt').placeholder='ส่งข้อความ... (@ชื่อ เพื่อแท็ก)';replyTo=null;$('#reply').classList.add('hide')};
// ---------- Voice (WebRTC mesh, perfect negotiation) + แชร์หน้าจอ — ไม่จำกัดจำนวนคน ----------
let vch,vchId,peers={},mic,screen;const ICE={iceServers:C.ICE||[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}]};
const vcCount=()=>{const n=Object.keys(peers).length+1;$('#vcInfo').textContent=`🔊 ในห้อง ${n} คน`};
$('#vcBtn').onclick=async()=>{if(vch&&vchId==ch.id)return leave();if(vch)leave();await joinVoice()};
async function joinVoice(){
  try{mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}})}catch{return alert('ต้องอนุญาตไมค์ และต้องเปิดเว็บผ่าน https')}
  vchId=ch.id;$('#vcBtn').textContent='📴 ออกจากห้อง';['#scr','#mute'].forEach(s=>$(s).classList.remove('hide'));$('#vc').classList.remove('hide');$('#vc').innerHTML='<div id="vcInfo" class="mu" style="width:100%"></div>';vcCount();
  vch=sb.channel('voice:'+vchId,{config:{presence:{key:me.id},broadcast:{self:false}}});
  vch.on('broadcast',{event:'sig'},({payload:p})=>{if(p.to==me.id)onSig(p)})
   .on('presence',{event:'join'},({key})=>{if(key!=me.id)pc(key)}).on('presence',{event:'leave'},({key})=>drop(key))
   .subscribe(s=>{if(s=='SUBSCRIBED')vch.track({u:me.id})})}
const sig=(to,x)=>vch&&vch.send({type:'broadcast',event:'sig',payload:{to,from:me.id,...x}});
function pc(id){if(peers[id])return peers[id].p;
  const p=new RTCPeerConnection(ICE),st={p,polite:me.id<id,making:false,ignore:false,els:[]};peers[id]=st;vcCount();
  mic.getTracks().forEach(t=>p.addTrack(t,mic));if(screen)screen.getTracks().forEach(t=>p.addTrack(t,screen));
  p.onicecandidate=e=>e.candidate&&sig(id,{c:e.candidate});
  p.ontrack=e=>{const s=e.streams[0];if(!s)return;let v=document.getElementById('s'+s.id);if(!v){v=document.createElement('video');v.id='s'+s.id;v.autoplay=true;v.playsInline=true;v.srcObject=s;$('#vc').appendChild(v);st.els.push(v);s.onremovetrack=()=>{if(!s.getTracks().length)v.remove()}}
    v.style.display=s.getVideoTracks().length?'':'none';v.play?.().catch(()=>{})};
  p.onnegotiationneeded=async()=>{try{st.making=true;await p.setLocalDescription();sig(id,{d:p.localDescription})}catch(e){console.warn(e)}finally{st.making=false}};
  p.onconnectionstatechange=()=>{if(p.connectionState=='failed')p.restartIce()};
  return p}
async function onSig(m){pc(m.from);const s=peers[m.from],p=s.p;
  try{if(m.d){const col=m.d.type=='offer'&&(s.making||p.signalingState!='stable');s.ignore=!s.polite&&col;if(s.ignore)return;
    await p.setRemoteDescription(m.d);if(m.d.type=='offer'){await p.setLocalDescription();sig(m.from,{d:p.localDescription})}}
   else if(m.c){try{await p.addIceCandidate(m.c)}catch(e){if(!s.ignore)throw e}}}catch(e){console.warn(e)}}
function drop(id){const s=peers[id];if(!s)return;s.p.close();s.els.forEach(v=>v.remove());delete peers[id];vch&&vcCount()}
function leave(){stopScreen();Object.keys(peers).forEach(drop);mic?.getTracks().forEach(t=>t.stop());vch&&sb.removeChannel(vch);vch=null;vchId=null;$('#vc').innerHTML='';$('#vc').classList.add('hide');['#scr','#mute'].forEach(s=>$(s).classList.add('hide'));$('#vcBtn').textContent='🎤 เข้าห้องเสียง'}
$('#mute').onclick=()=>{const t=mic?.getAudioTracks()[0];if(!t)return;t.enabled=!t.enabled;$('#mute').textContent=t.enabled?'🔇 ปิดไมค์':'🎙 เปิดไมค์'};
function stopScreen(){if(!screen)return;const tr=screen.getTracks();tr.forEach(t=>t.stop());Object.values(peers).forEach(st=>st.p.getSenders().filter(s=>s.track&&tr.includes(s.track)).forEach(s=>st.p.removeTrack(s)));screen=null;$('#scr').textContent='🖥 แชร์จอ'}
$('#scr').onclick=async()=>{if(screen)return stopScreen();
  try{screen=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true})}catch{return alert('แชร์หน้าจอไม่ได้ (บางเบราว์เซอร์บนมือถือไม่รองรับ)')}
  screen.getVideoTracks()[0].onended=stopScreen;Object.values(peers).forEach(st=>screen.getTracks().forEach(t=>st.p.addTrack(t,screen)));$('#scr').textContent='⏹ หยุดแชร์'};
addEventListener('pagehide',()=>vch&&leave());
// ---------- Profile / Posts / Verify ----------
function openModal(h){$('#mbody').innerHTML=h;modal.classList.remove('hide')}
window.showProfile=async id=>{const u=await user(id);const {data:ps}=await sb.from('posts').select('*').eq('user_id',id).order('created_at',{ascending:false}).limit(20);const own=id==me.id;
  openModal(`<div class="ban" style="${u.banner_url?`background-image:url('${esc(u.banner_url)}')`:''}"></div><div class="row">${avatar(u)}<div><h3 style="margin:0">${name(u)} ${badge(u)}</h3><span class="mu">${LABEL[u.status]} · อายุ ${esc(u.age)}</span></div></div><p>${esc(u.bio)||'<span class=mu>ยังไม่มีคำอธิบาย</span>'}</p>
  ${own?`<textarea id="bio" rows=3 placeholder="อธิบายโปรไฟล์">${esc(u.bio)}</textarea><div class="row"><label class="ic">รูปโปรไฟล์<input type="file" accept="image/*" hidden onchange="setImg('avatar_url',this.files[0])"></label><label class="ic">พื้นหลัง<input type="file" accept="image/*" hidden onchange="setImg('banner_url',this.files[0])"></label><button onclick="saveBio()">บันทึก</button></div>
  <b>ยืนยันตัวตน</b><div class="row"><input id="vu" placeholder="ลิงก์ช่องสตรีม/ติดตาม" style="flex:1"><input id="vf" type="number" placeholder="ผู้ติดตาม (≥200)" style="width:150px"><button onclick="reqVerify()">ส่งคำขอ</button></div>
  <b>โพสต์ใหม่</b><textarea id="pt" rows=2></textarea><div class="row"><input type="file" id="pi" accept="image/*"><button onclick="newPost()">โพสต์</button></div>`:''}
  <b>โพสต์</b>${(ps||[]).map(p=>`<div class="m"><div class="b">${fmt(p.content)}${p.image_url?`<img class="msg" src="${esc(p.image_url)}">`:''}<div class="mu">${new Date(p.created_at).toLocaleString('th-TH')}</div></div></div>`).join('')||'<span class=mu>ไม่มีโพสต์</span>'}`)};
window.setImg=async(k,f)=>{if(!f)return;const url=await upload(f);await sb.from('profiles').update({[k]:url}).eq('id',me.id);me[k]=url;P[me.id]=me;showProfile(me.id);loadServers()};
window.saveBio=async()=>{me.bio=$('#bio').value;await sb.from('profiles').update({bio:me.bio}).eq('id',me.id);showProfile(me.id)};
window.newPost=async()=>{const f=$('#pi').files[0];await sb.from('posts').insert({user_id:me.id,content:$('#pt').value,image_url:f?await upload(f):null});showProfile(me.id)};
window.reqVerify=async()=>{const n=+$('#vf').value;if(n<200)return alert('ต้องมีผู้ติดตามอย่างน้อย 200 คน');const {error}=await sb.from('verify_requests').insert({user_id:me.id,channel_url:$('#vu').value,followers:n});alert(error?error.message:'ส่งคำขอแล้ว รอทีมงานตรวจสอบ')};
// ---------- สร้าง/เข้าชุมชน ----------
window.srvMenu=()=>openModal(`<b>สร้างชุมชน</b><input id="sn" placeholder="ชื่อชุมชน"><button onclick="mkSrv()">สร้าง</button><b>เข้าร่วมชุมชน</b>${(allSrv||[]).filter(s=>!srvs.find(x=>x.id==s.id)).map(s=>`<div class="row">${esc(s.name)}<span class="sp"></span><button onclick="joinSrv('${s.id}')">เข้าร่วม</button></div>`).join('')||'<span class=mu>ไม่มี</span>'}`);
window.mkSrv=async()=>{const {data,error}=await sb.from('servers').insert({name:$('#sn').value,owner:me.id}).select().single();if(error)return alert(error.message);
  await sb.from('members').insert({server_id:data.id,user_id:me.id});await sb.from('channels').insert([{server_id:data.id,name:'general'},{server_id:data.id,name:'ห้องเสียง',kind:'voice'}]);modal.classList.add('hide');srv=null;loadServers()};
window.joinSrv=async id=>{await sb.from('members').insert({server_id:id,user_id:me.id});modal.classList.add('hide');srv=null;loadServers()};
// ---------- จัดการชุมชน: ห้อง + ยศในชุมชน ----------
window.srvAdmin=async()=>{const [{data:r},{data:m}]=await Promise.all([sb.from('roles').select('*').eq('server_id',srv.id),sb.from('members').select('profiles(id,alias)').eq('server_id',srv.id)]);
  openModal(`<b>สร้างห้อง</b><div class="row"><input id="cn" placeholder="ชื่อห้อง" style="flex:1"><select id="ck" style="width:120px"><option value="text">ข้อความ</option><option value="voice">เสียง</option><option value="announce">ประกาศ</option></select><button onclick="addCh()">เพิ่ม</button></div>
  <b>สร้างยศ</b><div class="row"><input id="rn" placeholder="ชื่อยศ" style="flex:1"><input id="rc" type="color" value="#5865f2" style="width:60px"><button onclick="addRole()">เพิ่ม</button></div>
  <b>มอบยศ</b><div class="row"><select id="ru" style="flex:1">${(m||[]).map(x=>`<option value="${x.profiles.id}">${esc(x.profiles.alias)}</option>`).join('')}</select><select id="rr" style="flex:1">${(r||[]).map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select><button onclick="giveRole()">มอบ</button></div>`)};
window.addCh=async()=>{await sb.from('channels').insert({server_id:srv.id,name:$('#cn').value,kind:$('#ck').value});modal.classList.add('hide');pickSrv(srv.id)};
window.addRole=async()=>{await sb.from('roles').insert({server_id:srv.id,name:$('#rn').value,color:$('#rc').value});srvAdmin()};
window.giveRole=async()=>{await sb.from('member_roles').upsert({server_id:srv.id,user_id:$('#ru').value,role_id:$('#rr').value});alert('มอบยศแล้ว')};
// ---------- หลังบ้าน (ทีมงานขึ้นไป) ----------
window.adminPanel=async()=>{const {data:us}=await sb.from('profiles').select('*').order('created_at',{ascending:false}).limit(100);const R=rank(me);
  openModal(`<h3>หลังบ้าน</h3>${R>=3?`<div class="row"><input id="tn" placeholder="ชื่อ" style="flex:1"><input id="tl" placeholder="ลิงก์" style="flex:1"><select id="tk"><option value="staff">ทีมงาน</option><option value="partner">พันธมิตร</option></select><button onclick="addTeam()">เพิ่มรายชื่อ</button></div>`:''}
  ${(us||[]).map(u=>`<div class="row">${name(u)} ${u.banned?'🚫':''}<span class="sp"></span>${R>=4?`<select onchange="setSt('${u.id}',this.value)">${Object.entries(LABEL).map(([k,v])=>`<option value="${k}" ${u.status==k?'selected':''} ${(R<5&&RANK[k]>2)?'disabled':''}>${v}</option>`).join('')}</select>`:''}
  ${R==5&&u.id!=me.id?`<button onclick="ban('${u.id}',${!u.banned})">${u.banned?'ปลดแบน':'แบน'}</button><button onclick="blk('${u.id}')">บัญชีดำ</button><button onclick="delU('${u.id}')">ลบ</button><button onclick="setV('${u.id}',${!u.verified})">✔</button>`:''}</div>`).join('')}`)};
window.setSt=async(id,s)=>{const {error}=await sb.from('profiles').update({status:s}).eq('id',id);error&&alert(error.message);delete P[id]};
window.ban=async(id,b)=>{await sb.from('profiles').update({banned:b}).eq('id',id);adminPanel()};
window.setV=async(id,v)=>{await sb.from('profiles').update({verified:v}).eq('id',id);adminPanel()};
window.blk=async id=>{const {data}=await sb.from('user_emails').select('email').eq('id',id).single();if(data)await sb.from('blacklist').upsert({email:data.email.toLowerCase()});await sb.from('profiles').update({banned:true}).eq('id',id);adminPanel()};
window.delU=async id=>{if(confirm('ลบโปรไฟล์นี้?')){await sb.from('profiles').delete().eq('id',id);adminPanel()}};
window.addTeam=async()=>{await sb.from('team_list').insert({kind:$('#tk').value,name:$('#tn').value,link:$('#tl').value});alert('เพิ่มแล้ว')};
// ---------- มือถือ ----------
$('#menu').onclick=()=>{$('#side').classList.toggle('open');$('#rail').classList.toggle('open')};
$('#memBtn').onclick=()=>$('#mem').classList.toggle('hide');
try{Notification.requestPermission()}catch{}
boot();
