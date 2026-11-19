'use strict';
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { Worker } = require('node:worker_threads');
const {createLifecycle}=require('./server-lifecycle');

const BOOT_ID=crypto.randomBytes(8).toString('hex');
const PORT = Math.max(1, Number(process.env.PORT) || 80);
// 두 마을: 원래 자유방임 마을('/')과 가문 모드 마을('/god'). 1GB 서버를 위해 한 번에 한 Worker만 메모리에 둔다.
const WORLDS = {
  village:{ seed:Number(process.env.SEED)||20261116, population:Number(process.env.POPULATION)||5000 },
  dynasty:{ seed:Number(process.env.DYNASTY_SEED)||0, population:Number(process.env.DYNASTY_POPULATION)||100 },
};
const SWITCH_MIN_MS = Math.max(0, Number(process.env.WORLD_SWITCH_MIN_MS ?? 15000));
const SCENE_ART_FILES=new Set(['atlas-0.webp','atlas-1.webp','atlas-2.webp','atlas-3.webp','business.webp','characters.webp']);
let active = null;          // {name, worker, gen, latestView, ready, waiting:Map, intended}
let switching = null;       // 전환 중인 대상 이름
let chain = Promise.resolve();
let booted = false, nextId = 1, gen = 0, liveWorkers = 0, activeSince = 0;

function makePage(apiBase,dynasty){
  const read=f=>fs.readFileSync(path.join(__dirname,f),'utf8');
  const html=read('ui2.html')
    .replace('/*ENGINE*/',()=>read('engine.js'))
    .replace('/*REMOTE_CLIENT*/',()=>read('remote-client.js')+(dynasty?'\n'+read('god-client.js'):''))
    .replace('<script>',`<script>window.REMOTE=true;window.API_BASE=${JSON.stringify(apiBase)};${dynasty?'window.DYN=true;':''}</script><script>`);
  return {html,gzip:zlib.gzipSync(Buffer.from(html)),tag:'"'+crypto.createHash('sha256').update(html).digest('hex')+'"'};
}
// /god는 원래 화면(지도·기존 탭)에 가문 모드 화면(god-client.js)을 얹는다.
const pages={village:makePage(''),dynasty:makePage('/god',true)};

function spawnWorld(name){
  const w={name,gen:++gen,latestView:null,ready:false,waiting:new Map(),intended:false};
  let resolveReady,rejectReady;w.readyPromise=new Promise((res,rej)=>{resolveReady=res;rejectReady=rej});
  w.worker=new Worker(path.join(__dirname,'sim-worker.js'),{
    workerData:{name,...WORLDS[name]},
    resourceLimits:{maxOldGenerationSizeMb:Number(process.env.VILLAGE_HEAP_MB)||512,maxYoungGenerationSizeMb:32}
  });
  liveWorkers++;
  w.worker.on('message',msg=>{
    if(msg.type==='view'){w.latestView={day:msg.day,etag:`"view-${BOOT_ID}-${name}-${w.gen}-${msg.revision}"`,body:Buffer.from(msg.body)};if(!w.ready){w.ready=true;resolveReady()}}
    else if(msg.type==='reply'){
      const p=w.waiting.get(msg.id);if(!p)return;w.waiting.delete(msg.id);
      if(msg.replyType==='error')p.reject(new Error(msg.value));else p.resolve(msg.value);
    } else if(msg.type==='saved')console.log(`[${name}] 저장 완료: ${msg.day}일, ${(msg.bytes/1024/1024).toFixed(1)}MB`);
    else if(msg.type==='save-error'||msg.type==='log')console.error(`[${name}] ${msg.message}`);
  });
  w.worker.on('error',e=>console.error(`[${name}] 시뮬레이션 Worker 오류`,e));
  w.worker.on('exit',code=>{
    liveWorkers--;w.ready=false;w.latestView=null;
    for(const p of w.waiting.values())p.reject(new Error('시뮬레이션이 종료됐습니다'));w.waiting.clear();
    rejectReady(new Error(`시뮬레이션 Worker 종료 (${code})`));
    // 마을 전환이나 서버 종료로 끈 Worker는 정상. 그 밖의 종료는 기존처럼 서버를 끝내 systemd가 다시 띄우게 한다.
    if(!w.intended&&!closing){console.error(`[${name}] 시뮬레이션 Worker 종료 (${code})`);server.close();process.exitCode=1;}
  });
  w.readyPromise.catch(()=>{});
  return w;
}

