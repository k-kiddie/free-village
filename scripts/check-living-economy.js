'use strict';
const assert=require('node:assert/strict');
const {createSession}=require('../rebuild/core/session');
const {fixture}=require('./fixtures/living');

let s,seq=0;
function open(f){s=createSession({mode:'strategy',legacy:f.state,playerId:f.me});seq=0;}
function req(action,args){const m=s.summary();return {worldId:m.worldId,expectedRevision:m.revision,commandId:'living:'+ (seq+1),actor:{kind:'person',id:m.playerId},action,args};}
function apply(action,args){const r=req(action,args),before=s.checkpoint(),p=s.preview(r);assert.deepEqual(s.checkpoint(),before,'생활 미리보기의 세계·난수·시간·관측 불변');assert(p.allowed,JSON.stringify(p));assert(!JSON.stringify(p.quote).includes('"q":'),'견적에 교사의 전체 학습 자료를 보내지 않음');const out=s.execute({...r,previewToken:p.previewToken});assert(out.allowed,JSON.stringify(out));seq++;if(!p.uncertainty)assert.deepEqual(out.ledger,p.accounts);return {out,p,command:{...r,previewToken:p.previewToken}};}
function deny(action,args){const before=s.checkpoint(),p=s.preview(req(action,args));assert.equal(p.allowed,false);assert.deepEqual(s.checkpoint(),before);return p;}
const base=fixture();open(base);
const before=s.checkpoint(),stock=before.engine.S.agents.reduce((n,a)=>n+a.inv.grain,0),cash=before.engine.S.agents.reduce((n,a)=>n+a.cash,0);
const bought=apply('living.buyFood',{supplierId:base.seller,quantity:2});
assert(Math.abs(bought.out.ledger.reduce((n,a)=>n+a.amount,0))<1e-9);
let now=s.checkpoint();assert.equal(now.engine.S.agents.reduce((n,a)=>n+a.inv.grain,0),stock);assert(Math.abs(now.engine.S.agents.reduce((n,a)=>n+a.cash,0)-cash)<1e-9);
const lesson=apply('living.lesson',{teacherId:base.teacher,skill:3,hours:1});const gain=lesson.out.result.gain;assert(gain>0);
assert.deepEqual(s.read({kind:'person',id:base.me}).g,before.engine.S.agents.find(a=>a.id===base.me).g);
assert.deepEqual(s.read({kind:'person',id:base.me}).q,before.engine.S.agents.find(a=>a.id===base.me).q);
apply('living.support',{personId:base.child,quantity:2});assert.equal(s.read({kind:'person',id:base.child}).inv.grain,2);
apply('living.rest',{hours:2});assert.equal(s.living().me.freeHours,0);deny('living.rest',{hours:1});
const saved=JSON.parse(JSON.stringify(s.checkpoint()));s.close();s=createSession({checkpoint:saved});
assert.equal(s.living().me.freeHours,0);assert.equal(s.execute(lesson.command).replayed,true);s.close();
const poor=fixture({hunger:85,foodPoor:true});open(poor);const p=apply('living.lesson',{teacherId:poor.teacher,skill:3,hours:1});assert(p.out.result.gain<gain,'같은 수업도 영양 부족 시 기술 성장이 낮음');
const poorPrice=s.living().offers.sellers.find(a=>a.id===poor.seller).price;s.close();
open(base);const richPrice=s.living().offers.sellers.find(a=>a.id===base.seller).price;assert(poorPrice>richPrice,'실제 재고와 인구 수요에 따라 같은 상품 견적이 달라짐');
const original=s.checkpoint();deny('living.buyFood',{supplierId:base.seller,quantity:21});deny('living.lesson',{teacherId:base.me,skill:3,hours:1});deny('living.support',{personId:base.seller,quantity:2});
assert.deepEqual(s.checkpoint(),original);s.close();

// 주소에 따른 학습 기회 차이. 등록비만 내면 학력이 생기는 것이 아니다.
function schooling(f){open(f);apply('act',{key:'social:basic'});apply('advance',{});const result=s.checkpoint();const progress=result.engine.S.dyn.social.basic?.progress||0;assert.equal(s.read({kind:'person',id:f.me}).edu,0);const history=s.living().history;assert.equal(history.length,1);assert(history[0].regions.some(r=>r.foodPrices.grain!==null),'실제 거래에서 지역 가격 관측');s.close();return progress;}
const closeProgress=schooling(base),far=fixture({far:true}),farProgress=schooling(far);assert(closeProgress>farProgress,'같은 교육 등록도 통학 가능한 교사에 따라 진척 차이');

