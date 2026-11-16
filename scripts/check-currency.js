'use strict';
const assert=require('node:assert/strict');
const {createWorld,formatMoney}=require('../engine');
const w=createWorld(9,200),S=w.S;
S.loans.push({id:1,l:1,b:2,amt:10000,rem:10000});S.price.tool=10000;
const before=JSON.parse(JSON.stringify(w.exportState())),money=w.moneySupply(),price={...S.price},rng=before.rng;
assert(w.reformCurrency(100));assert.equal(w.currencyUnit(),100);assert.equal(formatMoney(10000,w.currencyUnit()),'100냥');
assert.equal(w.moneySupply(),money);assert.deepEqual(S.price,price);assert.deepEqual(S.loans,before.S.loans);assert.equal(w.exportState().rng,rng);
for(let i=0;i<S.agents.length;i++){assert.equal(S.agents[i].cash,before.S.agents[i].cash);assert.deepEqual(S.agents[i].g,before.S.agents[i].g);assert.deepEqual(S.agents[i].q,before.S.agents[i].q)}
assert(!w.reformCurrency(NaN));assert(!w.reformCurrency(1));
const restored=createWorld(9,200);restored.importState(JSON.parse(JSON.stringify(w.exportState())));assert.equal(restored.currencyUnit(),100);assert.equal(restored.moneySupply(),money);
delete before.S.currency;const legacy=createWorld(9,200);legacy.importState(before);assert.equal(legacy.currencyUnit(),1);
// 연도 경계에서 단위를 바꿔도 물가와 금융 계약은 유지한다.
const auto=createWorld(10,100);auto.S.day=59;auto.S.price.tool=10000;auto.step();assert.equal(auto.currencyUnit(),100);
const presenter=require('../server-presenter')();for(const tab of ['sum','rich','mkt','firm','fin','trade','gov','soc'])assert(!presenter.panel(restored,tab).includes('문제가 생겼다'),tab);
assert(presenter.card(restored,1).includes(formatMoney(restored.S.agents[0].cash,100)));
console.log(JSON.stringify({ratio:'100:1',auto:true,pricesLoansCashUnchanged:true,genesAndLearningUnchanged:true,rngUnchanged:true,moneyConserved:true,restore:true,legacy:true,render:true}));