function request(w,type,data={}){
  if(!w)return Promise.reject(new Error('마을이 실행 중이 아닙니다'));
  const id=nextId++;
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{w.waiting.delete(id);reject(new Error('Worker 응답 시간 초과'))},120_000);
    w.waiting.set(id,{resolve:value=>{clearTimeout(timer);resolve(value)},reject:e=>{clearTimeout(timer);reject(e)}});
    w.worker.postMessage({type,id,...data,idRequest:id});
  });
}
async function stopWorld(w){
  // 저장이 끝난 뒤에만 Worker를 내린다. 저장 실패면 끄지 않고 오류를 올린다.
  await request(w,'command',{command:{action:'suspend'}});
  w.intended=true;await w.worker.terminate();
}
// 마을 전환은 직렬로 처리한다. 다른 마을이 켜져 있으면 저장 후 내리고 새 Worker를 띄운다.
function use(name){
  if(active?.name===name&&!switching)return active.readyPromise;
  const run=chain.then(async()=>{
    if(active?.name===name)return active.readyPromise;
    switching=name;
    try{
      if(active){const old=active;active=null;
        try{await stopWorld(old)}catch(e){if(!old.intended)active=old;throw e}}
      active=spawnWorld(name);activeSince=Date.now();
      await active.readyPromise;booted=true;
    }finally{switching=null}
  });
  chain=run.catch(e=>console.error('마을 전환 실패',e));
  return run;
}
// 탭 두 개가 서로 다른 마을을 번갈아 요청해도 전환이 계속 반복되지 않게 최소 유지 시간을 둔다.
function canSwitchTo(name){
  if(switching)return switching===name;
  return active?.name===name||!active||Date.now()-activeSince>=SWITCH_MIN_MS;
}

function sendJson(res, status, value) {
  const body=Buffer.from(JSON.stringify(value));
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':body.length,'cache-control':'no-store'});res.end(body);
}
function sendGzip(res,body){res.writeHead(200,{'content-type':'application/json; charset=utf-8','content-encoding':'gzip','content-length':body.length,'cache-control':'no-store'});res.end(body)}
const lifecycle=createLifecycle({save:()=>chain.then(()=>active&&request(active,'command',{command:{action:'suspend'}}))});
async function readBody(req,limit=16384,parse=true) {
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>limit)throw new Error('요청 본문이 너무 큽니다');chunks.push(chunk)}
  const raw=Buffer.concat(chunks).toString('utf8');return parse?JSON.parse(raw||'{}'):raw;
}
const preparing=(res,name)=>sendJson(res,503,{error:switching?'마을 준비 중':(active&&active.name!==name?'다른 마을이 실행 중입니다. 잠시 후 다시 시도합니다':'마을 초기화 중'),preparing:true});
// 대상 마을이 켜져 있고 준비됐으면 그 Worker, 아니면 전환을 걸고 null.
function ready(name){
  if(active?.name===name&&active.ready&&!switching)return active;
  if(!lifecycle.stopping&&!closing&&canSwitchTo(name))use(name).catch(()=>{});
  return null;
}
async function readyWait(name){
  const w=ready(name);if(w)return w;
  if(!canSwitchTo(name))return null;
  await use(name).catch(()=>{});
  return active?.name===name&&active.ready?active:null;
}

