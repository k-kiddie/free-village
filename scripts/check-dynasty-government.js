'use strict';
const assert=require('node:assert/strict');
const {createWorld}=require('../engine');

function fixture(status){
  const w=createWorld(481,120);
  w.dynStart();
  w.dynConfigureStart({age:32,status,served:'yes',family:'children'});
  const S=w.S,D=S.dyn,me=S.byId.get(D.pid);
  w.dynChoose(D.pending[0].id,'go');
  w.dynSetStory(2);
  return {w,S,D,me,story:w._story};
}

{
  const {w,S,me}=fixture('tycoon');
  for(const p of S.agents)if(p!==me){p.g.civic=1;p.g.comply=0}
  me.rep=.6;
  const blocked=w.dynActions().find(a=>a.k==='lord');
  assert.match(blocked.hint,/찬성 \d+명 · 반대 \d+명/);
  assert.equal(blocked.ok,false);
  assert.throws(()=>w.dynAct('lord'),/주민 반대/);
  assert.equal(S.gov,null);
  for(const p of S.agents)if(p!==me){p.g.civic=0;p.g.comply=1}
  assert(w.dynActions().find(a=>a.k==='lord').ok);
  w.dynAct('lord');
  assert.equal(w.regime(),'mon');
  assert.equal(S.gov.chief,me.id);
}

{
  const {w,S,D,me,story}=fixture('king');
  const G=S.gov,{SE,dynStoryContext,dynStoryEligible,dynStoryPush,dynStoryTick}=story;
  const resident=S.agents.find(x=>x!==me&&w.isAdult(x)&&x.alive);
  G.council=[resident.id];
  G.policy.womenVote=false;
  G.pending={tax:.2};
  assert.match(w.dynAct('lawval:tax:0.13').text,/왕명으로 즉시 시행/);
  assert.equal(G.policy.tax,.13);
  assert.equal(G.pending.tax,undefined);
  assert.match(w.dynAct('law:womenVote').text,/왕명으로 즉시 시행/);
  assert.equal(G.policy.womenVote,true);
  assert.throws(()=>w.dynAct('lawval:welfare:0.5'),/숫자로 설정/);
  assert(w.dynTargetActions(resident.id).some(a=>a.k==='tgt:title:'+resident.id));

  const work=4;
  me.emp=resident.id;
  me.ct={t:'reg',e:resident.id,w:10,d:S.day};
  const saved=createWorld(1,1);
  saved.importState(JSON.parse(JSON.stringify(w.exportState())));
  const restored=saved.S.byId.get(saved.S.dyn.pid);
  assert.equal(restored.emp,null);
  assert.equal(restored.ct,null);
  assert.equal(saved.dynView().me.emp,null);
  assert(!saved.dynView().jobs.some(j=>j.wage));
  assert.throws(()=>saved.dynSetBudget({job:work}),/고용/);

  assert(!dynStoryEligible(SE.officialVisit,me));
  assert(!dynStoryEligible(SE.strayDogs,me));
  assert(dynStoryEligible(SE.spouseCold,me));
  assert.equal(dynStoryContext(SE.officialVisit,resident).x,me.id);
  G.approval=.4;
  const royal=dynStoryContext(SE.royalInspection,me);
  assert(royal&&dynStoryPush(SE.royalInspection,royal,me));
  assert.deepEqual(w.dynView().pending[0].opts.map(o=>o.k),['audience','report']);
  assert.match(w.dynChoose(D.pending[0].id,'report').text,/국왕 보고/);

  const chron=D.chron.length;
  const wrongActor={id:'kindnessRepaid',at:S.day,ctx:{actor:resident.id,x:resident.id}};
  const deadTarget=S.agents.find(x=>x!==me&&x!==resident&&x.alive);
  deadTarget.alive=false;
  D.story.next=S.day+999;
  D.story.lastTrig=S.day;
  D.story.q.push(wrongActor,{id:'kindnessRepaid',at:S.day,ctx:{actor:me.id,x:deadTarget.id}});
  dynStoryTick(me);
  assert.equal(D.pending.length,0);
  assert.equal(D.story.q.length,0);
  assert.equal(D.chron.length,chron);

  const vote=G.lastVote,royalTax=G.policy.tax;
  G.regime='cmon';G.king=me.id;G.chief=resident.id;
  G.council=[];
  assert.equal(dynStoryContext(SE.royalInspection,me),null);
  assert(!w.dynActions().some(a=>a.k==='govern:report'));
  assert(!w.dynActions().some(a=>a.k==='intervene:send'));
  assert.doesNotMatch(w.dynActions().find(a=>a.k==='law2:tax').hint,/왕명/);
  assert.equal(G.lastVote,vote);
  assert.equal(G.policy.tax,royalTax);
}

{
  const {w,S,D,me,story}=fixture('king');
  const G=S.gov,{SE,dynStoryEligible,dynStoryContext,dynStoryPush}=story;
  G.regime='rep';
  S.dist=[{id:1,name:'서쪽'},{id:2,name:'중앙'},{id:3,name:'동쪽'}];
  assert.equal(w.chiefTitle(),'대통령');
  assert(!dynStoryEligible(SE.officialVisit,me));
  assert(!dynStoryEligible(SE.strayDogs,me));
  assert.equal(dynStoryContext(SE.royalInspection,me),null);
  const residents=S.agents.filter(x=>x.alive&&x!==me).slice(0,3);
  for(const p of residents)p.hunger=65;
  G.tre=200;
  const ctx=dynStoryContext(SE.electedFoodPetition,me);
  assert(ctx&&dynStoryPush(SE.electedFoodPetition,ctx,me));
  const before=G.tre;
  assert.match(w.dynChoose(D.pending[0].id,'relief').text,/주민 3명/);
  assert(G.tre<before);
  assert(residents.every(p=>p.hunger===45));
  assert(w.dynActions().some(a=>a.k==='govern:report'));
  assert.equal(dynStoryContext(SE.p2DeployDead,me),null);
  S.depl={to:'시험 나라',cas:1};
  assert(dynStoryContext(SE.p2DeployDead,me));

  const judge=residents[0];
  G.judge=judge.id;
  G.jr={law:{},rev:[],log:[{d:S.day,text:'위헌 결정. 시험 판결'}]};
  const court=dynStoryContext(SE.p2Court,me);
  assert(court&&dynStoryPush(SE.p2Court,court,me));
  assert.equal(w.dynView().pending[0].cast[0].role,'재판관');
  G.jr.log=[];
  assert.match(w.dynChoose(D.pending[0].id,'obey').text,/상황이 바뀌어/);
  assert.equal(D.storyHist?.p2Court,undefined);
}

console.log('주민 찬반과 군주정 선포, 왕명 시행, 고용과 저장 복원, 체제별 권한·사건·등장인물 검증 완료');
