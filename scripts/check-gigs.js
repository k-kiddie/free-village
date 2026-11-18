const assert=require('node:assert/strict');
const {createWorld}=require('../engine.js');

const w=createWorld(481,100);w.dynStart();w.dynChoose(w.S.dyn.pending[0].id,'go');
const me=w.S.byId.get(w.S.dyn.pid);
// 공고 생성과 일반 주민의 구직이 끝난 뒤, 실제 모집 공고에서 계약을 고른다.
for(let i=0;i<2;i++)w.step();
const gig=w.dynActions().find(a=>a.group==='일자리'&&a.ok&&a.opts?.some(o=>o[0]===3));
assert(gig,'조건과 재원이 맞는 3일 일감이 표시됨');
const cash=me.cash;w.dynAct(`${gig.k}:3`);
assert.equal(w.S.dyn.gig.days,3);assert.equal(me.emp,w.S.dyn.gig.employer);
const save=JSON.parse(JSON.stringify(w.exportState()));
const restored=createWorld(1,1);restored.importState(save);
assert.equal(restored.S.dyn.gig.days,3,'진행 중 계약 저장');
const worker=restored.S.byId.get(restored.S.dyn.pid);
for(let i=0;i<3;i++)restored.step();
assert.equal(restored.S.dyn.gig,null,'약정 기간에 계약 종료');
assert(worker.src.wage>0,'기존 급여 회계에 임금 기록');
assert(worker.cash>cash,'계약 수행 후 시작 시점보다 현금 증가');
assert(worker.emp==null,'계약 종료 뒤 고용 관계 해제');
console.log('실제 일감·계약 기간·임금 회계·중간 저장 복원 확인 완료');
