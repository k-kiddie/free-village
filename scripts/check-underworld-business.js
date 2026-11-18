const assert=require('node:assert/strict');
const {createWorld}=require('../engine.js');

const w=createWorld(31,120);w.dynStart();w.dynChoose(w.S.dyn.pending[0].id,'go');
const me=w.S.byId.get(w.S.dyn.pid);me.cash=10000;w.S.power=1;w.dynAct('gang');
const gang=w.S.groups.find(g=>g.id===me.grp);assert(gang&&gang.leader===me.id&&gang.mode==='gang','플레이어가 패거리 두목');
const member=w.S.agents.find(x=>x.alive&&x.id!==me.id&&x.age>=18*60&&!x.grp);assert(member,'업무 배정 대상 조직원');member.grp=gang.id;gang.members.push(member.id);
const bizAction=w.dynActions().find(a=>a.k==='extra:gang:business');assert(bizAction?.opts?.some(o=>o[0]==='smuggle'),'무시설 소규모 밀수망 선택');
w.dynAct('extra:gang:business:smuggle');assert(gang.dynOps.businesses[0].active,'사업 시작');
const task=w.dynActions().find(a=>a.k===`extra:gang:task:${member.id}`);assert(task?.opts?.some(o=>o[0]==='runner'),'조직원별 임무 선택');
w.dynAct(`extra:gang:task:${member.id}:runner`);assert.equal(gang.dynOps.orders[member.id],'runner');
const memberId=member.id;for(let i=0;i<3;i++)w.step();assert(gang.tre>0,'조직 금고에 사업 매출이 반영됨');assert.equal(gang.dynOps.orders[memberId],'runner','조직원 임무 유지');
assert(w.dynView().gangBusiness.businesses.length===1,'사업 현황 화면 정보');
const saved=JSON.parse(JSON.stringify(w.exportState())),restored=createWorld(1,1);restored.importState(saved);const rg=restored.S.groups.find(g=>g.id===restored.S.dyn.pid&&g.mode==='gang')||restored.S.groups.find(g=>g.id===restored.S.byId.get(restored.S.dyn.pid).grp);assert(rg?.dynOps?.businesses.length===1,'조직 사업 저장 복원');assert.equal(rg.dynOps.orders[member.id],'runner','조직원 명령 저장 복원');
console.log('무시설 조직 사업·요원 임무·급여·매출·현황·저장 복원 확인 완료');
