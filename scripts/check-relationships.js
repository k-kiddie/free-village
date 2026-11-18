'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ec={module:{exports:{}},console};vm.createContext(ec);vm.runInContext(fs.readFileSync(require.resolve('../engine.js'),'utf8').replace('return{dynSetStory,','return{rrTick,dynSetStory,'),ec);
const w=ec.module.exports.createWorld(2328,180);w.dynStart();w.dynConfigureStart({age:30,sex:'M',status:'king'});const S=w.S,D=S.dyn,me=S.byId.get(D.pid);me.cash=1e6;me.jailUntil=0;me.looks=1;me.orient='bi';
for(const x of S.agents)if(x!==me&&x.alive){x.orient='bi';x.g.lib=.95}
const A=k=>w.dynActions().find(a=>a.k===k);const run=k=>{for(const key of Object.keys(D.cool))if(/^act(ad|rr)/.test(key))D.cool[key]=0;return w.dynAct(k)};
const target=Number(A('adult:seduce').opts[0][0].slice(1)),x=S.byId.get(target);for(let i=0;i<30&&!D.relationships?.[me.id+':'+target];i++)run('adult:seduce:p'+target);const r=D.relationships[me.id+':'+target];assert(r);assert(!me.affair,'관심 표현만으로 정인이 되지 않음');
run('rel:letter:'+target);assert(r.letter&&r.trust>.35);for(let i=0;i<30&&!r.appointment;i++)run('rel:invite:'+target);assert(r.appointment);assert.throws(()=>run('rel:meet:'+target+':quiet'),/일 뒤|일정/,'약속 전 만남 방지');S.day=r.appointment;run('rel:meet:'+target+':quiet');assert.equal(r.phase,3);for(let i=0;i<30&&!me.affair;i++)run('rel:commit:'+target);assert.equal(me.affair,target);assert.equal(x.affair,me.id);
run('rel:promise:'+target);const before=r.trust;S.day=r.promise.due+1;while(S.day%5!==2)S.day++;w.rrTick(me);assert(r.promise.broken&&r.trust<before);assert(D.story.q.some(q=>q.id==='rrBrokenPromise'&&q.ctx.x===target),'후속 사건이 같은 성인 인물 참조');
run('rel:visit:'+target+':talk');assert(!r.promise);assert(r.history.some(h=>h.text.includes('약속을 지켰다')));
const saved=JSON.parse(JSON.stringify(w.exportState()));const restored=ec.module.exports.createWorld(2328,180);restored.importState(saved);assert.equal(restored.S.dyn.relationships[me.id+':'+target].target,target);assert(restored.dynView().relationships.some(t=>t.target===target));
run('adult:end');assert(r.ended&&!me.affair&&!x.affair);assert(!A('rel:visit:'+target),'정리한 관계에 만남 버튼이 남지 않음');
const minor=S.agents.find(a=>a.alive&&a!==me&&a.id!==target);minor.age=17*60;assert(!A('adult:seduce').opts.some(o=>o[0]==='p'+minor.id));assert.throws(()=>w.dynAct('rel:letter:'+minor.id),/할 수 없는|성인/);
assert(Object.keys(w._story.SE).filter(k=>/^rr[A-Z]/.test(k)).length>=12);
console.log('성인 관심→편지→약속→만남→관계·거절·약속 위반·동일인 후속·정리·미성년 제외·저장 확인 완료');
