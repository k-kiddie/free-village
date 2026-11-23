'use strict';
const {productionFixture}=require('./business-production');
function tradeFixture({population=120}={}){
 const f=productionFixture({population}),S=f.state.S,buyer=S.firms.find(c=>c.id===f.firmId),site=S.bldgs.find(b=>b.id===f.buildingId),sellerId=S.nextFirm++,sellerBuildingId=f.buildingId+1,p=S.geo.lots[site.lot];
 const lot=S.geo.lots.findIndex((x,i)=>i!==site.lot&&Math.hypot(x.x-p.x,x.y-p.y)>25&&Math.hypot(x.x-p.x,x.y-p.y)<50);
 S.bldgs.push({...structuredClone(site),id:sellerBuildingId,firm:sellerId,lot});S.firms.push({...structuredClone(buyer),id:sellerId,name:'원료공급회사',bld:[sellerBuildingId],cash:50});buyer.cash=300;S.business.warehouses[f.firmId].inv.grain=0;
 const q=S.geo.lots[lot];S.business.warehouses[sellerId]={firmId:sellerId,name:'원료공급회사',inv:{grain:120},quality:{grain:1.1},cost:{grain:1.5},location:{buildingId:sellerBuildingId,lot,x:q.x+5,y:q.y+5}};
 return {...f,sellerId,sellerBuildingId};
}
module.exports={tradeFixture};
