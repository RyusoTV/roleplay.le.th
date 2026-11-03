const C=window.LE_CONFIG,sb=supabase.createClient(C.url,C.key);
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LV={member:1,staff:2,exec:3,deputy:4,ceo:5},LB={member:'สมาชิก',staff:'ทีมงาน',exec:'คณะบริหาร',deputy:'รองCEO',ceo:'CEO'};
let me,P={},S=[],srv,chan,ch,wasm,mode='in';
WebAssembly.instantiateStreaming(fetch('wasm/validate.wasm')).then(r=>wasm=r.instance.exports).catch(()=>{});
const okc=c=>wasm?wasm.ok_char(c):/[\w .-]/.test(String.fromCodePoint(c));
const name=p=>p?`${esc(p.nick)} (${esc(p.xbox)})`:'ผู้ใช้ที่ถูกลบ';
const av=(p,c='av')=>`<div class="${c}" style="${p?.avatar?`background-image:url('${esc(p.avatar)}')`:''}">${p?.avatar?'':esc((p?.nick||'?')[0])}</div>`;
const badge=p=>p?`<span class="tag">${LB[p.rank]}</span>${p.verified?'<span class="ver" title="ยืนยันตัวตนแล้ว"> ✔</span>':''}`:'';
const lvl=()=>LV[me.rank];

// Loading screen: นับ 0→100 ด้วยตัวจับเวลา ไม่ค้างที่ 0%
let pc=0;const tm=setInterval(()=>{pc=Math.min(100,pc+4);$('#fill').style.width=pc+'%';$('#pct').textContent=pc+'%';if(pc>=100){clearInterval(tm);boot()}},50);
async function boot(){const{data:{session}}=await sb.auth.getSession();session?enter():gate();$('#load').classList.add('off')}
function gate(){$('#app').hidden=true;$('#gate').hidden=false;setMode(mode)}
function setMode(m){mode=m;$('#auth').classList.toggle('in',m==='in');document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.m===m))}
document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>setMode(b.dataset.m));
$('#auth').onsubmit=async e=>{e.preventDefault();const err=t=>$('#err').textContent=t,email=$('#email').value.trim(),password=$('#pw').value;
 if(mode==='up'){const xbox=$('#xbox').value.trim(),age=+$('#age').value,nick=$('#nick').value.trim();
  if(!xbox||![...xbox].every(c=>okc(c.codePointAt(0))))return err('ชื่อ Xbox ใช้ได้เฉพาะ A-Z 0-9 เว้นวรรค _ . -');
  if(!age||!nick)return err('กรอกอายุและนามแฝงให้ครบ');
  const{data,error}=await sb.auth.signUp({email,password,options:{data:{xbox,age,nick}}});
  if(error)return err(error.message);if(!data.session)return err('สมัครแล้ว กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ');
 }else{const{error}=await sb.auth.signInWithPassword({email,password});if(error)return err('อีเมลหรือรหัสผ่านไม่ถูกต้อง')}
 err('');enter()};
async function enter(){const{data:{user}}=await sb.auth.getUser();
 await new Promise(r=>setTimeout(r,400));const{data}=await sb.from('profiles').select('*').eq('id',user.id).single();me=data;
 if(!me||me.banned||me.blacklisted){await sb.auth.signOut();gate();$('#err').textContent='บัญชีนี้ถูกระงับ หรือไม่พบโปรไฟล์';return}
 const{data:set}=await sb.from('settings').select('*');(set||[]).forEach(s=>{if(s.key==='accent')document.documentElement.style.setProperty('--ac',s.value);if(s.key==='title')document.title=s.value});
 await loadP();$('#gate').hidden=true;$('#app').hidden=false;await loadS();pick(S[0])}
async function loadP(){const{data}=await sb.from('profiles').select('*');P={};(data||[]).forEach(p=>P[p.id]=p)}
async function loadS(){const{data}=await sb.from('servers').select('*').order('id');S=data||[];rail()}
function rail(){$('#rail').innerHTML=S.map(s=>`<button class="${srv?.id===s.id?'on':''}" title="${esc(s.name)}" data-s="${s.id}">${esc(s.name.slice(0,2))}</button>`).join('')+
 `<button id="addS" title="สร้างชุมชน">+</button><button id="bNews" title="ข่าวสาร">📰</button><button id="bMe" title="โปรไฟล์">👤</button>`+(lvl()>=2?`<button id="bAdm" title="หลังบ้าน">⚙</button>`:'')+`<button id="bOut" title="ออกจากระบบ">⏻</button>`;
 document.querySelectorAll('#rail [data-s]').forEach(b=>b.onclick=()=>pick(S.find(s=>s.id==b.dataset.s)));
 $('#addS').onclick=async()=>{const n=prompt('ชื่อชุมชน');if(!n)return;const{data,error}=await sb.from('servers').insert({name:n}).select().single();if(error)return alert(error.message);await sb.from('channels').insert({server_id:data.id,name:'ทั่วไป'});await loadS();pick(data)};
 $('#bNews').onclick=news;$('#bMe').onclick=()=>profile(me.id);$('#bOut').onclick=async()=>{await sb.auth.signOut();location.reload()};if($('#bAdm'))$('#bAdm').onclick=admin}
