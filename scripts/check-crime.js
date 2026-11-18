'use strict';
// 가문 모드 범죄 확장: 강도·도둑·폭행·강도단·돈세탁·고리대·독촉·인신매매·장기 매매·노예·사법 조작과 범죄 사건
const assert=require('node:assert/strict');
const src=require('fs').readFileSync(__dirname+'/check-story-fuzz.js','utf8');const {createWorld}=require('../engine.js');const rich=eval('('+src.match(/function rich[\s\S]*?\n}\n/)[0]+')');
const {w,S,D,me}=rich(1501);
const cool=()=>{for(const k of Object.keys(D.cool))if(/^actcr/.test(k))D.cool[k]=0;me.jailUntil=0;me.cash=1e6;me.health=100};
const A=k=>w.dynActions().find(a=>a.k===k);
const run=(k,v)=>{cool();const a=A(k);assert(a,k+' 목록');assert(a.ok,k+' 가능: '+a.why);if(v!=null)assert(a.opts?.some(o=>String(o[0])===String(v)),k+' 선택지 '+v);return w.dynAct(v!=null?k+':'+v:k)};
const opt=k=>{cool();return A(k).opts[0][0]};
for(const a of S.agents.filter(a=>a.alive&&a!==me).slice(0,8))a.cash=1e4;
run('crime:rob',opt('crime:rob'));run('crime:steal');run('crime:beat',opt('crime:beat'));
const g=me.grp&&S.groups.find(x=>x.id===me.grp);if(g&&g.leader===me.id&&g.members.length>=4)run('crime:raid');
assert(D.heat>0,'수배 열기');const h0=D.heat;run('crime:launder');assert(D.heat<h0,'돈세탁으로 열기 내려감');
for(const a of S.agents.filter(a=>a.alive&&a!==me))if(a.cash<50)a.cash=1;run('crime:shark');assert(D.shark.book.length>0,'고리대 장부');
for(const b of D.shark.book){const x=S.byId.get(b.id);x.cash=0}for(let i=0;i<12;i++)w.step();
assert(D.shark.book.some(b=>b.miss>0),'연체 발생');const col=A('crime:collect');assert(col,'독촉 행동');
const sl=col.opts.find(o=>o[0][0]==='s');run('crime:collect',sl[0]);assert(S.agents.some(x=>x.enslavedBy===me.id),'노예 노동');
{const c2=A('crime:collect');const o=c2?.opts?.find(o=>o[0][0]==='b');if(o)run('crime:collect',o[0])}
const pv=opt('crime:traffic'),pid=Number(pv.slice(1));run('crime:traffic',pv);assert(!S.byId.get(pid).alive,'인신매매로 사라짐');
run('crime:organ',opt('crime:organ'));
run('crime:free');assert(!S.agents.some(x=>x.alive&&x.enslavedBy===me.id),'노예 해방');
S.gov.cases.push({t:'robbery',who:me.id,amt:5,ev:.5,d:S.day});run('crime:jury');
S.gov.cases.push({t:'robbery',who:me.id,amt:5,ev:.5,d:S.day});if(!S.gov.judge)S.gov.judge=S.agents.find(a=>a.alive&&a!==me&&w.isAdult(a)).id;run('crime:judge');
// 범죄 사건 선택지 전부
const {SE,sCtx}=w._story;let n=0;D.heat=1.5;D.shark=D.shark||{book:[]};D.shark.book.push({id:S.agents.find(a=>a.alive&&a!==me).id,bal:10,miss:3});
for(const [id,e] of Object.entries(SE)){if(!/^cr[A-Z]/.test(id))continue;for(const [k,,,fn] of e.o){const ctx={sid:id,title:e.title};try{const c0=sCtx(me,ctx);if(e.need&&!e.need(c0))continue;if(e.who){const x=e.who(sCtx(me,ctx));if(x)ctx.x=x.id}const c=sCtx(me,ctx);me.cash=1e6;e.text(c);assert(typeof fn(c)==='string')}catch(err){throw new Error(id+':'+k+' '+err.message)}n++}}
console.log(JSON.stringify({ok:true,heat:+D.heat.toFixed(2),eventOpts:n}));