async function handleWorld(name,sub,req,res,url){
  if(req.method==='POST'&&sub==='/api/session'){
    const input=await readBody(req,512);
    lifecycle.sessions.update(input.id,input.active===true);
    if(input.active===true&&active?.name===name)active.worker.postMessage({type:'heartbeat'});
    return sendJson(res,lifecycle.stopping?503:200,{ok:!lifecycle.stopping});
  }
  if(lifecycle.stopping)return sendJson(res,503,{error:'저장 후 서버를 중지하고 있습니다. 진입 주소에서 다시 접속해주세요.'});
  if(req.method==='GET'&&sub==='/api/view'){
    // 전환 중에는 기다리지 않고 503으로 바로 답한다(클라이언트가 2초 뒤 다시 요청).
    const w=ready(name);if(!w||!w.latestView)return preparing(res,name);
    w.worker.postMessage({type:'heartbeat'});
    const v=w.latestView;
    if(req.headers['if-none-match']===v.etag){res.writeHead(304,{'etag':v.etag,'cache-control':'private, no-cache'});return res.end();}
    res.writeHead(200,{'content-type':'application/json; charset=utf-8','content-encoding':'gzip','content-length':v.body.length,'cache-control':'private, no-cache','etag':v.etag,'x-village-day':String(v.day),'x-village-world':name});
    return res.end(v.body);
  }
  const person=req.method==='GET'&&sub.match(/^\/api\/resident\/(\d+)$/);
  const known=person||(req.method==='GET'&&sub==='/api/panel')||(req.method==='POST'&&sub==='/api/cmd')||(req.method==='POST'&&sub==='/api/import'&&name==='village');
  if(!known)return sendJson(res,404,{error:'요청 경로를 찾을 수 없습니다'});
  const input=req.method==='POST'?await readBody(req,sub==='/api/import'?128*1024*1024:16384,sub!=='/api/import'):null;
  const w=await readyWait(name);if(!w)return preparing(res,name);
  if(person){const body=await request(w,'resident',{id:Number(person[1])});if(body===false)return sendJson(res,403,{error:'지금은 잘 모르는 사람입니다'});if(!body)return sendJson(res,404,{error:'주민을 찾을 수 없습니다'});return sendGzip(res,body)}
  if(sub==='/api/panel')return sendGzip(res,await request(w,'panel',{tab:url.searchParams.get('tab')||'sum',filter:url.searchParams.get('filter')||'all',selected:Number(url.searchParams.get('selected'))||null}));
  if(sub==='/api/cmd')return sendJson(res,200,await request(w,'command',{command:input}));
  return sendJson(res,200,await request(w,'import',{raw:input}));
}
function sendPage(req,res,p){
  if(req.headers['if-none-match']===p.tag){res.writeHead(304,{'etag':p.tag,'cache-control':'private, no-cache'});return res.end()}
  const gzip=/\bgzip\b/.test(req.headers['accept-encoding']||'');const body=gzip?p.gzip:Buffer.from(p.html);
  res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'private, no-cache','etag':p.tag,'vary':'Accept-Encoding','content-length':body.length,...(gzip?{'content-encoding':'gzip'}:{})});return res.end(body);
}

const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');const p=url.pathname;
    if(req.method==='GET'&&p.startsWith('/scene-art/')){
      const name=p.slice('/scene-art/'.length);if(!SCENE_ART_FILES.has(name))return sendJson(res,404,{error:'장면 그림을 찾을 수 없습니다'});
      const file=path.join(__dirname,'scene-art',name),stat=fs.statSync(file);
      res.writeHead(200,{'content-type':'image/webp','content-length':stat.size,'cache-control':'public, max-age=31536000, immutable'});
      fs.createReadStream(file).pipe(res);return;
    }
    if(req.method==='GET'&&p==='/health'){const ok=booted&&!lifecycle.stopping;
      return sendJson(res,ok?200:503,{ok,ready:ok,stopReady:lifecycle.stopReady,world:active?.name??null,worldReady:!!active?.ready&&!switching,switching,workers:liveWorkers,day:active?.latestView?.day??null,rssBytes:process.memoryUsage().rss});}
    if(req.method==='GET'&&p==='/')return sendPage(req,res,pages.village);
    if(req.method==='GET'&&(p==='/god'||p==='/god/'))return sendPage(req,res,pages.dynasty);
    if(p.startsWith('/god/api/'))return await handleWorld('dynasty',p.slice(4),req,res,url);
    if(p.startsWith('/api/'))return await handleWorld('village',p,req,res,url);
    return sendJson(res,404,{error:'요청 경로를 찾을 수 없습니다'});
  } catch(e) { if(!res.headersSent)sendJson(res,e instanceof SyntaxError?400:500,{error:e.message});else res.destroy(); }
});

server.listen(PORT,'0.0.0.0',()=>console.log(`free-village 서버가 ${PORT} 포트에서 실행 중`));
use('village').catch(e=>console.error('원래 마을 시작 실패',e));
const lifecycleTimer=setInterval(()=>lifecycle.tick(),5000);lifecycleTimer.unref();
let closing=false;
async function shutdown(){if(closing)return;closing=true;clearInterval(lifecycleTimer);server.close();
  try{await chain;if(active)await stopWorld(active)}catch(e){console.error('종료 저장 실패',e);process.exitCode=1;if(active){active.intended=true;await active.worker.terminate()}}}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
