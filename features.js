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
  await loadRewards();
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
function nameHtml(u,plain){
  const d=deco(u);let st='',cls='';
  if(d.mode=='gradient'&&d.g1&&d.g2)st=`background:linear-gradient(90deg,${d.g1},${d.g2});-webkit-background-clip:text;background-clip:text;color:transparent`;
  else if(d.mode=='holo'){cls='holo';st=`--g1:${d.g1||'#7c5cff'};--g2:${d.g2||'#34c3ff'}`}
  else if(d.color)st=`color:${d.color}`;
  return `${icoHtml(d.front,'dico')}<span class="${cls}" style="${st}">${dn(u)}</span> ${plain?'':`<span class="xb">(${esc(u?.display_name)})</span>`}`;
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
  return `<div class="cat cat-h"><span>กิจกรรม — ${srvActs.length}</span><span class="sp"></span><button class="ib mini" title="ภารกิจ" onclick="missionsModal()">🎯</button>${m?'<button class="ib mini" title="เพิ่มกิจกรรม" onclick="actForm()">＋</button>':''}</div>`+
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
  applyWm();applyBanner();
}

// ---------- รายชื่อสมาชิก: แยกตามยศ + นับคนออนไลน์ในแต่ละยศ + บอท ----------
function memRow(u){const a=actsOfUser(u.id)[0];return `<div class="u ${online.has(u.id)?'':'off'}" onclick="showProfile('${u.id}')">${avatarHtml(u,'sm')}<div style="min-width:0"><div><span class="plate" ${plateStyle(u)}>${nameHtml(u)}</span> ${sideIco(u)}</div><div>${badge(u)}</div>${a?`<div class="mu actline">🎮 ${esc(a.title)}</div>`:''}</div></div>`}
function renderMemberList(){const el=$('#mem');if(!el||!srv)return;
  const sorted=[...roles].sort((a,b)=>(b.pos||0)-(a.pos||0));
  const groups=new Map(sorted.map(r=>[r.id,{r,items:[]}]));const others=[];
  members.forEach(u=>{const top=roleOf(u.id).sort((a,b)=>(b.pos||0)-(a.pos||0))[0];top&&groups.has(top.id)?groups.get(top.id).items.push(u):others.push(u)});
  const onN=members.filter(u=>online.has(u.id)).length;
  let h=`<div class="cat">ออนไลน์ ${onN} · ทั้งหมด ${members.length}</div>`;
  const block=(title,r,items)=>{if(!items.length)return;
    items.sort((a,b)=>(online.has(b.id)-online.has(a.id))||(rank(b)-rank(a)));
    const n=items.filter(u=>online.has(u.id)).length;const col=r?hx(r.color):null;
    h+=`<div class="cat rgrp">${r?icoHtml(r.front_icon,'dico'):''}${r?roleNameHtml(r):`<span>${esc(title)}</span>`}<span class="rcount">ออนไลน์ ${n} / ${items.length}</span></div>`+items.map(memRow).join('')};
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

// ================= v7: ฟอร์แมตข้อความ, @ยศ, สียศทุกที่, กรอบ/แถบชื่อ, กิจกรรมบนโปรไฟล์ =================
let srvRewards=[],srvMissions=[],srvClaims=[],srvUR=[];
const roleNameMode=r=>r?.name_mode||'solid';
// ชื่อยศแบบมีสี: สีปกติ / ไล่สี / โฮโลกราฟิก (อ่านค่าจากยศโดยตรง)
function roleNameHtml(r,extra=''){const m=roleNameMode(r),g1=hx(r.grad1)||'#7c5cff',g2=hx(r.grad2)||'#34c3ff',c=hx(r.color)||'#5865f2';
  const st=m=='gradient'?`background:linear-gradient(90deg,${g1},${g2});-webkit-background-clip:text;background-clip:text;color:transparent`:m=='holo'?`--g1:${g1};--g2:${g2}`:`color:${c}`;
  return `<span class="${m=='holo'?'holo':''}" style="${st}${extra}">${esc(r.name)}</span>`}
// ป้ายยศ (ใช้ในโปรไฟล์และหัวกลุ่มรายชื่อ)
function roleTag(r){const m=roleNameMode(r),g1=hx(r.grad1)||'#7c5cff',g2=hx(r.grad2)||'#34c3ff',c=hx(r.color)||'#5865f2';
  const st=m=='gradient'?`background:linear-gradient(90deg,${g1},${g2})`:m=='holo'?`--g1:${g1};--g2:${g2}`:`background:${c}`;
  return `<span class="tag rtag ${m=='holo'?'holobg':''}" style="${st}">${esc(r.name)}</span>`}
const roleChipsHtml=rs=>rs.length?`<div class="row">${rs.map(roleTag).join('')}</div>`:'';

// ไอคอนห้องตามประเภท (CEO ปรับได้)
function iconFor(c){const m=srv?.icon_map||{};const k=c.kind=='voice'?'voice':c.kind=='announce'?'announce':'text';
  return m[k]||(k=='voice'?'🔊':k=='announce'?'📢':'#')}
function iconAdminHtml(){const m=srv?.icon_map||{};
  return `<h3>ไอคอนห้อง</h3><p class="mu">เปลี่ยนไอคอนของแต่ละประเภทห้องได้ (อีโมจิสั้นๆ)</p>
  <div class="row"><label style="flex:1">ข้อความ<input id="ic-text" value="${esc(m.text||'')}" maxlength="4" placeholder="#"></label><label style="flex:1">เสียง<input id="ic-voice" value="${esc(m.voice||'')}" maxlength="4" placeholder="🔊"></label><label style="flex:1">ประกาศ<input id="ic-announce" value="${esc(m.announce||'')}" maxlength="4" placeholder="📢"></label></div>
  <button onclick="saveIcons()">บันทึกไอคอนห้อง</button>`}
window.saveIcons=async()=>{const v={text:$('#ic-text').value.trim(),voice:$('#ic-voice').value.trim(),announce:$('#ic-announce').value.trim()};
  for(const k in v){if(!v[k])delete v[k];else if(!okIcon(v[k]))return toast('ไอคอนต้องเป็นอีโมจิสั้นๆ','err')}
  try{must(await sb.from('servers').update({icon_map:v}).eq('id',srv.id).select());await loadServers(srv.id);srvAdmin();toast('บันทึกไอคอนแล้ว','ok')}catch(e){toast(e.message,'err')}};

// พื้นหลังชุมชน (แถบด้านบนของแถบห้อง)
function bannerAdminHtml(){return `<h3>พื้นหลังชุมชน</h3><p class="mu">ภาพหรือ GIF แสดงด้านบนของแถบห้อง</p>
  <input id="sbu" type="file" accept="image/*"><div class="row"><button onclick="saveSrvBanner()">บันทึกพื้นหลัง</button><button class="g" onclick="clearSrvBanner()">เอาออก</button></div>`}
window.saveSrvBanner=async()=>{const f=$('#sbu').files[0];if(!f||!f.type.startsWith('image/'))return toast('เลือกไฟล์รูปหรือ GIF','err');
  try{toast('กำลังอัปโหลด…');const url=await upload(await shrink(f,1920));must(await sb.from('servers').update({banner_url:url}).eq('id',srv.id).select());await loadServers(srv.id);srvAdmin();toast('บันทึกพื้นหลังแล้ว','ok')}catch(e){toast(e.message,'err')}};
window.clearSrvBanner=async()=>{try{must(await sb.from('servers').update({banner_url:null}).eq('id',srv.id).select());await loadServers(srv.id);srvAdmin()}catch(e){toast(e.message,'err')}};
function applyBanner(){const sn=$('#srvName');if(!sn)return;const b=safeUrl(srv?.banner_url);
  sn.classList.toggle('hasbg',!!b);sn.style.backgroundImage=b?`url("${b.replace(/["()\\]/g,'')}")`:''}

// ---------- กรอบโปรไฟล์ / แถบชื่อ ----------
const rewardUrl=id=>safeUrl(srvRewards.find(r=>r.id==id)?.url);
function avatarHtml(u,c=''){const url=safeUrl(u?.avatar_url),fr=rewardUrl(u?.equip_frame);
  const av=`<div class="av ${c} ${online.has(u?.id)?'on':''}" ${url?`style="background-image:url('${esc(url)}')"`:''} onclick="showProfile('${u?.id}')">${url?'':esc((u?.alias||'?')[0].toUpperCase())}</div>`;
  return fr?`<span class="avf">${av}<img class="fr" src="${esc(fr)}" alt="" loading="lazy"></span>`:av}
const plateStyle=u=>{const p=rewardUrl(u?.equip_plate);return p?`style="background-image:url('${esc(p)}')"`:''};
function actsOfUser(id){return srvJoins.filter(j=>j.user_id==id).map(j=>actOf(j.activity_id)).filter(Boolean)}
function actChipsHtml(id){const as=actsOfUser(id);return as.length?`<div class="row">${as.map(a=>`<span class="tag actag" onclick="openAct('${a.id}')">🎮 ${esc(a.title)}</span>`).join('')}</div>`:''}

// ---------- ฟอร์แมตข้อความ ----------
// คีย์ลัด: **หนา**  *บาง*  ++ใหญ่++  --เล็ก--  ~~ขีดฆ่า~~  ||ซ่อน||  ^^เคลื่อนไหว^^  # หัวข้อ  [ข้อความ](https://ลิงก์)  `โค้ด`
function richFmt(t){
  const codes=[];let s=esc(t).replace(/`([^`\n]+)`/g,(m,c)=>{codes.push(c);return `\u0001${codes.length-1}\u0001`});
  s=s.replace(/^# (.+)$/gm,'<span class="fh">$1</span>');
  s=s.replace(/\[([^\]\n]{1,80})\]\((https:\/\/[^\s)<]+)\)/g,(m,a,u)=>`<a href="${u}" target="_blank" rel="noopener noreferrer">${a}</a>`);
  s=s.replace(/(^|[\s>])(https?:\/\/[^\s<]+)/g,(m,p,u)=>`${p}<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);
  s=s.replace(/\|\|([^|\n]+)\|\|/g,'<span class="spoil" onclick="this.classList.toggle(\'on\')">$1</span>')
     .replace(/\*\*([^*\n]+)\*\*/g,'<b>$1</b>')
     .replace(/~~([^~\n]+)~~/g,'<s>$1</s>')
     .replace(/\+\+([^+\n]+)\+\+/g,'<span class="fbig">$1</span>')
     .replace(/--([^-\n]+)--/g,'<span class="fsmall">$1</span>')
     .replace(/\^\^([^^\n]+)\^\^/g,'<span class="fanim">$1</span>')
     .replace(/\*([^*\n]+)\*/g,'<span class="flight">$1</span>');
  s=emoField(s);
  // @ชื่อ / @ยศ / @everyone — เฉพาะส่วนที่เป็นข้อความ (ไม่แตะแท็ก)
  const names=new Map([['everyone',null]]);members.forEach(u=>{if(u.alias)names.set(u.alias,u)});roles.forEach(r=>{if(r.name&&!names.has(r.name))names.set(r.name,r)});
  const keys=[...names.keys()].map(k=>esc(k)).sort((a,b)=>b.length-a.length);
  if(keys.length){const re=new RegExp('@('+keys.map(escRe).join('|')+')(?![^\\s<])','g');
    s=s.split(/(<[^>]+>)/).map(part=>part.startsWith('<')?part:part.replace(re,(m,k)=>{const raw=k.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
      const r=roles.find(x=>esc(x.name)==k&&!members.some(u=>esc(u.alias||'')==k));
      return r?`<span class="men rmen">@${roleNameHtml(r)}</span>`:`<span class="men">@${k}</span>`})).join('')}
  s=s.replace(/\u0001(\d+)\u0001/g,(m,i)=>`<code>${codes[+i]}</code>`);
  return s.replace(/\n/g,'<br>')}
