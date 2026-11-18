const assert=require('node:assert/strict');
const {createWorld}=require('../engine.js');

const w=createWorld(481,100);w.dynStart();
const D=w.S.dyn,before=new Map(w.S.agents.map(x=>[x.id,JSON.stringify({sur:x.sur,given:x.given,g:x.g,skill:x.skill,partner:x.partner,kids:x.kids,cash:x.cash,age:x.age})])),n0=w.S.agents.length;
const result=w.dynConfigureStart({sur:'박',given:'하늘',sex:'F',age:27,looks:82,edu:3,background:'기술자 집안',boss:75,civic:66,care:72,cheat:20,farm:40,craft:91,trade:35});
const a=w.S.byId.get(D.pid);
assert.equal(result.name,'박하늘');assert.equal(Math.floor(a.age/60),27);assert.equal(a.sex,'F');assert.equal(a.edu,3);assert.equal(a.sur,'박');assert.equal(a.g.boss,.75);assert.equal(a.skill[9],.99);assert.equal(D.background,'기술자 집안');
assert(!before.has(a.id),'꾸미기 시작은 새 인물을 만든다');assert(a.migrant,'새 인물은 이주민');assert.equal(w.S.agents.length,n0+1,'혼자 시작이면 1명만 늘어남');
for(const x of w.S.agents)if(before.has(x.id))assert.equal(JSON.stringify({sur:x.sur,given:x.given,g:x.g,skill:x.skill,partner:x.partner,kids:x.kids,cash:x.cash,age:x.age}),before.get(x.id),'기존 주민 불변');
const snapshot=JSON.stringify(w.exportState());const w2=createWorld(999,1);w2.importState(JSON.parse(snapshot));
assert.equal(w2.S.dyn.background,'기술자 집안');assert.equal(w2.S.byId.get(w2.S.dyn.pid).given,'하늘');
assert.throws(()=>w.dynConfigureStart({age:17}),/18~45/);assert.equal(w.S.dyn.pid,a.id,'입력 오류 때 인물 상태를 바꾸지 않음');assert.equal(w.S.agents.length,n0+1);
// 다시 꾸미면 앞서 만든 인물을 지우고 새로 만든다(인구가 쌓이지 않음)
const r2=w.dynConfigureStart({family:'children',wealth:'wealthy',age:40,sur:'최'});const me=w.S.byId.get(w.S.dyn.pid);
assert(!w.S.byId.has(a.id),'이전 꾸미기 인물 제거');assert.equal(r2.family,'children');
const sp=w.S.byId.get(me.partner);assert(sp&&sp.alive&&sp.partner===me.id&&sp.sex!==me.sex,'배우자 함께 이주');assert(me.kids.length>=1&&me.kids.every(id=>{const k=w.S.byId.get(id);return k&&k.parents.includes(me.id)&&k.parents.includes(sp.id)&&k.sur==='최'}),'자녀 함께 이주');
assert.equal(w.S.agents.length,n0+2+me.kids.length,'인물·배우자·자녀만 늘어남');{const cs=w.S.agents.filter(x=>x.alive&&x.age>=14*60&&x!==me&&x.id!==sp.id&&!me.kids.includes(x.id)).map(x=>x.cash).sort((x,y)=>x-y);assert(me.cash>=cs[cs.length>>1]*3,'넉넉한 재산은 보통의 3배 이상')}
// 조건이 맞는 기존 주민이 없어도 시작할 수 있다(이번 오류 재현 조건)
const w3=createWorld(482,100);w3.dynStart();for(const x of w3.S.agents){x.partner=null;x.kids=[]}const picked=w3.dynConfigureStart({family:'children',wealth:'poor'});const a3=w3.S.byId.get(w3.S.dyn.pid);
assert.equal(picked.family,'children');assert(a3.partner&&a3.kids.length>=1,'조건 맞는 기존 주민이 없어도 가족과 시작');
const w5=createWorld(484,100);w5.dynStart();const s5=w5.dynConfigureStart({family:'single',wealth:'modest'});const a5=w5.S.byId.get(w5.S.dyn.pid);assert.equal(a5.partner,null);assert.equal(a5.kids.length,0);assert.equal(s5.family,'single');
for(let i=0;i<20;i++)w5.step();assert(w5.S.byId.get(w5.S.dyn.pid),'시작 뒤 20일 진행');
const w4=createWorld(483,100);w4.dynStart();w4.dynConfigureStart({background:'정보기관 직원'});assert.equal(w4.S.dyn.spyCareer,'staff');assert(w4.S.byId.get(w4.S.dyn.pid).g.vigil>=.18,'정보기관 출신 경계심 보정');assert(w4.dynActions().some(x=>x.group==='첩보'),'정보기관 직원은 초반 첩보 임무를 수행할 수 있음');
console.log('캐릭터 시작 설정과 저장 복원 확인 완료');
