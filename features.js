// ================= ระบบเพิ่มเติม: ชื่อไล่สี / ไอคอนหน้าชื่อ / ไอคอนด้านข้าง / บอทชุมชน =================
// โหลดก่อน app.js — ฟังก์ชันพวกนี้อ่านค่า state ของ app.js (me, srv, roles, mroles ฯลฯ) ตอนถูกเรียกเท่านั้น
const hx=v=>/^#[0-9a-f]{6}$/i.test(v||'')?v:null;
const isUrlIco=v=>/^https:\/\/\S+$/.test(v||'');
const okIcon=v=>!v||isUrlIco(v)||(v.length<=8&&!/^https?:/i.test(v)&&!/[<>"']/.test(v));
const icoHtml=(v,c)=>!v?'':isUrlIco(v)?`<img class="${c}" src="${esc(v)}" alt="" loading="lazy">`:`<span class="${c}">${esc(v)}</span>`;

// ค่าตกแต่งของสมาชิก: ใช้ค่าที่ CEO ตั้งให้คนนั้นก่อน ถ้าไม่มีค่อยดูจากยศ (ยศที่ pos มากกว่าจะมาก่อน)
function deco(u){
  const rs=srv&&u?roleOf(u.id).slice().sort((a,b)=>(b.pos||0)-(a.pos||0)):[];
  const pick=k=>u?.[k]||rs.find(r=>r[k])?.[k]||null;
  return{g1:hx(pick('grad1')),g2:hx(pick('grad2')),front:pick('front_icon'),side:pick('side_icon'),color:hx(rs.find(r=>hx(r.color))?.color)};
}
const sideIco=u=>{const s=deco(u).side;return s?icoHtml(s,'sico'):''};

// อัปโหลดรูปไปเป็นไอคอน แล้วใส่ลงช่องที่ระบุ
window.upIcon=async(inputId,f)=>{if(!f)return;try{const url=await upload(await shrink(f,128));$('#'+inputId).value=url;toast('อัปโหลดแล้ว กดบันทึกเพื่อใช้งาน','ok')}catch(e){toast(e.message,'err')}};

// ---------- ตกแต่งสมาชิก (CEO) ----------
function decoPanel(u){const d=deco(u);
  return `<h3>ตกแต่งชื่อ (เฉพาะ CEO)</h3>
  <div class="row"><label style="flex:1">ไล่สี 1<input type="color" id="g1" value="${d.g1||'#7c5cff'}"></label><label style="flex:1">ไล่สี 2<input type="color" id="g2" value="${d.g2||'#34c3ff'}"></label></div>
  <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="gon" ${u.grad1&&u.grad2?'checked':''} style="width:auto"> ใช้ไล่สีกับชื่อคนนี้</label>
  <label>ไอคอนหน้าชื่อ (อีโมจิ หรือลิงก์ https)<div class="row"><input id="fi" value="${esc(u.front_icon||'')}" maxlength="300"><label class="ib" title="อัปโหลดรูป">📁<input type="file" accept="image/*" hidden onchange="upIcon('fi',this.files[0])"></label></div></label>
  <label>ไอคอนด้านข้าง (ในรายชื่อสมาชิก)<div class="row"><input id="si2" value="${esc(u.side_icon||'')}" maxlength="300"><label class="ib" title="อัปโหลดรูป">📁<input type="file" accept="image/*" hidden onchange="upIcon('si2',this.files[0])"></label></div></label>
  <div class="row"><button onclick="saveDeco('${u.id}')">บันทึกการตกแต่ง</button><button class="g" onclick="clearDeco('${u.id}')">ล้างการตกแต่งของคนนี้</button></div>`}
async function afterDeco(id){delete P[id];await user(id,true);if(id==me.id)me=P[id];renderMe();if(srv)await loadMembers();showProfile(id)}
window.saveDeco=async id=>{const fi=$('#fi').value.trim(),si=$('#si2').value.trim();if(!okIcon(fi)||!okIcon(si))return toast('ไอคอนต้องเป็นอีโมจิ (สั้นๆ) หรือลิงก์ https เท่านั้น','err');
  const on=$('#gon').checked;
  try{must(await sb.from('profiles').update({grad1:on?hx($('#g1').value):null,grad2:on?hx($('#g2').value):null,front_icon:fi||null,side_icon:si||null}).eq('id',id).select());toast('บันทึกการตกแต่งแล้ว','ok');await afterDeco(id)}catch(e){toast('บันทึกไม่สำเร็จ: '+e.message,'err')}};
window.clearDeco=async id=>{try{must(await sb.from('profiles').update({grad1:null,grad2:null,front_icon:null,side_icon:null}).eq('id',id).select());toast('ล้างการตกแต่งแล้ว','ok');await afterDeco(id)}catch(e){toast(e.message,'err')}};

// ---------- ตั้งค่ายศ (เจ้าของชุมชน / CEO) ----------
window.roleEditor=id=>{const r=roles.find(x=>x.id==id);if(!r)return;const on=!!(r.grad1&&r.grad2);
  openModal(`<h3>ตั้งค่ายศ: ${esc(r.name)}</h3>
  <label>ชื่อยศ<input id="re-n" value="${esc(r.name)}" maxlength="32"></label>
  <div class="row"><label style="flex:1">สีพื้นฐาน<input type="color" id="re-c" value="${hx(r.color)||'#5865f2'}"></label><label style="flex:1">ไล่สี 1<input type="color" id="re-g1" value="${hx(r.grad1)||'#7c5cff'}"></label><label style="flex:1">ไล่สี 2<input type="color" id="re-g2" value="${hx(r.grad2)||'#34c3ff'}"></label></div>
  <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="re-on" ${on?'checked':''} style="width:auto"> ใช้ไล่สีกับชื่อของสมาชิกที่มียศนี้</label>
  <label>ไอคอนหน้าชื่อ (อีโมจิ หรือลิงก์ https)<div class="row"><input id="re-fi" value="${esc(r.front_icon||'')}" maxlength="300"><label class="ib" title="อัปโหลดรูป">📁<input type="file" accept="image/*" hidden onchange="upIcon('re-fi',this.files[0])"></label></div></label>
  <label>ไอคอนด้านข้าง (ในรายชื่อสมาชิก)<div class="row"><input id="re-si" value="${esc(r.side_icon||'')}" maxlength="300"><label class="ib" title="อัปโหลดรูป">📁<input type="file" accept="image/*" hidden onchange="upIcon('re-si',this.files[0])"></label></div></label>
  <label>ลำดับ (ตัวเลขมาก = สำคัญกว่า)<input id="re-p" type="number" value="${r.pos||0}"></label>
  <div class="row"><button onclick="saveRole('${id}')">บันทึกยศ</button><button class="g" onclick="srvAdmin()">กลับ</button></div>`)};
window.saveRole=async id=>{const n=$('#re-n').value.trim();if(!n)return toast('ใส่ชื่อยศ','err');
  const fi=$('#re-fi').value.trim(),si=$('#re-si').value.trim();if(!okIcon(fi)||!okIcon(si))return toast('ไอคอนต้องเป็นอีโมจิ (สั้นๆ) หรือลิงก์ https เท่านั้น','err');
  const on=$('#re-on').checked;
  try{must(await sb.from('roles').update({name:n,color:$('#re-c').value,grad1:on?hx($('#re-g1').value):null,grad2:on?hx($('#re-g2').value):null,front_icon:fi||null,side_icon:si||null,pos:+$('#re-p').value||0}).eq('id',id).select());
    toast('บันทึกยศแล้ว','ok');await pickSrv(srv.id);srvAdmin()}catch(e){toast('บันทึกไม่สำเร็จ: '+e.message,'err')}};

// =====================================================================
// ---------- บอทชุมชน ----------
// โค้ดของแต่ละระบบบอทรันใน Web Worker ของตัวเองในเบราว์เซอร์ของ CEO/เจ้าของชุมชน (ทำงานตราบที่เปิดเว็บนี้อยู่)
// ทุกคำสั่งที่บอทสั่งจะทำในนามบัญชีของ CEO/เจ้าของ จึงใช้สิทธิ์เดิมของบัญชีนั้นตาม RLS
// ตัวฟังก์ชันนี้ถูกแปลงเป็นสตริงแล้วส่งเข้า Worker
function workerMain(){
  const pend={};let seq=0;const handlers={};
  const show=x=>typeof x=='string'?x:(()=>{try{return JSON.stringify(x)}catch{return String(x)}})();
  const log=(...a)=>self.postMessage({t:'log',msg:a.map(show).join(' ')});
  const call=(fn,args)=>{const id=++seq;self.postMessage({t:'call',id,fn,args});return new Promise((res,rej)=>{pend[id]={res,rej}})};
  const api={
    on:(ev,fn)=>{(handlers[ev]=handlers[ev]||[]).push(fn)},
    every:(ms,fn)=>setInterval(()=>{Promise.resolve().then(fn).catch(e=>log('ผิดพลาด:',e.message))},Math.max(5000,+ms||0)),
    send:(channel,text)=>call('send',{channel:String(channel),text:String(text)}),
    giveRole:(userId,role)=>call('role',{userId,role:String(role),on:true}),
    removeRole:(userId,role)=>call('role',{userId,role:String(role),on:false}),
    members:()=>call('members',{}),
    log
  };
  ['fetch','XMLHttpRequest','WebSocket','importScripts','indexedDB'].forEach(k=>{try{self[k]=undefined}catch(e){}});
  self.onmessage=async e=>{const m=e.data;
    if(m.t=='init'){try{new Function('api','console',m.code)(api,{log})}catch(x){log('เริ่มระบบไม่ได้:',x.message)}}
    else if(m.t=='res'){const p=pend[m.id];if(!p)return;delete pend[m.id];m.err?p.rej(new Error(m.err)):p.res(m.value)}
    else if(m.t=='event'){for(const fn of handlers[m.name]||[]){try{await fn(m.data)}catch(x){log('ผิดพลาด:',x.message)}}}};
}

// ตัวรันฝั่งหน้าเว็บ: เลือกเพียงแท็บเดียวต่อเบราว์เซอร์ให้เป็นผู้รันบอท (กันบอททำงานซ้ำ)
let botLeader=!navigator.locks,botRunners={},botSub=null,chInfo={},botSrvIds=[];
if(navigator.locks)navigator.locks.request('civitas-bots',()=>{botLeader=true;startBots();return new Promise(()=>{})}).catch(()=>{});

function stopBots(){Object.values(botRunners).forEach(r=>r.w.terminate());botRunners={};if(botSub){sb.removeChannel(botSub);botSub=null}}
async function loadChInfo(){const {data}=await sb.from('channels').select('id,server_id,name').in('server_id',botSrvIds);chInfo=Object.fromEntries((data||[]).map(c=>[c.id,c]))}
async function startBots(){
  stopBots();if(!me||!botLeader||!sb)return;
  const {data:ss}=await sb.from('servers').select('id,owner');
  botSrvIds=(ss||[]).filter(s=>s.owner==me.id||rank(me)==5).map(s=>s.id);if(!botSrvIds.length)return;
  const {data:bs}=await sb.from('bots').select('*').in('server_id',botSrvIds).eq('enabled',true);
  await loadChInfo();
  for(const b of bs||[])(b.systems||[]).forEach((sy,i)=>{
    if(sy.enabled===false||!sy.code)return;
    const w=new Worker(URL.createObjectURL(new Blob(['('+workerMain+')()'],{type:'text/javascript'})));
    const key=b.id+':'+i;botRunners[key]={w,bot:b,server:b.server_id};
    w.onmessage=e=>botMsg(key,e.data);w.onerror=e=>console.warn('บอท '+b.name,e.message);
    w.postMessage({t:'init',code:sy.code})});
  botSub=sb.channel('bot-events')
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},p=>botEvent('message',p.new))
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'members'},p=>botEvent('member_join',p.new))
    .subscribe();
}
async function botEvent(name,row){
  if(!row||row.bot_name||!Object.keys(botRunners).length)return;
  let srvId=row.server_id;
  if(name=='message'){if(!chInfo[row.channel_id])await loadChInfo();const c=chInfo[row.channel_id];if(!c)return;srvId=c.server_id;row={...row,channel_name:c.name}}
  if(!botSrvIds.includes(srvId))return;
  const targets=Object.values(botRunners).filter(r=>r.server==srvId);if(!targets.length)return;
  const alias=(await user(row.user_id))?.alias||'';
  const data=name=='message'?{id:row.id,content:row.content||'',channel_id:row.channel_id,channel_name:row.channel_name,user_id:row.user_id,alias}:{server_id:srvId,user_id:row.user_id,alias};
  targets.forEach(r=>r.w.postMessage({t:'event',name,data}));
}
async function botMsg(key,m){const r=botRunners[key];if(!r)return;
  if(m.t=='log'){console.log('[บอท '+r.bot.name+']',m.msg);return}
  if(m.t=='call'){let value,err;try{value=await botApi(r,m.fn,m.args)}catch(x){err=x.message||String(x)}
    if(err)toast('บอท '+r.bot.name+': '+err,'err');r.w.postMessage({t:'res',id:m.id,value,err})}}
