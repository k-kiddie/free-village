'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const zlib=require('node:zlib');
const {Worker}=require('node:worker_threads');
const root=path.resolve(__dirname,'..');
const {writeSnapshot}=require('../server-storage');
const tabs=['sum','rich','log','evo','mkt','job','firm','fin','trade','land','gov','parl','adm','pol','opn','dist','fam','sex','edu','med','soc','fun','crime','gang','mil','infra'];
async function main(){
  const directory=path.join(root,'save','checks-'+Date.now());await fs.mkdir(directory,{recursive:true});
  const {createWorld}=require('../engine');
  const world=createWorld(42,5000);const start=performance.now();for(let i=0;i<20;i++)world.step();
  const state=world.exportState();const snapshot={version:1,seed:42,population:5000,state};
  const file=path.join(directory,'village.json.gz');const jsonBytes=Buffer.byteLength(JSON.stringify(snapshot));
  const saveAt=performance.now();const bytes=await writeSnapshot(file,snapshot);const saveMs=performance.now()-saveAt;
  const decoded=JSON.parse(zlib.gunzipSync(await fs.readFile(file)));
  assert.deepEqual(decoded,JSON.parse(JSON.stringify(snapshot)),'streamed save must equal original JSON');
  const restored=createWorld(42,5000);restored.importState(decoded.state);
  for(const a of state.S.agents){const b=restored.S.byId.get(a.id);assert.deepEqual(b.g,a.g);assert.deepEqual(b.q,a.q)}
  console.log(JSON.stringify({population:5000,days:20,elapsedMs:performance.now()-start,jsonBytes,gzipBytes:bytes,saveMs,fullJsonRoundTrip:true,genesAndLearningRoundTrip:true}));
  const presenter=require('../server-presenter')();
  for(const tab of tabs){const html=presenter.panel(restored,tab);assert(!html.includes('문제가 생겼다'),tab+' render failed')}
  assert(presenter.card(restored,1).includes('배운 하루 벌이'));
  const worker=new Worker(path.join(root,'sim-worker.js'),{workerData:{seed:42,population:5000},env:{...process.env,VILLAGE_SAVE_DIR:directory}});
  let sequence=0,latestView;const waiting=new Map();
  worker.on('message',m=>{if(m.type==='view')latestView=JSON.parse(zlib.gunzipSync(m.body));if(m.type==='reply'){const p=waiting.get(m.id);if(p){waiting.delete(m.id);m.replyType==='error'?p.reject(Error(m.value)):p.resolve(m.value)}}});
  worker.on('error',e=>{for(const p of waiting.values())p.reject(e)});
  const rpc=(type,data={})=>new Promise((resolve,reject)=>{const id=++sequence;waiting.set(id,{resolve,reject});worker.postMessage({type,id,idRequest:id,...data})});
  try{
    const body=await rpc('resident',{id:1});const detail=JSON.parse(zlib.gunzipSync(body));
    assert.deepEqual(detail.resident.g,state.S.agents.find(a=>a.id===1).g);
    assert.deepEqual(detail.resident.q,state.S.agents.find(a=>a.id===1).q);
    for(const tab of tabs){const data=JSON.parse(zlib.gunzipSync(await rpc('panel',{tab,filter:'all'})));assert(!data.html.includes('문제가 생겼다'),tab)}
    await rpc('command',{command:{action:'save'}});
    await rpc('command',{command:{action:'autostop',value:'season'}});await rpc('command',{command:{action:'play'}});
    const deadline=Date.now()+30_000;while(!latestView?.stopped&&Date.now()<deadline)await new Promise(r=>setTimeout(r,50));
    assert.equal(latestView.day,30);assert.equal(latestView.running,false);assert(latestView.stopped,'season stop must run on the server');
    await rpc('command',{command:{action:'save'}});
    console.log('26 panels, resident card, Worker restore and exact g/q preservation: OK');
    console.log('Server seasonal stop at day 30: OK');
  }finally{await worker.terminate()}
}
main().catch(e=>{console.error(e);process.exitCode=1});
