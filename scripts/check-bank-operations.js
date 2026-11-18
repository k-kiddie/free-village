const assert=require('node:assert/strict');
const {createWorld}=require('../engine.js');

const w=createWorld(772,120);w.dynStart();w.dynChoose(w.S.dyn.pending[0].id,'go');
const me=w.S.byId.get(w.S.dyn.pid);me.cash=100000;me.rep=.95;w.S.power=1;
for(let i=0;i<5;i++){
  const action=w.dynActions().find(a=>a.loanSpec);assert(action,'대출 신청 후보 생성');
  const spec=action.loanSpec;w.dynAct(`${action.k}:${spec.min}:${spec.rates[0]}:none`);
}
assert.equal(w.S.loans.filter(l=>l.l===me.id).length,5,'개인 대출 실적 누적');
const before=me.cash,capitalHint=Number((w.S.wageAvg||1)*8);w.dynAct('bank:found');
const bank=w.S.banks.find(b=>b.own===me.id);assert(bank,'은행 설립');assert.equal(bank.capital,capitalHint);assert.equal((me.dres||0),capitalHint,'설립 자본이 현금에서 준비금으로 이동');assert.equal(me.cash,before-capitalHint,'설립 자본 실제 출금');
w.dynAct(`bank:ops:${bank.id}:0.1:0.02:0.5`);assert.deepEqual(bank.ops,{loanRate:.1,depositRate:.02,reserveRatio:.5},'은행 금리와 준비금 저장');
assert.throws(()=>w.dynAct(`bank:ops:${bank.id}:0.3:0.02:0.5`),/범위/,'범위를 벗어난 금리 거부');
assert.equal(w.dynView().bank.reserveRatio,.5,'은행 운영 정보 표시');
const saved=JSON.parse(JSON.stringify(w.exportState())),restored=createWorld(1,1);restored.importState(saved);assert.equal(restored.S.banks.find(b=>b.own===me.id).ops.loanRate,.1);assert.equal(restored.S.loans.filter(l=>l.l===me.id).length,5,'대부 계약 저장 복원');
console.log('개인 대부·은행 자본 이동·운영 기준·범위 검사·저장 복원 확인 완료');
