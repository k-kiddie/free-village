'use strict';
const assert=require('node:assert/strict'),{isDeepStrictEqual}=require('node:util');
const {createSession}=require('../rebuild/core/session');
const json=x=>JSON.parse(JSON.stringify(x));
function differences(a,b,path='',out=[]){
 if(out.length>=12||Object.is(a,b))return out;
 if(!a||!b||typeof a!=='object'||typeof b!=='object'){out.push(path);return out;}
 for(const k of new Set([...Object.keys(a),...Object.keys(b)]))differences(a[k],b[k],path+'.'+k,out);
 return out;
}
for(const seed of [7,19]){
 let s=createSession({mode:'strategy',seed,population:5000}),seq=0;
 function settle(){for(let guard=0;s.view().pending.length&&guard<30;guard++){
  const decision=s.catalog().decisions[0];let done=false;
  for(const option of decision.opts){const m=s.summary(),r={worldId:m.worldId,expectedRevision:m.revision,commandId:'continue:'+(seq+1),actor:{kind:'person',id:m.playerId},action:'choose',args:{id:decision.id,key:option.k}},p=s.preview(r);
   if(p.allowed){assert(s.execute({...r,previewToken:p.previewToken}).allowed);seq++;done=true;break;}}
  assert(done,'실제 대기 결정에 실행 가능한 선택지가 있음');
 }assert.equal(s.view().pending.length,0);}
 settle();for(let day=0;day<35;day++){settle();s.advance();}settle();
 let saved=json(s.checkpoint());assert(saved.engine.S.agents.every(a=>a.g&&a.q));assert.equal(saved.strategy.living.history.length,30);
 const archiveCount=saved.continuation.archived.length;
 s.advance();let expected=json(s.checkpoint());s.close();
 s=createSession({checkpoint:saved});saved=null;s.advance();let actual=json(s.checkpoint());
 assert(isDeepStrictEqual(actual,expected),'실제 출생·사망 후 JSON 복원 다음 하루 차이: '+differences(actual,expected).join(', '));
 console.log(JSON.stringify({seed,initialPopulation:5000,day:s.summary().day,population:s.summary().population,archived:archiveCount,passed:'출생·사망·전체 g/q·30일 지역 관측·저장 복원 다음 하루 전체 상태/난수 동일'}));s.close();actual=null;expected=null;
}
