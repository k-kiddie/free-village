'use strict';
const { parentPort, workerData } = require('node:worker_threads');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { createWorld, YEAR } = require('./engine.js');
const engine = require('./engine.js');
const {writeSnapshot}=require('./server-storage');
const presenter = require('./server-presenter')();
const uiSource=fs.readFileSync(path.join(__dirname,'ui2.html'),'utf8');
const mapSource=uiSource.slice(uiSource.indexOf('// ---------- 월드 그리기'),uiSource.indexOf('// ---------- 루프'));
const mapKeys=[...new Set([...mapSource.matchAll(/\bS\.([\w]+)/g)].map(m=>m[1]))].filter(k=>!k.startsWith('_')&&!['agents','byId','fx'].includes(k));
let panelDay=-1;const panelCache=new Map();

const saveDir = process.env.VILLAGE_SAVE_DIR || path.join(__dirname, 'save');
const saveFile = path.join(saveDir, 'village.json.gz');
let seed = workerData.seed || 20261116;
let population = workerData.population || 5000;
let world, running = false, speed = 1, pendingDays = 0, busySave = false;
let clockAt = Date.now(), dayFraction = 0;
let lastViewDay = -1;
let lastViewAt = 0, viewRevision = 0, lastSavedDay = -1;
let lastClientAt = Date.now();
let autoStop='none',stopMark=null,stopped=null;
let jumpTotal=0;
const markStop=()=>{stopMark={d:world.S.day,m:world.S.miles.length}};
function shouldStop(){if(!stopMark||autoStop==='none')return false;const d=world.S.day;
  if(autoStop==='mile')return world.S.miles.length>stopMark.m&&d-stopMark.d>=YEAR/4;
  const span=autoStop==='season'?YEAR/4:YEAR;return Math.floor(d/span)>Math.floor(stopMark.d/span);
}

function restore() {
  try {
    let raw;try{raw=zlib.gunzipSync(fs.readFileSync(saveFile))}catch(e){if(e.code!=='ENOENT')throw e;raw=fs.readFileSync(path.join(saveDir,'village.json'))}
    const saved = JSON.parse(raw.toString('utf8'));
    seed = saved.seed||seed; population = saved.population||saved.pop||saved.state?.S?.agents?.length||population;
    world = createWorld(seed, population);
    world.importState(saved.state);
    lastSavedDay = world.S.day;
    return true;
  } catch (e) {
    if (e.code !== 'ENOENT') { parentPort.postMessage({ type: 'log', message: `저장 복원 실패: ${e.message}` }); process.exit(1); }
    return false;
  }
}

function makeView() {
  const S = world.S;
  const day = S.day;
  const agents = S.agents;
  const adultN = agents.reduce((n,a)=>n+(a.alive && world.isAdult(a) ? 1 : 0),0);
  const homeless = agents.reduce((n,a)=>n+(a.alive && world.isAdult(a) && !a.home ? 1 : 0),0);
  const mapState={};for(const k of mapKeys)mapState[k]=S[k];
  // 지도에는 주민 이름/집 소유자 표식만 필요하다. 학습 및 유전체는 상세 요청에서만 제공한다.
  const mapIds=new Set([S.leader,S.gov?.chief]);
  for(const h of S.houses){mapIds.add(h.owner);mapIds.add(h.occ)}
  for(const list of [S.plots,S.shops,S.bldgs])for(const item of list)mapIds.add(item.owner);
  mapState.agents=[...mapIds].filter(Boolean).map(id=>S.byId.get(id)).filter(Boolean).map(a=>({id:a.id,alive:a.alive,age:a.age,sur:a.sur,given:a.given,family:a.family,grp:a.grp}));
  mapState.groups=S.groups.map(g=>({id:g.id,name:g.name,leader:g.leader,mode:g.mode}));
  mapState.gov=S.gov?{regime:S.gov.regime,chief:S.gov.chief}:null;
  const busyShops=new Set(agents.filter(a=>a.act===engine.CRAFT&&a.actT?.slot!=null).map(a=>a.actT.slot));
  mapState.shops=S.shops.map(sh=>({...sh,busy:busyShops.has(sh.slot)}));
  mapState.fx=S.fx.slice(-7);mapState.day=day;
  return {
    version:1, seed, population:agents.length, day, year:Math.floor(day/YEAR)+1,stopped,canImport:lastSavedDay<0&&day===0,jump:jumpTotal?{total:jumpTotal,left:pendingDays}:null,
    season:world.season(), running, speed, leader:S.leader,
    hud:{ adults:adultN, homeless, houses:S.houses.length, wageAvg:S.wageAvg, price:S.price, top:S.leader?world.W(S.byId.get(S.leader)):0, miles:S.miles, savedDay:lastSavedDay },
    map:mapState, geometry:{geo:S.geo,mapBig:S.mapBig,plots:engine.PLOTS,expl:engine.EXPL}
  };
}

