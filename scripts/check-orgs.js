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
  x.step();D2.pending=[];assert(!(G2.prosList||[]).includes(m.id),'검사직 자동 사임');assert((D2.notes||[]).some(n=>/검사 직을 내려놓았다/.test(n.text)),'알림');
  const orgs=x.dynView().orgs;assert(orgs.some(o=>o.id==='council'&&/의원/.test(o.role)),'의회 칩');assert(!orgs.some(o=>o.id==='justice'),'사법 칩 사라짐');assert(!orgs.some(o=>o.id==='exec'),'의원은 행정부 칩 없음');
  const ctx2={};vm.createContext(ctx2);vm.runInContext(blk+';this.acts=dynOrgActs',ctx2);const v2=x.dynView(),cl=ctx2.acts(v2,v2.orgs.find(o=>o.id==='council'),'light').map(a=>a.k);assert(cl.some(k=>k.startsWith('law2:')||k.startsWith('law:')||k.startsWith('pet:')),'의회: 법안');assert(!cl.some(k=>k.startsWith('duty:')),'의회에 수사 행동 없음');
  console.log('  직책 분리·정치 중립: 정당원 검사 지원 거부 · 의원 겸직 시 검사직 자동 사임 · 의회 칩만 남음 통과')}
