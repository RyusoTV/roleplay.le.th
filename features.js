// ================= ระบบเสริมชุมชน (ตกแต่งชื่อ, ไอคอน, บอท, กิจกรรม, หมวดหมู่, อิโมจิ, โลโก้แชท) =================
// โหลดก่อน app.js — ฟังก์ชันพวกนี้อ่าน state ของ app.js (me, srv, roles, members, P ฯลฯ) ตอนถูกเรียกเท่านั้น
const hx=v=>/^#[0-9a-f]{6}$/i.test(v||'')?v:null;
const isUrlIco=v=>/^https:\/\/\S+$/.test(v||'');
const safeUrl=v=>isUrlIco(v)?v:null;
const okIcon=v=>!v||isUrlIco(v)||(v.length<=8&&!/^https?:/i.test(v)&&!/[<>"']/.test(v));
const icoHtml=(v,c)=>!v?'':isUrlIco(v)?`<img class="${c}" src="${esc(v)}" alt="" loading="lazy">`:`<span class="${c}">${esc(v)}</span>`;
const isCeo=()=>!!me&&rank(me)==5;

// ---------- ข้อมูลของชุมชนที่เปิดอยู่ ----------
let srvCats=[],srvActs=[],srvJoins=[],srvEmos=[],srvBots=[];
async function loadExtras(){
  if(!srv||!sb)return;const sid=srv.id;
  const [c,a,e,b]=await Promise.all([
    sb.from('categories').select('*').eq('server_id',sid).order('pos'),
    sb.from('activities').select('*').eq('server_id',sid).order('pos').order('created_at'),
    sb.from('server_emojis').select('*').eq('server_id',sid).order('name'),
    sb.from('bots_public').select('*').eq('server_id',sid).order('created_at')
  ]);
  if(srv?.id!=sid)return;
  srvCats=c.data||[];srvActs=a.data||[];srvEmos=e.data||[];srvBots=b.data||[];
  const ids=srvActs.map(x=>x.id);
  const j=ids.length?await sb.from('activity_joins').select('*').in('activity_id',ids):{data:[]};
  if(srv?.id!=sid)return;
  srvJoins=j.data||[];
  await Promise.all([...new Set(srvJoins.map(x=>x.user_id))].map(u=>user(u)));
}
const joinsOf=id=>srvJoins.filter(j=>j.activity_id==id);
const joinedByMe=id=>srvJoins.some(j=>j.activity_id==id&&j.user_id==me.id);
const actOf=id=>srvActs.find(a=>a.id==id);
const botBy=n=>srvBots.find(b=>b.name==n);

// ---------- การตกแต่งชื่อ: สีปกติ / ไล่สี / โฮโลกราฟิก ----------
// ลำดับความสำคัญ: ค่าที่ CEO ตั้งให้คนนั้นก่อน ถ้าไม่มีค่อยดูจากยศ (ยศที่ pos มากกว่าจะมาก่อน)
function deco(u){
  const rs=srv&&u?roleOf(u.id).slice().sort((a,b)=>(b.pos||0)-(a.pos||0)):[];
  const pick=k=>u?.[k]||rs.find(r=>r[k])?.[k]||null;
  const mode=u?.name_mode||rs.find(r=>r.name_mode)?.name_mode||'solid';
  const roleColor=hx(rs.find(r=>hx(r.color))?.color);
  const g1=hx(pick('grad1')),g2=hx(pick('grad2'));
  return{mode,g1,g2,front:pick('front_icon'),side:pick('side_icon'),color:(u?.name_mode=='solid'?(g1||roleColor):roleColor)};
}
function nameHtml(u){
  const d=deco(u);let st='',cls='';
  if(d.mode=='gradient'&&d.g1&&d.g2)st=`background:linear-gradient(90deg,${d.g1},${d.g2});-webkit-background-clip:text;background-clip:text;color:transparent`;
  else if(d.mode=='holo'){cls='holo';st=`--g1:${d.g1||'#7c5cff'};--g2:${d.g2||'#34c3ff'}`}
  else if(d.color)st=`color:${d.color}`;
  return `${icoHtml(d.front,'dico')}<span class="${cls}" style="${st}">${dn(u)}</span> <span class="xb">(${esc(u?.display_name)})</span>`;
}
const sideIco=u=>{const s=deco(u).side;return s?icoHtml(s,'sico'):''};

// ---------- รูปโปรไฟล์บอท / ป้ายบอทในแชท ----------
function botAv(name,cls='sm'){const b=botBy(name);const url=safeUrl(b?.avatar_url);
  return `<div class="av ${cls} bot" ${url?`style="background-image:url('${esc(url)}')"`:''}>${url?'':esc((name||'?')[0])}</div>`}
window.showBotProfile=id=>{const b=srvBots.find(x=>x.id==id);if(!b)return toast('ไม่พบบอท','err');
  const bn=safeUrl(b.banner_url),av=safeUrl(b.avatar_url);
  openModal(`<div class="ban" style="${bn?`background-image:url('${esc(bn)}')`:''}"></div>
  <div class="pfh"><div class="av xl bot" ${av?`style="background-image:url('${esc(av)}')"`:''}>${av?'':esc((b.name||'?')[0])}</div><div><h3 style="margin:0">${esc(b.name)} <span class="tag bot">BOT</span> <span class="tag app">แอป</span></h3><span class="mu">${b.enabled?'กำลังทำงาน':'ปิดอยู่'}</span></div></div>
  <p class="mu">บอทนี้ตั้งค่าโดย CEO ของชุมชน</p>${isCeo()?`<button class="g" onclick="botEditor('${b.id}')">แก้ไขบอท</button>`:''}`)};
window.showBotProfileByName=n=>{const b=botBy(n);b?showBotProfile(b.id):toast('ไม่พบบอท','err')};

// ---------- โลโก้จางด้านหลังแชท ----------
function applyWm(){const c=$('#chatView');if(!c)return;const u=safeUrl(srv?.watermark_url);
  c.style.setProperty('--wm',u?`url("${u.replace(/["()\\]/g,'')}")`:'none');
  c.style.setProperty('--wmo',String(Math.min(.5,Math.max(0,(+srv?.watermark_opacity)||0.08))))}
function wmAdminHtml(){const o=Math.round((+srv?.watermark_opacity||0.08)*100);
  return `<h3>โลโก้จางในแชท</h3><p class="mu">โลโก้จะอยู่ด้านหลังข้อความในห้องแชท ผู้ใช้และบอทยังอ่านข้อความได้ปกติ</p>
  <input id="wmu" type="file" accept="image/*">
  <label>ความจาง (ค่าปัจจุบัน ${o}%)<input id="wmo" type="range" min="2" max="40" value="${o}"></label>
  <div class="row"><button onclick="saveWm()">บันทึกโลโก้</button><button class="g" onclick="clearWm()">เอาโลโก้ออก</button></div>`}
window.saveWm=async()=>{try{const f=$('#wmu').files[0];const p={watermark_opacity:(+$('#wmo').value||8)/100};
  if(f){if(!f.type.startsWith('image/'))return toast('ต้องเป็นไฟล์รูปภาพ','err');toast('กำลังอัปโหลด…');p.watermark_url=await upload(await shrink(f,1024))}
  must(await sb.from('servers').update(p).eq('id',srv.id).select());await loadServers(srv.id);srvAdmin();toast('บันทึกโลโก้แล้ว','ok')}catch(e){toast('บันทึกไม่สำเร็จ: '+e.message,'err')}};
window.clearWm=async()=>{try{must(await sb.from('servers').update({watermark_url:null}).eq('id',srv.id).select());await loadServers(srv.id);srvAdmin();toast('เอาโลโก้ออกแล้ว','ok')}catch(e){toast(e.message,'err')}};

// ---------- อิโมจิประจำชุมชน (ไม่จำกัด, รองรับ GIF, CEO เท่านั้น) ----------
function emoField(s){return s.replace(/:([a-z0-9_]{2,32}):/gi,(m,n)=>{const e=srvEmos.find(x=>x.name==n.toLowerCase());
  return e?`<img class="cemo" src="${esc(e.url)}" alt=":${n}:" title=":${n}:" loading="lazy">`:m})}
window.emoPicker=()=>openModal(`<h3>อีโมจิ</h3>${srvEmos.length?`<h4 class="mu" style="margin:0">อีโมจิประจำชุมชน</h4><div class="grid cgrid">${srvEmos.map(e=>`<button type="button" title=":${esc(e.name)}:" onclick="insEmo(':${e.name}:')"><img src="${esc(e.url)}" alt=""></button>`).join('')}</div>`:''}<h4 class="mu" style="margin:0">อีโมจิทั่วไป</h4><div class="grid">${EMO.map(e=>`<button onclick="insEmo('${e}')">${e}</button>`).join('')}</div>`);
function emoAdminHtml(){return `<h3>อิโมจิประจำชุมชน</h3><p class="mu">พิมพ์ :ชื่อ: ในแชทเพื่อใช้ รองรับ GIF</p>
  <div class="grid cgrid">${srvEmos.map(e=>`<div class="ecell"><img src="${esc(e.url)}" alt=""><span>:${esc(e.name)}:</span>${isCeo()?`<button class="d mini" onclick="delEmo('${e.id}')">ลบ</button>`:''}</div>`).join('')||'<span class="mu">ยังไม่มีอิโมจิ</span>'}</div>
  ${isCeo()?`<div class="row"><input id="emn" placeholder="ชื่อ (a-z 0-9 _)" maxlength="32" style="max-width:180px"><input id="emf" type="file" accept="image/*"><button onclick="addEmo(this)">เพิ่มอิโมจิ</button></div>`:''}`}
window.addEmo=async b=>{const n=($('#emn').value||'').trim().toLowerCase();const f=$('#emf').files[0];
  if(!/^[a-z0-9_]{2,32}$/.test(n))return toast('ชื่อต้องเป็น a-z 0-9 _ ยาว 2-32 ตัว','err');
  if(!f||!f.type.startsWith('image/'))return toast('เลือกไฟล์รูปหรือ GIF','err');
  b.disabled=true;try{const url=await upload(await shrink(f,256));must(await sb.from('server_emojis').insert({server_id:srv.id,name:n,url,animated:f.type=='image/gif'}).select());
    toast('เพิ่มอิโมจิแล้ว','ok');await loadExtras();srvAdmin()}catch(e){toast(e.message.includes('duplicate')?'มีชื่อนี้แล้ว':'เพิ่มไม่สำเร็จ: '+e.message,'err')}finally{b.disabled=false}};
window.delEmo=async id=>{try{must(await sb.from('server_emojis').delete().eq('id',id).select());await loadExtras();srvAdmin()}catch(e){toast(e.message,'err')}};

// ---------- หมวดหมู่ห้อง ----------
function catOpts(){return srvCats.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}
function catAdminHtml(){return `<h3>หมวดหมู่ห้อง</h3>${srvCats.map(c=>`<div class="row"><b style="flex:1">${esc(c.name)}</b><button class="d" onclick="delCat('${c.id}')">ลบ</button></div>`).join('')||'<span class="mu">ยังไม่มีหมวดหมู่</span>'}<div class="row"><input id="catn" placeholder="ชื่อหมวดหมู่" maxlength="40"><button onclick="addCat()">เพิ่มหมวดหมู่</button></div>`}
window.addCat=async()=>{const n=$('#catn').value.trim();if(!n)return toast('ใส่ชื่อหมวดหมู่','err');
  try{must(await sb.from('categories').insert({server_id:srv.id,name:n,pos:srvCats.length}).select());toast('เพิ่มหมวดหมู่แล้ว','ok');await pickSrv(srv.id);srvAdmin()}catch(e){toast(e.message,'err')}};
window.delCat=async id=>{if(!confirm('ลบหมวดหมู่นี้? ห้องในหมวดจะไปอยู่ด้านบนสุดแบบไม่มีหมวดหมู่'))return;
  try{must(await sb.from('categories').delete().eq('id',id).select());await pickSrv(srv.id);srvAdmin()}catch(e){toast(e.message,'err')}};
window.quickCh=catId=>openModal(`<h3>เพิ่มห้องในหมวดนี้</h3><label>ชื่อห้อง<input id="qcn" maxlength="40"></label><label>ประเภท<select id="qck"><option value="text">ข้อความ</option><option value="voice">เสียง</option><option value="announce">ประกาศ</option></select></label><button onclick="saveQuickCh('${catId}')">สร้างห้อง</button>`);
window.saveQuickCh=async catId=>{const n=$('#qcn').value.trim().toLowerCase().replace(/\s+/g,'-');if(!n)return toast('ใส่ชื่อห้อง','err');
  const r=await sb.from('channels').insert({server_id:srv.id,name:n,kind:$('#qck').value,category_id:catId});if(r.error)return toast(r.error.message,'err');
  closeModal();toast('สร้างห้องแล้ว','ok');await pickSrv(srv.id)};

// ---------- กิจกรรม (แสดงบนสุดของแถบห้อง, hover ดูรายละเอียด) ----------
function actDetail(a){const js=joinsOf(a.id);const names=js.slice(0,8).map(j=>esc(P[j.user_id]?.alias||'?')).join(', ');
  return `<b class="adt">${esc(a.title)}</b><div class="mu">${esc(a.subtitle||'')}</div>${a.description?`<p>${esc(a.description)}</p>`:''}${a.stats?`<div class="mu">${esc(a.stats)}</div>`:''}<div class="mu" style="margin-top:6px">เชื่อมต่ออยู่ ${js.length} คน${names?`: ${names}${js.length>8?' …':''}`:''}</div>`}
function actsHtml(){const m=isCeo();if(!srvActs.length&&!m)return '';
  return `<div class="cat cat-h"><span>กิจกรรม — ${srvActs.length}</span><span class="sp"></span>${m?'<button class="ib mini" title="เพิ่มกิจกรรม" onclick="actForm()">＋</button>':''}</div>`+
  srvActs.map(a=>`<div class="actc" onmouseenter="actHover(this,'${a.id}')" onmouseleave="actOut()" onclick="openAct('${a.id}')"><div class="actimg">${safeUrl(a.image_url)?`<img src="${esc(a.image_url)}" alt="">`:'🎮'}</div><div class="actt"><b>${esc(a.title)}</b><small>${esc(a.subtitle||'')}</small><small>${esc(a.stats||'')}</small></div><span class="actn" title="เชื่อมต่ออยู่">${joinsOf(a.id).length}</span></div>`).join('')}
window.actHover=(el,id)=>{const a=actOf(id);if(!a)return;let p=$('#actPop');if(!p){p=document.createElement('div');p.id='actPop';document.body.appendChild(p)}
  const r=el.getBoundingClientRect();p.innerHTML=actDetail(a);p.style.top=Math.max(8,Math.min(r.top,innerHeight-260))+'px';p.style.left=(r.right+10)+'px';p.classList.remove('hide')};
window.actOut=()=>$('#actPop')?.classList.add('hide');
window.openAct=id=>{const a=actOf(id);if(!a)return;actOut();const mine=joinedByMe(id);
  openModal(`${safeUrl(a.image_url)?`<img class="big" src="${esc(a.image_url)}" alt="">`:''}${actDetail(a)}
  <div class="row"><button onclick="toggleAct('${id}')">${mine?'ยกเลิกการเชื่อมต่อ':'🔗 เชื่อมต่อ'}</button>${safeUrl(a.link)?`<a class="btnlink" href="${esc(a.link)}" target="_blank" rel="noopener">เปิดลิงก์</a>`:''}${isCeo()?`<button class="g" onclick="actForm('${id}')">แก้ไข</button><button class="d" onclick="delAct('${id}')">ลบ</button>`:''}</div>`)};
window.activitiesModal=()=>openModal(`<h3>กิจกรรม</h3>${srvActs.map(a=>`<div class="row"><b style="flex:1">${esc(a.title)}</b><button onclick="openAct('${a.id}')">ดู</button></div>`).join('')||'<span class="mu">ยังไม่มีกิจกรรม</span>'}`);
window.toggleAct=async id=>{const mine=joinedByMe(id);
  try{const r=mine?await sb.from('activity_joins').delete().match({activity_id:id,user_id:me.id}):await sb.from('activity_joins').insert({activity_id:id,user_id:me.id});
    if(r.error)throw r.error;await loadExtras();renderChans();renderMembers();openAct(id)}catch(e){toast(e.message,'err')}};
window.actForm=id=>{const a=id?actOf(id):{};
  openModal(`<h3>${id?'แก้ไขกิจกรรม':'เพิ่มกิจกรรม'}</h3>
  <label>ชื่อกิจกรรม<input id="af-t" value="${esc(a.title||'')}" maxlength="60"></label>
  <label>หัวข้อรอง<input id="af-s" value="${esc(a.subtitle||'')}" maxlength="80"></label>
  <label>สถิติ / ข้อความสั้น (เช่น "1 วันที่ผ่านมา")<input id="af-st" value="${esc(a.stats||'')}" maxlength="80"></label>
  <label>รายละเอียด<textarea id="af-d" rows="3" maxlength="600">${esc(a.description||'')}</textarea></label>
  <label>ลิงก์ (https)<input id="af-l" value="${esc(a.link||'')}" maxlength="300"></label>
  <label>ภาพปก<div class="row"><input id="af-i" value="${esc(a.image_url||'')}" maxlength="300" placeholder="ลิงก์ https หรืออัปโหลด"><label class="ib" title="อัปโหลด">📁<input type="file" accept="image/*" hidden onchange="upIcon('af-i',this.files[0],512)"></label></div></label>
  <button onclick="saveAct('${id||''}')">บันทึกกิจกรรม</button>`)};
window.saveAct=async id=>{const t=$('#af-t').value.trim();if(!t)return toast('ใส่ชื่อกิจกรรม','err');
  const l=$('#af-l').value.trim(),im=$('#af-i').value.trim();
  if(l&&!isUrlIco(l))return toast('ลิงก์ต้องขึ้นต้นด้วย https://','err');if(im&&!isUrlIco(im))return toast('ภาพปกต้องเป็นลิงก์ https','err');
  const p={server_id:srv.id,title:t,subtitle:$('#af-s').value.trim()||null,stats:$('#af-st').value.trim()||null,description:$('#af-d').value.trim()||null,link:l||null,image_url:im||null};
  try{if(id)must(await sb.from('activities').update(p).eq('id',id).select());else must(await sb.from('activities').insert(p).select());
    toast('บันทึกกิจกรรมแล้ว','ok');closeModal();await loadExtras();renderChans()}catch(e){toast('บันทึกไม่สำเร็จ: '+e.message,'err')}};
window.delAct=async id=>{if(!confirm('ลบกิจกรรมนี้?'))return;
  try{must(await sb.from('activities').delete().eq('id',id).select());closeModal();await loadExtras();renderChans();toast('ลบแล้ว','ok')}catch(e){toast(e.message,'err')}};

// ---------- แถบห้อง: กิจกรรม > ห้องไม่มีหมวด > หมวดหมู่ > ห้องในหมวด ----------
function renderChanList(){
  const mg=isMgr();
  const row=c=>`<div class="ch ${ch?.id==c.id?'on':''}" data-id="${c.id}" onclick="pickCh('${c.id}')"><span>${icon(c)}</span><span>${esc(c.name)}</span>${mg?`<button class="del" title="ลบห้อง" onclick="event.stopPropagation();delCh('${c.id}')">✕</button>`:''}</div>`;
  const sortCh=a=>[...a].sort((x,y)=>(x.kind=='voice')-(y.kind=='voice')||x.name.localeCompare(y.name));
  let h=actsHtml();
  const un=sortCh(chs.filter(c=>!c.category_id||!srvCats.some(k=>k.id==c.category_id)));
  h+=un.map(row).join('');
  [...srvCats].sort((a,b)=>(a.pos||0)-(b.pos||0)).forEach(cat=>{
    h+=`<div class="cat cat-h"><span>${esc(cat.name)}</span><span class="sp"></span>${mg?`<button class="ib mini" title="เพิ่มห้องในหมวดนี้" onclick="quickCh('${cat.id}')">＋</button>`:''}</div>`+sortCh(chs.filter(c=>c.category_id==cat.id)).map(row).join('');
  });
  $('#chans').innerHTML=h||'<div class="mu" style="padding:12px">ยังไม่มีห้อง</div>';
  applyWm();
}

// ---------- รายชื่อสมาชิก: แยกตามยศ + นับคนออนไลน์ในแต่ละยศ + บอท ----------
function memRow(u){return `<div class="u ${online.has(u.id)?'':'off'}" onclick="showProfile('${u.id}')">${avatar(u,'sm')}<div style="min-width:0"><div>${nameHtml(u)} ${sideIco(u)}</div><div>${badge(u)}</div></div></div>`}
function renderMemberList(){const el=$('#mem');if(!el||!srv)return;
  const sorted=[...roles].sort((a,b)=>(b.pos||0)-(a.pos||0));
  const groups=new Map(sorted.map(r=>[r.id,{r,items:[]}]));const others=[];
  members.forEach(u=>{const top=roleOf(u.id).sort((a,b)=>(b.pos||0)-(a.pos||0))[0];top&&groups.has(top.id)?groups.get(top.id).items.push(u):others.push(u)});
  const onN=members.filter(u=>online.has(u.id)).length;
  let h=`<div class="cat">ออนไลน์ ${onN} · ทั้งหมด ${members.length}</div>`;
  const block=(title,r,items)=>{if(!items.length)return;
    items.sort((a,b)=>(online.has(b.id)-online.has(a.id))||(rank(b)-rank(a)));
    const n=items.filter(u=>online.has(u.id)).length;const col=r?hx(r.color):null;
    h+=`<div class="cat rgrp">${r?icoHtml(r.front_icon,'dico'):''}<span ${col?`style="color:${col}"`:''}>${esc(title)}</span><span class="rcount">ออนไลน์ ${n} / ${items.length}</span></div>`+items.map(memRow).join('')};
  for(const {r,items} of groups.values())block(r.name,r,items);
  block('สมาชิก',null,others);
  if(srvBots.length){const on=srvBots.filter(b=>b.enabled).length;
    h+=`<div class="cat rgrp"><span>BOT</span><span class="rcount">ทำงาน ${on} / ${srvBots.length}</span></div>`+srvBots.map(b=>`<div class="u ${b.enabled?'':'off'}" onclick="showBotProfile('${b.id}')">${botAv(b.name,'sm')}<div style="min-width:0"><div><span class="nm">${esc(b.name)}</span></div><div><span class="tag app">แอป</span></div></div></div>`).join('')}
  el.innerHTML=h}

// ---------- ยศ: ชื่อไล่สี / โฮโลกราฟิก / ไอคอน ----------
window.roleEditor=id=>{const r=roles.find(x=>x.id==id);if(!r)return;const m=r.name_mode||'solid';
  openModal(`<h3>ตั้งค่ายศ: ${esc(r.name)}</h3>
  <label>ชื่อยศ<input id="re-n" value="${esc(r.name)}" maxlength="32"></label>
  <label>รูปแบบชื่อ<select id="re-m"><option value="solid" ${m=='solid'?'selected':''}>สีปกติ</option><option value="gradient" ${m=='gradient'?'selected':''}>ไล่สี</option><option value="holo" ${m=='holo'?'selected':''}>โฮโลกราฟิก (เคลื่อนไหว)</option></select></label>
  <div class="row"><label style="flex:1">สีปกติ / สีป้ายยศ<input type="color" id="re-c" value="${hx(r.color)||'#5865f2'}"></label><label style="flex:1">สี 1<input type="color" id="re-g1" value="${hx(r.grad1)||'#7c5cff'}"></label><label style="flex:1">สี 2<input type="color" id="re-g2" value="${hx(r.grad2)||'#34c3ff'}"></label></div>
  <label>ไอคอนหน้าชื่อ (อีโมจิ หรือลิงก์ https รองรับ GIF)<div class="row"><input id="re-fi" value="${esc(r.front_icon||'')}" maxlength="300"><label class="ib" title="อัปโหลด">📁<input type="file" accept="image/*" hidden onchange="upIcon('re-fi',this.files[0])"></label></div></label>
  <label>ไอคอนด้านข้าง (ในรายชื่อสมาชิก)<div class="row"><input id="re-si" value="${esc(r.side_icon||'')}" maxlength="300"><label class="ib" title="อัปโหลด">📁<input type="file" accept="image/*" hidden onchange="upIcon('re-si',this.files[0])"></label></div></label>
  <label>ลำดับ (ตัวเลขมาก = สำคัญกว่า)<input id="re-p" type="number" value="${r.pos||0}"></label>
  <div class="row"><button onclick="saveRole('${id}')">บันทึกยศ</button><button class="g" onclick="srvAdmin()">กลับ</button></div>`)};
window.saveRole=async id=>{const n=$('#re-n').value.trim();if(!n)return toast('ใส่ชื่อยศ','err');
  const fi=$('#re-fi').value.trim(),si=$('#re-si').value.trim();if(!okIcon(fi)||!okIcon(si))return toast('ไอคอนต้องเป็นอีโมจิ (สั้นๆ) หรือลิงก์ https เท่านั้น','err');
  try{must(await sb.from('roles').update({name:n,color:$('#re-c').value,name_mode:$('#re-m').value,grad1:hx($('#re-g1').value),grad2:hx($('#re-g2').value),front_icon:fi||null,side_icon:si||null,pos:+$('#re-p').value||0}).eq('id',id).select());
    toast('บันทึกยศแล้ว','ok');await pickSrv(srv.id);srvAdmin()}catch(e){toast('บันทึกไม่สำเร็จ: '+e.message,'err')}};

// ---------- ตกแต่งสมาชิก (CEO) ----------
window.upIcon=async(inputId,f,max=128)=>{if(!f)return;try{const url=await upload(await shrink(f,max));$('#'+inputId).value=url;toast('อัปโหลดแล้ว กดบันทึกเพื่อใช้งาน','ok')}catch(e){toast(e.message,'err')}};
function decoPanel(u){const d=deco(u);const cur=u.name_mode||'';
  return `<h3>ตกแต่งชื่อ (เฉพาะ CEO)</h3>
  <label>รูปแบบชื่อ<select id="gm"><option value="" ${!cur?'selected':''}>ตามยศ</option><option value="solid" ${cur=='solid'?'selected':''}>สีปกติ</option><option value="gradient" ${cur=='gradient'?'selected':''}>ไล่สี</option><option value="holo" ${cur=='holo'?'selected':''}>โฮโลกราฟิก</option></select></label>
  <div class="row"><label style="flex:1">สี 1<input type="color" id="g1" value="${d.g1||'#7c5cff'}"></label><label style="flex:1">สี 2<input type="color" id="g2" value="${d.g2||'#34c3ff'}"></label></div>
  <label>ไอคอนหน้าชื่อ (อีโมจิ หรือลิงก์ https รองรับ GIF)<div class="row"><input id="fi" value="${esc(u.front_icon||'')}" maxlength="300"><label class="ib" title="อัปโหลด">📁<input type="file" accept="image/*" hidden onchange="upIcon('fi',this.files[0])"></label></div></label>
  <label>ไอคอนด้านข้าง (ในรายชื่อสมาชิก)<div class="row"><input id="si2" value="${esc(u.side_icon||'')}" maxlength="300"><label class="ib" title="อัปโหลด">📁<input type="file" accept="image/*" hidden onchange="upIcon('si2',this.files[0])"></label></div></label>
  <div class="row"><button onclick="saveDeco('${u.id}')">บันทึกการตกแต่ง</button><button class="g" onclick="clearDeco('${u.id}')">ล้าง (กลับไปใช้ค่าตามยศ)</button></div>`}
async function afterDeco(id){delete P[id];await user(id,true);if(id==me.id)me=P[id];renderMe();if(srv)await loadMembers();showProfile(id)}
window.saveDeco=async id=>{const fi=$('#fi').value.trim(),si=$('#si2').value.trim();if(!okIcon(fi)||!okIcon(si))return toast('ไอคอนต้องเป็นอีโมจิ (สั้นๆ) หรือลิงก์ https เท่านั้น','err');
  try{must(await sb.from('profiles').update({name_mode:$('#gm').value||null,grad1:hx($('#g1').value),grad2:hx($('#g2').value),front_icon:fi||null,side_icon:si||null}).eq('id',id).select());toast('บันทึกการตกแต่งแล้ว','ok');await afterDeco(id)}catch(e){toast('บันทึกไม่สำเร็จ: '+e.message,'err')}};
window.clearDeco=async id=>{try{must(await sb.from('profiles').update({name_mode:null,grad1:null,grad2:null,front_icon:null,side_icon:null}).eq('id',id).select());toast('ล้างการตกแต่งแล้ว','ok');await afterDeco(id)}catch(e){toast(e.message,'err')}};

// ---------- บอทชุมชน (CEO เท่านั้น) ----------
// โค้ดแต่ละระบบรันใน Web Worker ของตัวเอง ทำงานตราบที่ CEO เปิดเว็บนี้ค้างไว้
// คำสั่งที่บอทสั่งจะทำในนามบัญชี CEO จึงใช้สิทธิ์ตาม RLS เดิม
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

// เลือกเพียงแท็บเดียวต่อเบราว์เซอร์ให้เป็นผู้รันบอท (กันบอททำงานซ้ำ)
let botLeader=!navigator.locks,botRunners={},botSub=null,chInfo={},botSrvIds=[];
if(navigator.locks)navigator.locks.request('civitas-bots',()=>{botLeader=true;startBots();return new Promise(()=>{})}).catch(()=>{});

function stopBots(){Object.values(botRunners).forEach(r=>r.w.terminate());botRunners={};if(botSub){sb.removeChannel(botSub);botSub=null}}
async function loadChInfo(){const {data}=await sb.from('channels').select('id,server_id,name').in('server_id',botSrvIds);chInfo=Object.fromEntries((data||[]).map(c=>[c.id,c]))}
async function startBots(){
  stopBots();if(!me||!botLeader||!sb||!isCeo())return;
  const {data:ss}=await sb.from('servers').select('id');
  botSrvIds=(ss||[]).map(s=>s.id);if(!botSrvIds.length)return;
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

// ---------- หน้าจัดการบอท ----------
window.loadBotsBox=async()=>{const box=$('#botsBox');if(!box||!srv)return;
  if(!isCeo()){box.innerHTML='<span class="mu">เฉพาะ CEO เท่านั้นที่จัดการบอทได้</span>';return}
  const {data,error}=await sb.from('bots').select('id,name,icon,enabled,systems').eq('server_id',srv.id).order('created_at');
  if(error){box.innerHTML=`<span class="mu">โหลดบอทไม่ได้: ${esc(error.message)}</span>`;return}
  box.innerHTML=(data||[]).map(b=>`<div class="row"><span class="tag">${esc(b.icon||'🤖')}</span><b style="flex:1;min-width:90px">${esc(b.name)}</b><span class="mu">${(b.systems||[]).length} ระบบ · ${b.enabled?'ทำงาน':'ปิดอยู่'}</span><button class="g" onclick="toggleBot('${b.id}',${!b.enabled})">${b.enabled?'ปิด':'เปิด'}</button><button class="g" onclick="botEditor('${b.id}')">แก้ไข</button><button class="d" onclick="delBot('${b.id}')">ลบ</button></div>`).join('')||'<span class="mu">ยังไม่มีบอทในชุมชนนี้</span>'};
const SAMPLE_BOT="api.on('message', async m => {\n  if (m.content === '!ping') await api.send(m.channel_name, 'pong 🏓');\n});";
window.sysHtmlFn=s=>`<div class="panel bsys"><div class="row"><input class="sn" value="${esc(s.name||'')}" placeholder="ชื่อระบบ เช่น ต้อนรับสมาชิก" maxlength="40"><button class="d" type="button" onclick="this.closest('.bsys').remove()">ลบระบบ</button></div><textarea class="sc" rows="9" spellcheck="false" style="font-family:ui-monospace,Menlo,monospace;font-size:13px;white-space:pre">${esc(s.code||'')}</textarea></div>`;
window.botEditor=async id=>{if(!isCeo())return toast('เฉพาะ CEO ตั้งค่าบอทได้','err');
  let b={name:'',icon:'🤖',systems:[{name:'ระบบแรก',code:SAMPLE_BOT}]};
  if(id){const {data,error}=await sb.from('bots').select('*').eq('id',id).single();if(error)return toast(error.message,'err');b=data}
  openModal(`<h3>${id?'แก้ไขบอท':'สร้างบอท'}</h3>
  <div class="row"><input id="bn" placeholder="ชื่อบอท" value="${esc(b.name)}" maxlength="32"><input id="bi" placeholder="ไอคอน" value="${esc(b.icon||'')}" maxlength="4" style="max-width:90px"></div>
  <label>ภาพโปรไฟล์บอท (รองรับ GIF)<div class="row"><input id="bav" value="${esc(b.avatar_url||'')}" maxlength="300" placeholder="ลิงก์ https หรืออัปโหลด"><label class="ib" title="อัปโหลด">📁<input type="file" accept="image/*" hidden onchange="upIcon('bav',this.files[0],256)"></label></div></label>
  <label>ภาพพื้นหลังโปรไฟล์บอท (รองรับ GIF)<div class="row"><input id="bban" value="${esc(b.banner_url||'')}" maxlength="300" placeholder="ลิงก์ https หรืออัปโหลด"><label class="ib" title="อัปโหลด">📁<input type="file" accept="image/*" hidden onchange="upIcon('bban',this.files[0],1600)"></label></div></label>
  <div id="bsyss">${(b.systems||[]).map(sysHtmlFn).join('')}</div>
  <div class="row"><button class="g" type="button" onclick="$('#bsyss').insertAdjacentHTML('beforeend',sysHtmlFn({name:'ระบบใหม่',code:''}))">＋ เพิ่มระบบ</button><button onclick="saveBot('${id||''}')">บันทึกบอท</button></div>
  <p class="mu">คำสั่งที่ใช้ได้: api.on('message' | 'member_join', fn) · api.every(ms, fn) · api.send(ชื่อห้อง, ข้อความ) · api.giveRole(userId, ชื่อยศ) · api.removeRole(userId, ชื่อยศ) · api.members() · api.log(...)<br>บอทจะทำงานเฉพาะขณะที่ CEO เปิดเว็บนี้อยู่ และไม่ตอบข้อความที่บอทส่งเอง</p>`)};
window.saveBot=async id=>{const name=$('#bn').value.trim();if(!name)return toast('ใส่ชื่อบอท','err');
  const av=$('#bav').value.trim(),bn=$('#bban').value.trim();
  if((av&&!isUrlIco(av))||(bn&&!isUrlIco(bn)))return toast('ภาพต้องเป็นลิงก์ https หรืออัปโหลด','err');
  const systems=[...document.querySelectorAll('.bsys')].map(d=>({name:d.querySelector('.sn').value.trim()||'ระบบ',code:d.querySelector('.sc').value,enabled:true}));
  if(!systems.length)return toast('ต้องมีอย่างน้อยหนึ่งระบบ','err');
  for(const s of systems){try{new Function('api','console',s.code)}catch(x){return toast(`โค้ดระบบ "${s.name}" มีข้อผิดพลาด: ${x.message}`,'err')}}
  const p={server_id:srv.id,name,icon:$('#bi').value.trim()||null,systems,avatar_url:av||null,banner_url:bn||null};
  try{if(id)must(await sb.from('bots').update(p).eq('id',id).select());else must(await sb.from('bots').insert(p).select());
    toast('บันทึกบอทแล้ว','ok');closeModal();await loadExtras();renderMembers();startBots();srvAdmin()}catch(e){toast('บันทึกไม่สำเร็จ: '+e.message,'err')}};
window.toggleBot=async(id,on)=>{try{must(await sb.from('bots').update({enabled:on}).eq('id',id).select());await loadExtras();renderMembers();startBots();loadBotsBox()}catch(e){toast(e.message,'err')}};
window.delBot=async id=>{if(!confirm('ลบบอทนี้?'))return;try{must(await sb.from('bots').delete().eq('id',id).select());toast('ลบบอทแล้ว','ok');await loadExtras();renderMembers();startBots();loadBotsBox()}catch(e){toast(e.message,'err')}};
