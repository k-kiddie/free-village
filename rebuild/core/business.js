'use strict';
// 회사 지갑·공급·화물·창고·공정·고객을 같은 세계와 공통 명령에 연결한다.
// 새 화물은 실제 통행로 그래프를 사용하고 이전 저장의 화물은 도착까지 기존 경로를 보존한다.
const {YEAR}=require('../../engine');
const roads=require('./logistics');
const {geography}=require('./living');
const operations=require('./business-operations');
const logistics=require('./logistics');
const stores=require('./warehousing');
const rights=require('./business-rights');
const trade=require('./business-trade');
const copy=x=>structuredClone(x), fail=message=>{throw Error(message);};
const GOODS=['grain','meal','wood','stone','tool','iron','fiber','plank','brick','cloth','furn','liquor'];
function state(world){const b=world.S.business ||= {version:1,nextOrder:1,orders:[],warehouses:{},log:[]};if(b.version!==1)fail('지원하지 않는 사업 저장 형식입니다.');return b;}
function owned(world,strategy,id){
 const me=world.S.byId.get(strategy.playerId),firm=world.S.firms.find(f=>f.id===id);
 if(!me?.alive||!firm||firm.ceo!==me.id||firm.merc)fail('현재 운영 권한이 있는 일반 회사를 선택해 주세요.');
 return {me,firm};
}
function place(world,firm,id=stores.activeId(world,firm)){const b=stores.building(world,firm,id);return b?stores.point(world,b):null;}
function availableStock(a,good){return Math.max(0,(a.inv?.[good]||0)-(good==='grain'?Math.max(6,a.g?.keepG||6):good==='meal'?2:0));}
function carrierReady(a,day){return a?.alive&&a.age>=14*YEAR&&a.health>=50&&a.hunger<70&&!a.emp&&!a.firm&&!a.study&&!a.soldier&&!a.dynRoyal&&!a.civ&&!a.foreignT&&!a.dynMercFirm&&!a.enslavedBy&&!(a.jailUntil>day)&&!(a.armyUntil>day)&&!(a.abroadUntil>day)&&!(a.dynTravelUntil>day)&&!(a.dynBasicUntil>day);}
function route(world,firm,supplier,carrier,quantity,geo=geography(world),buildingId){
 const destination=place(world,firm,buildingId);if(!destination)fail('입고할 수 있는 실제 회사 건물이 없습니다.');
 return logistics.quote(world,geo.location(carrier),geo.location(supplier),destination,quantity);
}
function quote(world,strategy,action,args){
 if(action.startsWith('road.')){const actor=world.S.byId.get(strategy.playerId);return roads.quoteProject(world,actor,action,args);}
 const {me,firm}=owned(world,strategy,args.firmId),S=world.S;
 if(trade.ACTIONS.includes(action))return trade.quote(world,firm,me,action,args,carrierReady);
 if(action==='business.transfer'){
  const from=stores.building(world,firm,args.fromBuildingId),to=stores.building(world,firm,args.toBuildingId),w=from&&stores.get(world,firm,from.id),carrier=S.byId.get(args.carrierId);
  if(!from||!to||from.id===to.id||!GOODS.includes(args.good)||!w||((w.inv[args.good]||0)+1e-8<args.quantity))fail('실제 출발/도착 회사 시설과 창고 재고를 확인해 주세요.');
  if(!carrierReady(carrier,S.day)||carrier===me)fail('현재 운송 가능한 실제 운송인을 선택해 주세요.');
  const r=logistics.quote(world,geography(world).location(carrier),stores.point(world,from),stores.point(world,to),args.quantity);if((firm.cash||0)<r.freight)fail('창고 이동 운임을 지급할 회사 현금이 모자랍니다.');
  return {label:'사업장 간 창고 운송',cost:r.freight,hint:'같은 회사의 두 시설 사이에서 실제 화물을 옮깁니다. 상품 대금은 없고 실제 운송인에게 운임만 지급합니다. 도착 전에는 출발/도착 창고에서 사용할 수 없습니다.',details:{firmId:firm.id,fromBuildingId:from.id,toBuildingId:to.id,carrierId:carrier.id,good:args.good,quantity:args.quantity,quality:w.quality[args.good]??1,goodsCost:args.quantity*(w.cost?.[args.good]??S.price[args.good]??0),...r,arrivalDay:S.day+r.days,returnDay:S.day+r.days+r.backDays}};
 }
 if(action==='business.hire'){
  const a=S.byId.get(args.personId);if(!a||a===me||!world.businessHireable(a)||!Number.isFinite(args.wage)||args.wage<Math.max(.5,S.wageAvg||1)*.6)fail('채용 가능한 주민과 적정한 일당을 확인해 주세요.');
  if((S.business?.hiring?.[firm.id+':'+a.id]?.until||0)>S.day)fail('거절한 채용 제안은 사흘 뒤 다시 제안할 수 있습니다.');
  if((S.business?.arrears||[]).some(c=>c.firmId===firm.id&&c.amount>1e-8))fail('회사에 남은 미지급 임금을 먼저 정산해 주세요.');
  const payroll=S.agents.filter(x=>x.alive&&x.emp===firm.ceo&&x.ct?.company===firm.id).reduce((n,x)=>n+(x.ct.w||0),0),reserve=(payroll+args.wage)*3;
  if((firm.cash||0)-(S.business?.operations?.[firm.id]?.taxDebt||0)<reserve)fail('새 직원까지 포함한 사흘치 일당을 회사에 남겨야 합니다.');
  return {label:'회사 직원 채용 제안',hint:'실제 주민에게 회사 고용 계약을 제안합니다. 수락 여부는 불확실하며 거절하면 사흘 동안 다시 제안하지 않습니다.',details:{personId:a.id,name:world.nm(a),wage:args.wage,reserve}};
 }
 if(action==='business.policy'){operations.validatePolicy(world,firm,args);const w=stores.get(world,firm,args.buildingId),declared=w&&!w.location&&Object.values(w.inv).some(n=>n>1e-8)&&!(S.business?.orders||[]).some(o=>o.firmId===firm.id&&o.receivedDay!==undefined);return {label:'생산·판매 방침',hint:'같은 입고 시설의 회사 창고 재료와 계약 직원으로 생산·직접 소매를 운영합니다. 중지해도 계약 임금은 지급합니다.'+(declared?' 위치 기록이 없는 기존 단일 설비 재고를 이 설비에 배정합니다.':''),details:{firmId:firm.id,...args}};}
 if(action==='business.recover'){const o=S.business?.orders.find(o=>o.id===args.orderId&&o.firmId===firm.id);if(!o||o.status!=='blocked'||!(o.inv[o.good]>0))fail('회수할 중단 화물이 없습니다.');const carrier=S.byId.get(args.carrierId);if(!carrierReady(carrier,S.day)||carrier===me)fail('현재 운송 가능한 실제 운송인을 선택해 주세요.');const r=recoveryRoute(world,firm,o,carrier,args.buildingId);if((firm.cash||0)<r.freight)fail('회수 운임을 지불할 회사 현금이 모자랍니다.');return {label:'중단 화물 대체 운송',cost:r.freight,hint:'기존 화물만 다시 운송합니다. 공급자 상품 대금은 중복 지급하지 않습니다.',details:{orderId:o.id,carrierId:carrier.id,...r,arrivalDay:S.day+r.days,returnDay:S.day+r.days+r.backDays}};}
 if(action==='business.supply'){validatePlan(world,firm,args);return {label:'반복 발주 조건',hint:'재고·입고 예정량이 기준보다 적으면 지정 공급자에게 발주합니다. 매번 재고·운송인·가격·회사 잔액을 다시 확인하며 주문 상한을 넘기지 않습니다.',details:{...args}};}
 if(action==='business.payArrears'){const amount=(S.business?.arrears||[]).filter(c=>c.firmId===firm.id).reduce((n,c)=>n+c.amount,0);if(!amount)fail('미지급 임금이 없습니다.');if((firm.cash||0)<amount)fail('밀린 임금을 모두 정산할 회사 현금이 모자랍니다.');for(const c of S.business.arrears.filter(c=>c.firmId===firm.id&&c.amount>0))rights.holders(world,c);return {label:'미지급 임금 정산',cost:amount,hint:'회사 자금으로 직원 또는 사망 당시 확정된 채권 상속인에게 지급합니다. 상속인이 없는 몫은 미귀속 유산 계정에 보관하고 상속세는 사망 당시 기록한 세율로 함께 정산합니다.',details:{amount}};}
 if(action==='business.fund'){
  if(me.cash+1e-9<args.amount)fail('운영자금을 지원할 개인 현금이 모자랍니다.');
  return {label:'회사 운영자금 지원',cost:args.amount,hint:'개인→회사 지원금입니다. 지분·상환 청구권은 새로 생기지 않습니다.',details:{firmId:firm.id,amount:args.amount}};
 }
 const supplier=S.byId.get(args.supplierId),carrier=S.byId.get(args.carrierId);
 if(!supplier?.alive||supplier===me||supplier.age<14*YEAR||!GOODS.includes(args.good))fail('실제 공급자와 지원 품목을 선택해 주세요.');
 if(supplier.jailUntil>S.day||supplier.abroadUntil>S.day||supplier.dynTravelUntil>S.day)fail('공급자가 수감·출국·여행 중입니다.');
 if(availableStock(supplier,args.good)+1e-9<args.quantity)fail('공급자의 실제 판매 가능 재고가 모자랍니다.');
 if(!carrierReady(carrier,S.day)||carrier===me||carrier===supplier)fail('고용·복무·학업·여행 중이 아닌 실제 운송인을 선택해 주세요.');
 const r=route(world,firm,supplier,carrier,args.quantity,geography(world),args.buildingId),quality=args.good==='grain'?(supplier.gq??1):args.good==='meal'?(supplier.mq??1):1;
 const unitPrice=S.price[args.good]*1.05*quality;if(!Number.isFinite(unitPrice)||unitPrice<=0)fail('현재 거래 가격을 확인할 수 없습니다.');
 const goodsCost=unitPrice*args.quantity,cost=goodsCost+r.freight;
 if((firm.cash||0)+1e-9<cost)fail('회사 현금이 모자랍니다. 개인·금고·공공 예산으로 대신 지불하지 않습니다.');
 return {label:'공급 발주와 운송 계약',cost,hint:'회사→공급자 상품 대금, 회사→운송인 운임을 지금 지급합니다. 입고 전에는 사용할 수 없습니다.',
  details:{firmId:firm.id,supplierId:supplier.id,carrierId:carrier.id,good:args.good,quantity:args.quantity,quality,unitPrice,goodsCost,...r,arrivalDay:S.day+r.days,returnDay:S.day+r.days+r.backDays}};
}
function note(world,text,ids){const b=state(world);b.log.push({day:world.S.day,text,ids});b.log=b.log.slice(-40);}
function perform(world,strategy,action,args){
 if(action.startsWith('road.'))return roads.performProject(world,world.S.byId.get(strategy.playerId),action,args);
 const q=quote(world,strategy,action,args),S=world.S,{me,firm}=owned(world,strategy,args.firmId);
 if(trade.ACTIONS.includes(action)){state(world);return trade.perform(world,firm,me,action,args,q);}
 if(action==='business.transfer'){
  const d=q.details,b=state(world),w=stores.get(world,firm,d.fromBuildingId);world.businessPay(firm,S.byId.get(d.carrierId),d.freight,'biz');w.inv[d.good]-=d.quantity;
  if(!Number.isSafeInteger(b.nextOrder)||b.nextOrder>=Number.MAX_SAFE_INTEGER)fail('발주 번호의 저장 범위를 초과했습니다.');
  const order={id:b.nextOrder++,kind:'transfer',firmId:firm.id,managerId:me.id,firmName:firm.name,status:'transit',createdDay:S.day,...copy(d),inv:{[d.good]:d.quantity}};b.orders.push(order);S.byId.get(d.carrierId).dynTravelUntil=d.returnDay+1;logistics.state(world);note(world,firm.name+'의 사업장 간 창고 운송을 시작했다',[me.id,d.carrierId]);return {text:'창고 화물을 출고했습니다. 실제 도착 뒤 도착지에서 사용할 수 있습니다.',orderId:order.id,...d};
 }
 if(action==='business.hire'){const a=S.byId.get(args.personId),r=world.businessHire(firm,a,args.wage),b=state(world);b.hiring ||= {};b.hiring[firm.id+':'+a.id]={day:S.day,hired:r.hired,until:r.hired?S.day:S.day+3};return r;}
 if(action==='business.policy'){state(world);return operations.configure(world,firm,args);}
 if(action==='business.supply'){const b=state(world);b.supplyPlans ||= {};b.supplyPlans[firm.id] ||= {};b.supplyPlans[firm.id][args.good]={...copy(args),buildingId:args.buildingId??stores.activeId(world,firm),managerId:me.id};return {text:'재고 기준·주문 상한을 반영했습니다. 다음 하루부터 자동 발주 조건을 확인합니다.'};}
 if(action==='business.payArrears'){for(const c of S.business.arrears.filter(c=>c.firmId===firm.id&&c.amount>0)){rights.pay(world,firm,c);}return {text:'미지급 임금을 회사 자금으로 정산했습니다.',cost:q.cost};}
 if(action==='business.recover'){const o=S.business.orders.find(o=>o.id===args.orderId),d=q.details,carrier=S.byId.get(d.carrierId);world.businessPay(firm,carrier,d.freight,'biz');o.originalCarrierId ??=o.carrierId;o.recoveries ||= [];o.recoveries.push({day:S.day,previousCarrier:o.carrierId,carrierId:carrier.id,freight:d.freight,reason:o.reason,origin:copy(d.origin)});Object.assign(o,{carrierId:carrier.id,status:'transit',segmentOrigin:copy(d.origin),progressDays:0,lastTravelDay:S.day,segmentDay:S.day,days:d.days,arrivalDay:d.arrivalDay,returnDay:d.returnDay,destination:copy(d.destination),totalFreight:(o.totalFreight??o.freight)+d.freight,roadTrip:copy(d.roadTrip)});logistics.state(world);delete o.reason;carrier.dynTravelUntil=d.returnDay+1;return {text:'대체 운송인이 기존 화물을 회수하러 출발했습니다.',orderId:o.id,...d};}
 if(action==='business.fund'){
  me.cash-=args.amount;firm.cash=(firm.cash||0)+args.amount;
  me.spend ||= {};me.spend.companyFunding=(me.spend.companyFunding||0)+args.amount;
  note(world,firm.name+'에 운영자금을 지원했다',[me.id]);return {text:'회사 운영자금 지원 완료 · 지분·상환 청구권 변화 없음',...q.details};
 }
 const d=q.details,supplier=S.byId.get(d.supplierId),carrier=S.byId.get(d.carrierId),b=state(world);
 world.businessPay(firm,supplier,d.goodsCost,d.good==='grain'?'farm':d.good==='meal'?'cook':d.good==='wood'?'wood':d.good==='stone'?'stone':'biz');
 world.businessPay(firm,carrier,d.freight,'biz');supplier.inv[d.good]-=d.quantity;
 // native 일정 제한을 사용해 운송 기간에 기존 생산/고용을 동시에 하지 못하게 한다.
 carrier.dynTravelUntil=d.returnDay+1;
 if(!Number.isSafeInteger(b.nextOrder)||b.nextOrder>=Number.MAX_SAFE_INTEGER)fail('발주 번호의 저장 범위를 초과했습니다.');
 logistics.state(world);
 const order={id:b.nextOrder++,firmId:firm.id,managerId:me.id,firmName:firm.name,status:'transit',createdDay:S.day,...copy(d),inv:{[d.good]:d.quantity}};
 b.orders.push(order);note(world,firm.name+'의 공급품 운송을 시작했다',[me.id,supplier.id,carrier.id]);
 return {text:'발주 완료 · 물품은 운송 중이며 도착 뒤 입고됩니다.',orderId:order.id,...d};
}
function tick(world){
 const S=world.S,b=S.business,delivered=[];if(!b||b.lastTickDay===S.day)return delivered;
 if(b.version!==1)fail('지원하지 않는 사업 저장 형식입니다.');
 logistics.tickWorks(world);
 for(const o of b.orders){
  if(['transit','blocked'].includes(o.status)&&(o.inv[o.good]||0)<=1e-10){o.status='spoiled';o.reason='운송·대기 중 물품 소진';continue;}
  if(o.status==='returning'){
   const a=S.byId.get(o.carrierId);if(o.roadTrip){if(!a?.alive){o.status='complete';o.completedDay=S.day;continue;}if(a.jailUntil>S.day||a.health<30||a.hunger>=90){o.returnDay++;a.dynTravelUntil=o.returnDay+1;continue;}const r=logistics.move(world,o);if(!r.arrived){o.returnDay=Math.max(o.returnDay,S.day+1);a.dynTravelUntil=o.returnDay+1;o.returnReason=r.reason;continue;}}
   if(o.roadTrip||S.day>=o.returnDay){if(a?.dynTravelUntil===o.returnDay+1)a.dynTravelUntil=0;o.status='complete';o.completedDay=S.day;}
   continue;
  }
  if(o.status!=='transit')continue;
  o.progressDays ??= Math.max(0,Math.min(o.days,S.day-(o.segmentDay??o.createdDay)-1));
  const carrier=S.byId.get(o.carrierId),firm=S.firms.find(f=>f.id===o.firmId),destination=firm&&S.bldgs.find(b=>b.id===o.destination.buildingId&&firm.bld?.includes(b.id)&&b.firm===firm.id&&(b.cond??1)>.25);
  if(!carrier?.alive||carrier.jailUntil>S.day||!destination||destination.lot!==o.destination.lot){o.position=positionOf(world,o);o.status='blocked';o.reason=!carrier?.alive?'운송인 사망':carrier.jailUntil>S.day?'운송인 구금':'입고 시설 변경/상실';note(world,o.firmName+' 공급이 중단됐다 · '+o.reason,[o.managerId]);continue;}
  if(carrier.health<30||carrier.hunger>=90){o.arrivalDay++;o.returnDay++;carrier.dynTravelUntil=o.returnDay+1;o.delayedDays=(o.delayedDays||0)+1;continue;}
  o.progressDays++;o.lastTravelDay=S.day;
  if(o.roadTrip){const r=logistics.move(world,o);if(!r.arrived){o.arrivalDay=Math.max(o.arrivalDay,S.day+1);o.returnDay=Math.max(o.returnDay,o.arrivalDay+o.backDays);carrier.dynTravelUntil=o.returnDay+1;o.roadReason=r.reason;continue;}delete o.roadReason;}else if(o.progressDays<o.days)continue;
  const warehouse=stores.get(world,firm,o.destination.buildingId,true);
  const location=warehouse.location||operations.warehouseLocation(world,warehouse,firm);
  if(Object.values(warehouse.inv).some(n=>n>1e-8)&&(!location||location.lot!==o.destination.lot)){o.position={x:o.destination.x,y:o.destination.y};o.status='blocked';o.reason='입고지와 기존 창고 재고 위치가 다름';continue;}
  warehouse.location=copy(o.destination);
  const existing=warehouse.inv[o.good]||0,amount=o.inv[o.good]||0;
  warehouse.cost ||= {};warehouse.cost[o.good]=(existing*(warehouse.cost[o.good]??S.price[o.good]??0)+o.goodsCost+(o.totalFreight??o.freight))/(existing+amount);
  warehouse.quality[o.good]=(existing*(warehouse.quality[o.good]??1)+amount*o.quality)/(existing+amount);
  warehouse.inv[o.good]=existing+amount;o.inv[o.good]=0;o.status='returning';o.receivedDay=S.day;if(o.roadTrip){logistics.returning(o);o.returnDay=S.day+o.backDays;carrier.dynTravelUntil=o.returnDay+1;}
  delivered.push({orderId:o.id,firmId:o.firmId,good:o.good,quantity:amount});note(world,firm.name+'에 공급품이 입고됐다',[firm.ceo]);
 }
 operations.sell(world);autoSupply(world);b.lastTickDay=S.day;
 return delivered;
}
function positionOf(world,o){
 if(o.roadTrip)return logistics.current(world,o);
 if(o.status==='blocked'&&o.position)return copy(o.position);const from=o.segmentOrigin||o.origin,t=Math.max(0,Math.min(1,(o.progressDays??Math.max(0,world.S.day-o.createdDay))/Math.max(1,o.days)));return {x:from.x+(o.destination.x-from.x)*t,y:from.y+(o.destination.y-from.y)*t};
}
function recoveryRoute(world,firm,o,carrier,buildingId){
 const origin=positionOf(world,o),destination=place(world,firm,buildingId??o.destination.buildingId);if(!destination)fail('다시 입고할 실제 회사 건물이 없습니다.');return logistics.quote(world,geography(world).location(carrier),origin,destination,o.inv[o.good]||0);
}
function validatePlan(world,firm,a){
 if(!place(world,firm,a.buildingId))fail('반복 발주 입고 시설을 확인해 주세요.');
 if(!GOODS.includes(a.good)||!Number.isSafeInteger(a.supplierId)||!world.S.byId.get(a.supplierId)?.alive||a.supplierId===firm.ceo||!Number.isSafeInteger(a.carrierId)||!world.S.byId.get(a.carrierId)?.alive||a.carrierId===firm.ceo||a.carrierId===a.supplierId||!Number.isFinite(a.quantity)||a.quantity<1||a.quantity>20||!Number.isFinite(a.minimum)||a.minimum<0||a.minimum>200||!Number.isFinite(a.maxCost)||a.maxCost<=0||a.maxCost>1e9||typeof a.enabled!=='boolean')fail('공급자·운송인·재고 기준·수량·주문 상한을 확인해 주세요.');
}
function autoSupply(world){
 const S=world.S,b=S.business;if(!b.supplyPlans)return;
 for(const [id,plans]of Object.entries(b.supplyPlans)){const f=S.firms.find(f=>f.id===Number(id));if(!f)continue;
  for(const plan of Object.values(plans)){const planSite=plan.buildingId??stores.location(world,b.warehouses[f.id],f)?.buildingId??stores.activeId(world,f);if(!plan.enabled)continue;if(f.ceo!==plan.managerId){plan.lastReason='대표 변경으로 재승인 필요';continue;}
   const incoming=b.orders.filter(o=>o.firmId===f.id&&o.good===plan.good&&o.destination.buildingId===planSite&&o.status==='transit').reduce((n,o)=>n+(o.inv[o.good]||0),0),stock=stores.get(world,f,planSite)?.inv[plan.good]||0;
   if(stock+incoming>=plan.minimum){plan.lastReason='입고·운송 중 재고 충분';continue;}
   if(plan.lastOrderDay===S.day)continue;
   const corporate=plan.kind==='company',action=corporate?'business.companyOrder':'business.order',args=corporate?{firmId:f.id,offerId:plan.offerId,carrierId:plan.carrierId,quantity:plan.quantity,buildingId:planSite}:{firmId:f.id,supplierId:plan.supplierId,carrierId:plan.carrierId,good:plan.good,quantity:plan.quantity,buildingId:planSite},strategy={playerId:f.ceo};let q;
   try{q=quote(world,strategy,action,args);}catch(e){plan.lastReason=e.message;continue;}
   if(q.cost>plan.maxCost){plan.lastReason='승인한 주문 비용 상한 초과';continue;}
   const r=perform(world,strategy,action,args);plan.lastOrderDay=S.day;plan.lastOrderId=r.orderId;plan.lastReason='실제 자동 발주 완료';
  }
 }
}
function view(world,strategy){
 const S=world.S,b=S.business,geo=geography(world),me=S.byId.get(strategy.playerId);
 const carriers=S.agents.filter(a=>a.id!==me.id&&carrierReady(a,S.day));
 const companies=S.firms.filter(f=>f.ceo===me.id&&!f.merc).map(f=>{
  const location=place(world,f),staff=S.agents.filter(a=>a.alive&&a.emp===f.ceo&&a.ct?.company===f.id);
  const offers=[],nearCarriers=location?carriers.slice().sort((a,b)=>{const p=geo.location(a),q=geo.location(b);return Math.hypot(p.x-location.x,p.y-location.y)-Math.hypot(q.x-location.x,q.y-location.y);}).slice(0,16):[];
  if(location)for(const a of S.agents){if(!a.alive||a===me||a.age<14*YEAR)continue;
   const supplierPosition=geo.location(a),carrier=nearCarriers.filter(c=>c!==a).sort((x,y)=>{const p=geo.location(x),q=geo.location(y);return Math.hypot(p.x-supplierPosition.x,p.y-supplierPosition.y)-Math.hypot(q.x-supplierPosition.x,q.y-supplierPosition.y);})[0];if(!carrier)continue;
   for(const good of GOODS){const stock=availableStock(a,good);if(stock<1)continue;const quantity=Math.min(4,Math.floor(stock));let r;try{r=route(world,f,a,carrier,quantity,geo);}catch{continue;}const quality=good==='grain'?(a.gq??1):good==='meal'?(a.mq??1):1,unitPrice=S.price[good]*1.05*quality;
    offers.push({supplierId:a.id,supplierName:world.nm(a),carrierId:carrier.id,carrierName:world.nm(carrier),good,stock,quantity,unitPrice,cost:unitPrice*quantity+r.freight,...r});
   }
  }
  // 품목별 도착 비용 비교를 제공하며 전체 주민 상세·g/q는 보내지 않는다.
  const counts=new Map(),supplierOffers=offers.sort((a,b)=>a.good.localeCompare(b.good)||a.cost-b.cost).filter(o=>{const n=counts.get(o.good)||0;counts.set(o.good,n+1);return n<3;});
  const lines=world.companyLines(f),buildings=S.bldgs.filter(x=>f.bld?.includes(x.id));
  return {id:f.id,name:f.name,cash:f.cash||0,settlementReasons:rights.reasons(world,f),lines:lines.map(id=>({id,name:world.LINE_L[id]})),location,
   stake:((f.sh?.[me.id]||0)+(f.sh?.['I'+me.id]||0))/(f.totalShares||10000),staff:staff.map(a=>({id:a.id,name:world.nm(a),wage:a.ct?.w??null})),
   debt:(S.corpLoans||[]).filter(l=>l.firm===f.id&&!['paid','closed','forgiven'].includes(l.status)).reduce((n,l)=>n+(l.bal||0),0),
   buildings:buildings.map(x=>({id:x.id,name:world.bName(x),condition:x.cond,functions:(x.fx||[]).slice(),lot:x.lot})),
   wholesale:copy((b?.wholesale||[]).filter(o=>o.sellerFirmId===f.id)),companyOffers:trade.market(world,f,me,nearCarriers,carrierReady),warehouse:copy(stores.get(world,f)||{firmId:f.id,inv:{},quality:{}}),warehouses:copy(stores.all(world,f.id)),carriers:nearCarriers.map(a=>({id:a.id,name:world.nm(a)})),offers:supplierOffers,
   hireCandidates:S.agents.filter(a=>a!==me&&world.businessHireable(a)).sort((a,z)=>(z.skill?.[operations.RECIPES[b?.operations?.[f.id]?.recipe]?.skill??9]||0)-(a.skill?.[operations.RECIPES[b?.operations?.[f.id]?.recipe]?.skill??9]||0)).slice(0,8).map(a=>({id:a.id,name:world.nm(a),wage:world.businessHireWage(a),skill:a.skill?.[operations.RECIPES[b?.operations?.[f.id]?.recipe]?.skill??9]||0,waitDays:Math.max(0,(b?.hiring?.[f.id+':'+a.id]?.until||0)-S.day)})),
   production:copy(b?.operations?.[f.id]||null),recipes:Object.entries(operations.RECIPES).filter(([k,r])=>world.companyLines(f).some(l=>r.lines.includes(l))&&buildings.some(site=>operations.facility(world,f,k,site.id))).map(([id,r])=>({id,inputs:copy(r.in),output:r.out||1,rate:r.rate})),modes:copy(operations.MODES),
   arrears:copy((b?.arrears||[]).filter(c=>c.firmId===f.id&&c.amount>0)),plans:Object.fromEntries(Object.entries(b?.supplyPlans?.[f.id]||{}).map(([k,p])=>[k,{...copy(p),buildingId:p.buildingId??stores.location(world,b.warehouses[f.id],f)?.buildingId??stores.activeId(world,f)}])),
   recoveryOptions:(b?.orders||[]).filter(o=>o.firmId===f.id&&o.status==='blocked').slice(-40).map(o=>({orderId:o.id,position:positionOf(world,o),carriers:nearCarriers.slice(0,3).flatMap(a=>{try{return [{id:a.id,name:world.nm(a),...recoveryRoute(world,f,o,a)}];}catch{return [];}})})),
   rivals:S.firms.filter(x=>x!==f&&world.companyLines(x).some(line=>lines.includes(line))).map(x=>({id:x.id,name:x.name,lines:world.companyLines(x).map(id=>world.LINE_L[id])})).slice(0,8)};
 });
 const ids=new Set(companies.map(f=>f.id));
 return {worldId:strategy.worldId,revision:strategy.revision,day:S.day,companies,
  orders:copy((b?.orders||[]).filter(o=>ids.has(o.firmId)||ids.has(o.sellerFirmId)||o.managerId===me.id).slice(-40)),
  heldWarehouses:copy(Object.values(b?.warehouses||{}).filter(w=>!S.firms.some(f=>f.id===w.firmId))),
  log:copy((b?.log||[]).filter(x=>x.ids.includes(me.id)).slice(-20))};
}
function validateState(world){
 const b=world.S.business;if(!b)return;
 if(b.version!==1||!Array.isArray(b.orders)||!b.warehouses||typeof b.warehouses!=='object')fail('사업 저장 자료를 확인해 주세요.');
 for(const cfg of Object.values(b.operations||{}))if(!cfg||!Object.hasOwn(operations.RECIPES,cfg.recipe)||!Object.hasOwn(operations.MODES,cfg.mode)||!Number.isFinite(cfg.limit)||cfg.limit<.5||cfg.limit>40||!Number.isFinite(cfg.markup)||cfg.markup<.5||cfg.markup>2||typeof cfg.enabled!=='boolean'||cfg.taxDebt!==undefined&&(!Number.isFinite(cfg.taxDebt)||cfg.taxDebt<0)||!Array.isArray(cfg.history))fail('저장된 생산·판매 방침을 확인해 주세요.');
 for(const row of [...b.orders,...Object.values(b.warehouses)])for(const n of Object.values(row.inv||{}))if(!Number.isFinite(n)||n< -1e-8)fail('저장된 운송·창고 물량을 확인해 주세요.');
 for(const [key,w]of Object.entries(b.warehouses)){if(!Number.isSafeInteger(w.firmId)||w.firmId<1||w.warehouseId!==undefined&&w.warehouseId!==key||Object.values(w.cost||{}).some(n=>!Number.isFinite(n)||n<0)||Object.values(w.quality||{}).some(n=>!Number.isFinite(n)||n<0)||w.location&&(!Number.isSafeInteger(w.location.buildingId)||!world.S.geo.lots[w.location.lot]))fail('저장된 사업장 창고 신원·원가·품질을 확인해 주세요.');}
 for(const c of b.arrears||[])if(!Number.isFinite(c.amount)||c.amount<0)fail('저장된 미지급 임금을 확인해 주세요.');
}
function describeAction(world,row){const [prefix,op,id]=row.k.split(':');const f=world.S.firms.find(f=>f.id===Number(id));if(prefix!=='co'||!f||!operations.managed(world,f))return row;const out={...row};if(['branch','rd','fund','dark'].includes(op)){out.ok=false;out.why='이 회사의 생산·실거래 방침에서는 해당 경영 행동을 사용할 수 없습니다.';}if(op==='fac')out.hint=(row.hint||'회사 자금 사용').split(' · ')[0]+' · 공정 효율을 단계별 6% 개선합니다. 판매나 이익을 보장하지 않습니다.';if(op==='ad'){out.hint='실제 소매의 고객 도달 범위와 상품 발견 가능성을 개선합니다. 재고·수요·가격 조건이 맞아야 판매됩니다.';if(out.opts)out.opts=out.opts.map(([key,label])=>[key,label.replace(/ · 매출 \+\d+%/,' · 고객 도달 개선')]);}return out;}
function guardAction(world,key){
 const d=describeAction(world,{k:key});if(d.why)fail(d.why);const m=/^co:sell:(\d+):close$/.exec(key);
 if(m){const f=world.S.firms.find(f=>f.id===Number(m[1]));if(f&&rights.reasons(world,f).length)fail('회사 재고·운송 화물·미지급 임금·미납 세금·기업 대출의 권리를 먼저 정리해야 청산할 수 있습니다.');}
}
module.exports={quote,perform,tick,view,GOODS,connect:world=>{validateState(world);logistics.validate(world);logistics.validateProjects(world);rights.validate(world);trade.validate(world);operations.connect(world);},guardAction,describeAction};
