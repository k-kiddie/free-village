'use strict';
// 정부 조직: 수장이 부처 신설·폐지, 경찰 설치·승격, 장관 임명·해임을 하고, 엔진 자동 조직이 이를 함부로 되돌리지 않는지 검사한다.
const assert=require('node:assert/strict');
const {createWorld,YEAR}=require('../engine');
const w=createWorld(2429,200);w.dynStart();w.dynConfigureStart({age:34,status:'king'});w.dynChoose(w.S.dyn.pending[0].id,'go');const S=w.S,D=S.dyn,me=S.byId.get(D.pid),G=S.gov;
D.pending=[];if(D.story)D.story.freq=0;G.tre=1e6;
const A=k=>w.dynActions().find(a=>a.k===k),cool=()=>{for(const k of Object.keys(D.cool))if(/^actgo/.test(k))D.cool[k]=0};
const total=()=>S.agents.reduce((t,a)=>t+a.cash,0)+(G.tre||0);
// 부처 신설: 경찰 부처
const nw=A('govorg:new');assert(nw&&nw.ok,'부처 신설 가능: '+(nw&&nw.why));assert(nw.opts.some(o=>o[0]==='police'),'경찰 부처 후보');
let t0=total();w.dynAct('govorg:new:police');assert(G.min.police&&G.min.police.dynMade,'경찰 부처 생김');assert(Math.abs(total()-t0)<1e-6,'창설비는 주민에게(통화량 보존)');assert((G.inst.police||0)>=1,'경찰 기관도 설치');
// 경찰 승격
cool();const pa=A('govorg:police');if(pa){t0=total();w.dynAct('govorg:police');assert.equal(G.inst.police,2,'경찰 독립 기관');assert(Math.abs(total()-t0)<1e-6)}
// 장관 임명
cool();const ap=A('govorg:appoint:police');assert(ap&&ap.ok,'장관 인사 가능');const pick=ap.opts.find(o=>o[0][0]==='p');w.dynAct('govorg:appoint:police:'+pick[0]);const mid=Number(pick[0].slice(1));assert.equal(G.min.police.mn,mid,'내가 고른 장관');
// 1년 동안 자동 조직이 내 부처를 없애거나 내 장관을 임의로 바꾸지 않음(죽거나 갇히는 경우 제외)
for(let i=0;i<YEAR;i++){w.step();D.pending=D.pending.filter(p=>p.inbox)}
assert(G.min.police,'내가 만든 부처 유지');const m=S.byId.get(mid);if(m&&m.alive&&!((m.jailUntil||0)>S.day)&&G.chief===me.id)assert.equal(G.min.police.mn,mid,'내가 고른 장관 유지');
// 해임과 폐지
cool();w.dynAct('govorg:appoint:police:fire');assert(!G.min.police.mn,'해임');
cool();const ab=A('govorg:abolish');assert(ab.opts.some(o=>o[0]==='police'),'폐지 후보');w.dynAct('govorg:abolish:police');assert(!G.min.police,'폐지');
assert(!ab.opts.some(o=>['edu','fin','dip','def'].includes(o[0])),'기본 부처는 폐지 불가');
// 수장이 아니면 목록 없음
G.chief=null;G.king=null;assert(!A('govorg:new'),'수장만');
console.log(`정부 조직: 부처 신설(경찰)·경찰 ${pa?'설치·승격':'설치'}·장관 임명 유지·해임·폐지·기본 부처 보호·통화량 보존 통과`);
