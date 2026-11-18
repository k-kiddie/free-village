const assert=require('node:assert/strict');
const {createWorld}=require('../engine.js');
function map(seed){const w=createWorld(seed,90);w.dynStart();w.dynChoose(w.S.dyn.pending[0].id,'go');
  const names=['너른들','쇠뫼','비단나루'];w.S.trade={on:true,towns:names.map((name,i)=>({name,tag:'T'+i,pop:1000,era:1,mil:10,dev:1,tension:0}))};
  w.S.dyn.realms=Object.fromEntries(names.map(name=>[name,{regime:'rep',ruler:{sur:'김',given:'가',sex:'M',age:30*60,g:{boss:.5,civic:.5}},since:0,dyn:1,hist:[]} ]));
  return w.dynView().world;
}
const a=map(5150),same=map(5150),other=map(5151);
assert.equal(a.us.seed,5150,'지도에 시드가 반영됨');
assert.deepEqual(a.realms.map(r=>[r.x,r.y]),same.realms.map(r=>[r.x,r.y]),'같은 시드는 같은 국가 위치');
assert.notDeepEqual(a.realms.map(r=>[r.x,r.y]),other.realms.map(r=>[r.x,r.y]),'다른 시드는 지형 좌표 배치가 달라짐');
assert(a.realms.every(r=>Number.isFinite(r.x)&&Number.isFinite(r.y)),'모든 이웃 세력이 좌표를 가짐');
console.log('시드 기반 국가 배치·같은 시드 재현·다른 시드 차이 확인 완료');
