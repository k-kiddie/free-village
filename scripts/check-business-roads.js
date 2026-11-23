'use strict';
const assert=require('node:assert/strict'),{businessFixture}=require('./fixtures/business'),{createWorld}=require('../engine'),{createSession}=require('../rebuild/core/session'),roads=require('../rebuild/core/logistics');
const copy=x=>structuredClone(x),f=businessFixture({far:true}),w=createWorld(1,2);w.importState(f.state);w.S.business={version:1,nextOrder:1,orders:[],warehouses:{},log:[]};
const g=roads.network(w),from=copy(g.nodes[0]),to=copy(g.nodes[g.nodes.length-1]);
const before=copy(w.exportState()),p=roads.path(w,from,to,20);assert.deepEqual(w.exportState(),before,'경로 조회 불변');
assert(p.some(x=>x.edgeId));assert(p.reduce((n,x,i)=>i?n+Math.hypot(x.point.x-p[i-1].point.x,x.point.y-p[i-1].point.y):0,0)>=Math.hypot(to.x-from.x,to.y-from.y));
// 경로 조회 순서/캐시의 존재가 동률 경로를 바꾸지 않아야 한다.
const expected=copy(p);roads.path(w,to,from,20,true);assert.deepEqual(roads.path(w,from,to,20),expected);
const r=roads.state(w),edge=p.find(x=>x.edgeId).edgeId;r.closures[edge]={until:10};const detour=roads.path(w,from,to,20);assert(!detour.some(x=>x.edgeId===edge));assert.notDeepEqual(detour,expected);
for(const e of g.adj[0])r.closures[e.id]={until:10};assert.throws(()=>roads.path(w,from,to,20),/도로 경로/);assert(roads.map(w,()=>true).some(e=>e.closed));r.closures={};
// 동일 구간은 실제 하루 화물 40개만 통과하고 초과 화물은 출발점에 남는다.
const neighbor=copy(g.nodes[g.adj[0][0].b]),orders=Array.from({length:3},()=>({good:'wood',inv:{wood:20},roadTrip:roads.quote(w,from,from,neighbor,20).roadTrip}));
w.S.day++;assert(roads.move(w,orders[0]).arrived);assert(roads.move(w,orders[1]).arrived);assert.equal(roads.move(w,orders[2]).arrived,false);assert.equal(orders[2].roadTrip.reason,'도로 구간의 당일 화물 용량 대기');assert.deepEqual(orders[2].roadTrip.cargoPosition,from);w.S.day++;assert(roads.move(w,orders[2]).arrived);
// 도로로 진입한 실제 화물이 끊긴 구간을 통과하거나 저장 후 순간이동하지 않는다.
const shipment={good:'wood',inv:{wood:20},roadTrip:roads.quote(w,from,from,to,20).roadTrip};w.S.day++;roads.move(w,shipment);const at=copy(shipment.roadTrip.cargoPosition);for(const e of g.edges)r.closures[e.id]={until:w.S.day+10};w.S.day++;assert.equal(roads.move(w,shipment).arrived,false);assert.deepEqual(shipment.roadTrip.cargoPosition,at);r.closures={};w.S.day++;roads.move(w,shipment);assert.notDeepEqual(shipment.roadTrip.cargoPosition,at);

// 공통 명령→실제 하루→도로 운송→입고/귀환, 중간 저장 복원과 동일 다음 날.
let s=createSession({mode:'strategy',legacy:f.state,playerId:f.me,worldId:'roads'}),seq=0;
function apply(action,args={}){const m=s.summary(),q={worldId:m.worldId,expectedRevision:m.revision,commandId:'roads:'+ ++seq,actor:{kind:'person',id:m.playerId},action,args},p=s.preview(q);assert(p.allowed,JSON.stringify(p));const out=s.execute({...q,previewToken:p.previewToken});assert(out.allowed,JSON.stringify(out));return out;}
apply('business.fund',{firmId:f.firmId,amount:500});const order=apply('business.order',{firmId:f.firmId,supplierId:f.seller,carrierId:f.carrier,good:'wood',quantity:4});assert(order.result.roadTrip);apply('advance');const saved=copy(s.checkpoint());apply('advance');const next=copy(s.checkpoint());s.close();s=createSession({checkpoint:saved});seq=saved.strategy.commands.clients.roads.highWater;apply('advance');assert.deepEqual(s.checkpoint(),next,'경로·교통량·난수까지 저장 후 동일');
let days=0;while(s.business().orders[0].status!=='complete'&&days++<40){for(let guard=0;s.view().pending.length&&guard<20;guard++){const d=s.catalog().decisions[0];let ok=false;for(const o of d.opts){try{apply('choose',{id:d.id,key:o.k});ok=true;break;}catch{}}assert(ok);}apply('advance');}assert.equal(s.business().orders[0].status,'complete');assert.equal(s.business().companies[0].warehouse.inv.wood,4);assert.equal(s.read({kind:'person',id:f.carrier}).dynTravelUntil,0);s.close();
console.log(JSON.stringify({passed:'실제 집터 통행로·조회 불변/캐시 결정성·우회/단절·구간 하루 용량/대기·화물 위치·공통 명령 배송/귀환·저장 후 전체 상태 동일',nodes:g.nodes.length,edges:g.edges.length,deliveryDays:order.result.days}));
