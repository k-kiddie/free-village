'use strict';
const assert=require('node:assert/strict'),{createWorld}=require('../engine');
const {createSession}=require('../rebuild/core/session'),{productionFixture}=require('./fixtures/business-production');
const operations=require('../rebuild/core/business-operations');
const results=[];
for(const mode of ['bulk','quality']){
 const f=productionFixture(),s=createSession({mode:'strategy',legacy:f.state,playerId:f.me});let seq=0;
 function settle(){for(let guard=0;s.view().pending.length&&guard<30;guard++){const d=s.catalog().decisions[0];let accepted=false;for(const o of d.opts.slice().sort((a,b)=>Number(/no|wait|defer|ignore|leave/.test(b.k))-Number(/no|wait|defer|ignore|leave/.test(a.k)))){const m=s.summary(),r={worldId:m.worldId,expectedRevision:m.revision,commandId:'strategy:'+(seq+1),actor:{kind:'person',id:m.playerId},action:'choose',args:{id:d.id,key:o.k}},p=s.preview(r);if(p.allowed){assert(s.execute({...r,previewToken:p.previewToken}).allowed);seq++;accepted=true;break;}}assert(accepted,'실제 대기 결정을 해결할 선택지가 있음');}assert.equal(s.view().pending.length,0);}
 function run(action,args){if(action==='advance')settle();const m=s.summary(),r={worldId:m.worldId,expectedRevision:m.revision,commandId:'strategy:'+(seq+1),actor:{kind:'person',id:m.playerId},action,args},p=s.preview(r);assert(p.allowed,JSON.stringify(p));assert(s.execute({...r,previewToken:p.previewToken}).allowed);seq++;}
 run('business.policy',{firmId:f.firmId,recipe:'meal',mode,limit:12,markup:mode==='bulk'?.85:1.2,enabled:true});
 for(let day=0;day<24;day++)run('advance',{});
 const c=s.business().companies[0],h=c.production.history;
 const result={mode,days:h.length,produced:h.reduce((n,d)=>n+d.produced,0),sold:h.reduce((n,d)=>n+d.sold,0),revenue:h.reduce((n,d)=>n+d.revenue,0),operatingProfit:h.reduce((n,d)=>n+d.operatingProfit,0),cash:c.cash,quality:c.warehouse.quality.meal};
 assert.equal(h.length,24);assert(result.sold>0&&result.operatingProfit>0&&c.cash>100,'주입 없는 24일의 실제 원료/임금/고객 거래로 양의 운영 성과: '+JSON.stringify(result));assert.equal(c.arrears.length,0);results.push(result);s.close();
}
assert(results[0].produced>results[1].produced);assert(results[1].quality>results[0].quality);assert.notEqual(results[0].revenue,results[1].revenue);

// 같은 실제 구매자와 상품 재고에서 가격 변경이 어느 회사의 물건을 사는지 바꾼다.
function competition(markup){
 const f=productionFixture(),S=f.state.S,original=S.firms[0],rival={...structuredClone(original),id:S.nextFirm++,name:'경쟁식품',bld:[900002]};
 S.firms.push(rival);S.bldgs.push({...structuredClone(S.bldgs.find(b=>b.id===f.buildingId)),id:900002,firm:rival.id});
 for(const a of S.agents){a.inv.meal=100;a.cash=100;}
 const buyer=S.agents.find(a=>a.id===f.seller);buyer.inv.meal=0;buyer.hunger=20;buyer.g.lux=.1;
 for(const firm of [original,rival]){S.business.operations ||= {};S.business.operations[firm.id]={recipe:'meal',mode:'bulk',limit:12,markup:firm===original?markup:1,enabled:true,history:[],daily:{day:S.day,produced:0,sold:0,revenue:0,wages:0,inputCost:0,costOfSales:0,spoilageCost:0,unpaid:0,workers:1,idle:0,customers:[],reasons:[]}};
 S.business.warehouses[firm.id]={firmId:firm.id,inv:{meal:20},quality:{meal:1},cost:{meal:2}};}
 const w=createWorld(42,120);w.importState(f.state);w.S.gov={policy:{tax:.2},tre:0,st:{collected:0}};const before=buyer.cash;
 operations.sell(w);const paid=w.S.agents.find(a=>a.id===buyer.id).spend.food;
 const sold=w.S.business.operations[original.id].daily.sold,rivalSold=w.S.business.operations[rival.id].daily.sold;
 assert(paid>0&&paid<=before);assert(w.S.gov.tre>0&&w.S.gov.st.collected===w.S.gov.tre,'실제 회사 소득세가 공공 계정에 보존됨');return {sold,rivalSold};
}
const lower=competition(.8),higher=competition(1.15);assert(lower.sold>higher.sold);assert(higher.rivalSold>lower.rivalSold);
console.log(JSON.stringify({passed:'같은 초기 자금/원료의 24일 저가 대량·고품질 소량 실제 손익 차이, 가격 인하/인상에 따른 동일 고객의 경쟁사 선택 변화',results,lower,higher}));
