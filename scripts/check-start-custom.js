const assert=require('node:assert/strict');
const {createWorld}=require('../engine.js');

const w=createWorld(481,100);w.dynStart();
const D=w.S.dyn,people=new Map(w.S.agents.map(x=>[x.id,{partner:x.partner,kids:[...x.kids],parents:[...x.parents],cash:x.cash}]));
const result=w.dynConfigureStart({sur:'박',given:'하늘',sex:'F',age:27,looks:82,edu:3,background:'기술자 집안',boss:75,civic:66,care:72,cheat:20,farm:40,craft:91,trade:35});
const a=w.S.byId.get(D.pid),family=people.get(a.id);
assert.equal(result.name,'박하늘');assert.equal(Math.floor(a.age/60),27);assert.equal(a.sex,'F');assert.equal(a.edu,3);assert.equal(a.sur,'박');assert.equal(a.g.boss,.75);assert.equal(a.skill[9],.99);assert.equal(D.background,'기술자 집안');
assert.deepEqual({partner:a.partner,kids:a.kids,parents:a.parents},{partner:family.partner,kids:family.kids,parents:family.parents},'가족 연결 보존');assert.equal(a.cash,family.cash,'시작 재산 보존');
const snapshot=JSON.stringify(w.exportState());const w2=createWorld(999,1);w2.importState(JSON.parse(snapshot));
assert.equal(w2.S.dyn.background,'기술자 집안');assert.equal(w2.S.byId.get(w2.S.dyn.pid).given,'하늘');
assert.throws(()=>w.dynConfigureStart({age:17}),/18~45/);
const w3=createWorld(482,100);w3.dynStart();for(const x of w3.S.agents){x.partner=null;x.kids=[]}const picked=w3.dynConfigureStart({family:'single',wealth:'keep'});const a2=w3.S.byId.get(w3.S.dyn.pid);assert.equal(a2.partner,null);assert.equal(a2.kids.length,0);assert.equal(picked.family,'single');
const pid=w3.S.dyn.pid;assert.throws(()=>w3.dynConfigureStart({family:'children',wealth:'keep'}),/조건에 맞는/);assert.equal(w3.S.dyn.pid,pid,'조건 오류 때 인물 상태를 바꾸지 않음');
const w4=createWorld(483,100);w4.dynStart();w4.dynConfigureStart({background:'정보기관 직원'});assert.equal(w4.S.dyn.spyCareer,'staff');assert(w4.S.byId.get(w4.S.dyn.pid).g.vigil>=.18,'정보기관 출신 경계심 보정');assert(w4.dynActions().some(x=>x.group==='첩보'),'정보기관 직원은 초반 첩보 임무를 수행할 수 있음');
console.log('캐릭터 시작 설정과 저장 복원 확인 완료');