window.fmtHelp=()=>openModal(`<h3>คีย์ลัดจัดข้อความ</h3>
  <div class="fhelp"><div><code>**หนา**</code></div><div><span class="fbig">++ตัวใหญ่++</span></div><div><span class="fsmall">--ตัวเล็ก--</span></div><div><span class="flight">*ตัวบาง*</span></div><div><s>~~ขีดฆ่า~~</s></div><div><span class="spoil" onclick="this.classList.toggle('on')">||ซ่อนข้อความ||</span> <span class="mu">(คลิกเพื่อดู)</span></div><div><span class="fanim">^^ข้อความเคลื่อนไหว^^</span></div><div><span class="fh"># หัวข้อใหญ่</span> <span class="mu">(ขึ้นต้นบรรทัด)</span></div><div>[ข้อความลิงก์](https://example.com)</div><div><code>&#96;โค้ด&#96;</code></div><div><span class="men">@ชื่อ</span> <span class="men rmen">@ชื่อยศ</span> <span class="men">@everyone</span></div></div>`);

// ---------- รางวัลและภารกิจ ----------
async function loadRewards(){if(!srv)return;const sid=srv.id;
  const {data:rw}=await sb.from('rewards').select('*').eq('server_id',sid).order('created_at');
  if(srv?.id!=sid)return;srvRewards=rw||[];const rids=srvRewards.map(r=>r.id);
  const [{data:ur},{data:ms}]=await Promise.all([rids.length?sb.from('user_rewards').select('*').in('reward_id',rids):{data:[]},sb.from('missions').select('*').eq('server_id',sid).order('created_at')]);
  srvUR=ur||[];srvMissions=ms||[];const mids=srvMissions.map(m=>m.id);
  const {data:cl}=mids.length?await sb.from('mission_claims').select('*').in('mission_id',mids).order('created_at'):{data:[]};
  srvClaims=cl||[];
  await Promise.all([...new Set([...srvUR.map(x=>x.user_id),...srvClaims.map(c=>c.user_id)])].map(u=>user(u)));
}
function equipHtml(u){
  const owned=srvUR.filter(x=>x.user_id==u.id).map(x=>srvRewards.find(r=>r.id==x.reward_id)).filter(Boolean);
  const fr=owned.filter(r=>r.kind=='frame'),pl=owned.filter(r=>r.kind=='plate');
  if(!owned.length)return u.id==me.id?`<h3>กรอบโปรไฟล์และแถบชื่อ</h3><p class="mu">ทำภารกิจเพื่อรับกรอบโปรไฟล์และแถบชื่อ</p><button onclick="missionsModal()">🎯 ดูภารกิจ</button>`:'';
  const opt=(list,cur)=>`<option value="">— ไม่ใช้ —</option>`+list.map(r=>`<option value="${r.id}" ${cur==r.id?'selected':''}>${esc(r.name)}</option>`).join('');
  return `<h3>กรอบโปรไฟล์และแถบชื่อ</h3><div class="row"><label style="flex:1">กรอบ<select id="eqf">${opt(fr,u.equip_frame)}</select></label><label style="flex:1">แถบชื่อ<select id="eqp">${opt(pl,u.equip_plate)}</select></label></div><button onclick="saveEquip('${u.id}')">ใช้รางวัลที่เลือก</button>`}
