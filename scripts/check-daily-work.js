'use strict';
// 하루 일 개선: 우선순위·못 한 이유·사업 경영·공무 고정·땡땡이·주민 끈기를 검사한다.
const assert=require('node:assert/strict');
const {createWorld,YEAR}=require('../engine');
const fresh=(seed=812,n=140)=>{const w=createWorld(seed,n);w.dynStart();w.dynConfigureStart({age:30});w.dynChoose(w.S.dyn.pending[0].id,'go');w.S.dyn.pending=[];return w};
const quiet=w=>{w.S.dyn.pending=[];if(w.S.dyn.story)w.S.dyn.story.freq=0};
// 1. 우선순위와 이유
{const w=fresh(),S=w.S,me=S.byId.get(S.dyn.pid);quiet(w);me.inv.grain=0;me.cash=0;
  w.dynSetBudget({job:1/*COOK*/,job2:12/*TRADE*/,job3:0/*FARM*/});
  for(let i=0;i<3;i++){me.inv.grain=0;me.cash=0;w.step();quiet(w)}
  const v=w.dynView();assert(v.today,'오늘 한 일 기록');
  assert(v.today.why.includes('요리')&&v.today.why.includes('곡식'),'1순위 못 한 이유 표시: '+v.today.why);
  assert(v.today.why.includes('장사'),'2순위 못 한 이유도 표시');}
// 2. 사업 경영: 내 회사가 없으면 이유, 있으면 경영하고 매출 배수가 오름
{const w=fresh(),S=w.S,me=S.byId.get(S.dyn.pid);quiet(w);w.dynSetBudget({job:100});w.step();quiet(w);
  assert(w.dynView().today.why.includes('경영할 사업'),'경영할 사업이 없을 때 이유');
  const f={id:S.nextFirm++,name:'경영 상회',pre:'경영',suf:'상회',ceo:me.id,sh:{[me.id]:10000},totalShares:10000,shareVersion:74,cash:500,price:1,p30:1,peak:1,bld:[],born:S.day,divE:0,hist:[]};S.firms.push(f);me.firm=f.id;
  assert(w.dynView().canManage,'회사가 있으면 경영 가능');
  for(let i=0;i<8;i++){me.fat=0;w.step();quiet(w)}
  const v=w.dynView();assert.equal(v.today.kind,'manage','경영한 날로 기록');assert.equal(v.today.didN,'사업 경영');assert(v.manageRatio>=6,'경영 일수 누적 '+v.manageRatio);}
// 3. 공무 고정과 땡땡이(왕으로 시작)
{const w=createWorld(2429,160);w.dynStart();w.dynConfigureStart({age:34,status:'king'});w.dynChoose(w.S.dyn.pending[0].id,'go');const S=w.S,me=S.byId.get(S.dyn.pid);quiet(w);assert(S.gov&&S.gov.chief===me.id,'왕으로 시작');
  w.dynSetBudget({duty:0,job:0});const ap0=S.gov.approval??.5;for(let i=0;i<10;i++){w.step();quiet(w)}
  let v=w.dynView();assert(v.official,'전업 공직 판정');assert.equal(v.today.kind,'duty','공무를 봄');assert.equal(v.today.didN,'공무');
  // 주민 공직자: 재판관·장관 등 대부분이 공무
  w.dynSetBudget({duty:2});for(let i=0;i<20;i++){w.step();quiet(w)}v=w.dynView();
  assert.equal(v.today.kind,'slack','땡땡이 날은 개인 일');assert(v.today.didN!=='공무');assert(v.slack>0||S.dyn.chron.some(c=>c.text.includes('태만')),'땡땡이 누적');
  console.log(`  공무: 왕 성실 공무 · 땡땡이 누적 ${v.slack} · 지지율 ${Math.round(ap0*100)}→${Math.round((S.gov.approval??.5)*100)}`);}
// 4. 주민 끈기: 가문 마을 주민이 매일 일을 바꾸는 횟수가 줄었는지(끈기 유전자 부여 확인)
{const w=fresh(91,160),S=w.S;quiet(w);let sw=0,tot=0;const prev=new Map();
  for(let d=0;d<120;d++){w.step();quiet(w);for(const a of S.agents){if(!a.alive||!w.isAdult(a)||a.id===S.dyn.pid)continue;if(prev.has(a.id)){tot++;if(prev.get(a.id)!==a.act)sw++}prev.set(a.id,a.act)}}
  const withStick=S.agents.filter(a=>a.alive&&a.g.stick!=null).length;assert(withStick>20,'끈기 유전자 부여');
  console.log(`  주민 일 바꾸기 비율 ${(sw/tot*100).toFixed(1)}% · 끈기 유전자 ${withStick}명`);}
console.log('하루 일 개선: 우선순위·이유 표시·사업 경영·공무 고정·땡땡이·끈기 통과');
