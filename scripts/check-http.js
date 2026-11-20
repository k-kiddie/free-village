'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{spawn}=require('node:child_process');
const port=19288,base='http://127.0.0.1:'+port;
const child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),env:{...process.env,PORT:String(port),INITIAL_WORLD:'village',POPULATION:'5000',VILLAGE_SAVE_DIR:path.resolve(__dirname,'../save/http-'+Date.now())},stdio:['ignore','ignore','pipe']});
child.stderr.on('data',b=>process.stderr.write(b));
async function main(){try{
  let ready=false;for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,100));try{if((await(await fetch(base+'/health')).json()).ready){ready=true;break}}catch{}}assert(ready,'server readiness');
  const html=await(await fetch(base+'/classic')).text();assert(html.includes('window.REMOTE=true'));assert(!html.includes('/*ENGINE*/'));assert(!html.includes('/*REMOTE_CLIENT*/'));
  const response=await fetch(base+'/api/view'),etag=response.headers.get('etag'),view=await response.json();
  const compressedBytes=+response.headers.get('content-length');const notChanged=await fetch(base+'/api/view',{headers:{'if-none-match':etag}});assert.equal(notChanged.status,304);
  assert.equal(view.population,5000);assert(!view.map.agents.some(a=>a.g||a.q));
  const panel=await(await fetch(base+'/api/panel?tab=sum')).json();assert(panel.html.length>0);
  const detail=await(await fetch(base+'/api/resident/1')).json();assert(detail.resident.g&&detail.resident.q&&detail.html);
  const save=fetch(base+'/api/cmd',{method:'POST',body:JSON.stringify({action:'save'})});
  const latencies=[];for(let i=0;i<15;i++){const t=performance.now();assert((await(await fetch(base+'/health')).json()).ready);latencies.push(performance.now()-t);await new Promise(r=>setTimeout(r,20))}assert((await save).ok);
  console.log(JSON.stringify({population:5000,compressedViewBytes:compressedBytes,mapResidents:view.map.agents.length,unchangedStatus:304,maxHealthMsDuringSave:Math.max(...latencies),serverPage:true,detail:true,save:true}));
}finally{child.kill()}}
main().catch(e=>{console.error(e);process.exitCode=1});
