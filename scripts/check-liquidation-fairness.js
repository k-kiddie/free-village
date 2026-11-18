'use strict';
const assert=require('node:assert/strict'),{createWorld}=require('../engine');
function setup(){const w=createWorld(812,100);w.dynStart();w.dynConfigureStart({age:40});w.dynChoose(w.S.dyn.pending[0].id,'go');const me=w.S.byId.get(w.S.dyn.pid),b={id:90001,lot:0,owner:me.id,firm:null,fx:['pub'],cond:1,fee:1,rev:0,revE:0,built:0,users:0};w.S.bldgs.push(b);w.dynAct('firm:new');return {w,me,b,f:w.S.firms.find(f=>f.id===me.firm)}}
{
 const {w,me,b,f}=setup();me.cash=0;w.dynAct('co:sell:'+f.id+':close');assert.equal(b.owner,me.id);assert.equal(b.firm,null);assert.equal(me.cash,0);assert(!w.S.firms.includes(f));
}
{
 const {w,me,b,f}=setup(),buyer=w.S.agents.find(a=>a!==me&&a.alive&&w.isAdult(a));buyer.cash=1000;assert.equal(w.tradeStock(f,me.id,buyer.id,5000,f.price),5000);me.cash=0;const cash=buyer.cash;
 assert.throws(()=>w.dynAct('co:sell:'+f.id+':close'),/주주.*정산/);assert.equal(b.firm,f.id);assert.equal(buyer.cash,cash);assert(w.S.firms.includes(f));
 me.cash=1000;const supply=w.moneySupply(),owed=w.S.houseRef*1.4*.5;w.dynAct('co:sell:'+f.id+':close');assert(Math.abs(buyer.cash-cash-owed)<1e-8);assert(Math.abs(me.cash-(1000-owed))<1e-8);assert(Math.abs(w.moneySupply()-supply)<1e-8);assert.equal(b.owner,me.id);assert.equal(b.firm,null);
}
console.log('단독 소유 무자금 청산·다른 주주 건물 지분 정산·실패 원복·현금 보존 통과');