function sendView(force = false) {
  if (!world || lastViewDay === world.S.day) return;
  if (!force && Date.now() - lastViewAt < 1500) return;
  try {
    const body = zlib.gzipSync(Buffer.from(JSON.stringify(makeView())), { level: 1 });
    lastViewAt = Date.now();
    lastViewDay=world.S.day;
    parentPort.postMessage({ type:'view', day:lastViewDay, revision:++viewRevision, body });
  } catch (e) { parentPort.postMessage({ type:'log', message:`화면 데이터 생성 실패: ${e.message}` }); }
}

async function save() {
  if (!world || busySave) return;
  if (lastSavedDay === world.S.day) return;
  busySave = true;
  try {
    const state = world.exportState();
    fs.mkdirSync(saveDir, { recursive:true });
    const bytes=await writeSnapshot(saveFile,{version:1,seed,population,state});
    lastSavedDay = world.S.day;
    parentPort.postMessage({ type:'saved', day:world.S.day, bytes });
    lastViewDay=-1;sendView(true);
  } catch (e) { parentPort.postMessage({ type:'save-error', message:e.stack || e.message });throw e; }
  finally { busySave = false; }
}

function advance() {
  if (!world) return;
  if(busySave){clockAt=Date.now();setTimeout(advance,50);return;}
  const now=Date.now();
  if(now-lastClientAt>60_000 && (running || pendingDays>0)){running=false;pendingDays=0;dayFraction=0;lastViewDay=-1;sendView(true);}
  if(running){dayFraction+=Math.min(1000,now-clockAt)*speed/1000;const due=Math.floor(dayFraction);if(due){pendingDays=Math.min(speed,pendingDays+due);dayFraction-=due}}
  clockAt=now;
  const start = Date.now();
  let n = 0;
  try {
    while (pendingDays > 0 && n < 1 && Date.now() - start < 40) {
      world.step(); pendingDays--; n++;
      if(running&&shouldStop()){running=false;pendingDays=0;stopped=stopMark;lastViewDay=-1;sendView(true);break;}
    }
  } catch (e) {
    running = false; pendingDays = 0;
    parentPort.postMessage({ type:'log', message:`시뮬레이션 오류: ${e.stack || e.message}` });
  }
  if(jumpTotal&&pendingDays===0){jumpTotal=0;lastViewDay=-1;save().catch(()=>{});sendView(true)}else sendView();
  if (pendingDays > 0) setImmediate(advance);
  else setTimeout(advance, 50);
}

function answer(id, type, value) { parentPort.postMessage({ type:'reply', id, replyType:type, value }); }
function resident(id) {
  const a = world.S.byId.get(Number(id));
  if (!a) return null;
  const ids = new Set([a.id, a.partner, a.emp, a.lastModel, ...(a.parents||[]), ...(a.kids||[])]);
  const linked = [...ids].filter(key=>key&&key!==a.id).map(key=>world.S.byId.get(key)).filter(Boolean).map(x=>({id:x.id,sur:x.sur,given:x.given,alive:x.alive,age:x.age,family:x.family,gen:x.gen,parents:x.parents,kids:x.kids,partner:x.partner}));
  return { resident:a, linked, day:world.S.day, houses:world.S.houses.filter(h=>h.owner===a.id||h.occ===a.id), loans:world.S.loans.filter(l=>l.b===a.id||l.l===a.id), deps:world.S.deps.filter(d=>d.s===a.id||d.bank===a.id) };
}

