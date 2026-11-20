'use strict';
// 6단계 첫 구현: 회사 지갑, 실제 공급자, 운송 중 화물과 입고 재고의 소유권을 연결한다.
// 공정 자동화·고객/경쟁 전략·도로 그래프는 후속 작업이다. 별도 주민/일일 경제를 만들지 않는다.
const {YEAR}=require('../../engine');
const {geography}=require('./living');
const copy=x=>structuredClone(x), fail=message=>{throw Error(message);};
const GOODS=['grain','meal','wood','stone','tool','iron','fiber','plank','brick','cloth','furn','liquor'];
function state(world){const b=world.S.business ||= {version:1,nextOrder:1,orders:[],warehouses:{},log:[]};if(b.version!==1)fail('지원하지 않는 사업 저장 형식입니다.');return b;}
function owned(world,strategy,id){
 const me=world.S.byId.get(strategy.playerId),firm=world.S.firms.find(f=>f.id===id);
 if(!me?.alive||!firm||firm.ceo!==me.id||firm.merc)fail('현재 운영 권한이 있는 일반 회사를 선택해 주세요.');
 return {me,firm};
}
function place(world,firm){const b=world.S.bldgs.find(b=>firm.bld?.includes(b.id)&&b.firm===firm.id&&(b.cond??1)>.25),p=b&&world.S.geo.lots[b.lot];return p?{buildingId:b.id,lot:b.lot,x:p.x+5,y:p.y+5}:null;}
function availableStock(a,good){return Math.max(0,(a.inv?.[good]||0)-(good==='grain'?Math.max(6,a.g?.keepG||6):good==='meal'?2:0));}
function carrierReady(a,day){return a?.alive&&a.age>=14*YEAR&&a.health>=50&&a.hunger<70&&!a.emp&&!a.firm&&!a.study&&!a.soldier&&!a.dynRoyal&&!a.civ&&!a.foreignT&&!a.dynMercFirm&&!a.enslavedBy&&!(a.jailUntil>day)&&!(a.armyUntil>day)&&!(a.abroadUntil>day)&&!(a.dynTravelUntil>day)&&!(a.dynBasicUntil>day);}
function route(world,firm,supplier,carrier,quantity,geo=geography(world)){
 const destination=place(world,firm);if(!destination)fail('입고할 수 있는 실제 회사 건물이 없습니다.');
 const origin=geo.location(supplier),courier=geo.location(carrier);
 const pickup=Math.hypot(origin.x-courier.x,origin.y-courier.y),loaded=Math.hypot(destination.x-origin.x,destination.y-origin.y);
 const paving=Math.min(1,Math.max(0,(world.S.paved||0)/4000)),speed=80*(1+paving*.4);
 const days=Math.max(1,Math.ceil((pickup+loaded)/speed)),backDays=Math.max(1,Math.ceil(Math.hypot(destination.x-courier.x,destination.y-courier.y)/speed));
 const freight=Math.max(.5,world.S.wageAvg||1)*(days+backDays)*(1+quantity/20);
 return {origin,destination,courier,distance:pickup+loaded,days,backDays,freight,paving};
}
function quote(world,strategy,action,args){
 const {me,firm}=owned(world,strategy,args.firmId),S=world.S;
 if(action==='business.fund'){
  if(me.cash+1e-9<args.amount)fail('운영자금을 지원할 개인 현금이 모자랍니다.');
  return {label:'회사 운영자금 지원',cost:args.amount,hint:'개인→회사 지원금입니다. 지분·상환 청구권은 새로 생기지 않습니다.',details:{firmId:firm.id,amount:args.amount}};
 }
 const supplier=S.byId.get(args.supplierId),carrier=S.byId.get(args.carrierId);
 if(!supplier?.alive||supplier===me||supplier.age<14*YEAR||!GOODS.includes(args.good))fail('실제 공급자와 지원 품목을 선택해 주세요.');
 if(supplier.jailUntil>S.day||supplier.abroadUntil>S.day||supplier.dynTravelUntil>S.day)fail('공급자가 수감·출국·여행 중입니다.');
 if(availableStock(supplier,args.good)+1e-9<args.quantity)fail('공급자의 실제 판매 가능 재고가 모자랍니다.');
 if(!carrierReady(carrier,S.day)||carrier===me||carrier===supplier)fail('고용·복무·학업·여행 중이 아닌 실제 운송인을 선택해 주세요.');
 const r=route(world,firm,supplier,carrier,args.quantity),quality=args.good==='grain'?(supplier.gq??1):args.good==='meal'?(supplier.mq??1):1;
 const unitPrice=S.price[args.good]*1.05*quality;if(!Number.isFinite(unitPrice)||unitPrice<=0)fail('현재 거래 가격을 확인할 수 없습니다.');
 const goodsCost=unitPrice*args.quantity,cost=goodsCost+r.freight;
 if((firm.cash||0)+1e-9<cost)fail('회사 현금이 모자랍니다. 개인·금고·공공 예산으로 대신 지불하지 않습니다.');
 return {label:'공급 발주와 운송 계약',cost,hint:'회사→공급자 상품 대금, 회사→운송인 운임을 지금 지급합니다. 입고 전에는 사용할 수 없습니다.',
  details:{firmId:firm.id,supplierId:supplier.id,carrierId:carrier.id,good:args.good,quantity:args.quantity,quality,unitPrice,goodsCost,...r,arrivalDay:S.day+r.days,returnDay:S.day+r.days+r.backDays}};
}
function note(world,text,ids){const b=state(world);b.log.push({day:world.S.day,text,ids});b.log=b.log.slice(-40);}
function perform(world,strategy,action,args){
 const q=quote(world,strategy,action,args),S=world.S,{me,firm}=owned(world,strategy,args.firmId);
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
 const order={id:b.nextOrder++,firmId:firm.id,managerId:me.id,firmName:firm.name,status:'transit',createdDay:S.day,...copy(d),inv:{[d.good]:d.quantity}};
 b.orders.push(order);note(world,firm.name+'의 공급품 운송을 시작했다',[me.id,supplier.id,carrier.id]);
 return {text:'발주 완료 · 물품은 운송 중이며 도착 뒤 입고됩니다.',orderId:order.id,...d};
}
function tick(world){
 const S=world.S,b=S.business,delivered=[];if(!b)return delivered;
 if(b.version!==1)fail('지원하지 않는 사업 저장 형식입니다.');
 for(const o of b.orders){
  if(o.status==='returning'){
   if(S.day>=o.returnDay){const a=S.byId.get(o.carrierId);if(a?.dynTravelUntil===o.returnDay+1)a.dynTravelUntil=0;o.status='complete';o.completedDay=S.day;}
   continue;
  }
  if(o.status!=='transit'||S.day<o.arrivalDay)continue;
  const carrier=S.byId.get(o.carrierId),firm=S.firms.find(f=>f.id===o.firmId),destination=firm&&S.bldgs.find(b=>b.id===o.destination.buildingId&&firm.bld?.includes(b.id)&&b.firm===firm.id&&(b.cond??1)>.25);
  if(!carrier?.alive||carrier.jailUntil>S.day||!destination||destination.lot!==o.destination.lot){o.status='blocked';o.reason=!carrier?.alive?'운송인 사망':carrier.jailUntil>S.day?'운송인 구금':'입고 시설 변경/상실';note(world,o.firmName+' 공급이 중단됐다 · '+o.reason,[o.managerId]);continue;}
  if(carrier.health<30||carrier.hunger>=90){o.arrivalDay++;o.returnDay++;carrier.dynTravelUntil=o.returnDay+1;o.delayedDays=(o.delayedDays||0)+1;continue;}
  const warehouse=b.warehouses[o.firmId] ||= {firmId:o.firmId,name:firm.name,inv:{},quality:{}};
  const existing=warehouse.inv[o.good]||0,amount=o.inv[o.good]||0;
  warehouse.quality[o.good]=(existing*(warehouse.quality[o.good]??1)+amount*o.quality)/(existing+amount);
  warehouse.inv[o.good]=existing+amount;o.inv[o.good]=0;o.status='returning';o.receivedDay=S.day;
  delivered.push({orderId:o.id,firmId:o.firmId,good:o.good,quantity:amount});note(world,firm.name+'에 공급품이 입고됐다',[firm.ceo]);
 }
 return delivered;
}
function view(world,strategy){
 const S=world.S,b=S.business,geo=geography(world),me=S.byId.get(strategy.playerId);
 const carriers=S.agents.filter(a=>a.id!==me.id&&carrierReady(a,S.day));
 const companies=S.firms.filter(f=>f.ceo===me.id&&!f.merc).map(f=>{
  const location=place(world,f),staff=S.agents.filter(a=>a.alive&&a.emp===f.ceo&&a.ct?.company===f.id);
  const offers=[],nearCarriers=location?carriers.slice().sort((a,b)=>{const p=geo.location(a),q=geo.location(b);return Math.hypot(p.x-location.x,p.y-location.y)-Math.hypot(q.x-location.x,q.y-location.y);}).slice(0,16):[];
  if(location)for(const a of S.agents){if(!a.alive||a===me||a.age<14*YEAR)continue;
   const supplierPosition=geo.location(a),carrier=nearCarriers.filter(c=>c!==a).sort((x,y)=>{const p=geo.location(x),q=geo.location(y);return Math.hypot(p.x-supplierPosition.x,p.y-supplierPosition.y)-Math.hypot(q.x-supplierPosition.x,q.y-supplierPosition.y);})[0];if(!carrier)continue;
   for(const good of GOODS){const stock=availableStock(a,good);if(stock<1)continue;const quantity=Math.min(4,Math.floor(stock)),r=route(world,f,a,carrier,quantity,geo),quality=good==='grain'?(a.gq??1):good==='meal'?(a.mq??1):1,unitPrice=S.price[good]*1.05*quality;
    offers.push({supplierId:a.id,supplierName:world.nm(a),carrierId:carrier.id,carrierName:world.nm(carrier),good,stock,quantity,unitPrice,cost:unitPrice*quantity+r.freight,...r});
   }
  }
  // 품목별 도착 비용 비교를 제공하며 전체 주민 상세·g/q는 보내지 않는다.
  const counts=new Map(),supplierOffers=offers.sort((a,b)=>a.good.localeCompare(b.good)||a.cost-b.cost).filter(o=>{const n=counts.get(o.good)||0;counts.set(o.good,n+1);return n<3;});
  const lines=world.companyLines(f),buildings=S.bldgs.filter(x=>f.bld?.includes(x.id));
  return {id:f.id,name:f.name,cash:f.cash||0,lines:lines.map(id=>({id,name:world.LINE_L[id]})),location,
   stake:((f.sh?.[me.id]||0)+(f.sh?.['I'+me.id]||0))/(f.totalShares||10000),staff:staff.map(a=>({id:a.id,name:world.nm(a),wage:a.ct?.w??null})),
   debt:(S.corpLoans||[]).filter(l=>l.firm===f.id&&!['paid','closed','forgiven'].includes(l.status)).reduce((n,l)=>n+(l.bal||0),0),
   buildings:buildings.map(x=>({id:x.id,name:world.bName(x),condition:x.cond,functions:(x.fx||[]).slice()})),
   warehouse:copy(b?.warehouses[f.id]||{firmId:f.id,inv:{},quality:{}}),offers:supplierOffers,
   rivals:S.firms.filter(x=>x!==f&&world.companyLines(x).some(line=>lines.includes(line))).map(x=>({id:x.id,name:x.name,lines:world.companyLines(x).map(id=>world.LINE_L[id])})).slice(0,8)};
 });
 const ids=new Set(companies.map(f=>f.id));
 return {worldId:strategy.worldId,revision:strategy.revision,day:S.day,companies,
  orders:copy((b?.orders||[]).filter(o=>ids.has(o.firmId)||o.managerId===me.id).slice(-40)),
  heldWarehouses:copy(Object.values(b?.warehouses||{}).filter(w=>!S.firms.some(f=>f.id===w.firmId))),
  log:copy((b?.log||[]).filter(x=>x.ids.includes(me.id)).slice(-20))};
}
module.exports={quote,perform,tick,view,GOODS};
