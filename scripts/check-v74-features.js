'use strict';
const assert=require('node:assert/strict');const {createWorld}=require('../engine');
const world=createWorld(42,100),S=world.S,c=S.agents.find(world.isAdult);
const firm={id:1,name:'검증공업',pre:'검증',suf:'공업',ceo:c.id,founder:c.id,lines:['mfg'],cash:1000,sh:{[c.id]:100},price:10,bld:[],hist:[],born:0,divE:0};
S.firms.push(firm);S.nextFirm=2;
for(const [workers,cap]of[[5,1],[20,3],[200,6]]){c.workers=workers;assert.equal(world.lineCap(firm),cap)}c.workers=5;
for(let i=0;i<6;i++){const b={id:10000+i,firm:1,owner:c.id,lot:i,fx:['fac','store','guard'],spec:9,cond:.8,fee:1,rev:0,revE:i,built:0};S.bldgs.push(b);firm.bld.push(b.id)}
const cashBefore=S.firms.reduce((n,f)=>n+f.cash,0);world.importState(JSON.parse(JSON.stringify(world.exportState())));
assert.equal(S.firms.reduce((n,f)=>n+f.cash,0),cashBefore);assert(firm.bld.length===6,'input snapshot must remain detached');
const current=S.firms.find(f=>f.id===1),buildings=S.bldgs.filter(b=>b.firm===1);assert(buildings.length<=world.buildingCap(current));
assert.equal(buildings.reduce((n,b)=>n+b.units,0),6);assert(buildings.every(b=>!b.fx.includes('guard')));assert(buildings.some(b=>b.fx.includes('bigfac')));
assert(buildings.some(b=>world.bName(b).includes('창고 딸림')));assert(!world.bName({fx:['store','guard']}).includes('초소'));
console.log('직원별 분야 상한, 옛 건물 용도 정리, 대형 통합, 시설 수용량·현금 보존 OK');
