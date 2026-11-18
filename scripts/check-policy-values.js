const assert=require('node:assert/strict');
const {createWorld}=require('../engine.js');

const w=createWorld(123,100);w.dynStart();w.dynChoose(w.S.dyn.pending[0].id,'go');
const me=w.S.byId.get(w.S.dyn.pid);
w.S.gov={chief:me.id,king:null,council:[],policy:{tax:.1}};
const action=w.dynActions().find(a=>a.k==='law2:tax');
assert(action?.valueSpec,'숫자 정책에 허용 범위와 입력 단위 제공');
assert.equal(action.valueSpec.unit,'%');
assert.throws(()=>w.dynAct('lawval:tax:1.01'),/범위/);
assert.equal(w.S.gov.policy.tax,.1,'범위 밖 수치는 정책에 반영되지 않음');
const result=w.dynAct('lawval:tax:0.13');
assert.equal(w.S.gov.policy.tax,.13,'입력한 13% 정확히 시행');
assert.match(result.text,/10% → 13%/);
console.log('정책 수치 입력·허용 범위·기존 결정 경로 확인 완료');
