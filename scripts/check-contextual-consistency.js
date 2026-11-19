'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const filename=path.resolve(__dirname,'../engine.js'),m=new Module(filename);m.filename=filename;m.paths=module.paths;
const source=fs.readFileSync(filename,'utf8').replace('return{dynSetStory,','return{dynSetStory,dynCanServeArmy,dynCanHoldJustice,dynRole,dynStoryFinance,');
m._compile(source,filename);
const w=m.exports.createWorld(119,120);w.dynStart();w.dynConfigureStart({age:32,status:'king',family:'children'});
const S=w.S,me=S.byId.get(S.dyn.pid),G=S.gov,a=S.agents.find(x=>x!==me&&x.alive&&x.age>=25*60);
assert(a,'사법직 교차 점검 주민');

G.judges=[{id:a.id,until:S.day+8*60}];
assert.equal(w.dynCanServeArmy(a),false,'현직 재판관을 지원병으로 모집하지 않는다');
G.judges=[];a.civ='edu';
assert.equal(w.dynCanServeArmy(a),false,'관청 직원을 지원병으로 모집하지 않는다');
a.civ=null;
assert.equal(w.dynCanServeArmy(a),true,'일반 주민은 군 복무 자격이 있다');
a.soldier='army';a.armyUntil=S.day+60;G.judges=[{id:a.id,until:S.day+8*60}];
assert.equal(w.dynCanHoldJustice(a),false,'현역 군인은 검사·재판관 자격이 없다');
assert.match(w.dynRole(a),/재판관.*현역 군인/,'겹친 과거 저장의 두 역할을 화면에서 숨기지 않는다');
a.soldier=null;a.armyUntil=0;G.judges=[];

const event=w._story.SE.publicLocalRelief;
const poor={me,wA:10,G};me.cash=0;
const relief=w.dynStoryFinance(event,poor,'own');
assert.equal(relief.cost,100,'개인 구호 선택의 비용 표시');
assert.equal(relief.available,false,'기부할 돈이 없으면 선택을 실행할 수 없다');
me.cash=100;
assert.equal(w.dynStoryFinance(event,poor,'own').available,true,'비용을 낼 수 있을 때만 선택 가능');
console.log('공직·군복무 자격 교차와 구호 선택의 실제 비용·잔액 조건 확인 완료');