async function botApi(r,fn,a){const s=r.server;
  if(fn=='send'){let c=Object.values(chInfo).find(x=>x.server_id==s&&x.name==a.channel);
    if(!c){await loadChInfo();c=Object.values(chInfo).find(x=>x.server_id==s&&x.name==a.channel)}
    if(!c)throw new Error('ไม่พบห้อง "'+a.channel+'"');
    const {data,error}=await sb.from('messages').insert({channel_id:c.id,user_id:me.id,content:a.text.slice(0,4000),bot_name:r.bot.name}).select().single();
    if(error)throw new Error(error.message);return data.id}
  if(fn=='role'){const {data:ro}=await sb.from('roles').select('id').eq('server_id',s).eq('name',a.role).limit(1);const rid=ro?.[0]?.id;
    if(!rid)throw new Error('ไม่พบยศ "'+a.role+'"');
    const x=a.on?await sb.from('member_roles').upsert({server_id:s,user_id:a.userId,role_id:rid}):await sb.from('member_roles').delete().match({user_id:a.userId,role_id:rid});
    if(x.error)throw new Error(x.error.message);return true}
  if(fn=='members'){const {data:ms}=await sb.from('members').select('user_id').eq('server_id',s);const ids=(ms||[]).map(x=>x.user_id);if(!ids.length)return[];
    const {data:ps}=await sb.from('profiles').select('id,alias,display_name,status').in('id',ids);return ps||[]}
  throw new Error('ไม่รู้จักคำสั่ง '+fn)}

