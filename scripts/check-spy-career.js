const assert=require('node:assert/strict');
const {createWorld}=require('../engine.js');

const w=createWorld(847,120);w.dynStart();w.dynConfigureStart({background:'정보기관 직원'});
const me=w.S.byId.get(w.S.dyn.pid);assert.equal(w.S.dyn.spyCareer,'staff');assert(w.dynActions().some(a=>a.group==='첩보'),'직원 출신의 현장 첩보 행동 해금');
const chief=w.S.agents.find(a=>a.alive&&a.id!==me.id&&a.age>=18*60);me.cash=100000;
w.S.gov={regime:'rep',chief:chief.id,king:null,regent:null,council:[],policy:{},min:{sec:{k:'sec',name:'정보부',root:'정보',tier:0,mn:me.id,score:.5,since:w.S.day}}};
assert.equal(w.dynView().title,'국가정보원장','현장 직원 출신도 장관 임명 가능');
const recruit=w.dynActions().find(a=>a.k==='spyorg:recruit');assert(recruit?.opts?.some(o=>o[0]===1),'정보기관장 요원 모집 가능');w.dynAct('spyorg:recruit:1');
const agent=w.S.dyn.spyAgency.members[0],person=w.S.byId.get(agent.id);assert(person.agentOf===me.id,'포섭된 요원의 조직 연결');
const task=w.dynActions().find(a=>a.k===`spyorg:order:${agent.id}`);assert(task?.opts?.some(o=>o[0]==='counter'),'개별 요원 임무 지시 가능');w.dynAct(`spyorg:order:${agent.id}:counter`);assert.equal(agent.mission,'counter');
const saved=JSON.parse(JSON.stringify(w.exportState())),restored=createWorld(1,1);restored.importState(saved);assert.equal(restored.S.dyn.spyCareer,'staff');assert.equal(restored.S.dyn.spyAgency.members[0].mission,'counter','첩보 경력과 요원 명령 저장 복원');
restored.S.gov=null;for(let i=0;i<10;i++)restored.step();assert(restored.S.dyn.spyAgency,'조직 일일 운영 유지');assert(restored.S.dyn.spyAgency.upkeep>0,'일일 운영비 산출');
console.log('정보기관 직원 시작·현장 임무·기관장 임명·요원 지휘·저장 복원 확인 완료');