async function pick(s){if(!s){$('#side').innerHTML='<p class="mu">ยังไม่มีชุมชน กด + เพื่อสร้าง</p>';$('#mem').innerHTML='';$('#main').innerHTML='';return}
 srv=s;rail();const[{data:cs},{data:rs},{data:mr}]=await Promise.all([sb.from('channels').select('*').eq('server_id',s.id).order('id'),sb.from('roles').select('*').eq('server_id',s.id),sb.from('member_roles').select('*').eq('server_id',s.id)]);
 srv.cs=cs||[];srv.rs=rs||[];srv.mr=mr||[];const own=s.owner===me.id||lvl()===5;
 $('#side').innerHTML=`<h3>${esc(s.name)}</h3>`+srv.cs.map(c=>`<button data-c="${c.id}"># ${esc(c.name)}</button>`).join('')+
  (own?`<button id="addC" class="mu">+ ช่อง</button><button id="addR" class="mu">+ ยศ</button><button id="giveR" class="mu">มอบยศ</button><button id="delS" class="mu">ลบชุมชน</button>`:'');
 document.querySelectorAll('#side [data-c]').forEach(b=>b.onclick=()=>openChan(srv.cs.find(c=>c.id==b.dataset.c)));
 if(own){$('#addC').onclick=async()=>{const n=prompt('ชื่อช่อง');if(n){await sb.from('channels').insert({server_id:s.id,name:n});pick(s)}};
  $('#addR').onclick=async()=>{const n=prompt('ชื่อยศ');if(!n)return;const c=prompt('สี (เช่น #ff4d6d)','#5aa9ff');await sb.from('roles').insert({server_id:s.id,name:n,color:c});pick(s)};
  $('#giveR').onclick=async()=>{const u=prompt('ชื่อ Xbox ของสมาชิก'),r=prompt('ชื่อยศ:\n'+srv.rs.map(r=>r.name).join(', '));const p=Object.values(P).find(p=>p.xbox===u),ro=srv.rs.find(x=>x.name===r);if(!p||!ro)return alert('ไม่พบสมาชิกหรือยศ');await sb.from('member_roles').insert({server_id:s.id,user_id:p.id,role_id:ro.id});pick(s)};
  $('#delS').onclick=async()=>{if(confirm('ลบชุมชนนี้?')){await sb.from('servers').delete().eq('id',s.id);await loadS();pick(S[0])}}}
 members();openChan(srv.cs[0])}
function roleOf(uid){const r=srv.mr.filter(m=>m.user_id===uid).map(m=>srv.rs.find(x=>x.id===m.role_id)).filter(Boolean)[0];return r}
function members(){$('#mem').innerHTML='<h3>สมาชิก</h3>'+Object.values(P).filter(p=>!p.banned).map(p=>{const r=roleOf(p.id);return`<div class="m" data-u="${p.id}">${av(p)}<span style="color:${r?esc(r.color):'inherit'}">${esc(p.nick)}</span>${p.verified?'<span class="ver">✔</span>':''}</div>`}).join('');
 document.querySelectorAll('#mem [data-u]').forEach(d=>d.onclick=()=>profile(d.dataset.u))}