// ---------- หน้าจัดการบอท (ในตั้งค่าชุมชน) ----------
window.loadBotsBox=async()=>{const box=$('#botsBox');if(!box||!srv)return;
  const {data,error}=await sb.from('bots').select('*').eq('server_id',srv.id).order('created_at');
  if(error){box.innerHTML=`<span class="mu">โหลดบอทไม่ได้: ${esc(error.message)} (ให้รัน schema.sql ใหม่)</span>`;return}
  box.innerHTML=(data||[]).map(b=>`<div class="row"><span class="tag">${esc(b.icon||'🤖')}</span><b style="flex:1;min-width:90px">${esc(b.name)}</b><span class="mu">${(b.systems||[]).length} ระบบ · ${b.enabled?'ทำงาน':'ปิดอยู่'}</span><button class="g" onclick="toggleBot('${b.id}',${!b.enabled})">${b.enabled?'ปิด':'เปิด'}</button><button class="g" onclick="botEditor('${b.id}')">แก้ไข</button><button class="d" onclick="delBot('${b.id}')">ลบ</button></div>`).join('')||'<span class="mu">ยังไม่มีบอทในชุมชนนี้</span>'};
const SAMPLE_BOT="api.on('message', async m => {\n  if (m.content === '!ping') await api.send(m.channel_name, 'pong 🏓');\n});";
window.sysHtmlFn=s=>`<div class="panel bsys"><div class="row"><input class="sn" value="${esc(s.name||'')}" placeholder="ชื่อระบบ เช่น ต้อนรับสมาชิก" maxlength="40"><button class="d" type="button" onclick="this.closest('.bsys').remove()">ลบระบบ</button></div><textarea class="sc" rows="9" spellcheck="false" style="font-family:ui-monospace,Menlo,monospace;font-size:13px;white-space:pre">${esc(s.code||'')}</textarea></div>`;
window.botEditor=async id=>{let b={name:'',icon:'🤖',systems:[{name:'ระบบแรก',code:SAMPLE_BOT}]};
  if(id){const {data,error}=await sb.from('bots').select('*').eq('id',id).single();if(error)return toast(error.message,'err');b=data}
  openModal(`<h3>${id?'แก้ไขบอท':'สร้างบอท'}</h3>
  <div class="row"><input id="bn" placeholder="ชื่อบอท" value="${esc(b.name)}" maxlength="32"><input id="bi" placeholder="ไอคอน" value="${esc(b.icon||'')}" maxlength="4" style="max-width:90px"></div>
  <div id="bsyss">${(b.systems||[]).map(sysHtmlFn).join('')}</div>
  <div class="row"><button class="g" type="button" onclick="$('#bsyss').insertAdjacentHTML('beforeend',sysHtmlFn({name:'ระบบใหม่',code:''}))">＋ เพิ่มระบบ</button><button onclick="saveBot('${id||''}')">บันทึกบอท</button></div>
  <p class="mu">คำสั่งที่ใช้ได้: api.on('message' | 'member_join', fn) · api.every(ms, fn) · api.send(ชื่อห้อง, ข้อความ) · api.giveRole(userId, ชื่อยศ) · api.removeRole(userId, ชื่อยศ) · api.members() · api.log(...)<br>บอทจะทำงานเฉพาะขณะเปิดเว็บนี้อยู่ในเบราว์เซอร์ของ CEO/เจ้าของชุมชน และไม่ตอบข้อความที่บอทส่งเอง</p>`)};
