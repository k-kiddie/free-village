'use strict';
// 높으신 분 털기: 서민 마을에서도 직위·회사·국고를 노릴 수 있고, 돈은 실제 계정 사이에서만 옮겨지는지 검사한다.
const assert=require('node:assert/strict');
const {createWorld}=require('../engine');
const w=createWorld(812,120);w.dynStart();w.dynConfigureStart({age:30});w.dynChoose(w.S.dyn.pending[0].id,'go');const S=w.S,me=S.byId.get(S.dyn.pid);S.dyn.pending=[];

// 모두 서민: 현금이 적어 기존 강도 대상이 없음
for(const a of S.agents)if(a!==me)a.cash=1;
let rob=w.dynActions().find(a=>a.k==='crime:rob');assert(!rob.ok,'서민 마을에서는 기존 강도 대상이 없음');
// 회사 대표 한 명에게 돈이 있음
const rich=S.agents.find(a=>a.alive&&a!==me&&w.isAdult(a)&&!me.kids.includes(a.id)&&a.id!==me.partner);rich.cash=5000;
const f={id:S.nextFirm++,name:'시험 상회',pre:'시험',suf:'상회',ceo:rich.id,sh:{[rich.id]:10000},totalShares:10000,shareVersion:74,cash:3000,price:1,p30:1,peak:1,bld:[],born:S.day,divE:0,hist:[]};S.firms.push(f);
let heist=w.dynActions().find(a=>a.k==='crime:heist');assert(heist&&heist.ok,'높으신 분 털기 가능');
assert(heist.opts.some(o=>o[0]==='p'+rich.id&&o[1].includes('대표')),'회사 대표 저택이 대상');assert(heist.opts.some(o=>o[0]==='f'+f.id),'회사 금고가 대상');
const total=()=>S.agents.reduce((t,a)=>t+a.cash,0)+S.firms.reduce((t,x)=>t+(x.cash||0),0)+(S.gov?.tre||0);
let ok=0,fail=0;for(let i=0;i<40;i++){S.dyn.cool={};me.jailUntil=0;me.health=100;const before=total(),rc=rich.cash,mc=me.cash;w.dynAct('crime:heist:p'+rich.id);assert(Math.abs(total()-before)<1e-6,'통화량 보존');if(me.cash>mc){ok++;assert(Math.abs((rc-rich.cash)-(me.cash-mc))<1e-6)}else fail++;rich.cash=5000}
assert(ok>0&&fail>0,`성공·실패가 모두 나옴(성공 ${ok}·실패 ${fail})`);
S.dyn.cool={};const fc=f.cash,mc=me.cash;w.dynAct('crime:heist:f'+f.id);assert(Math.abs((fc-f.cash)-(me.cash-mc))<1e-6,'회사 금고 이동액 일치');
assert(w.dynActions().find(a=>a.k==='crime:heist').why.includes('기다려야'),'쿨다운 적용');
console.log(`높으신 분 털기: 서민 마을 대상 생성·회사 대표/금고·통화량 보존·성공 ${ok}/실패 ${fail}·쿨다운 통과`);
