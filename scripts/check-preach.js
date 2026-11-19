'use strict';
// 전도 방법 8가지와 독실함: 방법마다 대상·독실함이 다르고, 낮은 신도는 떠나며, 돈은 사람 사이에서만 옮겨지는지 검사한다.
const assert=require('node:assert/strict');
const {createWorld,YEAR}=require('../engine');
const w=createWorld(2429,180);w.dynStart();w.dynConfigureStart({age:34,status:'king',family:'children'});w.dynChoose(w.S.dyn.pending[0].id,'go');
const S=w.S,D=S.dyn,me=S.byId.get(D.pid);D.pending=[];if(D.story)D.story.freq=0;me.cash=1e6;
w.dynAct('extra:found:charity+honest:시험');const fa=S.faiths.find(f=>f.leader===me.id);assert(fa,'교단 창시');
const A=k=>w.dynActions().find(a=>a.k===k),reset=()=>{for(const k of Object.keys(D.cool))if(/^actpr|^actpreach/.test(k))D.cool[k]=0;me.cash=Math.max(me.cash,1e6);me.jailUntil=0};
for(const k of ['extra:preach','extra:visit','extra:relief','extra:heal','extra:kin','extra:debate','extra:court','extra:school','extra:force'])assert(A(k),k+' 목록');
const total=()=>S.agents.reduce((t,a)=>t+a.cash,0)+S.firms.reduce((t,f)=>t+(f.cash||0),0)+(S.gov?.tre||0)+S.faiths.reduce((t,f)=>t+(f.tre||0),0);
const out={};
// 아픈 사람·가난한 사람 준비
const ad=S.agents.filter(a=>a.alive&&w.isAdult(a)&&a!==me);for(const a of ad.slice(10,16))a.health=40;for(const a of ad.slice(20,30)){a.hunger=70;a.cash=0}
// 다른 교단(논쟁 상대)과 의원(포섭 대상) 준비
const rivalL=ad[40];S.faiths.push({id:999,name:'다른교',leader:rivalL.id,doc:['ascetic','obey'],members:6,tre:0});rivalL.faith=999;for(const a of ad.slice(41,47)){a.faith=999;a.piety=.3}
S.gov.council=[ad[50].id,ad[51].id];ad[50].g.faith=.9;
for(const k of ['visit','relief','heal','kin','court','debate','force','school']){reset();const a=A('extra:'+k);if(!a.ok){out[k]='불가: '+a.why;continue}const before=total();try{out[k]=w.dynAct('extra:'+k+(a.opts?':'+a.opts[0][0]:'')).text}catch(e){throw Error(k+' '+JSON.stringify(a.opts)+' '+e.message)}assert(Math.abs(total()-before)<1e-6,k+' 통화량 보존')}
// 독실함: 방법별 평균
const by={};for(const x of S.agents)if(x.alive&&x.faith===fa.id&&x.faithVia){(by[x.faithVia]=by[x.faithVia]||[]).push(x.piety)}
const avg=v=>v.reduce((a,b)=>a+b,0)/v.length;
if(by.force&&by.kin)assert(avg(by.force)<avg(by.kin),'강압 개종은 가족 전도보다 독실함이 낮음');
if(by.relief&&by.kin)assert(avg(by.relief)<avg(by.kin),'구제 신도는 가족 신도보다 독실함이 낮음');
// 시간이 지나면 낮은 신도가 떠남
const forced=S.agents.filter(x=>x.alive&&x.faith===fa.id&&x.faithVia==='force').length;
for(let i=0;i<YEAR;i++){w.step();D.pending=[]}
const stay=S.agents.filter(x=>x.alive&&x.faith===fa.id&&x.faithVia==='force').length,kinStay=S.agents.filter(x=>x.alive&&x.faith===fa.id&&x.faithVia==='kin').length;
assert(stay<forced||forced===0,`강압 신도가 떠남 ${forced}→${stay}`);
const v=w.dynView();assert(v.faithInfo.piety!=null,'독실함 평균 표시');
console.log(Object.entries(out).map(([k,t])=>`  ${k}: ${t}`).join('\n'));
console.log(`  독실함 평균(방법별): ${Object.entries(by).map(([k,v])=>k+' '+Math.round(avg(v)*100)).join(' · ')}`);
console.log(`  1년 뒤 강압 신도 ${forced}→${stay}명, 가족 신도 ${kinStay}명 남음 · 화면 독실함 평균 ${v.faithInfo.piety}`);
console.log('전도 다양화: 8가지 방법·독실함·이탈·통화량 보존 통과');