const msgHtml=m=>{const p=P[m.user_id],r=roleOf(m.user_id);return`<div class="msg">${av(p)}<div><span class="who" data-u="${m.user_id}" style="color:${r?esc(r.color):'inherit'}">${name(p)}</span>${badge(p)}<small class="mu"> ${new Date(m.created_at).toLocaleString('th-TH')}</small><div>${esc(m.body)}</div></div></div>`};
async function openChan(c){if(ch){sb.removeChannel(ch);ch=null}chan=c;document.querySelectorAll('#side [data-c]').forEach(b=>b.classList.toggle('on',b.dataset.c==c?.id));
 if(!c){$('#main').innerHTML='<p class="scroll mu">ยังไม่มีช่อง</p>';return}
 $('#main').innerHTML=`<div class="scroll" id="log"></div><form class="row" id="send"><input id="txt" placeholder="ส่งข้อความใน #${esc(c.name)}" maxlength="2000" autocomplete="off"><button class="pri">ส่ง</button></form>`;
 const{data}=await sb.from('messages').select('*').eq('channel_id',c.id).order('created_at').limit(100);const log=$('#log');log.innerHTML=(data||[]).map(msgHtml).join('');log.scrollTop=1e9;bindWho();
 ch=sb.channel('m'+c.id).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:'channel_id=eq.'+c.id},async p=>{if(!P[p.new.user_id])await loadP();log.insertAdjacentHTML('beforeend',msgHtml(p.new));log.scrollTop=1e9;bindWho()}).subscribe();
 $('#send').onsubmit=async e=>{e.preventDefault();const b=$('#txt').value.trim();if(!b)return;$('#txt').value='';const{error}=await sb.from('messages').insert({channel_id:c.id,body:b});if(error)alert(error.message)}}
function bindWho(){document.querySelectorAll('.who').forEach(w=>w.onclick=()=>profile(w.dataset.u))}
async function profile(id){const p=P[id],mine=id===me.id;const{data:po}=await sb.from('posts').select('*').eq('user_id',id).order('created_at',{ascending:false});
 $('#main').innerHTML=`<div class="scroll"><div><div class="ban" style="${p.banner?`background-image:url('${esc(p.banner)}')`:''}"></div><div class="sp" style="padding:0 16px">${av(p,'av big')}<div><h2>${name(p)}${badge(p)}</h2></div></div></div>
 <div class="card">${esc(p.bio)||'<span class="mu">ยังไม่มีคำอธิบาย</span>'}</div>
 ${mine?`<form class="card grid" id="ed"><h3>แก้ไขโปรไฟล์</h3><input id="e1" placeholder="ลิงก์รูปโปรไฟล์" value="${esc(p.avatar)}"><input id="e2" placeholder="ลิงก์พื้นหลังโปรไฟล์" value="${esc(p.banner)}"><input id="e3" placeholder="นามแฝง" value="${esc(p.nick)}"><textarea id="e4" rows="3" placeholder="อธิบายโปรไฟล์">${esc(p.bio)}</textarea>
 <h3>ยืนยันตัวตน</h3><p class="mu" style="margin:0">ช่องสตรีม/ติดตามต้องมีผู้ติดตามอย่างน้อย 200 คน ทีมงานจะตรวจสอบก่อนอนุมัติ</p><input id="e5" placeholder="ลิงก์ช่อง" value="${esc(p.channel_link)}"><input id="e6" type="number" placeholder="จำนวนผู้ติดตาม" value="${p.followers||''}"><button class="pri">บันทึก</button></form>
 <form class="card sp" id="np"><input id="pb" placeholder="โพสต์อะไรสักหน่อย" maxlength="1000"><button class="pri">โพสต์</button></form>`:''}
 <h3>โพสต์</h3>${(po||[]).map(x=>`<div class="card">${esc(x.body)}<br><small class="mu">${new Date(x.created_at).toLocaleString('th-TH')}</small></div>`).join('')||'<p class="mu">ยังไม่มีโพสต์</p>'}</div>`;
 if(mine){$('#ed').onsubmit=async e=>{e.preventDefault();const{error}=await sb.from('profiles').update({avatar:$('#e1').value,banner:$('#e2').value,nick:$('#e3').value,bio:$('#e4').value,channel_link:$('#e5').value,followers:+$('#e6').value||0}).eq('id',me.id);if(error)return alert(error.message);await loadP();me=P[me.id];profile(me.id)};
  $('#np').onsubmit=async e=>{e.preventDefault();const b=$('#pb').value.trim();if(b){await sb.from('posts').insert({body:b});profile(id)}}}}
async function news(){const[{data:n},{data:pt},{data:tm}]=await Promise.all([sb.from('news').select('*').order('created_at',{ascending:false}),sb.from('partners').select('*'),sb.from('team').select('*')]);
 $('#main').innerHTML=`<div class="scroll"><h2>ข่าวสาร</h2>${(n||[]).map(x=>`<div class="card"><h3>${esc(x.title)}</h3>${esc(x.body)}<br><small class="mu">${new Date(x.created_at).toLocaleString('th-TH')}</small></div>`).join('')||'<p class="mu">ยังไม่มีข่าว</p>'}
 <h2>รายชื่อทีมงาน</h2>${(tm||[]).map(x=>`<div class="card">${esc(x.name)} <span class="tag">${esc(x.title)}</span></div>`).join('')}
 <h2>พันธมิตร</h2>${(pt||[]).map(x=>`<div class="card"><a href="${/^https?:/.test(x.url)?esc(x.url):'#'}" target="_blank" rel="noopener" style="color:var(--ac)">${esc(x.name)}</a></div>`).join('')}</div>`}