window.saveEquip=async id=>{try{must(await sb.from('profiles').update({equip_frame:$('#eqf').value||null,equip_plate:$('#eqp').value||null}).eq('id',id).select());toast('ใช้รางวัลแล้ว','ok');await afterDeco(id)}catch(e){toast(e.message,'err')}};

window.missionsModal=async()=>{if(!srv)return;await loadRewards();
  const rw=id=>srvRewards.find(r=>r.id==id);
  const mine=srvClaims.filter(c=>c.user_id==me.id);
  const latest=mid=>mine.filter(c=>c.mission_id==mid).slice(-1)[0];
  const missHtml=srvMissions.map(m=>{const c=latest(m.id);const r=rw(m.reward_id);
    const st=!c?'':c.status=='approved'?'✅ ได้รับรางวัลแล้ว':c.status=='pending'?'⏳ รอตรวจ':'❌ ไม่ผ่าน ส่งใหม่ได้';
    const canSend=!isCeo()&&(!c||c.status=='rejected');
    return `<div class="panel mission"><b>${esc(m.title)}</b> <span class="tag">รางวัล: ${esc(r?.name||'—')}</span><p class="mu" style="margin:6px 0">${esc(m.description||'')}</p><div class="row"><span class="mu">${st}</span><span class="sp"></span>${canSend?`<button onclick="submitMission('${m.id}')">ส่งงาน</button>`:''}</div></div>`}).join('')||'<span class="mu">ยังไม่มีภารกิจ</span>';
  const pend=srvClaims.filter(c=>c.status=='pending');
  const review=isCeo()?`<h3>ตรวจงาน (${pend.length})</h3>`+(pend.map(c=>{const m=srvMissions.find(x=>x.id==c.mission_id);
    return `<div class="panel"><b>${esc(P[c.user_id]?.alias||'?')}</b> → ${esc(m?.title||'')}<div class="mu">${c.proof_url?`<a href="${esc(safeUrl(c.proof_url)||'#')}" target="_blank" rel="noopener">ดูหลักฐาน</a>`:''} ${esc(c.note||'')}</div><div class="row"><button onclick="reviewClaim('${c.id}',true)">อนุมัติ + มอบรางวัล</button><button class="d" onclick="reviewClaim('${c.id}',false)">ไม่ผ่าน</button></div></div>`}).join('')||'<span class="mu">ไม่มีงานรอตรวจ</span>')
    :'';
  openModal(`<h3>🎯 ภารกิจ</h3>${missHtml}${review}`)};
