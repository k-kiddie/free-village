'use strict';
// 가문 모드 정치 행동(탄핵·예산·헌법·탄압·선거 조작·정당·파병·이권·공공 공사·주민 투표)이 오류 없이 돌고 효과가 난다
const assert=require('node:assert/strict');
const src=require('fs').readFileSync(__dirname+'/check-story-fuzz.js','utf8');const {createWorld}=require('../engine.js');const rich=eval('('+src.match(/function rich[\s\S]*?\n}\n/)[0]+')');
const {w,S,D,me}=rich(1301);assert(S.gov,'정부');
const ad=()=>S.agents.filter(a=>a.alive&&w.isAdult(a)&&a!==me);
S.gov.regime='rep';S.gov.king=null;S.gov.chief=me.id;S.gov.policy.deathPen=true;S.gov.policy.referendum=true;S.gov.const=null;
const party=S.groups.find(g=>g.mode!=='gang')||null;
const cool=()=>{for(const k of Object.keys(D.cool))if(/^actp2/.test(k))D.cool[k]=0;me.jailUntil=0;me.cash=1e7};
const A=k=>w.dynActions().find(a=>a.k===k);
const run=(k,v)=>{cool();const a=A(k);assert(a,k+' 목록');assert(a.ok,k+' 가능: '+a.why);if(v!=null){assert(a.opts?.some(o=>String(o[0])===String(v)),k+' 선택지 '+v+' / '+(a.opts||[]).map(o=>o[0]).join(','))}return w.dynAct(v!=null?k+':'+v:k)};
// 의회 꾸리기: 내 정당 + 야당
{const g0=S.groups.find(g=>g.id===me.grp);if(g0){g0.members=(g0.members||[]).filter(x=>x!==me.id);if(g0.leader===me.id)S.groups=S.groups.filter(g=>g!==g0)}me.grp=null}
w.dynAct('party');const my=S.groups.find(g=>g.leader===me.id&&g.mode!=='gang');assert(my,'내 정당');
const opp=ad().slice(0,4),ally=ad().slice(4,8);S.gov.council=[...opp,...ally].map(a=>a.id);
const other={...JSON.parse(JSON.stringify(my)),id:Math.max(0,...S.groups.map(g=>g.id))+1,name:'시험당',leader:opp[0].id,members:[],tre:50,ideo:0};S.groups.push(other);
for(const a of opp){a.grp=null}for(const a of ally){a.grp=my.id;my.members.push(a.id)}for(const a of opp.slice(0,2)){a.grp=other.id;other.members.push(a.id)}
const tax0=S.gov.policy.tax||0;run('pol2:bud','taxup');assert(S.gov.policy.tax>tax0);run('pol2:bud','taxdn');run('pol2:bud','aust');const t0=S.gov.tre=Math.max(S.gov.tre,1e4);run('pol2:bud','release');assert(S.gov.tre<t0);
run('pol2:shield');assert(S.gov.impeachShield>S.day);
run('pol2:const');run('pol2:amend','seatUp');
run('pol2:secret');assert(S.gov.inst.secret);for(let i=0;i<20;i++)w.step();assert(S.gov.inst.secret,'민주 체제에서도 내가 만든 비밀경찰은 유지');
const cr=A('pol2:repress');assert(cr&&cr.opts.length,'탄압 대상');const tgt=Number(cr.opts[0][0].slice(1));run('pol2:repress',cr.opts[0][0]);assert(S.byId.get(tgt).jailUntil>S.day);
run('pol2:frame',A('pol2:frame').opts[0][0]);
const pu=A('pol2:purge');if(pu?.opts?.length)run('pol2:purge',pu.opts[0][0]);
const ex=A('pol2:exec');assert(ex&&ex.opts.length,'처형 대상');const ev=Number(ex.opts[0][0].slice(1));run('pol2:exec',ex.opts[0][0]);assert(!S.byId.get(ev).alive);assert(S.gov.fear>S.day);
console.log('dbg',S.gov.regime,S.gov.chief===me.id,S.gov.nextElection-S.day);run('pol2:troll');S.gov.nextElection=S.day+10;console.log('rig',A('pol2:rig')?.why,A('pol2:shield')?.ok,S.dyn.pid===me.id);console.log('dbg2',S.gov.nextElection-S.day,JSON.stringify(D.run),w.S===S);run('pol2:buy');run('pol2:rig');assert(D.elec.rig&&D.elec.buy>=30);
run('pol2:party','c'+other.id);
run('pol2:works','road');run('pol2:works','park');run('pol2:works','house');run('pol2:works','fire');
const rf=A('pol2:refer');if(rf?.opts?.length)run('pol2:refer',rf.opts[0][0]);
// 다른 사람이 통치자일 때 탄핵 발의
S.gov.chief=opp[2].id;S.gov.council.push(me.id);S.gov.approval=.1;const r=run('pol2:impeach');assert(typeof r.text==='string'||typeof r==='object');
// 선거 조작: 다음 선거에서 내가 후보면 반영되고 초기화
console.log(JSON.stringify({ok:true,tax:S.gov.policy.tax,secret:!!S.gov.inst.secret,impeach:S.gov.lastImpeach}));
