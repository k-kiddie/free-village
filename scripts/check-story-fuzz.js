// 모든 이야기 사건의 본문·선택지를 "기능이 다 켜진" 가문 마을에서 실행해 오류를 찾는다.
const assert=require('node:assert/strict');
const {createWorld}=require('../engine.js');
function rich(seed){
  const w=createWorld(seed,180);w.dynStart();w.dynConfigureStart({age:36,background:'정보기관 직원',family:'children',wealth:'wealthy',served:'yes',status:'king'});
  const S=w.S,D=S.dyn,me=S.byId.get(D.pid);me.cash=1e7;me.dynRoyal=1;me.pardoned=true;me.crimes=1;
  for(let i=0;i<40;i++)w.step();for(const p of D.pending.slice())try{w.dynChoose(p.id,p.opts[0].k)}catch(e){}
  try{w.dynAct('extra:found:charity+honest:시험')}catch(e){}
  const fa=S.faiths.find(f=>f.leader===me.id);const ad=S.agents.filter(a=>a.alive&&a.age>=14*60);
  if(fa){fa.tre=1e5;for(const a of ad.slice(0,60))if(a!==me)a.faith=fa.id;fa.members=60;D.faithRisk={[fa.id]:.5};D.faithDark={[fa.id]:{kind:'embezzle',amt:50,d:S.day}}}
  try{w.dynAct('gang')}catch(e){}
  const G=S.gov;if(G){Object.assign(G.policy,{draft:true,draftSex:true,altService:true,army:true});G.min=G.min||{};G.min.sec={k:'sec',name:'정보부',root:'정보',tier:0,mn:me.id,score:.5,since:S.day};G.council=[...(G.council||[]),...ad.slice(70,74).map(a=>a.id)];G.royalRivals=[ad[80]?.id].filter(Boolean)}
  const kid=ad.find(a=>a!==me&&a.age<26*60&&a.age>=18*60);if(kid){kid.parents=[me.id];me.kids.push(kid.id);kid.drafted=1;kid.soldier='army';kid.armyUntil=S.day+120}
  for(const a of ad.slice(90,95))a.addict=1;for(const a of ad.slice(95,98))a.jailUntil=S.day+50;
  D.ties={...D.ties,[ad[100]?.family||1]:{v:-.6,name:'원수 집안',d:S.day,why:''}};
  S.loans.push({id:S.nextLoan++,l:me.id,b:ad[110].id,bal:50,rate:.03,inst:5,missed:2,coll:null,start:S.day,next:S.day+10,kind:'개인 대부',paid:0});
  D.spyAgency={members:ad.slice(120,123).map(a=>({id:a.id,mission:'counter'})),since:S.day,exposed:false};
  S.banks=S.banks||[];S.banks.push({id:999,name:'시험은행',own:me.id,d:S.day,alive:true,capital:1000,ops:{loanRate:.03,depositRate:.01,reserveRatio:.15}});S.deps=S.deps||[];
  return {w,S,D,me};
}
const only=process.argv[2]?new RegExp(process.argv[2]):null;
const errs=[];let ran=0,needOk=0;
for(const seed of [1101,1102]){
  const {w,S,D,me}=rich(seed);const {SE,sCtx}=w._story;
  for(const [id,e] of Object.entries(SE)){if(only&&!only.test(id))continue;
    const ctx={sid:id,title:e.title};let c=sCtx(me,ctx),ok=true;
    try{if(e.realm){const T=(S.trade&&S.trade.towns)||[];if(T[0])ctx.t=T[0].name}if(e.who){const x=e.who(sCtx(me,ctx));if(x)ctx.x=x.id;else ok=false}else if(e.chain){const x=S.agents.find(a=>a.alive&&a!==me&&a.age>=18*60);if(x)ctx.x=x.id}if(e.need&&!e.need(sCtx(me,ctx)))ok=false;if(e.trig&&!e.trig(sCtx(me,ctx)))ok=false}catch(err){ok=false}
    if(ok)needOk++;
    for(const o of e.o){c=sCtx(me,{...ctx});
      if(ok&&o[4]?.when&&!o[4].when(c))continue;
      try{e.text(c);if(typeof o[2]==='function')o[2](c);const r=o[3](c);if(typeof r!=='string')throw Error('결과 문장이 문자열이 아님: '+r);ran++}catch(err){if(ok)errs.push(`${id}:${o[0]} — ${err.message}`)}}
    me.cash=Math.max(me.cash,1e6);me.health=Math.max(me.health,60);me.alive=true;me.jailUntil=0}
  for(let i=0;i<30;i++){w.step();for(const p of D.pending.slice())try{w.dynChoose(p.id,p.opts[0].k)}catch(e){}}
}
if(errs.length)console.log(errs.join('\n'));
assert.equal(errs.length,0,`사건 선택지 오류 ${errs.length}건`);
console.log(`이야기 사건 ${ran}개 선택지 실행, 조건 충족 사건 ${needOk}건, 오류 없음`);
