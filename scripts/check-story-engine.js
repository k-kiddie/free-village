const assert=require('node:assert/strict');
const {createWorld}=require('../engine.js');
const w=createWorld(901,120);w.dynStart();w.dynConfigureStart({age:30});const S=w.S,D=S.dyn,me=S.byId.get(D.pid);me.cash=1e6;
const {SE,SE_TRIG,sCtx}=w._story;
assert(SE_TRIG.some(e=>e.id==='newYearRite')&&SE_TRIG.some(e=>e.id==='threeGen'),'조건·계절 사건 목록');
// 1) 계절 사건: 해가 바뀔 무렵(0~3일) 뜬다
const run=(n,pick)=>{for(let i=0;i<n;i++){w.step();for(const p of D.pending.slice()){const k=pick&&pick(p);try{w.dynChoose(p.id,k||p.opts[0].k)}catch(e){}}}};
let seen=null;for(let i=0;i<600&&!seen;i++){w.step();const p=D.pending.find(x=>x.kind==='story'&&x.ctx.sid==='newYearRite');if(p){seen={day:S.day%60,title:p.ctx.title};w.dynChoose(p.id,'skip')}else for(const q of D.pending.slice())try{w.dynChoose(q.id,q.opts[0].k)}catch(e){}}
// 다른 사건이 먼저 잡힐 수 있어 몇 해에 걸쳐 확인한다
assert(seen&&seen.day<=3&&/🗓️/.test(seen.title),'설맞이 제사는 새해 무렵에 계절 표시와 함께');
// 2) 가문 기억: 지난 선택 기록과 누적
assert(D.storyHist.newYearRite&&D.storyHist.newYearRite.k==='skip','지난 선택 기록');assert.equal(D.mem.skipRite.v,1,'가문 기억 누적');
const c=sCtx(me,{});assert(c.did('newYearRite','skip')&&!c.did('newYearRite','grand'),'did() 조회');
// 3) 특별 사건: 3대째 조건이 맞으면 한 번만
D.gen=3;D.story.next=S.day+999;let sp=null;for(let i=0;i<20&&!sp;i++){w.step();sp=D.pending.find(x=>x.kind==='story'&&x.ctx.sid==='threeGen');if(!sp)for(const q of D.pending.slice())try{w.dynChoose(q.id,q.opts[0].k)}catch(e){}}
assert(sp&&/⭐ 특별/.test(sp.ctx.title),'특별 사건 표시');w.dynChoose(sp.id,'book');assert(D.specials.some(x=>x.title.includes('3대')),'특별한 순간 기록');assert(D.story.done.threeGen,'한 번만');
assert(w.dynView().specials.length>=1,'화면에 특별한 순간');
// 4) 몇 년 뒤 돌아오는 사건: 예약 → 시간이 지나 뜸
const x=S.agents.find(a=>a.alive&&a!==me&&a.age>20*60);c.later('kindnessRepaid',30,40,{x:x.id,sid:'kindnessRepaid'});
let lr=null;for(let i=0;i<60&&!lr;i++){w.step();lr=D.pending.find(p=>p.ctx.sid==='kindnessRepaid');if(!lr)for(const q of D.pending.slice())try{w.dynChoose(q.id,q.opts[0].k)}catch(e){}}
assert(lr,'예약 사건이 때가 되면 뜸');w.dynChoose(lr.id,'repay');assert(D.mem.repaidKindness,'은혜 갚음 기억');
// 5) 저장 복원
const back=createWorld(1,1);back.importState(JSON.parse(JSON.stringify(w.exportState())));assert.equal(back.S.dyn.mem.skipRite.v,D.mem.skipRite.v);assert(back.S.dyn.story.done.threeGen,'특별 사건 기록 저장');
run(300);console.log('계절·특별·조건 사건, 가문 기억, 몇 년 뒤 사건, 저장 복원 확인 완료');
