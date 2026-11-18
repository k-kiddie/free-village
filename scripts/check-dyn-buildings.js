'use strict';
// 가문 모드 건물 짓기: 마을과 같은 조건으로 잠기고 풀리며, 완공되면 내 건물이 된다
const assert=require('node:assert/strict');
const {createWorld}=require('../engine.js');
const w=createWorld(905,160);w.dynStart();w.dynConfigureStart({age:35});
const S=w.S,D=S.dyn,me=S.byId.get(D.pid);me.cash=1e7;for(let i=0;i<20;i++)w.step();
const A=k=>w.dynActions().find(a=>a.k==='biz:build:'+k);
const all=['b1','b0','b2','b10','pub','shelter','store','gather','vault','guard','heal','press','stage','fac','lab','bigfac','office','arena'];
for(const k of all)assert(A(k),k+' 목록에 있음');
S.medT=0;S.iron=0;S.tall=0;
assert.match(A('heal').why,/의학/);assert.match(A('bigfac').why,/쇠/);assert.match(A('office').why,/고층/);assert.match(A('fac').why,/일꾼/);
const ad=S.agents.filter(a=>a.alive&&w.isAdult(a)).length;if(ad<150)assert.match(A('press').why,/150/);if(ad<350)assert.match(A('arena').why,/350/);
// 일꾼·기술을 갖추면 풀림
const staff=S.agents.filter(a=>a.alive&&w.isAdult(a)&&a!==me&&!a.emp).slice(0,7);for(const x of staff){x.emp=me.id;x.ct={t:'reg',e:me.id,w:1,d:S.day}}
S.medT=1;S.iron=1;S.tall=1;
assert.equal(A('fac').why,'');assert.equal(A('heal').why,'');assert.equal(A('bigfac').ok||/집터|짓고/.test(A('bigfac').why),true);
const build=k=>{const n0=S.bldgs.filter(b=>b.owner===me.id&&b.fx.includes(k)).length;const r=w.dynAct('biz:build:'+k);assert(S.sites.some(x=>x.dynOwner===me.id),k+' 공사 시작');
  assert(A('b1').why.includes('이미'),'공사는 한 번에 하나');
  for(let i=0;i<200&&S.sites.some(x=>x.dynOwner===me.id);i++){w.step();for(const q of D.pending.slice())try{w.dynChoose(q.id,q.opts[0].k)}catch(e){}}
  const b=S.bldgs.filter(b=>b.owner===me.id&&b.fx.includes(k));assert(b.length>n0,k+' 완공되어 내 건물');return b.at(-1)};
const cash0=me.cash;const f=build('fac');assert(me.cash<cash0,'공사비 지불');
build('heal');
for(const x of S.agents.filter(a=>a.alive&&w.isAdult(a)&&a!==me&&!a.site).slice(0,7)){x.emp=me.id;x.ct={t:'reg',e:me.id,w:1,d:S.day}}
const big=build('bigfac');assert.equal(big.big,true,'대형 건물 표시');assert.equal(S.lotUsed[big.lot],99,'집터를 통째로 씀');
// 저장·복원
const r=createWorld(905,160);r.importState(JSON.parse(JSON.stringify(w.exportState())));assert(r.S.bldgs.some(b=>b.id===big.id&&b.big));
console.log(JSON.stringify({ok:true,kinds:all.length,built:['fac','heal','bigfac']}));
