'use strict';
const assert=require('node:assert/strict');
const {createWorld,YEAR}=require('../engine');
function boot(status='common'){const w=createWorld(42,100);w.dynStart();w.dynConfigureStart({age:40,status,family:'children',edu:0});w.dynChoose(w.S.dyn.pending[0].id,'go');w.dynSetStory(2);return {w,S:w.S,D:w.S.dyn,me:w.S.byId.get(w.S.dyn.pid)}}
function choose(o,id,k,ctx={}){const e=o.w._story.SE[id],c=o.w._story.dynStoryContext(e,o.me,{sid:id,actor:o.me.id,...ctx});assert(c,id+' 발생 조건');o.w._story.dynStoryPush(e,c,o.me);const p=o.D.pending.find(p=>p.kind==='story'&&p.ctx.sid===id);assert(p);return o.w.dynChoose(p.id,k)}
{
 const o=boot(),t=o.S.agents.find(a=>a!==o.me&&a.alive&&a.age>=18*YEAR);t.edu=4;o.me.cash=0;assert.throws(()=>choose(o,'mentor','learn',{x:t.id}),/자금/);assert.equal(o.me.edu,0);assert.equal(o.me.cash,0);
}
{
 const o=boot(),x=o.S.agents[0],l=o.S.agents[1];o.me.cash=100;o.S.loans.push({id:999,b:x.id,l:l.id,bal:100,rate:.01,next:10});const cash=l.cash;choose(o,'debtHelp','help',{x:x.id});assert.equal(o.S.loans.find(l=>l.id===999).bal,90);assert.equal(l.cash,cash+10);assert.equal(o.me.cash,90);
}
{
 const o=boot(),x=o.S.agents[0];o.me.cash=0;const h=o.S.houses.find(h=>h.owner===x.id);const cash=x.cash;assert.throws(()=>choose(o,'debtHelp','house',{x:x.id}),/자금/);assert.equal(x.cash,cash);if(h)assert.equal(h.owner,x.id);
}
{
 const o=boot();o.me.cash=100;for(const p of o.S.plots)p.sale=null;assert.throws(()=>choose(o,'flood','buy'),/매물|없는 선택/);assert.equal(o.me.cash,100);
}
{
 const o=boot(),x=o.S.byId.get(o.me.kids[0]);o.D.heir=x.id;choose(o,'feudGrudge','cut',{y:x.id});assert.equal(o.D.heir,null);assert(!o.w.dynView().heirs.some(h=>h.id===x.id));o.me.health=-100;o.w.step();assert.notEqual(o.D.pid,x.id);
}
{
 const o=boot('king');o.S.hist.push({starve:100});o.S.gov.tre=10000;const x=o.S.agents[0];x.hunger=100;const cash=o.me.cash;choose(o,'spFamine','gov');assert.equal(x.hunger,65);assert.equal(o.me.cash,cash);assert(o.S.gov.tre<10000);
 const b=boot();b.S.hist.push({starve:100});const e=b.w._story.SE.spFamine,c=b.w._story.dynStoryContext(e,b.me);b.w._story.dynStoryPush(e,c,b.me);assert(!b.D.pending.at(-1).opts.some(x=>x.k==='gov'));
}
{
 const o=boot('king');o.S.gov.policy.tax=.2;choose(o,'guildDemand','grant');assert.equal(o.S.gov.policy.tax,.18);
}
{
 const o=boot();o.me.cash=10000;const before=o.w.moneySupply();o.w.dynVault('in',1);assert.equal(o.w.moneySupply(),before);o.w.dynVault('out',1);assert.equal(o.w.moneySupply(),before);
}
{
 const o=boot('king');o.S.gov.tre=0;assert.throws(()=>o.w.dynAct('pol2:works:road'),/국고/);assert(!o.D.cool.actp2works);const sp=o.S.byId.get(o.me.partner);o.w.dynView();o.me.cash=0;assert.throws(()=>o.w.dynAct('rel:visit:'+sp.id+':gift'),/비용/);assert(!o.D.cool['actrrvisit'+sp.id]);assert.doesNotThrow(()=>o.w.dynAct('rel:visit:'+sp.id+':talk'));
}
{
 const o=boot();o.me.armyUntil=100;o.me.soldier='army';o.me.cash=1000;o.S.trade={on:true,towns:[{name:'검증국'}]};assert(!o.w.dynActions().find(a=>a.k==='social:travel').ok);assert.throws(()=>o.w.dynAct('social:travel:n'+encodeURIComponent('검증국')),/복무|여행/);
}
{
 const o=boot();o.me.health=-100;o.me.partner=null;o.me.kids=[];o.D.heir=null;o.w.step();const r=createWorld(42,100);r.importState(JSON.parse(JSON.stringify(o.w.exportState())));assert.doesNotThrow(()=>r.dynView());
}
{
 const o=boot('king'),other=o.S.agents[0];o.S.gov.chief=other.id;o.S.gov.king=other.id;const G=o.S.gov;G.council=[o.me.id,other.id,o.S.agents[1].id];for(const x of G.council)o.S.byId.get(x).g.civic=1;G.tre=1000;const cash=o.me.cash;o.w.dynAct('public:proposal:welf');assert.equal(o.me.cash,cash);assert(G.publicRequests.some(r=>r.status==='approved'));assert(!o.w.dynActions().some(a=>a.k.startsWith('public:execute:')));
 G.min={edu:{k:'edu',mn:o.me.id,name:'교육부',tier:0}};G.bud={lines:{edu:100,welf:100},spent:{},total:200,d:0};assert(!o.w.dynActions().some(a=>a.k==='public:relief'));G.min={welf:{k:'welf',mn:o.me.id,name:'복지부',tier:0}};o.S.agents[0].hunger=100;assert(o.w.dynActions().some(a=>a.k==='public:relief'&&a.ok));const request=G.publicRequests.find(r=>r.status==='approved'),tre=G.tre;o.w.dynAct('public:execute:'+request.id);assert.equal(request.status,'executed');assert.equal(G.tre,tre-request.amount);assert.equal(G.bud.spent.welf,request.amount);G.bud.lines.welf=0;assert(!o.w.dynActions().find(a=>a.k==='public:relief').ok);
}
{
 const o=boot('king'),[inside,outside]=o.S.agents;o.S.gov.chief=inside.id;o.S.gov.king=inside.id;o.S.gov.min={};o.S.gov.tre=12345;
 o.S.dist=[{id:1,name:'첫동',chief:o.me.id,tre:1000,gu:1},{id:2,name:'둘동',chief:outside.id,tre:1000,gu:2}];o.S.gu=[{id:1,name:'첫구',chief:inside.id,tre:1000},{id:2,name:'둘구',chief:outside.id,tre:1000}];o.S.tileD=Array(10000).fill(0);o.S.tileD[0]=1;o.S.tileD[1]=2;
 for(const a of o.S.agents)a.hunger=0;inside.hunger=100;outside.hunger=100;o.S.houses.push({id:99001,lot:0,owner:inside.id,occ:inside.id,cond:1},{id:99002,lot:1,owner:outside.id,occ:outside.id,cond:1});inside.home=99001;outside.home=99002;
 const cash=o.me.cash;o.w.dynAct('public:relief');assert.equal(o.S.dist[0].tre,998);assert.equal(o.S.dist[1].tre,1000);assert.equal(o.S.gov.tre,12345);assert.equal(o.me.cash,cash);assert.equal(inside.hunger,80);assert.equal(outside.hunger,100);
 o.S.gu[0].chief=o.me.id;o.D.cool.actpublicrelief=0;inside.hunger=100;o.w.dynAct('public:relief');assert.equal(o.S.gu[0].tre,998);assert.equal(o.S.gu[1].tre,1000);assert.equal(o.S.dist[0].tre,998);assert.equal(o.S.gov.tre,12345);assert.equal(outside.hunger,100);
}
{
 const o=boot('king'),other=o.S.agents[0];o.S.gov.chief=other.id;o.S.gov.king=other.id;o.S.gov.tre=1000;o.me.jailUntil=0;const cash=o.me.cash,crimes=o.me.crimes||0;o.w.dynAct('dark:tax');assert(o.me.cash>cash);assert((o.me.crimes||0)>crimes);assert.equal(o.D.finance.at(-1).scope,'illicit');
}
{
 const o=boot(),x=o.S.agents.find(a=>a!==o.me&&a.alive&&a.age>=18*YEAR);x.g.cheat=.1;o.me.cash=0;const rep=o.me.rep;assert.throws(()=>choose(o,'honestLedger','return',{x:x.id}),/자금/);assert.equal(o.me.rep,rep);const id=o.D.pending.find(p=>p.kind==='story'&&p.ctx.sid==='honestLedger').id,p=o.w.dynView().pending.find(p=>p.id===id);const option=p.opts.find(o=>o.k==='return');assert.equal(option.funding,'personal');assert.equal(option.cost,6);assert.equal(option.available,false);o.w.dynChoose(p.id,'cover');
}
{
 const o=boot();o.me.occ='agri';o.me.cash=5;assert.throws(()=>choose(o,'ocAgriSeed','all'),/자금/);const id=o.D.pending.find(p=>p.ctx?.sid==='ocAgriSeed').id,option=o.w.dynView().pending.find(p=>p.id===id).opts.find(o=>o.k==='all');assert.equal(option.cost,8);assert.equal(option.available,false);o.w.dynChoose(id,'old');
}
console.log('공적·개인 지출·의원 표결·부처 권한·실패 원자성·거래·상속·복무·단절 저장 회귀 통과');
