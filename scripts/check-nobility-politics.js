const assert=require('node:assert/strict');
const {createWorld}=require('../engine.js');

const w=createWorld(514,120);w.dynStart();w.dynConfigureStart({background:'장터'});
const me=w.S.byId.get(w.S.dyn.pid),chief=w.S.agents.find(x=>x.alive&&x.id!==me.id&&x.age>=18*60);me.cash=100000;w.S.gov={regime:'rep',chief:chief.id,king:null,regent:null,council:[me.id],policy:{},tre:1000,min:{}};
const motion=w.dynActions().find(a=>a.k==='extra:noble:petition');assert(motion?.ok,'의원이 공화정에서 작위 법안을 발의');
w.dynAct('extra:noble:petition');const p=w.S.dyn.pending.find(x=>x.kind==='nobleVote');assert(p,'의회 표결 단계 표시');assert.equal(me.dynNoble,undefined,'표결 전에는 작위 미부여');w.dynChoose(p.id,'vote');assert.equal(me.dynNoble,'남작','의회 가결 후 작위 부여');
const saved=JSON.parse(JSON.stringify(w.exportState())),restored=createWorld(1,1);restored.importState(saved);assert.equal(restored.S.byId.get(me.id).dynNoble,'남작','의원 경로 작위 저장 복원');
console.log('의원 발의·의회 표결·직업 배경 무관 작위 수여 확인 완료');
