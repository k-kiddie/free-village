const assert=require('node:assert/strict');
const {createWorld}=require('../engine.js');

const w=createWorld(911,120);w.dynStart();w.dynChoose(w.S.dyn.pending[0].id,'go');
const me=w.S.byId.get(w.S.dyn.pid),chief=w.S.agents.find(a=>a.alive&&a.id!==me.id&&a.age>=18*60);
me.cash=100000;w.S.gov={regime:'rep',chief:chief.id,king:null,regent:null,council:[],policy:{},min:{
  def:{k:'def',name:'국방부',root:'국방',tier:0,mn:chief.id,score:.5,since:w.S.day},
  sec:{k:'sec',name:'정보부',root:'정보',tier:0,mn:chief.id,score:.5,since:w.S.day},
  edu:{k:'edu',name:'교육부',root:'교육',tier:0,mn:chief.id,score:.5,since:w.S.day}
}};
w.S.mil={lvl:2,str:10,morale:.7};
const initial=me.cash;
assert(w.dynActions().some(a=>a.k==='minlobby:edu'),'일반 부처 임명 로비 행동');w.dynAct('minlobby:edu');assert.equal(w.S.dyn.ministerLobby.key,'edu','특정 장관뿐 아니라 다른 공직도 청원 가능');
assert(w.dynActions().some(a=>a.k==='minlobby:def'),'국방 장관직 로비 행동');
assert(w.dynActions().some(a=>a.k==='minlobby:sec'),'정보기관장 로비 행동');
w.dynAct('minlobby:def');
assert.equal(w.S.dyn.ministerLobby.key,'def');assert(me.cash<initial,'로비 후원 비용 지출');
w.S.gov.min.def.mn=me.id;
assert.equal(w.dynView().title,'국방부 장관');assert.equal(w.dynRank(),3,'장관은 정치 직책으로 인식');
const recruit=w.dynActions().find(a=>a.k==='privmil:recruit');
assert(recruit?.opts?.some(o=>o[0]===3),'무장대 3명 모집 선택지');
w.dynAct('privmil:recruit:3');
assert.equal(w.S.dyn.privateMilitia.members.length,3);
assert(w.S.dyn.privateMilitia.upkeep>0,'일일 운영비 계산');
const saved=JSON.parse(JSON.stringify(w.exportState())),restored=createWorld(1,1);restored.importState(saved);
assert.equal(restored.S.dyn.privateMilitia.members.length,3,'사병 조직 저장 복원');
const ids=[...restored.S.dyn.privateMilitia.members];restored.dynAct('privmil:disband');
assert.equal(restored.S.dyn.privateMilitia,null);assert(ids.every(id=>!restored.S.byId.get(id).privateMilitia),'해산 시 조직 소속 해제');
// Political access follows the current regime's institutions, not the player's starting occupation.
for(const regime of ['rep','olig','cmon','mon','mil','com','msoc','theo']){
  w.S.gov.regime=regime;w.S.gov.council=[chief.id];w.S.gov.min.edu.mn=chief.id;me.occ='farmer';
  const actions=w.dynActions();
  assert(actions.some(a=>a.k==='minlobby:edu'),`${regime}: 비선출 공직 청원은 출발 직업과 무관`);
  assert.equal(actions.some(a=>a.k==='runCouncil'),['rep','olig','cmon'].includes(regime),`${regime}: 의원 선거 행동은 선거 체제에서만 표시`);
}
console.log('장관 로비·정보기관장 목표·비밀 사병·저장 복원·해산 확인 완료');
