'use strict';
const {fixture}=require('./living');
function businessFixture({far=false,population=120}={}){
 const f=fixture({population}),S=f.state.S,me=S.agents.find(a=>a.id===f.me),supplier=S.agents.find(a=>a.id===f.seller),carrier=S.agents.find(a=>a.id===f.teacher);
 const firmId=S.nextFirm++,buildingId=900001;
 S.bldgs.push({id:buildingId,lot:far?f.right.id:f.left.id,owner:me.id,firm:firmId,spec:null,pub:false,fx:['store'],fee:1,cond:1,built:0,builder:me.id,rev:0,revE:0,users:0,stud:0});
 S.firms.push({id:firmId,name:'공급검사상사',pre:'공급검사',suf:'상사',ceo:me.id,founder:me.id,sh:{[me.id]:10000},totalShares:10000,shareVersion:74,price:.01,p30:.01,peak:.01,born:0,bld:[buildingId],hist:[],cash:0,debt:0,lines:['trade']});
 me.firm=firmId;Object.assign(carrier,{emp:null,firm:null,civ:null,study:null,armyUntil:0,abroadUntil:0,dynTravelUntil:0,jailUntil:0});supplier.inv.wood=30;
 return {...f,firmId,buildingId,carrier:carrier.id};
}
module.exports={businessFixture};
