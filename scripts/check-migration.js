'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),zlib=require('node:zlib'),{Worker}=require('node:worker_threads');
async function main(){
  const w=require('../engine').createWorld(17,100);for(let i=0;i<3;i++)w.step();const snapshot={seed:17,pop:100,state:w.exportState()};
  const worker=new Worker(path.resolve(__dirname,'../sim-worker.js'),{workerData:{seed:42,population:100},env:{...process.env,VILLAGE_SAVE_DIR:path.resolve(__dirname,'../save/import-'+Date.now())}});
  let id=0;const pending=new Map();worker.on('message',m=>{if(m.type==='reply'){const p=pending.get(m.id);if(p){pending.delete(m.id);m.replyType==='error'?p.reject(Error(m.value)):p.resolve(m.value)}}});
  worker.on('error',e=>{for(const p of pending.values())p.reject(e)});
  const rpc=(type,data={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});worker.postMessage({type,id:key,idRequest:key,...data})});
  try{const result=await rpc('import',{raw:JSON.stringify(snapshot)});assert.equal(result.day,3);
    const detail=JSON.parse(zlib.gunzipSync(await rpc('resident',{id:1})));assert.deepEqual(detail.resident.g,snapshot.state.S.agents[0].g);assert.deepEqual(detail.resident.q,snapshot.state.S.agents[0].q);
    await assert.rejects(rpc('import',{raw:JSON.stringify(snapshot)}),/진행 중인 마을/);
    console.log('Existing browser save import preserves g/q; importing over a server village is rejected: OK');
  }finally{await worker.terminate()}
}
main().catch(e=>{console.error(e);process.exitCode=1});
