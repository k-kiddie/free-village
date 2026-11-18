const assert=require('node:assert/strict');
const {createWorld}=require('../engine.js');

const w=createWorld(612,120);w.dynStart();w.dynChoose(w.S.dyn.pending[0].id,'go');
const me=w.S.byId.get(w.S.dyn.pid),ceo=w.S.agents.find(x=>x.alive&&x.id!==me.id&&x.age>=18*60);me.cash=10000;w.S.cbank={base:.02};w.S.banks=[{id:1,name:'가문은행',own:me.id,alive:true,capital:10,ops:{loanRate:.02,depositRate:.008,reserveRatio:.15}}];
const firm={id:1,name:'새빛상사',pre:'새빛',suf:'상사',ceo:ceo.id,founder:ceo.id,sh:{[ceo.id]:10000},totalShares:10000,shareVersion:74,price:1,p30:1,born:w.S.day,bld:[],cash:100,debt:0};w.S.firms.push(firm);w.S.nextFirm=2;
const action=w.dynActions().find(a=>a.k==='corp:offer:1');assert(action?.corpLoanSpec,'기업 대상 대출 제안');assert.equal(action.corpLoanSpec.baseRate,.02,'기준금리 제안에 표시');
const before=me.cash;w.dynAct('corp:offer:1:100:0.02:6:none');assert.equal(w.S.corpLoans.length,0,'협상 전에는 계약을 만들지 않음');assert(w.S.dyn.pending.some(p=>p.kind==='corpNegotiation'),'기업 응답 협상 단계');
const proposal=w.S.dyn.pending.find(p=>p.kind==='corpNegotiation');assert(proposal.opts.some(o=>o.k==='seal'),'기업 수락 후 은행 최종 승인 선택');w.dynChoose(proposal.id,'seal');
assert.equal(w.S.corpLoans.length,1,'최종 승인 후 계약 생성');assert.equal(firm.cash,200,'대출 실행 뒤 회사에만 자금 입금');assert.equal(me.cash,before-100,'계약 체결 전까지 은행 현금 보존');assert.equal(w.S.corpLoans[0].term,6);assert(w.S.banks[0].finance?.corpOutstanding===100,'기업 대출 잔액 장부');
const saved=JSON.parse(JSON.stringify(w.exportState())),restored=createWorld(1,1);restored.importState(saved);assert.equal(restored.S.corpLoans[0].firm,firm.id,'기업 계약 저장 복원');assert.equal(restored.S.dyn.pending.length,0,'승인한 협상 이벤트 처리');
console.log('기준금리 반영·기업 제안·기업 응답·은행 최종 승인·실행·저장 복원 확인 완료');
