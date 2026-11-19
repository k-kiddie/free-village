'use strict';
// 체제 전환: 수장이 고를 수 있는 전환·방법·준비 정도가 나오고, 성공하면 실제 체제가 바뀌며 실패하면 대가를 치르는지 검사한다.
const assert=require('node:assert/strict');
const {createWorld,YEAR}=require('../engine');
const king=(seed=2429)=>{const w=createWorld(seed,180);w.dynStart();w.dynConfigureStart({age:34,status:'king',family:'children'});w.dynChoose(w.S.dyn.pending[0].id,'go');w.dynSetStory(0);w.S.dyn.pending=[];w.S.byId.get(w.S.dyn.pid).cash=1e6;return w};
const A=(w,k)=>w.dynActions().find(a=>a.k===k),reg=w=>w.S.gov.coup&&!['com','msoc'].includes(w.S.gov.regime)?'mil':w.S.gov.regime;
const force=(w,k,m,tries=40)=>{for(let i=0;i<tries;i++){w.S.dyn.cool={};const me=w.S.byId.get(w.S.dyn.pid);me.jailUntil=0;me.abroadUntil=0;const before=reg(w);const t=w.dynAct(k+':'+m).text;if(reg(w)!==before||/성공/.test(t))return t}return null};
// 1) 군주 → 입헌군주정(내 뜻으로 권력 이양): 거의 확실, 나는 왕으로 남음
{const w=king(),S=w.S,me=S.byId.get(S.dyn.pid);assert.equal(reg(w),'mon');const a=A(w,'regime:cmon');assert(a&&a.ok,'입헌군주정 선포 가능');assert(/준비: 군대/.test(a.hint),'준비 정도 표시');assert.deepEqual(a.opts.map(o=>o[0]),['legal']);
  const t=force(w,'regime:cmon','legal');assert(t,'성공');assert.equal(reg(w),'cmon');assert.equal(S.gov.king,me.id,'왕으로 남음');
  // 2) 친정 복귀(절대왕정)
  assert(A(w,'regime:king'),'친정 복귀 목록');const t2=force(w,'regime:king','martial',80);assert(t2,'친정 복귀 성공: '+t2);assert.equal(reg(w),'mon');assert.equal(S.gov.chief,me.id)}
// 3) 군주 → 위로부터 공산화 → 개혁 개방 → 세습 왕조 → 민주화
{const w=king(),S=w.S,me=S.byId.get(S.dyn.pid);assert(force(w,'regime:com','martial',80),'공산화');assert.equal(reg(w),'com');
  assert(force(w,'regime:msoc','legal',80),'개혁 개방');assert.equal(reg(w),'msoc');assert(force(w,'regime:hered','martial',80));assert(S.gov.heredCom,'세습 표시');
  assert(force(w,'regime:democ','legal'),'민주화');assert.equal(reg(w),'rep');assert(S.gov.chief!=null,'민주화 뒤 바로 선거로 새 지도자')}
// 4) 허수아비 왕: 측근이 왕, 나는 섭정으로 실권 유지
{const w=king(),S=w.S,me=S.byId.get(S.dyn.pid);assert(force(w,'regime:puppet','martial',80),'허수아비 왕');assert.equal(S.gov.regent,me.id);assert(S.gov.puppet);for(let i=0;i<YEAR;i++){w.step();S.dyn.pending=[]}assert.equal(S.gov.regent,me.id,'성인 왕이어도 섭정 유지');assert(w.dynActions().some(a=>a.k.startsWith('govern:')),'섭정이 국정 행동')}
// 5) 실패 대가: 쿠데타 실패 → 망명(자리 잃음)
{const w=king(),S=w.S,me=S.byId.get(S.dyn.pid);let lost=false;for(let i=0;i<200&&!lost;i++){S.dyn.cool={};me.jailUntil=0;me.abroadUntil=0;if(reg(w)!=='mon'){break}const r=w.dynAct('regime:cmon:legal');}
  // 쿠데타 실패 경로는 공화정에서 확인
  const w2=king(),S2=w2.S,m2=S2.byId.get(S2.dyn.pid);force(w2,'regime:republic','legal');S2.gov.chief=m2.id;S2.gov.approval=.05;S2.mil=null;let out='';for(let i=0;i<200;i++){S2.dyn.cool={};m2.jailUntil=0;m2.abroadUntil=0;S2.gov.chief=m2.id;S2.gov.coup=null;S2.gov.regime='rep';const t=w2.dynAct('regime:dict:selfcoup').text;if(/실패/.test(t)){out=t;break}}
  assert(/망명/.test(out),'쿠데타 실패 시 망명: '+out);assert(m2.abroadUntil>S2.day,'나라 밖');assert(S2.dyn.rcExile,'망명 기록')}
// 6) 2차: 반발 음모·내전·망명 정부와 귀환·왕정복고
const waitFor=(w,kind,days=YEAR*3)=>{const D=w.S.dyn;for(let i=0;i<days;i++){const p=D.pending.find(p=>p.kind===kind);if(p)return p;D.pending=D.pending.filter(p=>['rcPlot','rcCivilWar','rcExileGov','rcReturn','rcRestore','rcClaim'].includes(p.kind));w.step()}return null};
{const w=king(),S=w.S,D=S.dyn,me=S.byId.get(D.pid);D.rcBacklash={d:S.day,t:'dict',str:1};const p=waitFor(w,'rcPlot');assert(p,'반발 음모 사건');w.dynChoose(p.id,'coax');assert(D.rcBacklash.str<1,'회유로 반발↓');
  D.rcUnrest={d:S.day,str:.6};S.gov.approval=.1;let q=null;for(let i=0;i<YEAR*3&&!q;i++){S.gov.approval=.1;q=waitFor(w,'rcCivilWar',15)}assert(q,'내전 사건');w.dynChoose(q.id,'share');assert(['cmon','rep'].includes(S.gov.regime),'협상으로 체제 변화: '+S.gov.regime)}
{const w=king(),S=w.S,D=S.dyn,me=S.byId.get(D.pid);D.rcExile={d:S.day,support:0};me.abroadUntil=S.day+200;const p=waitFor(w,'rcExileGov');assert(p,'망명 정부 사건');w.dynChoose(p.id,'gov');assert(D.rcExile.support>0);
  me.abroadUntil=S.day;const r=waitFor(w,'rcReturn');assert(r,'귀환 사건');w.dynChoose(r.id,'home');assert(!D.rcExile,'귀환 정리')}
{const w=king(),S=w.S,D=S.dyn,me=S.byId.get(D.pid),G=S.gov;force(w,'regime:republic','legal');G.chief=me.id;G.regime='rep';G.coup=null;const heir=S.agents.find(a=>a.alive&&w.isAdult(a)&&a.family!==me.family);G.dynasty=heir.family||heir.id;G.regHist.push({d:S.day,r:'mon'});
  const p=waitFor(w,'rcRestore',YEAR*6);assert(p,'왕정복고 사건');w.dynChoose(p.id,'cmon');assert.equal(G.regime,'cmon','입헌군주로 맞아들임');assert.equal(G.king,heir.id)}
console.log('체제 전환: 입헌군주정·친정 복귀·공산화·개혁 개방·세습·민주화·허수아비 왕·쿠데타 실패 망명·준비 정도·반발 음모·내전 협상·망명 정부·귀환·왕정복고 통과');