async function admin(){await loadP();const L=lvl(),opts=L===5?['member','staff','exec','deputy']:['member','staff'];
 $('#main').innerHTML=`<div class="scroll"><h2>หลังบ้าน (${LB[me.rank]})</h2>
 <form class="card grid" id="fn"><h3>แจ้งข่าวสาร</h3><input id="nt" placeholder="หัวข้อ" required><textarea id="nb" rows="3" placeholder="รายละเอียด" required></textarea><button class="pri">ประกาศ</button></form>
 ${L>=3?`<form class="card sp" id="ft"><h3 style="width:100%">เพิ่มรายชื่อทีมงาน / พันธมิตร</h3><input id="t1" placeholder="ชื่อ" required><input id="t2" placeholder="ตำแหน่ง หรือ ลิงก์พันธมิตร" required><button data-k="team">+ ทีมงาน</button><button data-k="partners">+ พันธมิตร</button></form>`:''}
 ${L===5?`<form class="card sp" id="fs"><h3 style="width:100%">ปรับแต่งเว็บไซต์</h3><input id="s1" placeholder="ชื่อเว็บ"><input id="s2" type="color" value="#2ea8ff" style="max-width:70px"><button class="pri">บันทึก</button></form>`:''}
 <h3>สมาชิก</h3>${Object.values(P).map(p=>`<div class="card sp" data-id="${p.id}">${av(p)}<b>${name(p)}</b>${badge(p)}${p.blacklisted?'<span class="tag">บัญชีดำ</span>':''}${p.banned?'<span class="tag">แบน</span>':''}
  ${L>=3&&p.id!==me.id&&(L===5||LV[p.rank]<3)?`<select data-a="rank">${opts.map(o=>`<option value="${o}" ${o===p.rank?'selected':''}>${LB[o]}</option>`).join('')}</select>`:''}
  ${L>=2?`<button data-a="ver">${p.verified?'ถอนยืนยัน':`ยืนยัน (${p.followers||0})`}</button>`:''}
  ${L===5&&p.id!==me.id?`<button data-a="bl">บัญชีดำ</button><button data-a="ban">${p.banned?'ปลดแบน':'แบน'}</button><button data-a="del">ลบโปรไฟล์</button>`:''}</div>`).join('')}</div>`;
 $('#fn').onsubmit=async e=>{e.preventDefault();const{error}=await sb.from('news').insert({title:$('#nt').value,body:$('#nb').value});error?alert(error.message):(e.target.reset(),alert('ประกาศแล้ว'))};
 if($('#ft'))$('#ft').onsubmit=async e=>{e.preventDefault();const k=e.submitter?.dataset.k;if(!k)return;const r=k==='team'?{name:$('#t1').value,title:$('#t2').value}:{name:$('#t1').value,url:$('#t2').value};const{error}=await sb.from(k).insert(r);error?alert(error.message):(e.target.reset(),alert('เพิ่มแล้ว'))};
 if($('#fs'))$('#fs').onsubmit=async e=>{e.preventDefault();const rows=[{key:'accent',value:$('#s2').value}];if($('#s1').value)rows.push({key:'title',value:$('#s1').value});await sb.from('settings').upsert(rows);document.documentElement.style.setProperty('--ac',$('#s2').value);if($('#s1').value)document.title=$('#s1').value};
 document.querySelectorAll('[data-a]').forEach(el=>{const id=el.closest('[data-id]').dataset.id,p=P[id],a=el.dataset.a,run=async f=>{const{error}=f===null?{}:await f;if(error)alert(error.message);admin()};
  if(a==='rank')el.onchange=()=>run(sb.from('profiles').update({rank:el.value}).eq('id',id));
  else el.onclick=()=>{if(a==='ver')run(sb.from('profiles').update({verified:!p.verified}).eq('id',id));
   if(a==='bl')run(sb.from('profiles').update({blacklisted:!p.blacklisted}).eq('id',id));
   if(a==='ban')run(sb.from('profiles').update({banned:!p.banned}).eq('id',id));
   if(a==='del'&&confirm('ลบโปรไฟล์นี้ถาวร?'))run(sb.from('profiles').delete().eq('id',id))}})}
