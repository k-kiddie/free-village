'use strict';
// 받은 일함: 급한 일만 멈추고, 나머지는 쌓였다가 기한이 지나면 "무시"로 넘어가는지, 반응 학습·관련성 가중이 도는지 검사한다.
const assert=require('node:assert/strict');
const {createWorld,YEAR}=require('../engine');
const w=createWorld(812,140);w.dynStart();w.dynConfigureStart({age:30});
assert(!w.S.dyn.pending[0].inbox,'시작 선택은 급한 일(멈춤)');
w.dynChoose(w.S.dyn.pending[0].id,'go');const S=w.S,D=S.dyn;
let urgent=0,inbox=0,expired=0;const seen=new Set();
for(let d=0;d<YEAR*2;d++){w.step();
  if(D.res&&D.res.d===S.day&&D.res.text.includes('기한이 지나'))expired++;
  for(const p of D.pending.slice()){if(seen.has(p.id))continue;seen.add(p.id);
    if(p.inbox){inbox++;assert(p.due>S.day-1,'받은 일에는 기한');}else{urgent++;w.dynChoose(p.id,p.opts[0].k)}}
  assert(D.pending.filter(p=>p.inbox&&p.kind!=='notice').length<=12,'받은 일이 끝없이 쌓이지 않음')}
assert(inbox>5,'받은 일이 쌓임 '+inbox);assert(expired>0,'답하지 않은 일은 기한이 지나 넘어감');
assert(D.pending.every(p=>p.inbox),'남은 것은 받은 일뿐(시간이 멈추지 않음)');
// 반응 학습: 기한을 넘긴 종류는 선호도가 내려감
assert(Object.values(D.story.like||{}).some(v=>v<0),'기한 넘김·첫 선택 반복이 선호도에 반영');
// 시뮬레이터 대기 판정과 같은 규칙
assert.equal(D.pending.some(p=>!p.inbox),false);
console.log(`받은 일함: 급한 일 ${urgent}건만 멈춤 · 받은 일 ${inbox}건 · 기한 지나 넘어감 ${expired}건 · 학습 ${JSON.stringify(D.story.like)}`);
