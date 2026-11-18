const assert=require('node:assert/strict');
const {createWorld}=require('../engine.js');
const reset=(w,me)=>{for(const k of ['actfound','actpreach','acttheo'])w.S.dyn.cool[k]=0;me.jailUntil=0};
const share=(w,fa,frac)=>{const ad=w.S.agents.filter(a=>a.alive&&a.age>=14*60);let n=ad.filter(a=>a.faith===fa.id).length;for(const a of ad){if(n/ad.length>=frac)break;if(a.faith!==fa.id){a.faith=fa.id;n++}}};

// 1) 출신 배경: 성직자 집안·몰락한 왕족
const w=createWorld(701,120);w.dynStart();w.dynConfigureStart({background:'성직자 집안',faith:50,age:30});
const me=w.S.byId.get(w.S.dyn.pid);assert(me.g.faith>=.64,'성직자 집안 신앙심 보정');
const wr0=createWorld(702,120);wr0.dynStart();wr0.dynConfigureStart({background:'몰락한 왕족'});assert.equal(wr0.S.byId.get(wr0.S.dyn.pid).dynRoyal,1,'몰락한 왕족 혈통');

// 2) 종교 창시
me.cash=1e6;const found=w.dynActions().find(a=>a.k==='extra:found');assert(found&&found.ok&&found.faithSpec.docs.filter(d=>!d.x).length===12&&found.faithSpec.docs.filter(d=>d.x).length===21,'창시 행동과 교리 12개+이단 21개');
assert.throws(()=>w.dynAct('extra:found:charity:'),/2~3개/);assert.throws(()=>w.dynAct('extra:found:charity+equal+honest+work:'),/2~3개/);
assert.throws(()=>w.dynAct('extra:found:celibate+poly:'),/하나만/);assert.throws(()=>w.dynAct('extra:found:charity+equal:abc'),/한글/);
const msg=w.dynAct('extra:found:charity+equal:새빛');const fa=w.S.faiths.find(f=>f.name==='새빛교');
assert(fa&&fa.leader===me.id&&fa.prophet===me.id&&me.faith===fa.id,'교단 창시·교주');assert.deepEqual(fa.doc,['charity','equal']);assert(/열었다/.test(msg.text||msg));
assert(!w.dynActions().some(a=>a.k==='extra:found'),'교주는 다시 창시하지 않음');

// 3) 전도
const before=w.S.agents.filter(a=>a.alive&&a.faith===fa.id).length;for(let i=0;i<6;i++){reset(w,me);w.dynAct('extra:preach')}
assert(w.S.agents.filter(a=>a.alive&&a.faith===fa.id).length>before,'전도로 신도 증가');

// 4) 정부가 없을 때 신정 국가 세우기
assert(!w.S.gov,'시작 때 정부 없음');share(w,fa,.1);reset(w,me);
const th0=w.dynActions().find(a=>a.k==='extra:theo');assert(th0&&!th0.ok&&/22%/.test(th0.why),'신도 22% 미만이면 불가');
let ok=false;for(let i=0;i<40&&!ok;i++){share(w,fa,.45);reset(w,me);w.dynAct('extra:theo');ok=w.S.gov&&w.S.gov.regime==='theo'}
assert(ok,'신정 국가 수립');const G=w.S.gov;assert.equal(G.stateFaith,fa.id);assert.equal(G.chief,me.id);assert.equal(G.policy.censor,true);
assert(!w.dynActions().some(a=>a.k==='extra:theo'),'이미 신정이면 혁명 행동 없음');

// 5) 군주정에서 종교 혁명
const m=createWorld(703,150);m.dynStart();m.dynConfigureStart({age:35});const k=m.S.byId.get(m.S.dyn.pid);k.cash=1e7;m.dynAct('lord');assert.equal(m.S.gov.regime,'mon','영주 자처로 군주정');
m.dynAct('extra:found:honest+work:');const fb=faithOf2(m,k);let ok2=false;for(let i=0;i<40&&!ok2;i++){share(m,fb,.45);reset(m,k);m.dynAct('extra:theo');ok2=m.S.gov.regime==='theo'}
assert(ok2,'군주정에서 종교 혁명');assert.equal(m.S.gov.king,null);assert.equal(m.S.gov.chief,k.id);
for(let i=0;i<30;i++)m.step();assert(m.S.byId.get(k.id),'혁명 뒤 30일 진행');

// 6) 저장 복원
const back=createWorld(1,1);back.importState(JSON.parse(JSON.stringify(w.exportState())));
assert.equal(back.S.gov.regime,'theo');assert(back.S.faiths.some(f=>f.name==='새빛교'&&f.leader===me.id),'교단 저장 복원');
console.log('종교 창시·전도·신정 국가·종교 혁명·출신 배경·저장 복원 확인 완료');
function faithOf2(world,a){return world.S.faiths.find(f=>f.id===a.faith)}