window.submitMission=id=>openModal(`<h3>ส่งงานภารกิจ</h3><label>ลิงก์หลักฐาน (https) หรือหมายเหตุ<input id="mpf" maxlength="300"></label><label>รูปหรือ GIF หลักฐาน (ไม่บังคับ)<input type="file" id="mpi" accept="image/*"></label><button onclick="sendClaim('${id}')">ส่งงาน</button>`);
window.sendClaim=async id=>{const v=$('#mpf').value.trim(),f=$('#mpi').files[0];const link=isUrlIco(v)?v:null;
  try{const proof=f?await upload(await shrink(f,1600)):link;
    const r=await sb.from('mission_claims').insert({mission_id:id,user_id:me.id,status:'pending',proof_url:proof||null,note:link?null:(v||null)});if(r.error)throw r.error;
    toast('ส่งงานแล้ว รอ CEO ตรวจ','ok');await loadRewards();missionsModal()}catch(e){toast('ส่งงานไม่สำเร็จ: '+e.message,'err')}};
window.reviewClaim=async(id,ok)=>{const c=srvClaims.find(x=>x.id==id);if(!c)return;
  try{must(await sb.from('mission_claims').update({status:ok?'approved':'rejected'}).eq('id',id).select());
    if(ok){const m=srvMissions.find(x=>x.id==c.mission_id);if(m?.reward_id){must(await sb.from('user_rewards').upsert({user_id:c.user_id,reward_id:m.reward_id,server_id:srv.id},{onConflict:'user_id,reward_id'}).select())}}
    toast(ok?'อนุมัติและมอบรางวัลแล้ว':'บันทึกว่าไม่ผ่านแล้ว','ok');await loadRewards();missionsModal()}catch(e){toast(e.message,'err')}};

