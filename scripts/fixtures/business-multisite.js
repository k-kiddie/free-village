'use strict';
const {productionFixture}=require('./business-production');
function fixture(){const f=productionFixture(),S=f.state.S,first=S.bldgs.find(b=>b.id===f.buildingId),p=S.geo.lots[first.lot],lot=S.geo.lots.findIndex((x,i)=>i!==first.lot&&Math.hypot(x.x-p.x,x.y-p.y)>30&&Math.hypot(x.x-p.x,x.y-p.y)<50),second={...structuredClone(first),id:first.id+1,lot};S.bldgs.push(second);S.firms.find(x=>x.id===f.firmId).bld.push(second.id);return {...f,secondId:second.id};}
module.exports={fixture};
