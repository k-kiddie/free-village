'use strict';
// 경찰·수사관·재판관이 되어 사건을 처리하고, 의원 어두운 영업과 관련 사건이 오류 없이 돈다
const assert=require('node:assert/strict');
const src=require('fs').readFileSync(__dirname+'/check-story-fuzz.js','utf8');const {createWorld}=require('../engine.js');const rich=eval('('+src.match(/function rich[\s\S]*?\n}\n/)[0]+')');
const {w,S,D,me}=rich(1601);const G=()=>S.gov;
const cool=()=>{for(const k of Object.keys(D.cool))if(/^actdu|^actbld/.test(k))D.cool[k]=0;me.jailUntil=0;me.cash=1e6;me.health=100;me.edu=3;me.rep=1;me.emp=null;me.firm=null};
const A=k=>w.dynActions().find(a=>a.k===k);
const run=(k,v)=>{cool();const a=A(k);assert(a,k+' 목록');assert(a.ok,k+' 가능: '+a.why);return w.dynAct(v!=null?k+':'+v:k)};
G().inst=G().inst||{};G().inst.police=1;
run('duty:cop');assert(me.dynCop,'경찰관');
for(const a of S.agents.filter(a=>a.alive&&a!==me).slice(0,6))a.crimes=2;
const r=A('duty:raid');run('duty:raid',r.opts.find(o=>o[0][0]==='c')[0]);run('duty:raid',A('duty:raid').opts.find(o=>o[0][0]==='b')[0]);
run('duty:probe',A('duty:probe').opts[0][0]);run('duty:protect');
const c0=me.cash;me.cash=0;D.cool.actdu=0;for(let i=0;i<31;i++)w.step();assert(me.cash>0||!me.dynCop,'월급');
run('duty:quit');assert(!me.dynCop);
for(let i=0;i<10&&!(G().prosList||[]).includes(me.id);i++){D.cool.actdupros=0;run('duty:pros')}assert((G().prosList||[]).includes(me.id),'수사관');
// 내가 맡은 사건 처리
const sus=S.agents.find(a=>a.alive&&a!==me&&w.isAdult(a)&&!(a.jailUntil>S.day)&&a.grp!==me.grp&&!me.kids.includes(a.id)&&a.id!==me.partner);G().cases.push({t:'robbery',who:sus.id,amt:5,ev:.6,d:S.day});
let p=null;for(let i=0;i<120&&!p;i++){w.step();p=D.pending.find(x=>x.kind==='duty');for(const q of D.pending.slice())if(q.kind!=='duty')try{w.dynChoose(q.id,q.opts[0].k)}catch(e){}if(!G().cases.some(c=>c.who===sus.id)&&!p)G().cases.push({t:'robbery',who:sus.id,amt:5,ev:.6,d:S.day})}
assert(p,'맡은 사건 선택지');const res=w.dynChoose(p.id,p.opts.some(o=>o.k==='bribe')?'bribe':'lenient');assert(res.text);
run('duty:quit');for(let i=0;i<10&&!(G().judges||[]).some(j=>j.id===me.id);i++){D.cool.actdujudge=0;run('duty:judge')}assert((G().judges||[]).some(j=>j.id===me.id),'재판관');run('duty:docket');
// 의원 어두운 영업
const b={big:false,pname:null,pk:null,faith:null,id:990001,lot:0,owner:me.id,firm:null,spec:null,pub:false,weak:false,fx:['heal'],fee:1,cond:1,built:S.day,builder:me.id,rev:0,revE:0,users:0,stud:0};S.bldgs.push(b);
for(const v of ['hp_illegal','hp_divert','hp_fakeCert','hp_vip'])run('bld:'+b.id,v);
// 사건 선택지 전부
const {SE,sCtx}=w._story;let n=0;D.mem={...D.mem,duPressure:{v:sus.id,d:S.day,ids:[sus.id]},duWrong:{v:sus.id,d:S.day,ids:[sus.id]}};me.dynCop=S.day;
for(const [id,e] of Object.entries(SE)){if(!/^(du|hp)[A-Z]/.test(id))continue;for(const [k,,,fn] of e.o){const ctx={sid:id,title:e.title};try{const c1=sCtx(me,ctx);if(e.need&&!e.need(c1)&&!e.chain)continue;if(e.who){const x=e.who(sCtx(me,ctx));if(x)ctx.x=x.id}const c=sCtx(me,ctx);me.cash=1e6;e.text(c);assert(typeof fn(c)==='string')}catch(err){throw new Error(id+':'+k+' '+err.message)}n++}}
console.log(JSON.stringify({ok:true,eventOpts:n,dutyChoice:res.text}));