// 실제 물건 임대·가족 이동·다음 수금과 주소 이동을 관측한다.
const rentFixture=fixture();let raw=rentFixture.state;
const empty={id:raw.S.nextHouse++,lot:rentFixture.right.id,owner:rentFixture.seller,occ:null,cond:1,rent:12,sale:null,jeon:null,deposit:0};
// 가까운 다른 생활권을 선택한다. 한 번 이사로 옮길 수 있는 거리다.
const origin=raw.S.geo.lots[raw.S.houses.find(h=>h.id===rentFixture.mine).lot];
const near=raw.S.geo.lots.map((p,id)=>({p,id})).find(({p})=>Math.hypot(p.x-origin.x,p.y-origin.y)>64&&Math.hypot(p.x-origin.x,p.y-origin.y)<120);
assert(near);empty.lot=near.id;raw.S.houses.push(empty);raw.S.lotUsed[near.id]=1;
open(rentFixture);const priorRegion=s.living().region.id;const leased=apply('living.rent',{houseId:empty.id});
assert.equal(s.read({kind:'person',id:rentFixture.child}).home,empty.id);assert.equal(s.read({kind:'house',id:empty.id}).occ,rentFixture.me);
assert.equal(s.read({kind:'house',id:empty.id}).tenantRent,12);assert.equal(leased.out.result.nextDueDay,10);deny('living.rent',{houseId:empty.id});
assert.notEqual(s.living().region.id,priorRegion);apply('advance',{});
assert(Object.values(s.living().history[0].movement).some(r=>r.movedIn>0));
const checkpoint=JSON.parse(JSON.stringify(s.checkpoint()));s.close();s=createSession({checkpoint});assert.equal(s.read({kind:'person',id:rentFixture.child}).home,empty.id);assert.equal(s.living().history.length,1);s.close();

// 계약 뒤 다음 열흘 정산은 기존 임대료 계산이 실제로 수행한다.
const dueFixture=fixture();dueFixture.state.S.day=9;
dueFixture.state.S.houses.push({...empty});dueFixture.state.S.nextHouse=empty.id+1;
open(dueFixture);const dueLease=apply('living.rent',{houseId:empty.id});assert(Math.abs(dueLease.out.result.cost-1.2)<1e-9,'첫 계약은 남은 하루분만 지불');
const rentPaid=s.read({kind:'person',id:dueFixture.me}).spend.rent;apply('advance',{});
assert(s.read({kind:'person',id:dueFixture.me}).spend.rent>=rentPaid+12,'다음 정산에서 기존 엔진이 실제 열흘 임대료 수금');s.close();

// 가문 금고는 개인 지출의 잔액으로 둔갑하지 않는다.
const broke=fixture();broke.state.S.agents.find(a=>a.id===broke.me).cash=0;broke.state.S.dyn.vault=100000;
open(broke);deny('living.buyFood',{supplierId:broke.seller,quantity:2});deny('living.lesson',{teacherId:broke.teacher,skill:3,hours:1});s.close();
// 다른 명령이 집행되면 이전 생활 견적을 그대로 집행하지 않는다.
open(base);const stale={...req('living.buyFood',{supplierId:base.seller,quantity:2}),commandId:'stale:1'},old=s.preview(stale);assert(old.allowed);
apply('living.rest',{hours:1});const unchanged=s.checkpoint();const refused=s.execute({...stale,previewToken:old.previewToken});assert.equal(refused.allowed,false);assert.equal(refused.reasons[0].code,'STALE_REVISION');assert.deepEqual(s.checkpoint(),unchanged);s.close();

// canonical 생활 계층의 미리보기와 저장 복원 이후 계산이 일치한다.
open(base);apply('advance',{});apply('advance',{});const resume=JSON.parse(JSON.stringify(s.checkpoint()));const actor=s.summary().playerId;
const r={worldId:s.summary().worldId,expectedRevision:s.summary().revision,commandId:'replay:1',actor:{kind:'person',id:actor},action:'advance',args:{}};
const preview=s.preview(r);assert(preview.allowed);const expected=s.execute({...r,previewToken:preview.previewToken});assert(expected.allowed);const end=JSON.parse(JSON.stringify(s.checkpoint()));s.close();
s=createSession({checkpoint:resume});const actual=s.execute({...r,previewToken:preview.previewToken});assert(actual.allowed);const resumed=JSON.parse(JSON.stringify(s.checkpoint()));
if(!require('node:util').isDeepStrictEqual(resumed,end)){
 const differences=[];function walk(a,b,path=''){if(differences.length>=20||Object.is(a,b))return;if(!a||!b||typeof a!=='object'||typeof b!=='object'){differences.push({path,actual:a,expected:b});return;}for(const key of new Set([...Object.keys(a),...Object.keys(b)]))walk(a[key],b[key],path+'.'+key);}
 walk(resumed,end);console.log(JSON.stringify({restoreDifferences:differences}));
}
assert.deepEqual(resumed,end);s.close();

// 4단계 v2 저장에는 없던 관측은 현재부터 시작하며 기존 재산·학습·권리는 유지한다.
const legacy=JSON.parse(JSON.stringify(resume));legacy.version=2;delete legacy.continuation;delete legacy.strategy.living;
s=createSession({checkpoint:legacy});const migrated=s.checkpoint();assert.equal(migrated.version,8);assert.equal(migrated.strategy.revision,legacy.strategy.revision);
assert.deepEqual(migrated.engine.S.agents,legacy.engine.S.agents);assert.deepEqual(migrated.strategy.contracts,legacy.strategy.contracts);assert.equal(s.living().history.length,0);assert.equal(s.living().me.freeHours,4);s.close();
console.log(JSON.stringify({passed:'생활 실제 회계·재고·시간·영양/기술·지역 가격·교육 접근·가족 이동·관측/저장 복원',healthyGain:gain,hungryGain:p.out.result.gain,richPrice,poorPrice,closeProgress,farProgress}));
