const assert=require('node:assert/strict');
const {createWorld}=require('../engine.js');
const Y=60;

// 1) 시작 설정: 군필/미필
const w=createWorld(601,100);w.dynStart();
const r=w.dynConfigureStart({sex:'M',age:24,served:'yes',boss:50});const me=w.S.byId.get(w.S.dyn.pid);
assert.equal(r.served,'yes');assert.equal(me.served,1,'군필이면 징병 대상에서 빠짐');assert.equal(w.dynView().me.served,true,'화면에 군필 표시');
w.dynConfigureStart({sex:'M',age:24,served:'no'});const me2=w.S.byId.get(w.S.dyn.pid);assert(!me2.served,'미필');assert.equal(w.dynView().me.served,false);
assert.throws(()=>w.dynConfigureStart({served:'maybe'}),/병역/);
const saved=JSON.parse(JSON.stringify(w.exportState())),back=createWorld(1,1);back.importState(saved);assert.equal(back.S.dyn.servedStart,'no','병역 선택 저장 복원');

// 2) 가문 마을: '남녀 모두 징병' 법안을 발의할 수 있다
const g=createWorld(602,100);g.dynStart();g.dynConfigureStart({sex:'F',age:30});const gm=g.S.byId.get(g.S.dyn.pid);gm.cash=100000;
g.S.gov={regime:'rep',chief:gm.id,king:null,regent:null,council:[],policy:{army:true,draft:true},tre:1000,min:{}};
const law=g.dynActions().find(a=>a.k==='law2:draftSex');assert(law,'징병 대상 법안 발의 가능');assert(law.opts.some(o=>o[0]==='on'),'남녀 모두 징병 시행 선택지');
g.dynAct('law2:draftSex:on');assert.equal(g.S.gov.policy.draftSex,true,'통치자 결정으로 시행');

// 3) 정책이 켜지면 여성도 징집된다
const v=createWorld(7,300);let d=0;while(!v.S.gov&&d<600){v.step();d++}assert(v.S.gov,'정부 형성');
const P=v.S.gov.policy;Object.assign(P,{army:true,draft:true,draftSex:true,milBudget:2,draftYears:2});
if(!v.S.mil)v.S.mil={lvl:2,d:v.S.day,bases:[],morale:.6};for(const a of v.S.agents)if(a.sex==='M')a.served=1;
for(let i=0;i<90;i++)v.step();
assert(v.S.agents.some(a=>a.drafted&&a.sex==='F'),'남녀 모두 징병: 여성 징집');

// 4) 원래 마을에서는 이 정책이 논의되지 않는다(값·준비 기록 없음)
const o=createWorld(8,300);for(let i=0;i<400;i++)o.step();
if(o.S.gov){assert.equal(o.S.gov.policy.draftSex,undefined,'원래 마을 정책값 없음');assert(!(o.S.gov.ready||{}).draftSex,'원래 마을 논의 기록 없음')}
console.log('군필 시작 설정·남녀 모두 징병 정책·여성 징집·원래 마을 불변 확인 완료');
