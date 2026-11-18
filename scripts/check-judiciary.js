'use strict';
// 사법부: 대법원장, 재판관 제청·재제청·동의·임명, 위헌법률심판(실제 폐지), 권한쟁의, 사법개혁, 대법원장 압박·탄핵, 관련 사건
const assert=require('node:assert/strict');
const src=require('fs').readFileSync(__dirname+'/check-story-fuzz.js','utf8');const {createWorld}=require('../engine.js');const rich=eval('('+src.match(/function rich[\s\S]*?\n}\n/)[0]+')');
const {w,S,D,me}=rich(1801);const G=()=>S.gov;
G().regime='rep';G().king=null;G().chief=me.id;
{const g0=S.groups.find(g=>g.id===me.grp);if(g0){g0.members=(g0.members||[]).filter(x=>x!==me.id);if(g0.leader===me.id)S.groups=S.groups.filter(g=>g!==g0)}me.grp=null}w.dynAct('party');
const ad=()=>S.agents.filter(a=>a.alive&&w.isAdult(a)&&a!==me);G().council=ad().slice(0,7).map(a=>a.id);for(const a of ad().slice(0,4))a.grp=me.grp;
G().judges=ad().slice(10,13).map(a=>({id:a.id,until:S.day+600,by:null}));G().cj=null;
const step=n=>{for(let i=0;i<n;i++){w.step();for(const q of D.pending.slice())try{w.dynChoose(q.id,q.opts[0].k)}catch(e){}}};
step(15);assert(G().jr,'사법부 상태');assert(G().cj,'대법원장');
// 빈자리: 대법원장이 제청 → 내가 임명권자로 재제청 요구 → 결국 임명
G().jr.law.expand=true;const ids0=new Set(G().judges.map(j=>j.id));let asked=false,done=false;
for(let i=0;i<300&&!done;i++){w.step();for(const q of D.pending.slice()){if(q.kind==='jrRuler'&&!asked){asked=true;w.dynChoose(q.id,'renom');continue}try{w.dynChoose(q.id,q.kind==='jrRuler'?'accept':q.opts[0].k)}catch(e){}}done=G().judges.some(j=>!ids0.has(j.id))}
assert(asked,'재제청 선택지');assert(done,'결국 재판관 임명');
// 위헌법률심판: 실제 폐지까지
const cool=()=>{for(const k of Object.keys(D.cool))if(/^actjr/.test(k))D.cool[k]=0;me.cash=1e6;me.jailUntil=0};
G().policy.censor=true;for(const j of G().judges.map(j=>S.byId.get(j.id)))if(j){j.g.civic=.95;j.g.cheat=0;j.grp=null}
for(let i=0;i<6&&G().policy.censor;i++){G().regime='rep';G().chief=me.id;for(const j of G().judges.map(j=>S.byId.get(j.id)))if(j){j.g.civic=.95;j.g.cheat=0;j.grp=null;j.jrBy=null}cool();const a=w.dynActions().find(x=>x.k==='jr:petition');assert(a&&a.opts.some(o=>o[0]==='kcensor'),'청구 목록');w.dynAct('jr:petition:kcensor');step(30)}assert.equal(G().policy.censor,false,'위헌 결정으로 실제 폐지');
// 사법개혁·압박·탄핵
G().regime='rep';G().chief=me.id;cool();w.dynAct('jr:reform:'+(G().jr.law.expand?'x':'o')+'expand');cool();w.dynAct('jr:reform:'+(G().jr.law.distort?'x':'o')+'distort');
cool();if(w.dynActions().find(x=>x.k==='jr:press'))w.dynAct('jr:press');
G().chief=ad()[20].id;G().council.push(me.id);cool();if(G().cj&&w.dynActions().find(x=>x.k==='jr:impeach'))w.dynAct('jr:impeach');
// 사건 선택지
const {SE,sCtx}=w._story;let n=0;G().chief=me.id;G().jr.vac={stage:'ruler',d:S.day-90,cand:ad()[30].id,refused:1,ren:1};G().jr.law={noNom:true,distort:true};G().cj=G().cj||ad()[11].id;G().jr.log.push({d:S.day,text:'위헌 결정. 시험'});
for(const [id,e] of Object.entries(SE)){if(!/^jr[A-Z]/.test(id))continue;for(const [k,,,fn] of e.o){const ctx={sid:id,title:e.title};try{const c0=sCtx(me,ctx);if(e.trig&&!e.trig(c0)&&!(e.need&&e.need(c0)))continue;if(e.need&&!e.need(c0))continue;const c=sCtx(me,ctx);me.cash=1e6;e.text(c);assert(typeof fn(c)==='string')}catch(err){throw new Error(id+':'+k+' '+err.message)}n++;G().jr.vac=G().jr.vac||{stage:'ruler',d:S.day-90,cand:ad()[30].id,refused:1,ren:1};G().cj=G().cj||ad()[11].id;G().jr.law={noNom:true,distort:true}}}
console.log(JSON.stringify({ok:true,eventOpts:n,judges:G().judges.length}));
