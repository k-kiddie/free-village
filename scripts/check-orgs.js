'use strict';
// 내 조직: 이끄는/속한 단체마다 정보와 양지/음지 행동이 모이고, 화면 규칙으로 실제 행동이 골라지는지 검사한다.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'check-story-fuzz.js'),'utf8');const rich=eval('('+src.match(/function rich[\s\S]*?\n}\n/)[0]+')');const {createWorld,YEAR}=require('../engine.js');
const {w,S,D,me}=rich(1101);me.cash=1e6;w.dynAct('merc:found:'+encodeURIComponent('푸른 방패'));
D.shark={d:S.day,book:[{id:S.agents.find(a=>a.alive&&a!==me).id,bal:30,miss:1}]};
const v=w.dynView(),ids=v.orgs.map(o=>o.id);
for(const k of ['exec','faith','gang','bank','spy','shark'])assert(ids.includes(k),k+' 조직 표시: '+ids.join(','));assert(ids.some(k=>k.startsWith('merc')),'용병 회사 표시');
// 화면 쪽 고르기 규칙(god-client.js)을 그대로 실행
const gc=fs.readFileSync(path.join(__dirname,'..','god-client.js'),'utf8');const blk=gc.slice(gc.indexOf('function dynOrgKey'),gc.indexOf('function dynOrgChips'));const ctx={};vm.createContext(ctx);vm.runInContext(blk+';this.acts=dynOrgActs',ctx);
const pick=(id,side)=>ctx.acts(v,v.orgs.find(o=>o.id===id),side).map(a=>a.k);
const fl=pick('faith','light'),fd=pick('faith','dark');assert(fl.includes('extra:preach')&&fl.includes('extra:rite'),'교단 양지: 전도·예배');assert(fd.includes('extra:force')&&fd.some(k=>k.startsWith('fdark:')),'교단 음지: 강압·어둠');assert(!fl.includes('extra:force'),'강압은 양지에 없음');
const gd=pick('gang','dark');assert(gd.some(k=>k.startsWith('crime:'))&&!gd.includes('crime:shark'),'패거리 음지: 범죄(고리대 제외)');
assert(pick('exec','dark').some(k=>k.startsWith('pol2:')),'정부 음지: 공안');assert(pick('exec','light').some(k=>k.startsWith('law2:')||k.startsWith('govern:')),'정부 양지: 법·국정');
const m=v.orgs.find(o=>o.id.startsWith('merc'));assert(pick(m.id,'light').length>0,'용병 회사 행동');assert(pick('shark','dark').includes('crime:shark'),'고리대 음지');
for(const o of v.orgs)assert(o.stats.length>=2,o.id+' 정보');
console.log(`내 조직: ${v.orgs.map(o=>o.icon+o.name).join(' · ')} · 양지/음지 분류 통과`);
// 직책별 분리와 수사·사법 정치 중립: 의원+검사+정당원(동현 저장과 같은 상황)
{const x=createWorld(2429,180);x.dynStart();x.dynConfigureStart({age:30});x.dynChoose(x.S.dyn.pending[0].id,'go');x.dynSetStory(0);const S2=x.S,D2=S2.dyn,m=S2.byId.get(D2.pid);D2.pending=[];
  for(let i=0;i<YEAR*3&&!S2.gov;i++){x.step();D2.pending=[]}if(!S2.gov){x.dynAct('council')}
  const G2=S2.gov;assert(G2,'정부');m.edu=3;m.rep=1;
  // 검사가 되려는데 정당원이면 막힘
  if(!m.grp){m.cash=1e5;try{x.dynAct('party')}catch(e){}}if(m.grp){const pr=x.dynActions().find(a=>a.k==='duty:pros');assert(pr&&!pr.ok&&/탈퇴/.test(pr.why),'정당원은 검사 지원 불가: '+(pr&&pr.why))}
  // 예전 저장처럼 이미 겹친 상태를 만들면, 다음 날 검사직을 내려놓음
  G2.council=[...new Set([...(G2.council||[]),m.id])];G2.prosList=[...(G2.prosList||[]),m.id];assert.equal(x.dynView().orgs.some(o=>o.id==='justice'),true,'겹친 순간에는 사법 칩');
  D2.pending=[];x.step();const cf=D2.pending.find(p=>p.kind==='duConflict');assert(cf&&cf.opts.length===2,'겹치면 어느 쪽을 남길지 선택창');assert((G2.prosList||[]).includes(m.id),'고르기 전에는 그대로');
  x.dynChoose(cf.id,'politics');assert(!(G2.prosList||[]).includes(m.id),'의원직을 지키면 검사직 사임');
  const orgs=x.dynView().orgs;assert(orgs.some(o=>o.id==='council'&&/의원/.test(o.role)),'의회 칩');assert(!orgs.some(o=>o.id==='justice'),'사법 칩 사라짐');assert(!orgs.some(o=>o.id==='exec'),'의원은 행정부 칩 없음');
  const ctx2={};vm.createContext(ctx2);vm.runInContext(blk+';this.acts=dynOrgActs',ctx2);const v2=x.dynView(),cl=ctx2.acts(v2,v2.orgs.find(o=>o.id==='council'),'light').map(a=>a.k);assert(cl.some(k=>k.startsWith('law2:')||k.startsWith('law:')||k.startsWith('pet:')),'의회: 법안');assert(!cl.some(k=>k.startsWith('duty:')),'의회에 수사 행동 없음');
  // 장관 제안을 사양하면 검사직 유지, 1년 동안 다시 안 앉힘
  G2.prosList=[...(G2.prosList||[]),m.id];G2.council=G2.council.filter(id=>id!==m.id);if(m.grp){const gg=S2.groups.find(q=>q.id===m.grp);gg.members=gg.members.filter(id=>id!==m.id);if(gg.leader===m.id)gg.leader=gg.members[0]||null;m.grp=null}
  G2.min=G2.min||{};const mk=Object.keys(G2.min).find(k=>!G2.min[k].into)||'edu';G2.min[mk]=G2.min[mk]||{k:mk,d:S2.day,mn:null,score:0,root:'교육',tier:0,name:'교육부'};G2.min[mk].mn=m.id;D2.pending=[];x.step();
  const ap=D2.pending.find(p=>p.kind==='duConflict');assert(ap&&ap.ctx.kind==='appoint','장관 제안 선택창');x.dynChoose(ap.id,'decline');assert((G2.prosList||[]).includes(m.id)&&G2.min[mk].mn!==m.id,'사양하면 검사 유지');assert(D2.declineUntil>S2.day,'1년 동안 다시 안 앉힘');
  // 다른 주민 검사가 정당원이면 정당을 떠나고, 의원이면 검사직에서 물러남
  const np=S2.agents.find(a=>a.alive&&a!==m&&a.age>=25*60&&!a.grp);const party=S2.groups.find(q=>q.mode==='party'&&q.leader!==np.id);if(party){np.grp=party.id;party.members.push(np.id)}G2.prosList.push(np.id);
  const nc=S2.agents.find(a=>a.alive&&a!==m&&a!==np&&a.age>=25*60);G2.council.push(nc.id);G2.judges=[...(G2.judges||[]),{id:nc.id,until:S2.day+600,by:null}];
  for(let i=0;i<11;i++){D2.pending=[];x.step()}assert(!party||!np.grp,'주민 검사는 정당을 떠남');assert(!(G2.judges||[]).some(j=>j.id===nc.id),'의원인 주민은 재판관에서 물러남');
  console.log('  직책 분리·정치 중립: 정당원 검사 지원 거부 · 겹치면 선택창(의원/장관 제안) · 사양 1년 · 주민 검사·재판관 중립 · 의회 칩만 남음 통과')}
