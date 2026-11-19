'use strict';
// 어느 선택지를 골라도 결과가 거의 같은 이야기 사건을 찾아 STORY_AUDIT.md로 정리한다.
// 기능이 다 켜진 가문 마을(check-story-fuzz의 rich)에서 선택지마다 3번씩 실행해 주요 수치 변화를 비교한다.
const fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'check-story-fuzz.js'),'utf8');const {createWorld}=require('../engine.js');
const rich=eval('('+src.match(/function rich[\s\S]*?\n}\n/)[0]+')');
const {w,S,D,me}=rich(1101);const {SE,sCtx}=w._story;const wA=Math.max(.5,S.wageAvg||1);
const tieSum=()=>Object.values(D.ties||{}).reduce((t,x)=>t+(x.v||0),0);
const fam=()=>S.agents.filter(a=>a.alive&&(a.parents||[]).includes(me.id)).length+(me.partner?1:0);
const metric=()=>({cash:me.cash/wA,rep:(me.rep??1)*100,health:me.health,happy:(me.happy??0)*100,stress:me.dynStress||0,vault:(D.vault||0)/wA,prestige:D.prestige||0,ties:tieSum()*100,
  approval:S.gov?(S.gov.approval??.5)*100:0,tre:S.gov?S.gov.tre/wA:0,heat:(D.heat||0)*100,jail:(me.jailUntil||0)>S.day?1:0,fam:fam(),
  mem:Object.keys(D.mem||{}).length,q:(D.story?.q||[]).length,pend:D.pending.length,faith:S.faiths.reduce((t,f)=>t+(f.members||0),0)});
const TH={cash:1,rep:1,health:2,happy:2,stress:2,vault:1,prestige:1,ties:2,approval:1,tre:2,heat:3,jail:.5,fam:.5,mem:.5,q:.5,pend:.5,faith:1};
const base={cash:me.cash,rep:me.rep,health:me.health,happy:me.happy,stress:me.dynStress};
const reset=()=>{me.cash=base.cash;me.rep=base.rep;me.health=Math.max(60,base.health);me.happy=base.happy;me.dynStress=base.stress;me.alive=true;me.jailUntil=0;D.pending=[];if(S.gov){S.gov.tre=1e9;S.gov.bud={d:S.day,total:7e9,lines:Object.fromEntries(['adm','welf','pub','def','pol','edu','health'].map(k=>[k,1e9])),spent:{}}}};
const flat=[];let checked=0;
for(const [id,e] of Object.entries(SE)){if(!e.o||e.o.length<2)continue;
  const ctx={sid:id,title:e.title};let ok=true;
  try{if(e.realm){const T=(S.trade&&S.trade.towns)||[];if(T[0])ctx.t=T[0].name}if(e.who){const x=e.who(sCtx(me,ctx));if(x)ctx.x=x.id;else ok=false}if(e.need&&!e.need(sCtx(me,ctx)))ok=false}catch(err){ok=false}
  if(!ok)continue;const outs=[];let bad=false;
  for(const o of e.o){const runs=[];for(let r=0;r<3;r++){reset();const b=metric();try{const c=sCtx(me,{...ctx});if(o[4]?.when&&!o[4].when(c)){bad=true;break}o[3](c)}catch(err){bad=true;break}const a=metric();runs.push(Object.fromEntries(Object.keys(a).map(k=>[k,a[k]-b[k]])))}
    if(bad)break;outs.push({k:o[0],label:o[1],avg:Object.fromEntries(Object.keys(runs[0]).map(k=>[k,runs.reduce((t,x)=>t+x[k],0)/runs.length]))})}
  if(bad||outs.length<2)continue;checked++;
  const diff=Object.keys(TH).filter(k=>Math.max(...outs.map(o=>o.avg[k]))-Math.min(...outs.map(o=>o.avg[k]))>=TH[k]);
  if(!diff.length)flat.push({id,title:e.title,cat:e.cat,opts:outs.map(o=>o.label)})}
const byCat={};for(const f of flat)(byCat[f.cat||'분류 없음']=byCat[f.cat||'분류 없음']||[]).push(f);
const md=[`# 결과 차이가 거의 없는 이야기 사건`,``,`- 2026-11-19 \`node scripts/report-flat-stories.js\`로 생성. 기능이 다 켜진 가문 마을에서 조건이 맞은 사건 ${checked}개를 검사했다.`,`- 선택지마다 3번 실행해 돈·평판·건강·행복·스트레스·가문 금고·명성·집안 관계·지지율·국고·수배·투옥·가족·후속 사건 기억을 비교했다. 어느 선택지도 이 값들을 의미 있게 다르게 만들지 못한 사건이 아래 ${flat.length}개다.`,`- 결과 문장만 다르고 위 수치는 같은 사건이다(특정 인물 하나와의 관계·기술 등 재지 않은 값은 다를 수 있어 후보 목록이다). 고칠지(선택지에 차이를 줌) 뺄지(목록에서 삭제) 정해야 한다.`,``,
  ...Object.entries(byCat).sort((a,b)=>b[1].length-a[1].length).flatMap(([c,list])=>[`## ${c} (${list.length})`,...list.map(f=>`- \`${f.id}\` ${f.title} — ${f.opts.join(' / ')}`),''])];
fs.writeFileSync(path.join(__dirname,'..','STORY_AUDIT.md'),md.join('\n'));
console.log(`조건 충족 ${checked}개 중 결과 차이가 거의 없는 사건 ${flat.length}개 → STORY_AUDIT.md`);