// หน้าตั้งค่าชุมชน (CEO): สร้างรางวัล ภารกิจ และมอบรางวัลตรงๆ
function rewardAdminHtml(){
  const rwList=srvRewards.map(r=>`<div class="row"><img class="rwth" src="${esc(r.url)}" alt=""><b style="flex:1">${esc(r.name)}</b><span class="mu">${r.kind=='frame'?'กรอบ':'แถบชื่อ'}</span><button class="d" onclick="delReward('${r.id}')">ลบ</button></div>`).join('')||'<span class="mu">ยังไม่มีรางวัล</span>';
  const msList=srvMissions.map(m=>`<div class="row"><b style="flex:1">${esc(m.title)}</b><button class="d" onclick="delMission('${m.id}')">ลบ</button></div>`).join('')||'<span class="mu">ยังไม่มีภารกิจ</span>';
  const rwOpts=srvRewards.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('');
  const memOpts=members.map(u=>`<option value="${u.id}">${esc(u.alias||'?')}</option>`).join('');
  return `<h3>รางวัลและภารกิจ</h3><p class="mu">รางวัลคือกรอบโปรไฟล์หรือแถบชื่อ (รองรับ GIF) ผู้ใช้ทำภารกิจแล้ว CEO อนุมัติเพื่อรับรางวัล</p>
  <h4 class="mu" style="margin:6px 0">รางวัล</h4>${rwList}
  <div class="panel"><label>ชื่อรางวัล<input id="rwn" maxlength="40"></label><div class="row"><label style="flex:1">ประเภท<select id="rwk"><option value="frame">กรอบโปรไฟล์</option><option value="plate">แถบชื่อ</option></select></label><input id="rwu" placeholder="ลิงก์ https (หรืออัปโหลด)" style="flex:2"></div><input id="rwf" type="file" accept="image/*"><button onclick="addReward()">เพิ่มรางวัล</button></div>
  <h4 class="mu" style="margin:6px 0">ภารกิจ</h4>${msList}
  <div class="panel"><label>ชื่อภารกิจ<input id="msn" maxlength="60"></label><label>รายละเอียด<input id="msd" maxlength="300"></label><label>รางวัลที่ได้<select id="msr">${rwOpts}</select></label><button onclick="addMission()">เพิ่มภารกิจ</button></div>
  <h4 class="mu" style="margin:6px 0">มอบรางวัลให้สมาชิกโดยตรง</h4><div class="row"><select id="gu" style="flex:1">${memOpts}</select><select id="gr" style="flex:1">${rwOpts}</select><button onclick="grantReward()">มอบ</button></div>`}
