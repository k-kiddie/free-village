'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module');
const file=require.resolve('../engine'),m=new Module(file);m.filename=file;m.paths=module.paths;m._compile(fs.readFileSync(file,'utf8').replace('return{dynSetStory,','return{stockTick,stockActionsTick,dynSetStory,'),file);
const {createWorld,YEAR}=m.exports,w=createWorld(812,100);w.dynStart();w.dynConfigureStart({age:40});w.dynChoose(w.S.dyn.pending[0].id,'go');const S=w.S,me=S.byId.get(S.dyn.pid);
for(const a of S.agents)if(a!==me)a.cash=0;
S.bldgs.push({id:90001,lot:0,owner:me.id,firm:null,fx:['pub'],cond:1,fee:1,rev:0,revE:0,built:0,users:0});const cash=me.cash;
assert(w.dynActions().find(a=>a.k==='firm:new').ok,'투자자 없이 단독 설립 가능');
w.dynAct('firm:new:'+encodeURIComponent('단독 상회'));const f=S.firms.find(f=>f.id===me.firm);assert.deepEqual(f.sh,{[me.id]:10000});assert.equal(f.totalShares,10000);assert.equal(f.raised,0);assert.equal(f.cash,0);assert.equal(me.cash,cash);assert(S.agents.filter(a=>a!==me).every(a=>a.cash===0));
const saved=JSON.parse(JSON.stringify(w.exportState())),restored=createWorld(1,1);restored.importState(saved);assert.deepEqual(restored.S.firms.find(x=>x.id===f.id).sh,{[me.id]:10000});
S.exch={d:0,base:0};S.day=1;w.stockTick();assert(!f.listed);assert.deepEqual(f.sh,{[me.id]:10000});
assert.throws(()=>w.dynAct('co:ipo:'+f.id),/무산/);assert.deepEqual(f.sh,{[me.id]:10000});assert.equal(f.cash,0);assert(!S.dyn.cool['actcoipo'+f.id]);
for(const a of S.agents)if(a!==me&&a.alive&&w.isAdult(a)){a.cash=1e5;a.g.lend=.9}
S.day=2;w.dynAct('co:ipo:'+f.id);assert(f.listed);assert(f.sh[me.id]<10000);assert.equal(Object.values(f.sh).reduce((a,b)=>a+b,0),10000);assert(f.cash>0);
const shares=JSON.stringify(f.sh);for(let i=0;i<100;i++){S.day=YEAR*3+11+30*i;f.cash=0;f.lastAction=-YEAR*10;w.stockActionsTick()}assert.equal(JSON.stringify(f.sh),shares,'플레이어 승인 없이 자동 증자로 희석하지 않음');
console.log('단독 설립 100%·투자자 불필요·저장 복원·자동 상장/희석 차단·명시적 상장·실패 거래 원복 통과');