let commandChain=Promise.resolve();
parentPort.on('message',msg=>{
  if(msg.type==='heartbeat'){lastClientAt=Date.now();return;}
  commandChain=commandChain.then(()=>handleMessage(msg)).catch(e=>answer(msg.idRequest,'error',e.message));
});
async function handleMessage(msg) {
  if(msg.type==='heartbeat'){lastClientAt=Date.now();return;}
  lastClientAt=Date.now();
  while(busySave)await new Promise(r=>setTimeout(r,10));
  if(msg.type==='import'){
    try{
      if(lastSavedDay>=0||world.S.day!==0)throw Error('서버에 진행 중인 마을이 있어 가져오지 않았습니다');
      const o=JSON.parse(msg.raw);if(!Number.isFinite(o.seed)||!o.state?.S||!Array.isArray(o.state.S.agents)||!Array.isArray(o.state.dead))throw Error('지원하지 않는 저장 형식');
      for(const a of o.state.S.agents)if(!a.g||!Array.isArray(a.q))throw Error('주민 학습 데이터가 없는 저장');
      const next=createWorld(o.seed,o.pop||o.state.S.agents.length);next.importState(o.state);world=next;seed=o.seed;population=o.pop||world.S.agents.length;panelDay=-1;panelCache.clear();await save();lastViewDay=-1;sendView(true);answer(msg.idRequest,'import',{day:world.S.day});
    }catch(e){answer(msg.idRequest,'error',e.message)}return;
  }
  if(msg.type==='panel'){
    try{if(panelDay!==world.S.day){panelCache.clear();panelDay=world.S.day}
      const key=JSON.stringify([msg.tab,msg.filter,msg.selected]);let body=panelCache.get(key);
      if(!body){body=zlib.gzipSync(Buffer.from(JSON.stringify({day:world.S.day,html:presenter.panel(world,msg.tab,msg.filter,msg.selected)})),{level:1});if(panelCache.size>=32)panelCache.clear();panelCache.set(key,body)}
      answer(msg.idRequest,'panel',body);
    }catch(e){answer(msg.idRequest,'error',e.message)}return;
  }
  if (msg.type === 'resident') {
    try { const value=resident(msg.id);if(value)value.html=presenter.card(world,Number(msg.id)); answer(msg.idRequest,'resident',value==null?null:zlib.gzipSync(Buffer.from(JSON.stringify(value)),{level:1})); }
    catch(e) { answer(msg.idRequest,'error',e.message); }
    return;
  }
  if (msg.type === 'command') {
    try {
      const c=msg.command||{};
      if(c.action==='play') { running=true; stopped=null;markStop();clockAt=Date.now(); }
      else if(c.action==='pause') { running=false; pendingDays=0; dayFraction=0;jumpTotal=0; }
      else if(c.action==='speed') speed=Math.max(1,Math.min(100,Math.floor(Number(c.value)||1)));
      else if(c.action==='autostop'){if(!['none','mile','season','year'].includes(c.value))throw Error('알 수 없는 멈춤 기준');autoStop=c.value;markStop();}
      else if(c.action==='advance') { if(!Number.isFinite(c.days)||c.days<1||c.days>3650)throw Error('건너뛸 날짜가 올바르지 않습니다');running=false;pendingDays=Math.floor(c.days);jumpTotal=pendingDays;stopped=null; }
      else if(c.action==='new') { running=false;pendingDays=0;dayFraction=0;seed=Number(c.seed)||((seed*7919+13)%99991+1);population=Math.max(1,Math.min(10000,Math.floor(Number(c.population)||5000)));world=createWorld(seed,population);lastViewDay=-1;lastSavedDay=-1;panelDay=-1;panelCache.clear();await save();sendView(true); }
      else if(c.action==='save') await save();
      else if(c.action==='suspend') {running=false;pendingDays=0;dayFraction=0;jumpTotal=0;await save()}
      else throw new Error('알 수 없는 명령');
      lastViewDay=-1;sendView(true);answer(msg.id,'command',{running,speed,day:world.S.day});
    } catch(e) { answer(msg.id,'error',e.message); }
  }
}

if (!restore()) world=createWorld(seed,population);
sendView();
setInterval(()=>save().catch(()=>{}),60_000);
advance();
