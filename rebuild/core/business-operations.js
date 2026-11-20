'use strict';
// 회사 창고 공정은 native 하루의 직원 실행 슬롯을 사용한다. 별도 노동/생산 시계를 돌리지 않는다.
// 재료는 창고에서, 임금은 회사에서, 매출은 실제 고객 지갑에서 이동한다.
const {MAKE,YEAR}=require('../../engine');
const {geography}=require('./living');
const clone=x=>structuredClone(x),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const RECIPES={meal:{in:{grain:2},out:3,rate:1,skill:1,fx:['b1','pub'],lines:['food','leisure']},
 ...Object.fromEntries(Object.entries(MAKE).map(([k,v])=>[k,{...v,skill:9,fx:k==='plank'?['b2','fac','bigfac']:k==='brick'?['b10','fac','bigfac']:k==='liquor'?['pub','fac','bigfac']:['fac','bigfac'],lines:k==='liquor'?['food','leisure','mfg']:k==='plank'||k==='brick'?['mfg','build','agri']:['mfg']}]))};
const MODES={bulk:{name:'저가 대량',speed:1.2,quality:.9,price:.85},quality:{name:'고품질 소량',speed:.65,quality:1.3,price:1.2},reserve:{name:'현금·재고 우선',speed:.8,quality:1,price:1}};
function store(world){const b=world.S.business;b.operations ||= {};b.arrears ||= [];return b;}
function managed(world,f){return !!world.S.business?.operations?.[f.id];}
function warehouseLocation(world,w,f){
 if(w?.location)return w.location;
 const receipts=(world.S.business?.orders||[]).filter(o=>o.firmId===f.id&&o.receivedDay!==undefined),places=new Map(receipts.map(o=>[o.destination.lot,o.destination]));
 if(places.size===1)return [...places.values()][0];
 if(!places.size&&f.bld?.length===1){const b=world.S.bldgs.find(b=>b.id===f.bld[0]);return b?{buildingId:b.id,lot:b.lot}:null;}return null;
}
function facility(world,f,recipe){const r=RECIPES[recipe],w=world.S.business?.warehouses[f.id],hasStock=Object.values(w?.inv||{}).some(n=>n>1e-8),loc=hasStock?warehouseLocation(world,w,f):null;if(hasStock&&!loc)return null;return r&&world.S.bldgs.find(b=>f.bld?.includes(b.id)&&b.firm===f.id&&(b.cond??1)>.25&&(!loc||loc.lot===b.lot)&&b.fx?.some(k=>r.fx.includes(k)));}
function member(world,a){
 if(!a.alive||a.pubT||a.faithT||a.foreignT||a.civ||a.soldier)return null;
 const f=a.ct?.company&&world.S.firms.find(f=>f.id===a.ct.company&&f.ceo===a.emp&&a.ct.e===f.ceo);
 return f&&managed(world,f)?f:null;
}
function daily(world,cfg){
 if(cfg.daily?.day!==world.S.day){const charges=(cfg.pendingCosts||[]).filter(c=>c.day<world.S.day);cfg.pendingCosts=(cfg.pendingCosts||[]).filter(c=>c.day>=world.S.day);cfg.daily={otherExpenses:charges.reduce((n,c)=>n+c.amount,0),expenseDetails:clone(charges),day:world.S.day,produced:0,sold:0,revenue:0,serviceRevenue:0,serviceCustomers:[],taxAssessment:0,taxPaid:0,wages:0,inputCost:0,costOfSales:0,spoilageCost:0,unpaid:0,workers:0,idle:0,customers:[],reasons:[]};}
 return cfg.daily;
}
function issue(d,reason){if(!d.reasons.includes(reason))d.reasons.push(reason);}
function warehouse(world,f){const b=world.S.business;return b.warehouses[f.id] ||= {firmId:f.id,name:f.name,inv:{},quality:{},cost:{}};}
function configure(world,f,args){
 const b=store(world),old=b.operations[f.id]||{};
 b.operations[f.id]={...old,recipe:args.recipe,mode:args.mode,limit:args.limit,markup:args.markup,enabled:args.enabled,
  startedDay:old.startedDay??world.S.day,history:old.history||[]};
 const w=warehouse(world,f);if(!w.location)w.locationSource=(world.S.business.orders||[]).some(o=>o.firmId===f.id&&o.receivedDay!==undefined)?'saved-delivery':'operator-declaration';const site=facility(world,f,args.recipe),p=world.S.geo.lots[site.lot];w.location={buildingId:site.id,lot:site.lot,x:p.x+5,y:p.y+5};return {text:'생산·판매 방침을 반영했습니다. 다음 하루부터 적용됩니다. 중지해도 고용 계약의 임금은 지급합니다.'};
}
function validatePolicy(world,f,args){
 const r=RECIPES[args.recipe];if(!Object.hasOwn(RECIPES,args.recipe)||!Object.hasOwn(MODES,args.mode)||!Number.isFinite(args.limit)||args.limit<.5||args.limit>40||!Number.isFinite(args.markup)||args.markup<.5||args.markup>2||typeof args.enabled!=='boolean')throw Error('공정·방침·생산 한도·판매 배율을 확인해 주세요.');
 if(!world.companyLines(f).some(l=>r.lines.includes(l)))throw Error('이 공정에 맞는 실제 사업 분야가 필요합니다.');
 if(!facility(world,f,args.recipe))throw Error('해당 공정을 수행할 회사 설비가 없습니다.');
}
function addClaim(world,f,a,amount){
 if(amount<1e-8)return;const b=store(world);let c=b.arrears.find(c=>c.firmId===f.id&&c.workerId===a.id&&c.amount>1e-8);
 if(!c){c={id:b.arrears.length+1,firmId:f.id,firmName:f.name,workerId:a.id,amount:0,createdDay:world.S.day};b.arrears.push(c);}c.amount+=amount;
}
function work(world,a){
 const f=member(world,a);if(!f)return false;
 const S=world.S,b=store(world),cfg=b.operations[f.id],d=daily(world,cfg),r=RECIPES[cfg.recipe],mode=MODES[cfg.mode],home=facility(world,f,cfg.recipe),w=warehouse(world,f);
 const due=Math.max(0,a.ct.w||0),pension=S.gov?.policy.pension ? .03 : 0,pay=Math.min(due,Math.max(0,f.cash||0)/(1+pension));
 const missing=Math.max(0,due-pay);addClaim(world,f,a,missing);d.unpaid+=missing;
 let reason='',batches=0,quality=1,cost=0,added=0;
 if(!cfg.enabled)reason='생산 중지';else if(f.co?.strike>S.day)reason='파업';else if(!home)reason='설비 상실';else if(!world.companyLines(f).some(l=>r.lines.includes(l)))reason='사업 분야 변경';else if(a.fat>=85||a.health<30||a.hunger>=85)reason='직원 피로·건강·식량';else if(missing>1e-8)reason='회사 임금 부족';
 else if((cfg.mode==='reserve')&&(f.cash||0)-pay<due*3)reason='현금 비축';
 else if((w.inv[cfg.recipe]||0)>=cfg.limit*(r.out||1)*3)reason='완제품 재고 상한';
 if(!reason){
  const skill=a.skill[r.skill]||0,eff=Math.max(.15,1-a.fat/150)*(a.disMul||1)*(a.addict?.75:1)*(1+.15*(a.edu||0))*(home.cond??1)*(1+.06*(f.co?.fac||0))*(home.fx.includes('bigfac')?1.25:1)*(.8+.4*(f.co?.morale??.5));
  batches=Math.min(Math.max(0,cfg.limit-d.produced/(r.out||1)),(cfg.recipe==='meal'?1+2*skill:(.3+.7*skill)*r.rate)*eff*mode.speed);
  for(const [good,n]of Object.entries(r.in))batches=Math.min(batches,(w.inv[good]||0)/n);
  if(batches<=1e-8)reason='원재료 부족';
  else{
   quality=clamp(Object.keys(r.in).reduce((n,k)=>n+(w.quality[k]??1),0)/Object.keys(r.in).length*mode.quality*(.85+.15*skill)*(1+.03*(f.co?.pat||[]).filter(p=>p.until>S.day).length),.2,2);
   w.cost ||= {};for(const [good,n]of Object.entries(r.in)){const used=n*batches;w.inv[good]-=used;cost+=used*(w.cost[good]??S.price[good]??0);added-=used*(S.price[good]||0);}
   const amount=batches*(r.out||1),old=w.inv[cfg.recipe]||0;
   w.quality[cfg.recipe]=(old*(w.quality[cfg.recipe]??1)+amount*quality)/(old+amount);
   w.cost[cfg.recipe]=(old*(w.cost[cfg.recipe]??S.price[cfg.recipe]??0)+cost)/(old+amount);w.inv[cfg.recipe]=old+amount;
   d.produced+=amount;d.inputCost+=cost;added+=amount*(S.price[cfg.recipe]||0);S.made ||= {};S.made[cfg.recipe]=(S.made[cfg.recipe]||0)+amount;
   f.made ||= {};f.made[cfg.recipe]=(f.made[cfg.recipe]||0)+amount;
  }
 }
 const paid=world.businessLabor(f,a,pay,r.skill,home?.lot,added,batches>1e-8);d.wages+=paid;d.workers++;
 if(reason){d.idle++;issue(d,reason);}a.businessDay={day:S.day,firmId:f.id,recipe:cfg.recipe,produced:batches*(r.out||1),reason};
 if(missing>1e-8){a.businessUnpaidDays=(a.businessUnpaidDays||0)+1;if(a.businessUnpaidDays>=3)world.businessDismiss(a);}else a.businessUnpaidDays=0;
 return true;
}
function need(a,good,S){
 const inv=a.inv||{},rich=a.cash>Math.max(.5,S.wageAvg||1)*20;
 if(good==='meal')return Math.max(0,3+(a.hunger>40?2:0)-(inv.meal||0));
 if(good==='cloth')return Math.max(0,(rich?1.5:.7)-(inv.cloth||0));
 if(good==='furn')return rich?Math.max(0,1-(inv.furn||0)):0;
 if(good==='liquor')return a.g.lux>.4&&rich?Math.max(0,2-(inv.liquor||0)):0;
 if(good==='plank'||good==='brick')return a.site||a.act===3?Math.max(0,4-(inv[good]||0)):0;
 return 0;
}
function sell(world){
 const S=world.S,b=S.business;if(!b?.operations)return;const geo=geography(world);
 const sellers=S.firms.filter(f=>managed(world,f)&&b.operations[f.id].enabled).map(f=>({f,cfg:b.operations[f.id],w:b.warehouses[f.id],site:facility(world,f,b.operations[f.id].recipe)})).filter(x=>x.site&&x.w&&x.cfg.daily?.day===S.day&&x.cfg.daily.workers>0);
 const points=new Map(sellers.map(x=>[x.f.id,S.geo.lots[x.site.lot]]));
 for(const buyer of S.agents){if(!buyer.alive||buyer.age<14*YEAR||buyer.cash<=0||buyer.jailUntil>S.day||buyer.dynTravelUntil>S.day||buyer.abroadUntil>S.day)continue;
  const p=geo.location(buyer);
  for(const good of Object.keys(RECIPES)){
   let demand=need(buyer,good,S);if(demand<=.01)continue;const candidates=[];
   for(const row of sellers){if(row.cfg.recipe!==good||(row.w.inv[good]||0)<=.01)continue;
    const loc=points.get(row.f.id),distance=Math.hypot(loc.x+5-p.x,loc.y+5-p.y);const ad=row.f.co?.adUntil>S.day?(row.f.co.ad||0):0;if(distance>96+ad*80)continue;
    const quality=row.w.quality[good]??1,price=(S.price[good]||1)*row.cfg.markup*quality;
    const taste=.3+(buyer.g.lux||0)*2.2+(buyer.cash>Math.max(.5,S.wageAvg||1)*20?.5:0),willing=(S.price[good]||1)*(1+(buyer.g.lux||0)*.6+(good==='meal'?buyer.hunger/200:0))*quality**taste;
    if(price>willing)continue;candidates.push({...row,quality,price,score:(price/quality**taste+(S.price[good]||1)*distance/500)*(1-ad*.2)});
   }
   candidates.sort((x,y)=>x.score-y.score||((x.f.id+S.day+buyer.id)%Math.max(1,S.firms.length))-((y.f.id+S.day+buyer.id)%Math.max(1,S.firms.length)));
   for(const row of candidates){if(demand<=.01)break;const budget=good==='meal'?buyer.cash*.6:Math.max(0,buyer.cash-Math.max(.5,S.wageAvg||1)*3)*.25;
    const quantity=Math.min(demand,row.w.inv[good],budget/row.price);if(quantity<=.01)continue;
    const amount=quantity*row.price,existing=buyer.inv[good]||0;world.businessReceive(row.f,buyer,amount,good);row.w.inv[good]-=quantity;buyer.inv[good]=existing+quantity;
    if(good==='meal')buyer.mq=(existing*(buyer.mq??1)+quantity*row.quality)/(existing+quantity);
    buyer.goodsQuality ||= {};buyer.goodsQuality[good]=(existing*(buyer.goodsQuality[good]??1)+quantity*row.quality)/(existing+quantity);
    const d=daily(world,row.cfg);d.sold+=quantity;d.revenue+=amount;d.costOfSales+=quantity*(row.w.cost?.[good]??S.price[good]??0);
    let c=d.customers.find(x=>x.id===buyer.id);if(!c&&d.customers.length<8){c={id:buyer.id,name:world.nm(buyer),quantity:0,value:0};d.customers.push(c);}if(c){c.quantity+=quantity;c.value+=amount;}
    S.trades[good]=(S.trades[good]||0)+quantity;demand-=quantity;
   }
  }
 }
 for(const f of S.firms.filter(f=>managed(world,f))){const cfg=b.operations[f.id],d=daily(world,cfg);d.operatingProfit=d.revenue-d.costOfSales-d.wages-d.spoilageCost-(d.otherExpenses||0);
  d.taxAssessment=Math.max(0,d.operatingProfit)*clamp(S.gov?.policy.tax||0,0,.6);const tax=world.businessTax(f,(cfg.taxDebt||0)+d.taxAssessment);cfg.taxDebt=tax.due;d.taxPaid=tax.paid;d.afterTaxProfit=d.operatingProfit-d.taxAssessment;f.profE=(f.profE||0)*.8+d.operatingProfit*.2;
  if(d.produced&&!d.sold)issue(d,'판매되지 않은 완제품');if(!d.workers)issue(d,'출근 가능한 회사 계약 직원 없음');
  if(cfg.history.at(-1)?.day===S.day)cfg.history.pop();cfg.history.push(clone(d));cfg.history=cfg.history.slice(-30);f.revM=cfg.history.reduce((n,row)=>n+row.revenue,0);
 }
}
function connect(world){world.setBusinessHooks({managed:f=>managed(world,f),assigned:a=>!!member(world,a),work:a=>work(world,a),charge(f,amount,kind){if(!(amount>0))return;const b=world.S.business,cfg=b.operations[f.id],charge={day:world.S.day,amount,kind};if(cfg.daily?.day===world.S.day&&b.lastTickDay!==world.S.day){cfg.daily.otherExpenses=(cfg.daily.otherExpenses||0)+amount;cfg.daily.expenseDetails ||= [];cfg.daily.expenseDetails.push(charge);}else{cfg.pendingCosts ||= [];cfg.pendingCosts.push(charge);}},service(f,a,amount){const d=daily(world,world.S.business.operations[f.id]);d.revenue+=amount;d.serviceRevenue=(d.serviceRevenue||0)+amount;d.serviceCustomers ||= [];if(d.serviceCustomers.length<8)d.serviceCustomers.push({id:a.id,name:world.nm(a),value:amount});},beginDay(){
 const S=world.S,b=S.business;if(!b)return;
 for(const a of S.agents)if(a.alive&&a.ct?.company&&b.operations?.[a.ct.company]&&a.ct.until!==undefined&&a.ct.until<=S.day)world.businessDismiss(a);
 for(const cfg of Object.values(b.operations||{}))daily(world,cfg);
 if(b.lastDecayDay===S.day)return;
 for(const w of Object.values(b.warehouses||{})){const protectedStore=S.bldgs.some(x=>x.firm===w.firmId&&(x.cond??1)>.25&&x.fx.includes('store')),cfg=b.operations?.[w.firmId];
  for(const good of ['grain','meal']){const old=w.inv[good]||0;if(!old)continue;w.inv[good]=old*(good==='grain'?(protectedStore?.9995:.998):(protectedStore?.992:.97));if(good==='grain')w.quality[good]=Math.max(.05,(w.quality[good]??1)-(protectedStore?.0005:.002));if(cfg)daily(world,cfg).spoilageCost+=(old-w.inv[good])*(w.cost?.[good]??S.price[good]??0);}
 }
 for(const o of b.orders||[])if(['transit','blocked'].includes(o.status)&&['grain','meal'].includes(o.good)){const old=o.inv[o.good]||0;o.inv[o.good]=old*(o.good==='grain'?.998:.97);o.spoiled=(o.spoiled||0)+old-o.inv[o.good];if(o.good==='grain'){o.originalQuality ??=o.quality;o.quality=Math.max(.05,o.quality-.002);}}
 b.lastDecayDay=S.day;
 }});}
module.exports={RECIPES,MODES,managed,facility,warehouseLocation,configure,validatePolicy,connect,sell};
