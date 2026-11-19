'use strict';
// 사건 선택지: 놓치지 않도록 모든 선택지가 시간을 멈추고 뜨며, 기한 없이 고를 때까지 기다리는지 검사한다(2026-11-19 동현 요청으로 받은 일함 방식에서 변경).
const assert=require('node:assert/strict');
const {createWorld,YEAR}=require('../engine');
const w=createWorld(812,140);w.dynStart();w.dynConfigureStart({age:30});w.dynChoose(w.S.dyn.pending[0].id,'go');const S=w.S,D=S.dyn;
let shown=0;const seen=new Set();
for(let d=0;d<YEAR*2;d++){w.step();for(const p of D.pending.slice()){if(seen.has(p.id))continue;seen.add(p.id);shown++;assert(!p.inbox&&p.due==null,'모든 선택지는 멈춤·기한 없음');}
  // 선택지가 있으면 바로 고르지 않고 30일 동안 그대로 두어도 사라지지 않음(멈춘 상태에서 고민)
  if(d===YEAR&&D.pending.length){const id=D.pending[0].id;for(let i=0;i<30;i++)w.step();assert(D.pending.some(p=>p.id===id),'고를 때까지 남아 있음')}
  for(const p of D.pending.slice())try{w.dynChoose(p.id,p.opts[0].k)}catch(e){D.pending=D.pending.filter(x=>x.id!==p.id)}}
assert(shown>5,'선택지가 뜸 '+shown);
// 예전 저장의 받은 일은 멈춤 선택지로 바뀜
D.pending.push({id:D.nextP++,kind:'story',d:S.day,inbox:true,due:S.day+3,text:'예전 받은 일',opts:[{k:'a',label:'고른다'}],ctx:{}});w.step();assert(D.pending.every(p=>!p.inbox&&p.due==null),'예전 받은 일 변환');
console.log(`사건 선택지: 2년간 ${shown}건 모두 멈춤으로 표시 · 고를 때까지 유지 · 예전 받은 일 변환 통과`);
