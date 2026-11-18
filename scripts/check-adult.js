'use strict';
// 가문 모드 성인 요소(유혹·하룻밤·파티·후궁·업소·잡지·관광·미인계·성 접대·스캔들)와 사건이 오류 없이 돈다
const assert=require('node:assert/strict');
const src=require('fs').readFileSync(__dirname+'/check-story-fuzz.js','utf8');const {createWorld}=require('../engine.js');const rich=eval('('+src.match(/function rich[\s\S]*?\n}\n/)[0]+')');
const {w,S,D,me}=rich(1701);
const cool=()=>{for(const k of Object.keys(D.cool))if(/^act(ad|rr)/.test(k))D.cool[k]=0;me.jailUntil=0;me.cash=1e6;me.health=100};
const A=k=>w.dynActions().find(a=>a.k===k);
const run=(k,v)=>{cool();const a=A(k);assert(a,k+' 목록');assert(a.ok,k+' 가능: '+a.why);return w.dynAct(v!=null?k+':'+v:k)};
for(const a of S.agents)if(a.alive&&a!==me){a.g.lib=.95;a.looks=.9}me.looks=1;
let target;for(let i=0;i<15&&!target;i++){const a=A('adult:seduce');if(!a?.opts?.length)break;run('adult:seduce',a.opts[0][0]);target=Object.values(D.relationships||{}).find(r=>r.actor===me.id&&!r.ended&&r.phase<4)}assert(target,'관심 표현');
run('rel:letter:'+target.target);for(let i=0;i<15&&!target.appointment;i++)run('rel:invite:'+target.target);assert(target.appointment);S.day=target.appointment;run('rel:meet:'+target.target,'quiet');for(let i=0;i<15&&!me.affair;i++)run('rel:commit:'+target.target);assert(me.affair,'양쪽 동의로 정인 관계');
run('adult:end');assert(!me.affair);run('adult:fling');run('adult:party');
const a=A('adult:conc');if(a){for(let i=0;i<15&&!S.agents.some(x=>x.dynConc===me.id);i++)run('adult:conc',a.opts[0][0]);assert(S.agents.some(x=>x.dynConc===me.id),'후궁')}
let id=980000;for(const fx of ['pub','press'])S.bldgs.push({big:false,pname:fx==='press'?'밤신문':null,pk:null,faith:null,id:++id,lot:0,owner:me.id,firm:null,spec:null,pub:false,weak:false,fx:[fx],fee:1,cond:1,built:S.day,builder:me.id,rev:0,revE:0,users:0,stud:0});
run('adult:brothel','b'+(id-1));run('adult:mag','b'+id);if(S.trade?.on)run('adult:tour');
const c0=me.cash;for(let i=0;i<20;i++)w.step();
const h=A('adult:honey');run('adult:honey',h.opts[0][0]);const sb=A('adult:sexbribe');if(sb)run('adult:sexbribe',sb.opts[0][0]);
const x=S.agents.find(q=>q.alive&&q!==me&&w.isAdult(q));D.mem={...D.mem,['dirt_'+x.id]:{v:1,d:S.day,ids:[x.id]}};const sc=A('adult:scandal');run('adult:scandal',sc.opts.find(o=>o[0][0]==='e')[0]);run('adult:scandal',A('adult:scandal').opts.find(o=>o[0][0]==='b')[0]);
// 사건 선택지 전부
const {SE,sCtx}=w._story;let n=0;const l=S.agents.find(q=>q.alive&&q!==me&&w.isAdult(q)&&q.partner);me.affair=l.id;l.affair=me.id;me.std=1;
for(const [eid,e] of Object.entries(SE)){if(!/^ad[A-Z]/.test(eid))continue;for(const [k,,,fn] of e.o){const ctx={sid:eid,title:e.title};try{const c1=sCtx(me,ctx);if(e.need&&!e.need(c1)&&!e.chain)continue;if(e.who){const y=e.who(sCtx(me,ctx));if(y)ctx.x=y.id}const c=sCtx(me,ctx);me.cash=1e6;e.text(c);assert(typeof fn(c)==='string')}catch(err){throw new Error(eid+':'+k+' '+err.message)}n++;me.affair=l.id;l.affair=me.id}}
console.log(JSON.stringify({ok:true,eventOpts:n}));