window.saveBot=async id=>{const name=$('#bn').value.trim();if(!name)return toast('ใส่ชื่อบอท','err');
  const systems=[...document.querySelectorAll('.bsys')].map(d=>({name:d.querySelector('.sn').value.trim()||'ระบบ',code:d.querySelector('.sc').value,enabled:true}));
  if(!systems.length)return toast('ต้องมีอย่างน้อยหนึ่งระบบ','err');
  for(const s of systems){try{new Function('api','console',s.code)}catch(x){return toast(`โค้ดระบบ "${s.name}" มีข้อผิดพลาด: ${x.message}`,'err')}}
  const p={server_id:srv.id,name,icon:$('#bi').value.trim()||null,systems};
  try{if(id)must(await sb.from('bots').update(p).eq('id',id).select());else must(await sb.from('bots').insert(p).select());
    toast('บันทึกบอทแล้ว','ok');closeModal();startBots();srvAdmin()}catch(e){toast('บันทึกไม่สำเร็จ: '+e.message,'err')}};
window.toggleBot=async(id,on)=>{try{must(await sb.from('bots').update({enabled:on}).eq('id',id).select());startBots();loadBotsBox()}catch(e){toast(e.message,'err')}};
window.delBot=async id=>{if(!confirm('ลบบอทนี้?'))return;try{must(await sb.from('bots').delete().eq('id',id).select());toast('ลบบอทแล้ว','ok');startBots();loadBotsBox()}catch(e){toast(e.message,'err')}};
