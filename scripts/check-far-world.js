'use strict';
// 먼 나라: 같은 시드는 같은 배치, 전쟁·동맹·합병·독립이 일어나고, 사절 보내기와 저장·복원이 된다
const assert=require('node:assert/strict');
const {createWorld}=require('../engine.js');
function boot(seed){const w=createWorld(seed,120);w.dynStart();w.dynConfigureStart({age:30});const S=w.S,D=S.dyn;
  for(let i=0;i<3000&&!D.far;i++){w.step();for(const q of D.pending.slice())try{w.dynChoose(q.id,q.opts[0].k)}catch(e){}}return w}
const a=boot(4401),b=boot(4401);assert(a.S.dyn.far&&a.S.dyn.far.length>=6,'먼 나라 6곳 이상');
assert.deepEqual(a.S.dyn.far.map(f=>[f.name,f.x,f.y]),b.S.dyn.far.map(f=>[f.name,f.x,f.y]),'같은 시드는 같은 배치');
const w=a,S=w.S,D=S.dyn;const kinds=new Set();
// 사절
const me=S.byId.get(D.pid);me.dynNoble=me.dynNoble||'남작';me.cash=1e6;me.jailUntil=0;if(D.over||!me.alive){console.log('가문 단절로 사절 검사 생략')}else{const F=D.far.find(f=>f.alive);const r0=F.rel;
const orig=w.dynActions;const act=w.dynActions().find(x=>x.k==='far:envoy:'+F.name);assert(act,'사절 행동');
if(!act.ok){assert.match(act.why,/의원|비용|기다려/)}else{w.dynAct(act.k);assert(F.rel>r0)}}

for(let i=0;i<YEARS(25);i++){w.step();for(const q of D.pending.slice())try{w.dynChoose(q.id,q.opts[0].k)}catch(e){}}
function YEARS(n){return n*360}
for(const n of D.wnews.filter(n=>n.far))kinds.add(/쳐들어/.test(n.text)?'war':/동맹을 맺/.test(n.text)?'ally':/무너뜨리고/.test(n.text)?'annex':/독립/.test(n.text)?'indep':'other');
const hist=D.far.flatMap(f=>f.hist||[]).map(h=>h.text).join('\n');
assert(/쳐들어/.test(hist)||kinds.has('war'),'먼 나라끼리 전쟁');assert(/동맹/.test(hist),'동맹');
assert(D.far.filter(f=>f.alive).length>=3,'나라가 너무 줄지 않음');assert(/무너뜨리고/.test(hist)||D.far.some(f=>!f.alive)||/독립/.test(hist),'멸망·합병 발생');
const v=w.dynView().world;assert(v.far.every(f=>Number.isFinite(f.x)&&f.owner),'지도용 자료');
const r=createWorld(4401,120);r.importState(JSON.parse(JSON.stringify(w.exportState())));assert.deepEqual(r.S.dyn.far.map(f=>f.name),D.far.map(f=>f.name),'저장·복원');
console.log(JSON.stringify({ok:true,alive:D.far.filter(f=>f.alive).length,dead:D.far.filter(f=>!f.alive).length,news:D.wnews.filter(n=>n.far).length}));