window.addReward=async()=>{const n=$('#rwn').value.trim(),k=$('#rwk').value,u=$('#rwu').value.trim(),f=$('#rwf').files[0];if(!n)return toast('ใส่ชื่อรางวัล','err');
  try{let url=u;if(f){toast('กำลังอัปโหลด…');url=await upload(await shrink(f,512))}
    if(!isUrlIco(url))return toast('ต้องมีรูปหรือลิงก์ https','err');
    must(await sb.from('rewards').insert({server_id:srv.id,name:n,kind:k,url}).select());toast('เพิ่มรางวัลแล้ว','ok');await loadRewards();srvAdmin()}catch(e){toast(e.message,'err')}};
window.delReward=async id=>{if(!confirm('ลบรางวัลนี้? ผู้ที่เคยได้รับจะไม่เห็นรางวัลนี้แล้ว'))return;try{must(await sb.from('rewards').delete().eq('id',id).select());await loadRewards();srvAdmin()}catch(e){toast(e.message,'err')}};
window.addMission=async()=>{const t=$('#msn').value.trim(),d=$('#msd').value.trim(),r=$('#msr').value;if(!t)return toast('ใส่ชื่อภารกิจ','err');
  try{must(await sb.from('missions').insert({server_id:srv.id,title:t,description:d||null,reward_id:r||null}).select());toast('เพิ่มภารกิจแล้ว','ok');await loadRewards();srvAdmin()}catch(e){toast(e.message,'err')}};
window.delMission=async id=>{try{must(await sb.from('missions').delete().eq('id',id).select());await loadRewards();srvAdmin()}catch(e){toast(e.message,'err')}};
window.grantReward=async()=>{const u=$('#gu').value,r=$('#gr').value;if(!u||!r)return toast('เลือกสมาชิกและรางวัล','err');
  try{must(await sb.from('user_rewards').upsert({user_id:u,reward_id:r,server_id:srv.id},{onConflict:'user_id,reward_id'}).select());toast('มอบรางวัลแล้ว','ok');await loadRewards();srvAdmin()}catch(e){toast(e.message,'err')}};

// ปุ่มคีย์ลัดข้อความที่ช่องพิมพ์ (ใส่ครั้งเดียวหลังโหลดหน้า)
document.addEventListener('DOMContentLoaded',()=>{const tx=$('#txt');if(tx&&!$('#fmtBtn')){const b=document.createElement('button');b.type='button';b.id='fmtBtn';b.className='ib';b.title='คีย์ลัดจัดข้อความ';b.textContent='Aa';b.onclick=fmtHelp;tx.parentNode.insertBefore(b,tx)}});
