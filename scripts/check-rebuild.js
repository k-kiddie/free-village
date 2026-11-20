'use strict';
const assert=require('node:assert/strict');
const {createGame}=require('../rebuild/game');
const advance=(g,n)=>{for(let i=0;i<n;i++){const e=g.view().events[0];if(e)g.command({action:'choose',id:e.id,value:'decline'});g.command({action:'advance',days:1})}};
const open=(g,policy='volume')=>{g.command({action:'open',site:3,good:'food',policy});advance(g,3);return g.view().firms.find(f=>f.owner==='player').id};
{
 const g=createGame(12),initial=g.money(),f=open(g);assert(Math.abs(g.money()-initial)<1e-6,'개업의 운영자금은 실제 이전');g.command({action:'hire',firm:f,person:10});advance(g,90);assert(Math.abs(g.money()-initial)<1e-6,'생산·임금·경쟁 확장·세금 통화량 보존');for(const p of g.view().people)assert(p.cash>=0);for(const f of g.view().firms)assert(f.cash>=0&&f.stock>=-1e-8);
 const restored=createGame(1,g.export());assert.deepEqual(restored.view(),g.view());advance(g,30);advance(restored,30);assert.deepEqual(restored.export(),g.export(),'난수와 약속 포함 복원 후 동일한 진행');
}
{
 const g=createGame(),snapshot=g.export();assert.throws(()=>g.command({action:'road',district:0}),/권한/);assert.deepEqual(g.export(),snapshot);assert.throws(()=>g.command({action:'open',site:3,good:'invalid',policy:'volume'}));assert.deepEqual(g.export(),snapshot);
 const f=open(g);g.command({action:'hire',firm:f,person:10});const before=g.export();assert.throws(()=>g.command({action:'hire',firm:f,person:10}));assert.deepEqual(g.export(),before,'중복 고용 실패에 시간·돈 소비 없음');
}
{
 const g=createGame();const f=open(g);advance(g,14);assert(g.view().events.length,'실제 사업에서 협상 발생');const day=g.view().day;g.command({action:'advance',days:7});assert.equal(g.view().day,day,'판단 대기 중 시간 정지');const e=g.view().events[0];g.command({action:'choose',id:e.id,value:'counter'});assert.equal(g.view().promises[0].quantity,12);advance(g,9);assert.notEqual(g.view().promises[0].status,'active','약속 후속 결과');
}
{
 const a=createGame(7),b=createGame(7);open(a,'volume');open(b,'quality');advance(a,12);advance(b,12);assert.notEqual(a.view().player.cash,b.view().player.cash,'운영 방침별 실제 성과 차이');
}
{
 const g=createGame();for(let i=0;i<25;i++){g.command({action:'visit',district:i%3});advance(g,1)}g.command({action:'campaign',value:'food'});advance(g,5);assert(g.view().history.length===1,'선거 판정과 이력');assert(!g.view().player.candidate);if(g.view().player.office){const personal=g.view().player.cash,tre=g.view().treasury;g.command({action:'road',district:0});assert.equal(g.view().player.cash,personal);assert.equal(g.view().treasury,tre-140,'공공사업은 국고에서만 집행');advance(g,8);assert.equal(g.view().districts[0].road,1)}
}
{
 const g=createGame();advance(g,120);g.command({action:'succession'});assert.equal(g.view().player.generation,2);assert.throws(()=>createGame(1,{version:999,state:{}}),/저장/);
}
console.log('리빌드 검사 통과: 회계·권한·전략·협상·선거·계승·저장 복원');
