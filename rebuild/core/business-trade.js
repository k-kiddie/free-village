'use strict';
// 기업 재고의 판매 권한은 대표가 게시한 조건에서 온다. 다른 회사 재고를 개인 재고처럼 빼지 않는다.
const stores=require('./warehousing'),logistics=require('./logistics');
const clone=x=>structuredClone(x),fail=message=>{throw Error(message);};
const ACTIONS=['business.wholesale','business.companyOrder','business.companySupply'];
function offer(world,id){return world.S.business?.wholesale?.find(o=>o.id===id);}
function terms(world,seller,a){
 if(!world.S.business?.operations?.[seller.id])fail('생산·실거래 방침을 사용하는 회사에서 도매 조건을 게시해 주세요.');
 if(!stores.building(world,seller,a.buildingId))fail('도매품을 출고할 실제 회사 시설을 확인해 주세요.');
 if(!Number.isFinite(a.reserve)||a.reserve<0||a.reserve>200||!Number.isFinite(a.batch)||a.batch<1||a.batch>20||!Number.isFinite(a.markup)||a.markup<.5||a.markup>2||!Number.isFinite(a.discountAt)||a.discountAt<1||a.discountAt>a.batch||!Number.isFinite(a.discountMarkup)||a.discountMarkup<.5||a.discountMarkup>a.markup||typeof a.enabled!=='boolean')fail('도매 잔여 재고·주문 한도·가격 배율·대량 할인 조건을 확인해 주세요.');
}
function sellerFor(world,o){
 const f=o&&world.S.firms.find(f=>f.id===o.sellerFirmId&&!f.merc);
 if(!f||!world.S.byId.get(f.ceo)?.alive||!o.enabled||f.ceo!==o.managerId||!world.S.business?.operations?.[f.id])fail('공급 회사의 유효한 대표 승인 조건이 없습니다.');
 const site=stores.building(world,f,o.buildingId),w=site&&stores.get(world,f,site.id);
 if(!site||!w)fail('공급 회사의 실제 출고 시설·창고가 없습니다.');
 return {f,site,w};
}
function orderQuote(world,buyer,me,a,ready,checkCash=true){
 const S=world.S,o=offer(world,a.offerId),{f:seller,site,w}=sellerFor(world,o);
 if(seller===buyer)fail('같은 회사의 재고는 사업장 간 창고 운송을 사용해 주세요.');
 if(a.quantity>o.batch||(w.inv[o.good]||0)-a.quantity+1e-8<o.reserve)fail('공급 회사가 승인한 주문 한도 또는 잔여 재고 조건에 맞지 않습니다.');
 const dest=stores.building(world,buyer,a.buildingId??stores.activeId(world,buyer)),carrier=S.byId.get(a.carrierId);
 if(!dest)fail('입고할 실제 구매 회사 시설이 없습니다.');
 if(!ready(carrier,S.day)||carrier.id===me.id||S.firms.some(f=>f.ceo===carrier.id))fail('현재 운송 가능한 실제 운송인을 선택해 주세요.');
 const geo=require('./living').geography(world),r=logistics.quote(world,geo.location(carrier),stores.point(world,site),stores.point(world,dest),a.quantity),quality=w.quality[o.good]??1;
 const markup=a.quantity>=o.discountAt?o.discountMarkup:o.markup,unitPrice=S.price[o.good]*quality*markup,goodsCost=unitPrice*a.quantity,cost=goodsCost+r.freight;
 if(!Number.isFinite(unitPrice)||unitPrice<=0)fail('도매품의 실제 시세·품질 가격을 확인할 수 없습니다.');
 if(checkCash&&(buyer.cash||0)+1e-8<cost)fail('구매 회사의 상품 대금·운임이 모자랍니다. 개인이나 공공 자금으로 대신 지급하지 않습니다.');
 return {label:'기업 간 공급 계약',cost,hint:'구매 회사→공급 회사 상품 대금, 구매 회사→운송인 운임입니다. 게시된 잔여 재고·수량별 가격 조건만 실행합니다. 출고 시 구매 회사 소유가 되며 이후 운송 지연·보관 손실과 회수 운임은 구매 회사가 부담합니다. 입고 전에는 사용할 수 없습니다.',details:{firmId:buyer.id,sellerFirmId:seller.id,sellerManagerId:seller.ceo,sourceBuildingId:site.id,offerId:o.id,offerRevision:o.revision,carrierId:carrier.id,good:o.good,quantity:a.quantity,quality,markup,unitPrice,goodsCost,...r,arrivalDay:S.day+r.days,returnDay:S.day+r.days+r.backDays,agreedTerms:{reserve:o.reserve,batch:o.batch,markup:o.markup,discountAt:o.discountAt,discountMarkup:o.discountMarkup,payment:'dispatch',transportRisk:'buyer'}}};
}
function quote(world,firm,me,action,a,ready){
 if(action==='business.wholesale'){
  terms(world,firm,a);return {label:'기업 도매 조건 게시',hint:'이 회사의 실제 창고에서 다른 회사가 구매할 수 있도록 승인합니다. 잔여 재고·주문 한도와 수량별 가격 배율을 매번 확인합니다. 대표가 바뀌면 새 주문은 재승인 전까지 멈춥니다.',details:clone(a)};
 }
 if(action==='business.companySupply'){
  if(!offer(world,a.offerId)||!Number.isFinite(a.minimum)||a.minimum<0||a.minimum>200||!Number.isFinite(a.maxCost)||a.maxCost<=0||a.maxCost>1e9||typeof a.enabled!=='boolean')fail('도매 조건·재고 기준·주문 상한을 확인해 주세요.');
  if(!stores.building(world,firm,a.buildingId??stores.activeId(world,firm)))fail('실제 반복 입고 시설이 없습니다.');
  if(!world.S.byId.get(a.carrierId))fail('실제 운송인을 선택해 주세요.');
  const o=offer(world,a.offerId);if(o.sellerFirmId===firm.id)fail('다른 공급 회사를 선택해 주세요.');
  return {label:'기업 간 반복 공급 승인',hint:'승인한 공급 조건을 매번 다시 확인하고 상품 대금+운임이 주문 상한을 넘으면 발주하지 않습니다. 게시 조건의 중지·대표 변경·재고 부족·운송 불가 사유를 남깁니다.',details:{...clone(a),good:o.good}};
 }
 return orderQuote(world,firm,me,a,ready);
}
function recordSale(world,seller,d,orderId,sourceCost){
 const S=world.S,cfg=S.business.operations[seller.id],sale={day:S.day,orderId,buyerFirmId:d.firmId,good:d.good,quantity:d.quantity,revenue:d.goodsCost,costOfSales:sourceCost};
 // 하루 소매/세금 보고는 이미 닫혔을 수 있다. 현금은 지금 이동하고 보고는 다음 하루 한 번 반영한다.
 cfg.pendingWholesale ||= [];cfg.pendingWholesale.push(sale);
 seller.rev=(seller.rev||0)+d.goodsCost;seller.revBy ||= {};seller.revBy[d.good]=(seller.revBy[d.good]||0)+d.goodsCost;
 S.trades[d.good]=(S.trades[d.good]||0)+d.quantity;
}
function perform(world,firm,me,action,a,q){
 const S=world.S,b=S.business;
 if(action==='business.wholesale'){
  b.wholesale ||= [];b.nextWholesale ||= 1;let o=b.wholesale.find(o=>o.sellerFirmId===firm.id&&o.buildingId===a.buildingId&&o.good===a.good);
  if(o&&o.revision>=Number.MAX_SAFE_INTEGER||!o&&b.nextWholesale>=Number.MAX_SAFE_INTEGER)fail('도매 조건 번호의 저장 범위를 초과했습니다.');
  if(!o){o={id:b.nextWholesale++,sellerFirmId:firm.id,revision:0,createdDay:S.day};b.wholesale.push(o);}Object.assign(o,clone(a),{managerId:me.id,revision:o.revision+1,updatedDay:S.day});return {text:'실제 회사 창고의 도매 조건을 게시했습니다.',offerId:o.id};
 }
 if(action==='business.companySupply'){
  const o=offer(world,a.offerId);b.supplyPlans ||= {};b.supplyPlans[firm.id] ||= {};b.supplyPlans[firm.id]['company-'+o.good]={...clone(a),kind:'company',good:o.good,buildingId:a.buildingId??stores.activeId(world,firm),managerId:me.id};return {text:'기업 간 반복 공급의 재고 기준·비용 상한을 승인했습니다.'};
 }
 const d=q.details,seller=S.firms.find(f=>f.id===d.sellerFirmId),w=stores.get(world,seller,d.sourceBuildingId),carrier=S.byId.get(d.carrierId);
 if(!Number.isSafeInteger(b.nextOrder)||b.nextOrder>=Number.MAX_SAFE_INTEGER)fail('발주 번호의 저장 범위를 초과했습니다.');
 const sourceCost=d.quantity*(w.cost?.[d.good]??S.price[d.good]??0);
 firm.cash-=d.goodsCost;seller.cash=(seller.cash||0)+d.goodsCost;world.businessPay(firm,carrier,d.freight,'biz');w.inv[d.good]-=d.quantity;
 carrier.dynTravelUntil=d.returnDay+1;logistics.state(world);const o={id:b.nextOrder++,kind:'companySupply',managerId:me.id,firmName:firm.name,status:'transit',createdDay:S.day,...clone(d),inv:{[d.good]:d.quantity}};b.orders.push(o);recordSale(world,seller,d,o.id,sourceCost);
 b.log.push({day:S.day,text:firm.name+' → '+seller.name+' 기업 간 공급 계약·출고',ids:[me.id,seller.ceo,carrier.id]});b.log=b.log.slice(-40);
 return {text:'회사 간 상품 대금과 실제 운임을 지급하고 출고했습니다. 구매 회사 물품은 실제 도착 후 입고됩니다.',orderId:o.id,...d};
}
function market(world,firm,me,carriers,ready){
 if(!carriers.length)return [];const location=stores.building(world,firm,stores.activeId(world,firm));if(!location)return [];
 const dest=stores.point(world,location),g=require('./living').geography(world),out=[];
 const rows=(world.S.business?.wholesale||[]).filter(o=>o.sellerFirmId!==firm.id&&o.enabled).map(o=>{const p=world.S.geo.lots[world.S.bldgs.find(b=>b.id===o.buildingId)?.lot];return {o,distance:p?Math.hypot(dest.x-p.x,dest.y-p.y):Infinity};}).sort((a,b)=>a.distance-b.distance||a.o.id-b.o.id).slice(0,48);
 for(const {o}of rows){let source;try{source=sellerFor(world,o);}catch{continue;}const p=stores.point(world,source.site),carrier=carriers.slice().sort((a,b)=>{const A=g.location(a),B=g.location(b);return Math.hypot(A.x-p.x,A.y-p.y)-Math.hypot(B.x-p.x,B.y-p.y);})[0],available=Math.max(0,(source.w.inv[o.good]||0)-o.reserve),quantity=Math.min(o.batch,Math.floor(available),4);if(quantity<1)continue;
  try{const q=orderQuote(world,firm,me,{offerId:o.id,carrierId:carrier.id,quantity},ready,false),{roadTrip,...details}=q.details;out.push({sellerName:source.f.name,carrierName:world.nm(carrier),available,batch:o.batch,reserve:o.reserve,discountAt:o.discountAt,discountMarkup:o.discountMarkup,askMarkup:o.markup,cost:q.cost,...details});}catch{}
 }
 return out.sort((a,b)=>a.cost/a.quantity-b.cost/b.quantity).slice(0,36);
}
function validate(world){const S=world.S,b=S.business;if(!b)return;if(b.wholesale!==undefined&&!Array.isArray(b.wholesale))fail('저장된 기업 도매 목록을 확인해 주세요.');const seen=new Set();for(const o of b.wholesale||[]){if(!Number.isSafeInteger(o.id)||o.id<1||seen.has(o.id)||!Number.isSafeInteger(o.revision)||o.revision<1||!Number.isSafeInteger(o.sellerFirmId)||!Number.isSafeInteger(o.managerId)||!Number.isSafeInteger(o.buildingId)||!['grain','meal','wood','stone','tool','iron','fiber','plank','brick','cloth','furn','liquor'].includes(o.good)||!Number.isFinite(o.reserve)||o.reserve<0||o.reserve>200||!Number.isFinite(o.batch)||o.batch<1||o.batch>20||!Number.isFinite(o.markup)||o.markup<.5||o.markup>2||!Number.isFinite(o.discountAt)||o.discountAt<1||o.discountAt>o.batch||!Number.isFinite(o.discountMarkup)||o.discountMarkup<.5||o.discountMarkup>o.markup||typeof o.enabled!=='boolean')fail('저장된 기업 도매 조건을 확인해 주세요.');seen.add(o.id);}
 if(b.wholesale&&(!Number.isSafeInteger(b.nextWholesale)||b.nextWholesale<=[...seen].reduce((n,id)=>Math.max(n,id),0)))fail('저장된 기업 도매 조건 번호를 확인해 주세요.');
 for(const plans of Object.values(b.supplyPlans||{}))for(const p of Object.values(plans))if(p.kind==='company'&&(!Number.isSafeInteger(p.firmId)||p.firmId<1||!Number.isSafeInteger(p.managerId)||p.managerId<1||!Number.isSafeInteger(p.offerId)||p.offerId<1||!Number.isSafeInteger(p.carrierId)||p.carrierId<1||!Number.isSafeInteger(p.buildingId)||p.buildingId<1||!Number.isFinite(p.quantity)||p.quantity<1||p.quantity>20||!Number.isFinite(p.minimum)||p.minimum<0||p.minimum>200||!Number.isFinite(p.maxCost)||p.maxCost<=0||p.maxCost>1e9||typeof p.enabled!=='boolean'))fail('저장된 기업 반복 공급 승인을 확인해 주세요.');
 for(const cfg of Object.values(b.operations||{}))for(const s of cfg.pendingWholesale||[])if(!Number.isSafeInteger(s.day)||!Number.isSafeInteger(s.orderId)||!Number.isFinite(s.quantity)||s.quantity<=0||!Number.isFinite(s.revenue)||s.revenue<0||!Number.isFinite(s.costOfSales)||s.costOfSales<0)fail('저장된 도매 매출/원가를 확인해 주세요.');
}
module.exports={ACTIONS,quote,perform,market,validate};
