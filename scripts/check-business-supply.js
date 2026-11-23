'use strict';
const assert=require('node:assert/strict'),{createSession}=require('../rebuild/core/session'),{businessFixture}=require('./fixtures/business');
let s,seq=0;const copy=x=>JSON.parse(JSON.stringify(x));
function open(f){s=createSession({mode:'strategy',legacy:f.state,playerId:f.me,worldId:'business-check'});seq=0;}
function request(action,args){const m=s.summary();return {worldId:m.worldId,expectedRevision:m.revision,commandId:'supply:'+(seq+1),actor:{kind:'person',id:m.playerId},action,args};}
function apply(action,args){const r=request(action,args),before=s.checkpoint(),p=s.preview(r);assert(p.allowed,JSON.stringify(p));assert.deepEqual(s.checkpoint(),before,'미리보기의 세계·운송 일정·재고·계약 불변');const command={...r,previewToken:p.previewToken},out=s.execute(command);assert(out.allowed,JSON.stringify(out));seq++;return {out,p,command};}
function deny(action,args){const before=s.checkpoint(),p=s.preview(request(action,args));assert.equal(p.allowed,false);assert.deepEqual(s.checkpoint(),before);return p;}
const f=businessFixture(),args={firmId:f.firmId,supplierId:f.seller,carrierId:f.carrier,good:'wood',quantity:4};open(f);
let unchanged=s.checkpoint();const initial=s.business();assert.equal(initial.companies.length,1);assert.deepEqual(s.checkpoint(),unchanged,'회사 현황 조회는 세계를 변경하지 않음');assert(!JSON.stringify(initial).includes('"q":'));
deny('business.order',args);deny('business.fund',{firmId:f.firmId+1,amount:10});apply('business.fund',{firmId:f.firmId,amount:50});assert.equal(s.read({kind:'firm',id:f.firmId}).cash,50);assert.equal(s.read({kind:'person',id:f.me}).cash,450);
const before=s.checkpoint(),order=apply('business.order',args),after=s.checkpoint();
const money=c=>c.engine.S.agents.reduce((n,a)=>n+a.cash,0)+c.engine.S.firms.reduce((n,a)=>n+(a.cash||0),0);
assert(Math.abs(money(before)-money(after))<1e-8,'실제 회사→공급자/운송인 지급, 돈 생성 없음');
assert.equal(s.read({kind:'person',id:f.seller}).inv.wood,26);assert.equal(after.engine.S.business.orders[0].inv.wood,4);assert.equal(s.business().companies[0].warehouse.inv.wood,undefined);
assert.equal(order.out.inventory.reduce((n,x)=>n+x.amount,0),0,'판매자 재고와 운송 중 물품 보존');assert(Math.abs(order.out.ledger.reduce((n,x)=>n+x.amount,0))<1e-8);
assert(s.contracts().some(c=>c.kind==='supply'&&c.status==='active'));assert.equal(s.read({kind:'person',id:f.carrier}).dynTravelUntil,3);
deny('business.order',args);deny('business.order',{...args,carrierId:f.me});deny('business.order',{...args,quantity:21});
let saved=copy(s.checkpoint());s.close();s=createSession({checkpoint:saved});assert.equal(s.execute(order.command).replayed,true);assert.equal(s.checkpoint().engine.S.business.orders.length,1);
const arrived=apply('advance',{});assert.equal(s.business().companies[0].warehouse.inv.wood,4);assert.equal(s.business().orders[0].inv.wood,0);assert.equal(s.business().orders[0].status,'returning');assert.equal(s.read({kind:'person',id:f.carrier}).act,6,'운송인이 기존 생산 일을 함께 하지 않음');
assert(arrived.out.inventory.some(x=>x.id.startsWith('warehouse:')&&x.amount===4));assert(s.contracts().some(c=>c.kind==='supply'&&c.status==='ended'));
apply('advance',{});assert.equal(s.business().orders[0].status,'complete');assert.equal(s.read({kind:'person',id:f.carrier}).dynTravelUntil,0);s.close();

// 좌표 차이가 실제 납기·운임을 바꾸고, 중단된 화물을 없애지 않는다.
const far=businessFixture({far:true});open(far);apply('business.fund',{firmId:far.firmId,amount:100});
const remoteArgs={...args,firmId:far.firmId,supplierId:far.seller,carrierId:far.carrier};const remote=apply('business.order',remoteArgs);assert(remote.out.result.days>order.out.result.days);assert(remote.out.result.freight>order.out.result.freight);
saved=copy(s.checkpoint());s.close();const carrier=saved.engine.S.agents.find(a=>a.id===far.carrier);carrier.jailUntil=100;
// 사고가 발생한 검사 저장. 실제 날짜는 같은 하루 명령으로 진행한다.
s=createSession({checkpoint:saved});for(let i=0;i<remote.out.result.days;i++)apply('advance',{});
assert.equal(s.business().orders[0].status,'blocked');assert.equal(s.business().orders[0].inv.wood,4);assert.equal(s.business().companies[0].warehouse.inv.wood,undefined);s.close();

// 회사 시설 상실·폐업 뒤에도 화물/창고 물량은 독립된 실제 소유 재고로 남는다.
open(f);apply('business.fund',{firmId:f.firmId,amount:50});apply('business.order',args);saved=copy(s.checkpoint());s.close();saved.engine.S.bldgs=[];
s=createSession({checkpoint:saved});apply('advance',{});assert.equal(s.business().orders[0].status,'blocked');assert.equal(s.checkpoint().engine.S.business.orders[0].inv.wood,4);s.close();

// 운송인이 사망해도 화물의 소유권과 물량을 삭제하지 않는다.
open(f);apply('business.fund',{firmId:f.firmId,amount:50});apply('business.order',args);saved=copy(s.checkpoint());s.close();saved.engine.S.agents.find(a=>a.id===f.carrier).alive=false;
s=createSession({checkpoint:saved});apply('advance',{});assert.equal(s.business().orders[0].status,'blocked');assert.equal(s.business().orders[0].reason,'운송인 사망');assert.equal(s.business().orders[0].inv.wood,4);s.close();

// 도중 저장 복원 후 도착일의 전체 결과와 난수가 같다.
open(f);apply('business.fund',{firmId:f.firmId,amount:50});apply('business.order',args);saved=copy(s.checkpoint());apply('advance',{});const expected=copy(s.checkpoint());s.close();s=createSession({checkpoint:saved});seq=saved.strategy.commands.clients.supply.highWater;apply('advance',{});assert.deepEqual(copy(s.checkpoint()),expected);s.close();
console.log(JSON.stringify({passed:'회사 현황 조회 불변·실제 자금/재고 보존·권한/운송인 이중 업무 거절·계약·배송/귀환·중단 화물 보존·재전송·저장 후 도착 결과 동일',nearDays:order.out.result.days,farDays:remote.out.result.days}));
