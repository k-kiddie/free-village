'use strict';
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { Worker } = require('node:worker_threads');
const {createLifecycle}=require('./server-lifecycle');

const PORT = Math.max(1, Number(process.env.PORT) || 80);
const worker = new Worker(path.join(__dirname, 'sim-worker.js'), {
  workerData:{ seed:Number(process.env.SEED)||20261116, population:Number(process.env.POPULATION)||5000 },
  resourceLimits:{maxOldGenerationSizeMb:Number(process.env.VILLAGE_HEAP_MB)||512,maxYoungGenerationSizeMb:32}
});
let latestView = null;
let ready = false;
let nextId = 1;
const waiting = new Map();
const page=fs.readFileSync(path.join(__dirname,'ui2.html'),'utf8')
  .replace('/*ENGINE*/',()=>fs.readFileSync(path.join(__dirname,'engine.js'),'utf8'))
  .replace('/*REMOTE_CLIENT*/',()=>fs.readFileSync(path.join(__dirname,'remote-client.js'),'utf8'))
  .replace('<script>','<script>window.REMOTE=true;</script><script>');
const pageGzip=zlib.gzipSync(Buffer.from(page));
const pageTag='"'+crypto.createHash('sha256').update(page).digest('hex')+'"';

worker.on('message', msg => {
  if (msg.type === 'view') { latestView={day:msg.day,etag:`"view-${msg.revision}"`,body:Buffer.from(msg.body)}; ready=true; }
  else if (msg.type === 'reply') {
    const p=waiting.get(msg.id); if(!p)return; waiting.delete(msg.id);
    if(msg.replyType==='error') p.reject(new Error(msg.value)); else p.resolve(msg.value);
  } else if (msg.type === 'saved') console.log(`저장 완료: ${msg.day}일, ${(msg.bytes/1024/1024).toFixed(1)}MB`);
  else if (msg.type === 'save-error' || msg.type === 'log') console.error(msg.message);
});
worker.on('error', e => { console.error('시뮬레이션 Worker 오류',e); });
worker.on('exit', code => { ready=false;latestView=null;for(const p of waiting.values())p.reject(new Error('시뮬레이션이 종료됐습니다'));waiting.clear();if(!closing){console.error(`시뮬레이션 Worker 종료 (${code})`);server.close();process.exitCode=1;} });

function request(type, data={}) {
  const id=nextId++;
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{waiting.delete(id);reject(new Error('Worker 응답 시간 초과'))},120_000);
    waiting.set(id,{resolve:value=>{clearTimeout(timer);resolve(value)},reject:e=>{clearTimeout(timer);reject(e)}});
    worker.postMessage({type,id,...data,idRequest:id});
  });
}
function sendJson(res, status, value) {
  const body=Buffer.from(JSON.stringify(value));
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':body.length,'cache-control':'no-store'});res.end(body);
}
const lifecycle=createLifecycle({save:()=>request('command',{command:{action:'suspend'}})});
async function readBody(req,limit=16384,parse=true) {
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>limit)throw new Error('요청 본문이 너무 큽니다');chunks.push(chunk)}
  const raw=Buffer.concat(chunks).toString('utf8');return parse?JSON.parse(raw||'{}'):raw;
}
const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    if(req.method==='GET'&&url.pathname==='/health')return sendJson(res,ready&&!lifecycle.stopping?200:503,{ok:ready&&!lifecycle.stopping,ready:ready&&!lifecycle.stopping,stopReady:lifecycle.stopReady,day:latestView?.day??null,rssBytes:process.memoryUsage().rss});
    if(req.method==='POST'&&url.pathname==='/api/session'){
      const input=await readBody(req,512);
      lifecycle.sessions.update(input.id,input.active===true);
      if(input.active===true)worker.postMessage({type:'heartbeat'});
      return sendJson(res,lifecycle.stopping?503:200,{ok:!lifecycle.stopping});
    }
    if(lifecycle.stopping)return sendJson(res,503,{error:'저장 후 서버를 중지하고 있습니다. 진입 주소에서 다시 접속해주세요.'});
    if(req.method==='GET'&&url.pathname==='/api/view'){
      worker.postMessage({type:'heartbeat'});
      if(!latestView)return sendJson(res,503,{error:'마을 초기화 중'});
      if(req.headers['if-none-match']===latestView.etag){res.writeHead(304,{'etag':latestView.etag,'cache-control':'private, no-cache'});return res.end();}
      res.writeHead(200,{'content-type':'application/json; charset=utf-8','content-encoding':'gzip','content-length':latestView.body.length,'cache-control':'private, no-cache','etag':latestView.etag,'x-village-day':String(latestView.day)});
      return res.end(latestView.body);
    }
    const person=req.method==='GET'&&url.pathname.match(/^\/api\/resident\/(\d+)$/);
    if(person){const body=await request('resident',{id:Number(person[1])});if(!body)return sendJson(res,404,{error:'주민을 찾을 수 없습니다'});
      res.writeHead(200,{'content-type':'application/json; charset=utf-8','content-encoding':'gzip','content-length':body.length,'cache-control':'no-store'});return res.end(body)}
    if(req.method==='GET'&&url.pathname==='/api/panel'){
      const body=await request('panel',{tab:url.searchParams.get('tab')||'sum',filter:url.searchParams.get('filter')||'all',selected:Number(url.searchParams.get('selected'))||null});
      res.writeHead(200,{'content-type':'application/json; charset=utf-8','content-encoding':'gzip','content-length':body.length,'cache-control':'no-store'});return res.end(body);
    }
    if(req.method==='POST'&&url.pathname==='/api/cmd'){
      const input=await readBody(req);const result=await request('command',{command:input});return sendJson(res,200,result)}
    if(req.method==='POST'&&url.pathname==='/api/import'){const raw=await readBody(req,128*1024*1024,false);return sendJson(res,200,await request('import',{raw}))}
    if(req.method==='GET'&&url.pathname==='/'){
      if(req.headers['if-none-match']===pageTag){res.writeHead(304,{'etag':pageTag,'cache-control':'private, no-cache'});return res.end()}
      const gzip=/\bgzip\b/.test(req.headers['accept-encoding']||'');const body=gzip?pageGzip:Buffer.from(page);
      res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'private, no-cache','etag':pageTag,'vary':'Accept-Encoding','content-length':body.length,...(gzip?{'content-encoding':'gzip'}:{})});return res.end(body);
    }
    return sendJson(res,404,{error:'요청 경로를 찾을 수 없습니다'});
  } catch(e) { if(!res.headersSent)sendJson(res,e instanceof SyntaxError?400:500,{error:e.message});else res.destroy(); }
});

server.listen(PORT,'0.0.0.0',()=>console.log(`free-village 서버가 ${PORT} 포트에서 실행 중`));
const lifecycleTimer=setInterval(()=>lifecycle.tick(),5000);lifecycleTimer.unref();
let closing=false;
async function shutdown(){if(closing)return;closing=true;clearInterval(lifecycleTimer);server.close();try{await request('command',{command:{action:'suspend'}})}catch(e){console.error('종료 저장 실패',e);process.exitCode=1}finally{await worker.terminate()}}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
