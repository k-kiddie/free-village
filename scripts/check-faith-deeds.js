const assert=require('node:assert/strict');
const {createWorld}=require('../engine.js');
const w=createWorld(801,150);w.dynStart();w.dynConfigureStart({age:32,background:'성직자 집안'});
const S=w.S,D=S.dyn,me=S.byId.get(D.pid);me.cash=1e7;for(const a of w.S.agents){a.g.comply=1;a.g.civic=0}me.rep=1;w.dynAct('lord');assert.equal(S.gov.regime,'mon','영주 자처로 정부 수립');
w.dynAct('extra:found:charity+honest:한빛');const fa=S.faiths.find(f=>f.name==='한빛교');fa.tre=1e6;
const ad=()=>S.agents.filter(a=>a.alive&&a.age>=14*60);
for(const a of ad().slice(0,40))if(a!==me)a.faith=fa.id;
const cool=()=>{for(const k of Object.keys(D.cool))if(/^act(fg|fd)/.test(k))D.cool[k]=0;me.jailUntil=0};
const act=k=>{cool();const a=w.dynActions().find(x=>x.k===k.split(':').slice(0,2).join(':'));assert(a,`${k} 행동 목록`);assert(a.ok,`${k} 가능: ${a.why}`);return w.dynAct(k)};

// 선행 10가지: 조건을 만들어 하나씩 실행
ad().slice(40,55).forEach(a=>a.hunger=80);
const kid=S.agents.find(a=>a.alive&&a.age<14*60);if(kid)kid.parents=[];
ad().slice(55,60).forEach(a=>a.addict=1);
D.ties={...D.ties,[ad()[60].family]:{v:-.7,name:'원수 집안',d:S.day,why:'시험'}};
const crook=ad().find(a=>a!==me&&a.faith!==fa.id);S.gov.council=[...(S.gov.council||[]),crook.id];crook.g.cheat=.95;
const rep0=D.faithRep[fa.id]||0;
for(const k of [...(kid?['orphan']:[]),'kitchen','clinic','mutual','comfort','mediate','recover','expose','peace','festival'])act('fgood:'+k);
assert(D.faithRep[fa.id]>rep0+.3,'선행으로 교단 평판 상승');assert(S.gov.cases.some(c=>c.who===crook.id),'부패 고발로 수사');
assert(D.faithMutual[fa.id]>S.day,'상호부조 계 운영');assert(S.agents.some(a=>a.refugee&&a.faith===fa.id),'피난민 보호');

// 어둠
const cash0=me.cash;act('fdark:embezzle');assert(me.cash>cash0,'헌금 착복');assert(D.faithRisk[fa.id]>=.25,'들킬 위험 누적');
act('fdark:miracle');act('fdark:indulge');{const c0=S.gov.chief;S.gov.chief=crook.id;act('fdark:politics:ally');S.gov.chief=c0}{const rl=ad().find(a=>a!==me&&a.faith!==fa.id);S.faiths.push({id:S.nextFaith++,name:'경쟁교',doc:['work','obey'],prophet:rl.id,leader:rl.id,tre:0,born:S.day,temple:null,members:5});for(const a of ad().filter(a=>a!==me&&a.faith!==fa.id).slice(0,5))a.faith=S.faiths.at(-1).id;rl.faith=S.faiths.at(-1).id}act('fdark:politics:heretic');
assert(w.dynActions().find(a=>a.k==='fdark:inquisition').why,'신정이 아니면 이단 재판 불가');
act('fdark:cult');assert.equal(fa.dynLock,D.house,'교단 세습');
// 신정에서 이단 재판
let ok=false;for(let i=0;i<40&&!ok;i++){for(const a of ad().slice(0,90))a.faith=fa.id;me.jailUntil=0;D.cool.acttheo=0;w.dynAct('extra:theo');ok=S.gov.regime==='theo'}
assert(ok,'종교 혁명');for(const a of ad().slice(100))if(a!==me)a.faith=null;const ap0=S.gov.approval??.5;act('fdark:inquisition');assert((S.gov.approval??.5)<ap0,'이단 재판으로 민심 하락');

// 폭로 → 사과
D.faithRisk[fa.id]=1;let p=null;for(let i=0;i<600&&!p;i++){w.step();p=D.pending.find(x=>x.kind==='faithExpose');for(const q of D.pending.slice())if(q!==p&&q.kind!=='faithExpose')try{w.dynChoose(q.id,q.opts[0].k)}catch(e){}}
assert(p,'어두운 일 폭로 사건');w.dynChoose(p.id,'apologize');assert.equal(D.faithRisk[fa.id],0,'사과하면 위험 초기화');

// 평판이 좋으면 신도가 늘어남
D.faithRep[fa.id]=.9;for(const a of ad())if(a.faith===fa.id&&a!==me&&Math.random()<.5)a.faith=null;for(const a of ad())a.g.faith=Math.max(a.g.faith,.6);
const n0=ad().filter(a=>a.faith===fa.id).length;for(let i=0;i<31;i++){w.step();for(const q of D.pending.slice())try{w.dynChoose(q.id,q.opts[0].k)}catch(e){}}
assert(ad().filter(a=>a.faith===fa.id).length>n0,'좋은 평판으로 신도 증가');

// 화면·저장
const v=w.dynView();assert(v.faithInfo&&v.faithInfo.leader&&v.faithInfo.lock,'교단 정보 화면');
const back=createWorld(1,1);back.importState(JSON.parse(JSON.stringify(w.exportState())));assert.equal(back.S.dyn.faithRep[fa.id],D.faithRep[fa.id],'교단 평판 저장 복원');
console.log('교단 선행 10·어둠 8(성전 제외 실행)·폭로·평판 효과·세습·저장 복원 확인 완료');
