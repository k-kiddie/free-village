'use strict';
// "새로 할 수 있게 된 일" 목록이 판마다 분리되고, 지금 할 수 있는 행동만 보이는지 검사한다.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),src=fs.readFileSync(path.join(root,'god-client.js'),'utf8');
const block=src.slice(src.indexOf('// 새로 할 수 있게 된 일:'),src.indexOf('// 인물 카드에'));
const store=new Map([['v-dynever','["govern:report","pol2:exec"]'],['v-dynnew',JSON.stringify([{d:0,label:'왕실 국정 보고 받기',group:'정치 · 국정',tab:'law'}])]]);
const ctx={S:{day:0},localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},
  DYN_TABS:[['law','⚖️','정치'],['me','👤','인물']],dynTabOfGroup:g=>/^(법|정치)/.test(g)?'law':'me',fmtD:d=>'D'+d,dynEsc:s=>String(s)};
vm.createContext(ctx);vm.runInContext(block+';this.api={dynTrackNew,dynNewActsHTML}',ctx);const {dynTrackNew,dynNewActsHTML}=ctx.api;
const act=(k,label,group,ok=true)=>({k,label,group,ok});
assert(!store.has('v-dynever')&&!store.has('v-dynnew'),'예전 전역 목록 삭제');
// 판 A: 왕이 되어 국정 보고·처형이 새로 열림
dynTrackNew({game:'A',actions:[act('gang','패거리 만들기','조직')]});assert.equal(dynNewActsHTML(),'','첫 화면에 있던 행동은 새 소식이 아님');
ctx.S.day=10;dynTrackNew({game:'A',actions:[act('gang','패거리 만들기','조직'),act('govern:report','왕실 국정 보고 받기','정치 · 국정'),act('pol2:exec','공개 처형','정치 · 공안')]});
assert(dynNewActsHTML().includes('왕실 국정 보고 받기')&&dynNewActsHTML().includes('공개 처형'),'판 A에서 새로 열린 행동 표시');
// 처형 대상이 없어 지금은 못 함 → 숨김
dynTrackNew({game:'A',actions:[act('gang','패거리 만들기','조직'),act('govern:report','왕실 국정 보고 받기','정치 · 국정'),act('pol2:exec','공개 처형','정치 · 공안',false)]});
assert(!dynNewActsHTML().includes('공개 처형'),'지금 못 하는 행동은 숨김');
// 판 B: 정부 없는 새 판 → 판 A 목록이 보이면 안 됨
ctx.S.day=0;dynTrackNew({game:'B',actions:[act('gang','패거리 만들기','조직')]});assert.equal(dynNewActsHTML(),'','새 판에는 이전 판 목록이 없음');
ctx.S.day=5;dynTrackNew({game:'B',actions:[act('gang','패거리 만들기','조직'),act('govern:report','국정 보고 받기','정치 · 국정')]});
assert(dynNewActsHTML().includes('국정 보고 받기')&&!dynNewActsHTML().includes('왕실'),'새 판에서 다시 열리면 새 소식으로 표시하고 현재 이름을 씀');
assert.equal(JSON.parse(store.get('v-dynacts')).game,'B','판별로 저장');
console.log('새로 할 수 있게 된 일: 판별 분리·예전 목록 정리·불가능 행동 숨김·현재 이름 표시 통과');
