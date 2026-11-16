'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),path=require('node:path');
// 난수 기반 장외 사건을 다른 시뮬레이션 단계와 분리해 현금 보존 계약을 확인한다.
const filename=path.resolve(__dirname,'../engine.js'),testModule=new Module(filename);testModule.filename=filename;testModule.paths=module.paths;
testModule._compile(fs.readFileSync(filename,'utf8').replace('return{rulingN,','return{stockTick,settleClosedFirm,rulingN,'),filename);
const w=testModule.exports.createWorld(42,100),S=w.S,ad=S.agents.filter(w.isAdult);
S.houseRef=1;S.power=1;S.exch={d:0,base:1};
for(let i=0;i<2;i++){const c=ad[i],v=ad[i+2];c.g.cheat=.99;c.cash=0;S.firms.push({id:i+1,name:'검증'+i,ceo:c.id,sh:{[c.id]:60,[v.id]:40},price:1,ipoP:1,p30:1,peak:1,cash:0,bld:[],hist:[],born:0,listed:1,divE:0})}
const before=w.moneySupply();for(let i=0;i<300;i++){S.day=i*5+1;w.stockTick();assert(Math.abs(w.moneySupply()-before)<1e-7,'주식 사건에서 현금 생성/소멸')}
const firm=S.firms[0];ad[3].cash-=20;firm.cash=20;const m=w.moneySupply();w.settleClosedFirm(firm);assert(Math.abs(w.moneySupply()-m)<1e-7,'폐업 정산에서 현금 소멸');
S.gov={tre:0,pen:0};const pensionBefore=w.moneySupply();ad[4].cash-=10;S.gov.pen+=10;assert(Math.abs(w.moneySupply()-pensionBefore)<1e-7,'연금 납입 집계 누락');
console.log(JSON.stringify({stockEvents:300,moneySupply:before,conserved:true,liquidation:true,pension:true}));
