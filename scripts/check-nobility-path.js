const assert=require('node:assert/strict');
const {createWorld}=require('../engine.js');

const w=createWorld(513,120);w.dynStart();w.dynConfigureStart({background:'농촌'});
const me=w.S.byId.get(w.S.dyn.pid),king=w.S.agents.find(x=>x.alive&&x.id!==me.id&&x.age>=18*60),target=w.S.agents.find(x=>x.alive&&x.id!==me.id&&x.id!==king.id&&x.age>=18*60);
me.cash=100000;me.rep=.95;w.S.gov={regime:'mon',king:king.id,chief:null,regent:null,council:[],policy:{},tre:1000,min:{}};
assert(w.dynActions().some(a=>a.k==='extra:noble:petition'),'비정치 직업 출신도 군주정 작위 청원 경로 이용');
// 군주가 같은 인물에게 작위를 올려 주는 경로는 남작부터 공작까지 이어진다.
me.cash=100000;w.S.gov.king=me.id;
for(const title of ['남작','자작','백작','공작']){w.S.dyn.cool[`actgrantTitle${target.id}`]=0;assert(w.dynTargetActions(target.id).some(a=>a.k===`tgt:title:${target.id}`),'군주 작위 수여·승급 행동');w.dynAct(`tgt:title:${target.id}`);assert.equal(target.dynNoble,title)}
assert.equal(w.dynView().me.noble,null,'플레이 인물의 직함과 수여 대상 구분');
const saved=JSON.parse(JSON.stringify(w.exportState())),restored=createWorld(1,1);restored.importState(saved);assert.equal(restored.S.byId.get(target.id).dynNoble,'공작','공작 작위 저장 복원');
console.log('직업 무관 작위 청원·남작부터 공작 승급·저장 복원 확인 완료');
