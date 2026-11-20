'use strict';
const {YEAR}=require('../../engine');
const {businessFixture}=require('./business');
function productionFixture({population=120}={}){
 const f=businessFixture({population}),S=f.state.S,worker=S.agents.find(a=>![f.me,f.seller,f.carrier,f.child].includes(a.id));
 S.bldgs.find(b=>b.id===f.buildingId).fx=['b1','store'];const company=S.firms.find(c=>c.id===f.firmId);company.lines=['food'];company.cash=100;
 Object.assign(worker,{alive:true,age:30*YEAR,emp:f.me,ct:{t:'reg',e:f.me,w:1.1,d:0,company:f.firmId},firm:null,study:null,civ:null,foreignT:null,armyUntil:0,abroadUntil:0,dynTravelUntil:0,dynBasicUntil:0,dynDayD:-1,jailUntil:0,fat:0,hunger:20,health:100});worker.skill[1]=.7;
 S.business={version:1,nextOrder:1,orders:[],warehouses:{[f.firmId]:{firmId:f.firmId,name:company.name,inv:{grain:150},quality:{grain:1},cost:{grain:2},location:{buildingId:f.buildingId,lot:f.left.id,x:f.left.x+5,y:f.left.y+5}}},log:[]};
 return {...f,worker:worker.id};
}
module.exports={productionFixture};
