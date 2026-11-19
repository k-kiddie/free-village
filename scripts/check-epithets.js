'use strict';
const assert=require('node:assert/strict');
const {createWorld}=require('../engine');

const w=createWorld(1119,180);w.dynStart();w.dynConfigureStart({age:32,family:'children'});
const S=w.S,D=S.dyn,me=S.byId.get(D.pid),partner=S.byId.get(me.partner);
w.dynChoose(D.pending[0].id,'go');w.dynSetStory(0);D.pending=[];
const event=w._story.SE.adultIntimacy;
for(let n=0;n<2;n++){
  const ctx=w._story.dynStoryContext(event,me);assert(ctx,'성인 부부 친밀 사건 조건');
  assert(w._story.dynStoryPush(event,ctx,me),'사건 대기열');
  w.dynChoose(D.pending[0].id,'together');
}
assert.equal(D.epithets[me.id][0].title,'다정한','실제 선택을 두 번 한 뒤 별명 획득');
assert.equal(w.dynView().me.epithet,'다정한','인물 상단 표시용 별명 전달');
assert.equal(w.dynView().family.partner.epithet,null,'배우자에게 잘못된 별명이 복사되지 않음');
assert(D.chron.some(x=>x.text.includes('“다정한”이라는 별명')),'획득 사실이 연대기에 기록됨');
const restored=createWorld(1,1);restored.importState(JSON.parse(JSON.stringify(w.exportState())));
assert.equal(restored.dynView().me.epithet,'다정한','저장·불러오기 뒤에도 별명 유지');
console.log(JSON.stringify({ok:true,epithet:'다정한',actor:me.id,partner:partner.id,chronicle:true,saveRestore:true}));
