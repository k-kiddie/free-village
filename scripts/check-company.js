'use strict';
// 가문 모드 회사 경영: 임금·품목·설비·연구·광고·복지·재단·지점·상장·인수·승계·매각·청산·어두운 경영·현황판·사건
const assert=require('node:assert/strict');
const {createWorld,shareCount}=require('../engine.js');
const w=createWorld(812,180);w.dynStart();w.dynConfigureStart({age:40});
const S=w.S,D=S.dyn,me=S.byId.get(D.pid);me.cash=1e6;
for(let i=0;i<40;i++)w.step();
const ad=()=>S.agents.filter(a=>a.alive&&w.isAdult(a));
const mk=(id,name,ceo,line,cash)=>{const f={id,name,ceo:ceo.id,sh:{[ceo.id]:10000},totalShares:10000,shareVersion:74,price:1,p30:1,peak:1,hist:[1],cash,bld:[],divE:0,born:S.day,lines:[line],suf:'상회'};S.firms.push(f);return f};
const others=ad().filter(a=>a!==me);
const f=mk(9001,'가문상회',me,'trade',5e4);const rival=mk(9002,'경쟁상회',others[0],'trade',3e4);
me.firm=f.id;me.workers=40;
const staff=others.slice(2,10);for(const x of staff){x.emp=me.id;x.ct={t:'reg',e:me.id,w:2,d:S.day,company:f.id};x.firm=null}
const cool=()=>{for(const k of Object.keys(D.cool))if(/^actco/.test(k))D.cool[k]=0;me.jailUntil=0};
const find=k=>w.dynActions().find(a=>a.k===k);
const act=(k,v)=>{cool();const a=find(k);assert(a,`${k} 행동 목록`);assert(a.ok,`${k} 가능: ${a.why}`);if(v!=null)assert(a.opts?.some(o=>String(o[0])===String(v)),`${k} 선택지 ${v}`);return w.dynAct(v!=null?k+':'+v:k)};
const money0=w.moneySupply();
// 1 임금
const w0=staff[0].ct.w;act('co:wage:'+f.id,'up');assert(Math.abs(staff[0].ct.w-w0*1.1)<1e-9,'임금 인상');act('co:wage:'+f.id,'down');act('co:wage:'+f.id,'bonus');assert(f.co.morale>.6,'성과급으로 사기 상승');
// 2 품목
act('co:line:'+f.id,'add_food');assert(f.lines.includes('food'),'새 분야');
// 3 설비 4 연구 5 광고
act('co:fac:'+f.id);assert.equal(f.co.fac,1);
for(let i=0;i<12&&!f.co.pat.length;i++)act('co:rd:'+f.id);assert(f.co.pat.length,'연구 끝에 특허');
act('co:ad:'+f.id,'big');assert(f.co.adUntil>S.day);
// 6 복지·재단 9 지점
act('co:wel:'+f.id);assert.equal(f.co.wel,1);act('co:fund:'+f.id);assert(f.co.fund);act('co:branch:'+f.id);assert.equal(f.co.br,1);
assert(Math.abs(w.moneySupply()-money0)<1e-6*money0,'경영 행동이 돈을 만들거나 없애지 않음');
// 13 현황판
const v=w.dynView?w.dynView():null;const co=(v||w.view?.()||{}).co;
// 월간 경영 효과
const cash0=f.cash;for(let i=0;i<60;i++){w.step();for(const q of D.pending.slice())try{w.dynChoose(q.id,q.opts[0].k)}catch(e){}}
assert(f.co.lastGain>0,'경영 효과로 손님을 끌어옴');
// 8 인수합병
f.cash=Math.max(f.cash,1e5);const small=mk(9003,'작은공방',others[1],'mfg',1e4);for(const x of others.slice(10,20))small.sh[x.id]=500;small.sh[others[1].id]=10000-5000;small.price=.0001;
for(let i=0;i<8&&small.parent!==f.id;i++){f.cash=Math.max(f.cash,1e5);act('co:mna:'+f.id,(i<4?'f':'h')+small.id)}assert.equal(small.parent,f.id,'인수로 계열사');assert.equal(small.ceo,me.id);
// 7 상장
S.exch={d:S.day,base:0};for(const x of ad())x.g.lend=.6;act('co:ipo:'+f.id);assert(f.listed,'상장');
// 11 승계·임원
const kid=others[30];me.kids=[...(me.kids||[]),kid.id];kid.parents=[me.id];
act('co:heir:'+small.id,'e'+kid.id);assert(small.co.exec.includes(kid.id));
act('co:heir:'+small.id,'c'+kid.id);assert.equal(small.ceo,kid.id,'사장 승계');
// 12 어두운 경영
const p0=f.price;act(`co:dark:${f.id}:dress`);assert(f.price>p0);act(`co:dark:${f.id}:cartel`);act(`co:dark:${f.id}:sub`);const m0=me.cash;act(`co:dark:${f.id}:slush`);assert(me.cash>m0,'비자금');assert(f.co.risk>.5);
let exposed=false;for(let i=0;i<1800&&!exposed;i++){f.co.risk=1.4;w.step();exposed=!!f.co.exposed;for(const q of D.pending.slice())try{w.dynChoose(q.id,q.opts[q.opts.length-1].k)}catch(e){}}
assert(exposed,'어두운 경영이 들통남');
// 경영권 장악
if(!S.firms.includes(rival)){rival.bld=[];S.firms.push(rival)}rival.alive=true;rival.ceo=others[0].id;rival.sh={[others[0].id]:4000,[me.id]:6000};act('co:seize:'+rival.id);assert.equal(rival.ceo,me.id,'과반 지분으로 경영권 장악');
// 10 매각·청산
act('co:sell:'+rival.id,'sell');assert(!(rival.sh[me.id]>0)||rival.sh[me.id]<6000,'지분 매각');
const g=mk(9004,'정리상회',me,'agri',500);g.sh={[me.id]:10000};act('co:sell:'+g.id,'close');assert(!S.firms.includes(g),'청산');
// 사건 정의 수
const ev=Object.keys(w._story.SE).filter(k=>/^co[A-Z]/.test(k));assert(ev.length>=18,'회사 사건 '+ev.length);
// 저장·복원
const saved=JSON.parse(JSON.stringify(w.exportState()));const r=createWorld(812,180);r.importState(saved);assert.deepEqual(r.S.firms.find(x=>x.id===f.id).co.pat,f.co.pat);
console.log(JSON.stringify({ok:true,events:ev.length,morale:+f.co.morale.toFixed(2),pat:f.co.pat.length,listed:!!f.listed}));
