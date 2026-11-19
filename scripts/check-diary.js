'use strict';
const assert=require('node:assert/strict');
const {createWorld}=require('../engine');

const w=createWorld(1119,180);w.dynStart();w.dynConfigureStart({age:32,family:'children'});
const S=w.S,D=S.dyn,me=S.byId.get(D.pid);
w.dynChoose(D.pending[0].id,'go');w.dynSetStory(0);D.pending=[];const priorDays=D.diary?.length||0;
w.step();
assert.equal(D.diary.length,priorDays+1,'새 하루 기록 생성');
assert.match(D.diary.at(-1).text,/오늘 나는/,'1인칭 서술');
assert.equal(w.dynView().diary[0].d,S.day,'일기 목록을 가족 화면으로 전달');
const event=w._story.SE.adultIntimacy,ctx=w._story.dynStoryContext(event,me);
assert(ctx,'성인 관계 사건 조건');w._story.dynStoryPush(event,ctx,me);
w.dynChoose(D.pending[0].id,'together');
assert.match(D.diary.at(-1).text,/입맞춤은 깊어지고/,'당일 선택 결과가 일기에 반영');
const restored=createWorld(1,1);restored.importState(JSON.parse(JSON.stringify(w.exportState())));
assert.equal(restored.dynView().diary[0].text,D.diary.at(-1).text,'저장·불러오기 뒤 일기 유지');
console.log(JSON.stringify({ok:true,days:D.diary.length,choiceReflected:true,saveRestore:true}));
