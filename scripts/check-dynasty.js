'use strict';
// 가문 모드 엔진 검사: 시작 인물·이름 변경·선택지 대기·저장 복원, 그리고 원래 마을 결과 불변.
// 사용: node scripts/check-dynasty.js [기준 git 커밋(기본 origin/main)] [--quick]
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),os=require('node:os'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const engine=require('../engine.js');
// 이야기 사건(15번)은 무작위로 마을을 바꾸므로, 그 전 검사들은 사건을 끈 채로 돌린다.
{const cw=engine.createWorld;engine.createWorld=(s,n)=>{const w=cw(s,n);const ds=w.dynStart;w.dynStart=(...a)=>{const r=ds(...a);if(!engine.keepStory&&w.dynSetStory)w.dynSetStory(0);return r};return w}}const {YEAR}=engine;
const args=process.argv.slice(2),quick=args.includes('--quick'),base=args.find(a=>!a.startsWith('--'))||'origin/main';

// 선택지가 뜨면 멈추고 답한 뒤 진행하는 Worker 흐름을 흉내 낸다.
function drive(w,days,pickFn,stat){
  for(let i=0;i<days;i++){
    let guard=0;while(w.S.dyn.pending.length){assert(++guard<50,'선택지 무한 반복');const p=w.S.dyn.pending[0];const options=p.opts.filter(o=>o.available!==false);assert(options.length,'실행 가능한 선택지가 있음');const k=pickFn({...p,opts:options});const r=w.dynChoose(p.id,k);stat.kinds[p.kind]=(stat.kinds[p.kind]||0)+1;stat.last=r.text}
    if(w.S.dyn.over)return;
    w.step();
  }
}
const isA=a=>a.age>=14*YEAR;
function crownForCheck(w){const me=w.S.byId.get(w.S.dyn.pid);me.rep=1;for(const a of w.S.agents){a.g.comply=1;a.g.civic=0}return w.dynAct('lord')}
function budgetForCheck(w){const X=w.S;X.gov.tre=1e9;X.gov.bud={d:X.day,total:7e9,lines:Object.fromEntries(['adm','welf','pub','def','pol','edu','health'].map(k=>[k,1e9])),spent:{}}}
function main(){
  const t0=Date.now();
  // 1. 시작 인물 = 성인 중 정치력 최고
  const w=engine.createWorld(7,100);w.dynStart();const S=w.S,D=S.dyn;
  const score=a=>a.g.boss*.5+a.g.civic*.4+Math.log10((w.W(a)||0)+10)*.15+(a.grp?.2:0);
  const best=S.agents.filter(a=>a.alive&&w.isAdult(a)).sort((x,y)=>score(y)-score(x))[0];
  assert.equal(D.pid,best.id);assert.equal(D.pending[0].kind,'start');
  assert.throws(()=>w.dynRename('','길동'));assert.throws(()=>w.dynRename('김','abc'));
  const rn=w.dynRename('홍','길동');assert.equal(rn.name,'홍길동');assert.equal(D.house,'홍씨 가문');assert.equal(S.byId.get(D.pid).sur,'홍');
  assert.throws(()=>w.dynChoose(999,'go'));assert.throws(()=>w.dynChoose(D.pending[0].id,'nope'));
  // 2. 자동 플레이: 선택지가 뜨는 동안 날짜가 멈추는지, 고른 대로 반영되는지
  const stat={kinds:{}};let rnd=12345;const pick=p=>{rnd=(rnd*1103515245+12345)&0x7fffffff;return p.opts[rnd%p.opts.length].k};
  const years=quick?20:60;
  drive(w,YEAR*years,pick,stat);
  const v=w.dynView();assert(v.me&&v.house==='홍씨 가문');
  const married=D.chron.some(c=>c.text.includes('혼인하다'));
  assert(stat.kinds.arrange>0,'정략결혼(혼처 고르기) 선택지');assert(Object.keys(D.ties||{}).length>0,'사돈 관계 형성');
  for(const t of Object.values(D.ties))assert(t.v>=-1&&t.v<=1&&t.name);
  // 대기 중에는 Worker가 step을 부르지 않는다: 여기서는 선택지를 넣고 엔진 상태가 그대로인지 확인
  // 3. 저장 → 복원 → 저장 JSON 완전 일치, 이후 같은 선택이면 같은 결과
  // (기존 엔진은 복원 때 건물 필드를 보정하므로 첫 왕복 대신 S.dyn·g/q 일치와 두 번째 왕복 완전 일치를 본다)
  const e1=w.exportState(),j1=JSON.stringify(e1);const load=j=>{const x=engine.createWorld(7,100);x.importState(JSON.parse(j));return x};
  const w2=load(j1),e2=w2.exportState(),j2=JSON.stringify(e2);
  assert.equal(JSON.stringify(e2.S.dyn),JSON.stringify(e1.S.dyn),'S.dyn 저장 왕복');
  assert.equal(JSON.stringify(e2.S.agents.map(a=>[a.id,a.g,a.q])),JSON.stringify(e1.S.agents.map(a=>[a.id,a.g,a.q])),'g/q 보존');
  assert.equal(JSON.stringify(load(j2).exportState()),j2,'두 번째 저장 왕복 완전 일치');
  // 엔진의 지도 확장 목록(EXPL·PLOTS)은 모듈 전역이라 한 프로세스에서는 복원본을 하나씩 차례로 돌린다(서버는 Worker당 마을 하나).
  const pk=r=>p=>p.opts[(r=(r*48271)%2147483647)%p.opts.length].k;const runFrom=()=>{const x=load(j1);drive(x,YEAR*2,pk(777),{kinds:{}});return JSON.stringify(x.exportState())};
  assert.equal(runFrom(),runFrom(),'복원 후 같은 선택이면 같은 결과');
  // 4. 선택지 직접 확인: 청혼 받음 → 수락하면 부부
  const w3=engine.createWorld(11,120);w3.dynStart();w3.dynConfigureStart({age:25,family:'single'});w3.dynChoose(w3.S.dyn.pending[0].id,'go');let accepted=false;
  {const me=w3.S.byId.get(w3.S.dyn.pid),suitor=w3.S.agents.find(a=>a!==me&&a.alive&&isA(a)&&!a.partner&&a.family!==me.family);assert(suitor,'청혼 검사에 필요한 미혼 성인');const p={id:w3.S.dyn.nextP++,kind:'proposeIn',d:0,text:'청혼 검사',opts:[{k:'yes',label:'수락'},{k:'no',label:'거절'}],ctx:{from:suitor.id}};w3.S.dyn.pending.push(p);w3.dynChoose(p.id,'yes');assert.equal(me.partner,suitor.id);assert.equal(suitor.partner,me.id);accepted=true}
  // 5. 정부 세우기 행동: 회의 제안·공산 혁명·영주 자처(기존 엔진 계산 재사용)
  const fresh=(seed)=>{const x=engine.createWorld(seed,100);x.dynStart();x.dynChoose(x.S.dyn.pending[0].id,'go');for(let i=0;i<10;i++)x.step();return x};
  const acts={};
  {const x=fresh(7);const r=x.dynAct('council');assert(x.S.gov||/부결/.test(r.text));acts.council=r.text;if(x.S.gov){assert(['rep','olig'].includes(x.S.gov.regime));assert(x.S.gov.history.length>=1,'첫 선거');assert(x.S.gov.history[0].cands.some(c=>c.id===x.S.dyn.pid)||/참정권|자격/.test(r.text),'내가 후보(또는 자격 없음 안내)')}
    assert.throws(()=>x.dynAct('council'),'정부가 생기면 회의 제안 없음')}
  {const x=fresh(11);const r=x.dynAct('revolt');acts.revolt=r.text;if(/성공/.test(r.text)){assert.equal(x.S.gov.regime,'com');assert.equal(x.S.gov.chief,x.S.dyn.pid);assert.equal(x.dynView().rank,4)}}
  {const x=fresh(5);assert.throws(()=>crownForCheck(x));x.S.byId.get(x.S.dyn.pid).cash+=1e5;const r=crownForCheck(x);acts.lord=r.text;assert.equal(x.S.gov.regime,'mon');assert.equal(x.S.gov.chief,x.S.dyn.pid);x.step();assert.equal(x.S.dyn.pending.filter(p=>p.kind!=='story').length,0,'행동 직후 중복 알림 없음')}
  {const x=fresh(9);const me=x.S.byId.get(x.S.dyn.pid);me.cash+=1e5;if(!me.grp){x.dynAct('gang');assert(me.grp);acts.gang=true}}
  // 6. 법 바꾸기: 시위·청원/발의 → 의회 표결 또는 통치자 결정
  {let passed=0,tried=0;for(const seed of [7,11,17]){const x=fresh(seed);x.dynAct('council');if(!x.S.gov)continue;for(const t of x.dynActions().filter(a=>/^(pet|law):/.test(a.k)&&a.ok)){const r=x.dynAct(t.k);tried++;const key=t.k.split(':')[1];assert.equal(/통과/.test(r.text)&&!/부결|거부|갇혔/.test(r.text),x.S.gov.policy[key]===true,r.text);if(x.S.gov.policy[key]===true)passed++;assert.throws(()=>x.dynAct(t.k))}}
    assert(tried>0);acts.law={tried,passed}}
  // 7. 경제 행동·지출·일
  {const x=engine.createWorld(7,150);x.dynStart();x.dynConfigureStart({age:40,family:'children'});x.dynChoose(x.S.dyn.pending[0].id,'go');
    const me=x.S.byId.get(x.S.dyn.pid);me.cash+=3000;me.age=Math.max(me.age,18*YEAR);me.jailUntil=0;const seller=x.S.agents.find(a=>a!==me&&a.alive&&isA(a));let sale=x.S.houses.find(h=>h.owner===seller.id);if(!sale){sale={id:x.S.nextHouse++,lot:0,owner:seller.id,occ:null,cond:1,sale:20,rent:null,stale:0};x.S.houses.push(sale)}if(sale.occ){const tenant=x.S.byId.get(sale.occ);if(tenant)tenant.home=null}sale.occ=null;sale.sale=20;const done=[];for(const a of x.dynActions().filter(a=>/^(house|land|stock|firm|loan|dep):/.test(a.k)&&a.ok&&!Object.keys(a).some(k=>k.endsWith('Spec')))){const before=JSON.stringify([me.cash,x.S.houses.filter(h=>h.owner===me.id).length,x.S.loans.length,x.S.firms.length]);const r=x.dynAct(a.opts?a.k+':'+a.opts[0][0]:a.k);done.push(a.k.split(':').slice(0,2).join(':'));assert(r.text)}
    assert(done.some(k=>k==='house:buy'),'집 사기');assert.throws(()=>x.dynSetBudget({life:'x'}));x.dynSetBudget({life:4,edu:2,save:.2,give:3,debt:1,job:0});const v0=x.S.dyn.vault||0;for(let i=0;i<60;i++){while(x.S.dyn.pending.length){const p=x.S.dyn.pending[0];x.dynChoose(p.id,p.opts.at(-1).k)}if(x.S.dyn.over)break;x.step()}
    assert(x.S.dyn.spent,'지출 적용');acts.eco=done}
  // 8. 내 주식은 엔진이 자동으로 사고팔지 않는다(가), 내 회사는 목록에 항상(나), 양 선택(다)
  {const x=engine.createWorld(7,150);x.dynStart();x.dynConfigureStart({age:40,family:'children'});x.dynChoose(x.S.dyn.pending[0].id,'go');x.S.bldgs.push({id:90001,lot:0,owner:x.S.agents[0].id,firm:null,fx:['pub'],cond:1,fee:1,rev:0,revE:0,built:0,users:0});
    const me=x.S.byId.get(x.S.dyn.pid);const b=x.S.bldgs.find(b=>!b.firm&&b.owner&&b.owner!==me.id);b.owner=me.id;me.cash+=500;x.dynAct('firm:new');const f=x.S.firms.find(f=>f.ceo===me.id);assert(f,'회사 세우기');
    const b0=f.sh[String(me.id)];for(let i=0;i<120;i++){while(x.S.dyn.pending.length){const p=x.S.dyn.pending[0];x.dynChoose(p.id,p.opts.at(-1).k)}x.step()}
    assert.equal(f.sh[String(me.id)],b0,'엔진 자동 거래 없음');const sell=x.dynActions().find(a=>a.k==='stock:sell:'+f.id);assert(sell&&sell.opts.length===3&&/경영권/.test(sell.hint));
    assert.throws(()=>x.dynAct('stock:sell:'+f.id),/양/);assert(/팔았다/.test(x.dynAct('stock:sell:'+f.id+':0.1').text));acts.stock=true}
  // 9. 사건 선택지(7-2): 상황을 만들어 선택지가 뜨고 고른 대로 반영되는지
  const evs={};
  {// 8년 동안 마지막 선택만 고르므로 정변·망명 등으로 가문이 끊길 수 있다 — 끊기면 다른 시드로 다시 만든다(이 묶음은 사건 반응을 보는 검사)
    const mk=sd=>{const x=engine.createWorld(sd,150);x.dynStart();x.dynChoose(x.S.dyn.pending[0].id,'go');for(let i=0;i<10;i++)x.step();try{x.dynAct('council')}catch(e){}const D=x.S.dyn;for(let i=0;i<YEAR*8&&!D.over;i++){while(D.pending.length){const p=D.pending[0];x.dynChoose(p.id,p.opts.at(-1).k)}x.step()}return x};
    let x;for(const sd of [7,8,9,11,13]){x=mk(sd);if(!x.S.dyn.over)break}
    const S2=x.S,D2=S2.dyn,me=()=>S2.byId.get(D2.pid);assert(!D2.over,'사건 검사용 가문 유지');const clear=()=>{let g=0;while(D2.pending.length){assert(++g<50);const p=D2.pending[0];x.dynChoose(p.id,p.opts.at(-1).k)}};
    const until=(kind,days)=>{for(let i=0;i<days;i++){x.step();const p=D2.pending.find(p=>p.kind===kind);if(p)return p;clear();if(D2.over)return null}return null};
    clear();D2.cool={};const other=()=>S2.agents.find(a=>a.alive&&x.isAdult(a)&&a.id!==D2.pid&&a.id!==me().partner);
    me().health=30;let p=until('sick',2);assert(p,'병 선택지');let h0=me().health;x.dynChoose(p.id,'bear');assert(me().health>h0,'버티면 조금 회복');evs.sick=p.opts.map(o=>o.k).join('/');clear();
    const th=other();D2.rob={by:th.id,amt:50,d:S2.day+1,v:0};p=until('robbed',1);assert(p,'도둑 피해 선택지');x.dynChoose(p.id,'bear');evs.robbed=p.opts.map(o=>o.k).join('/');clear();
    me().soldier='army';me().drafted=1;me().armyUntil=S2.day+YEAR*2;p=until('draft',1);assert(p,'징병 영장 선택지');x.dynChoose(p.id,'evade');assert(!me().soldier,'회피하면 군인이 아님');evs.draft=p.opts.map(o=>o.k).join('/');clear();
    {const sp=me().partner&&S2.byId.get(me().partner);if(sp){const l=other();sp.affair=l.id;l.affair=sp.id;sp.affairOut=1;p=until('affair',1);assert(p,'외도 발각 선택지');x.dynChoose(p.id,'forgive');assert.equal(sp.affair,null,'용서하면 외도 정리');evs.affair=p.opts.map(o=>o.k).join('/');clear()}}
    if(me().home){const h=S2.houses.find(h=>h.id===me().home);h.burned=S2.day+1;p=until('fire',1);assert(p,'화재 선택지');x.dynChoose(p.id,'family');evs.fire=1;clear()}
    if(S2.gov){const G=S2.gov;G.cases.unshift({t:'tax',who:D2.pid,amt:5,ev:.8,d:S2.day});p=until('caught',12);
      if(p){x.dynChoose(p.id,'confess');const c=G.cases.find(c=>c.who===D2.pid&&c.t==='tax');assert(c&&c.conf===1&&c.dyn==='conf','자백 표시');for(let i=0;i<12&&G.cases.includes(c);i++){x.step();clear()}assert(!G.cases.includes(c),'자백 뒤 재판 진행');evs.caught=G.caseLog.slice(-6).map(r=>r.r).find(r=>/유죄|무죄|불기소|무혐의|종결/.test(r))||'처리됨'}
      else evs.caught='수사관 없음';clear()}
    {const t=other(),h=S2.houses.find(h=>h.id!==me().home&&h.id!==t.home);if(h){if(t.home){const o=S2.houses.find(x=>x.id===t.home);if(o&&o.occ===t.id)o.occ=null}h.owner=D2.pid;h.occ=t.id;t.home=h.id;h.tenantRent=1e6;h.sale=null;h.deposit=0;t.cash=0;p=until('rentLate',10);assert(p,'월세 체납 선택지');x.dynChoose(p.id,'wait');assert(h.dynGrace>S2.day,'기다려 주기');evs.rentLate=1;clear()}}
    {const o=S2.agents.find(a=>a.alive&&x.isAdult(a)&&a.id!==D2.pid&&a.id!==me().partner&&a.home)||other(),h=S2.houses.find(h=>h.owner===o.id&&!h.pub)||S2.houses.find(h=>h.id!==me().home&&!h.pub);h.owner=o.id;h.deposit=200;/* 집주인은 자기 집이 있어야 하고, 보증금 보호 정책이 있으면 관청이 대신 물어 선택지가 안 뜸 */if(S2.gov)S2.gov.policy.depGuar=false;h.depTenant=D2.pid;h.depEnd=S2.day+1;o.g.cheat=3;p=until('deposit',2);assert(p,'전세금 미반환 선택지');x.dynChoose(p.id,'give');evs.deposit=1;clear()}
    {const b=S2.bldgs.find(b=>!b.firm&&b.owner&&b.owner!==D2.pid);if(b&&!me().firm){me().jailUntil=0;b.owner=D2.pid;me().cash+=500;const r=x.dynAct('firm:new');const f=S2.firms.find(f=>f.ceo===D2.pid);if(f){f.cash=0;p=null;for(let i=0;i<16&&!p;i++){x.step();p=D2.pending.find(p=>p.kind==='firmCrisis');if(!p)clear()}assert(p,'사업 위기 선택지');x.dynChoose(p.id,'close');assert(!S2.firms.includes(f)&&b.owner===D2.pid,'정리하면 건물은 내 것');evs.firmCrisis=1;clear()}else evs.firmCrisis=r.text}}
    if(S2.gov&&!(S2.gov.chief===D2.pid||S2.gov.king===D2.pid)&&!['mil','com','msoc'].includes(S2.gov.regime)){S2.gov.coup=true;p=until('regime',1);assert(p,'체제 변화 선택지');x.dynChoose(p.id,'hide');evs.regime=p.opts.map(o=>o.k).join('/');clear()}
    if(!S2.war&&!(S2.gov&&(S2.gov.chief===D2.pid||S2.gov.king===D2.pid))){S2.war={t:'너른들',d:S2.day+1,score:0,cas:0,civ:0};p=until('war',1);if(p){x.dynChoose(p.id,'avoid');evs.war=1}clear()}
    const ex=x.exportState(),jx=JSON.stringify(ex);assert.equal(JSON.stringify(load(jx).exportState().S.dyn),JSON.stringify(ex.S.dyn),'사건 뒤 S.dyn 저장 왕복')}
  {const kinds=Object.keys(stat.kinds).filter(k=>!['start','notice','death','arrange','kidMatch','proposeIn','proposeOut'].includes(k));assert(kinds.length>=6,'자동 플레이에서 사건 선택지 여러 종류: '+kinds.join(','));evs.auto=kinds}
  // 10. 7-1 남은 행동(가족·상속·인맥·건강·어두운 길·권력)과 3단계(넓은 상속·섭정·단절·새 가문·관전)
  const st3={};
  {// 12년 동안 마지막 선택만 고르면 가문이 끊길 수 있다 — 끊기면 다른 시드로 다시 만든다
    let x;const D3=()=>x.S.dyn;const clear=()=>{let g=0;while(D3().pending.length){assert(++g<50);const p=D3().pending[0];x.dynChoose(p.id,p.opts.at(-1).k)}};
    for(const sd of [7,8,9,11,13]){x=engine.createWorld(sd,150);x.dynStart();x.dynChoose(D3().pending[0].id,'go');for(let i=0;i<10;i++)x.step();try{x.dynAct('council')}catch(e){}for(let i=0;i<YEAR*12&&!D3().over;i++){clear();x.step()}clear();if(!D3().over)break}assert(!D3().over);
    const me=x.S.byId.get(D3().pid);me.cash+=5000;const relative=x.S.agents.find(a=>a.alive&&isA(a)&&a.id!==me.id);assert(relative);relative.family=me.family;D3().disinherited=[];const done=[];
    for(const a0 of x.dynActions().filter(a=>a.ok&&/^(fam|kin|net|med|dark|pow):/.test(a.k)&&a.k!=='fam:divorce')){const a=x.dynActions().find(y=>y.k===a0.k);if(!a||!a.ok)continue;const r=x.dynAct(a.k);assert(r.text,a.k);done.push(a.k.split(':').slice(0,2).join(':'))}
    assert(done.includes('kin:heir')&&done.some(k=>k.startsWith('net:'))&&done.some(k=>k.startsWith('dark:')),'새 행동: '+done.join(','));st3.acts=[...new Set(done)];
    // 미성년 지정 상속자 → 섭정
    const kid=x.S.agents.find(a=>a.alive&&a.age<10*YEAR&&a.parents.some(p=>x.S.byId.get(p)?.alive)&&a.id!==D3().pid);assert(kid);D3().heir=kid.id;
    const gen0=D3().gen;me.health=-999;x.step();const pd=D3().pending.find(p=>p.kind==='death');assert(pd&&/섭정/.test(pd.text),'섭정 알림');assert.equal(D3().pid,kid.id);assert.equal(D3().gen,gen0+1);assert(D3().regent,'섭정 지정');clear();
    for(let i=0;i<30;i++){clear();x.step()}assert(x.dynView().regent,'섭정 표시');st3.regent=true;
    // 상속 순서: 자녀가 없고 지정도 없으면 형제·조카·배우자·같은 집안까지
    const h=x.dynView().heirs;st3.heirOrder=h.slice(0,4).map(v=>v.why);
    // 단절 → 새 가문 후보 선택
    const m2=x.S.byId.get(D3().pid);D3().heir=null;m2.kids=[];m2.parents=[];m2.partner=null;m2.family=-1;m2.health=-999;x.step();
    const po=D3().pending.find(p=>p.kind==='death');assert(D3().over&&po,'단절');assert(po.opts.some(o=>o.k==='watch')&&po.opts.some(o=>o.k[0]==='h'),'새 가문·관전 선택');assert.equal(D3().past.length,1,'끊긴 가문 보관');
    const ex=JSON.stringify(x.exportState());x.dynChoose(po.id,po.opts[0].k);assert(!D3().over&&D3().gen===1&&D3().past.length===1&&D3().pending[0].kind==='start','새 가문 시작');x.dynChoose(D3().pending[0].id,'go');for(let i=0;i<20;i++){clear();x.step()}st3.newHouse=D3().house;
    // 관전
    const y=load(ex);const py=y.S.dyn.pending.find(p=>p.kind==='death');y.dynChoose(py.id,'watch');assert(y.S.dyn.watch&&y.dynCanSee(1)&&y.dynCanTab('gov'),'관전은 전체 공개');for(let i=0;i<5;i++)y.step();st3.watch=true}
  console.log(JSON.stringify({stage3:st3,events:evs,dynasty:{years,day:S.day,gen:D.gen,over:D.over,me:v.me.name,age:v.me.age,pop:S.agents.length,choices:stat.kinds,married,ties:Object.keys(D.ties||{}).length,chron:D.chron.length},roundTrip:true,resumeSame:true,proposeInAccepted:accepted,acts,ms:Date.now()-t0}));

  // 11. 2차: 세계 지도(이웃 나라 통치 가문)·외교(혼인 동맹·동맹·선전포고·화친)·정복 속령·왕실 단절 계승
  const world2=(()=>{const x=engine.createWorld(11,100),X=x.S;x.dynStart();const pick=ks=>p=>(p.opts.find(o=>ks.includes(o.k))||p.opts[0]).k;const st={kinds:{}};
    drive(x,300,pick(['take','annex','fight']),st);const me=X.byId.get(X.dyn.pid);if(!X.gov){me.cash+=1e7;crownForCheck(x)}else X.gov.chief=me.id;
    const v=x.dynView().world;assert(v.known&&v.realms.length===3,'이웃 나라 3곳');for(const r of v.realms){assert(r.ruler.name&&r.regName&&r.title,'통치자·체제 표시');assert(r.ruler.traits,'권력자는 통치자 성향을 앎')}
    // 혼인 동맹: 상대가 우리 마을로 와서 배우자가 된다
    const sp=me.partner&&X.byId.get(me.partner);if(sp){sp.partner=null;me.partner=null}
    let wed=null;for(let i=0;i<40&&!wed;i++){X.dyn.cool={};const a=x.dynActions().find(a=>a.k.startsWith('dip:wed:'));assert(a&&a.ok,a&&a.why);const r=x.dynAct(a.k);if(/혼인했다/.test(r.text))wed=a.k.split(':')[2]}
    assert(wed,'혼인 동맹 성사');const R1=X.dyn.realms[wed],sp2=X.byId.get(R1.kin.spouse);assert(sp2&&sp2.partner===me.id&&me.partner===sp2.id&&sp2.royal===wed,'사돈 배우자');
    // 왕실 단절 → 계승권 선택지 → 속령(계승)
    R1.regime='mon';R1.heir=null;R1.ruler.born=X.day-200*YEAR;drive(x,120,pick(['take']),st);assert(R1.prov&&R1.prov.how==='union','계승 합병');
    // 선전포고 → 승리 → 정복 선택지 → 속령(정복), 인재 이주, 수용 한도 증가
    const t=X.trade.towns.find(z=>!X.dyn.realms[z.name].prov);const pop0=X.agents.filter(a=>a.alive).length,cap0=X.cap;
    X.dyn.cool={};X.war=null;X.gov.chief=me.id;X.mil=X.mil||{lvl:2,str:5,morale:.6};X.mil.str=Math.max(X.mil.str||0,5);x.dynAct('dip:war:'+t.name);assert(X.war&&X.war.t===t.name&&X.war.by==='us','선전포고');
    for(let i=0;i<60&&X.war;i++){X.war.score=100;X.gov.chief=me.id;drive(x,1,pick(['annex']),st)}drive(x,1,pick(['annex']),st);
    const R2=X.dyn.realms[t.name];assert(R2.prov&&R2.prov.how==='war','정복 속령');assert(X.agents.filter(a=>a.from===t.name).length>=10,'인재 이주');assert(X.cap>cap0,'수용 한도 증가');
    // 속령은 세금을 내고 우리와 전쟁하지 않는다
    const tre0=X.gov.tre;drive(x,30,pick(['annex','take']),st);assert(R2.prov?R2.prov.tax>0:true,'속령 세금');assert(!(X.war&&X.dyn.realms[X.war.t]?.prov),'속령과 전쟁 없음');
    // 화친: 다른 나라와 전쟁 중 배상금을 내고 끝낼 수 있다
    const t3=X.trade.towns.find(z=>!X.dyn.realms[z.name].prov);if(t3&&!X.war){X.gov.chief=me.id;X.gov.tre=1e9;X.gov.bud={d:X.day,total:7e9,lines:Object.fromEntries(['adm','welf','pub','def','pol','edu','health'].map(k=>[k,1e9])),spent:{}};X.dyn.cool={};X.mil.str=Math.max(X.mil.str||0,5);x.dynAct('dip:war:'+t3.name);X.gov.tre+=1e6;let ok=false;for(let i=0;i<20&&!ok;i++){X.dyn.cool={};const r=x.dynAct('dip:peace:'+t3.name);ok=/화친했다/.test(r.text)}assert(ok&&!X.war,'화친')}
    const s1=JSON.stringify(x.exportState());const y=engine.createWorld(11,100);y.importState(JSON.parse(s1));assert.deepEqual(y.S.dyn.realms,X.dyn.realms,'세계 상태 저장 왕복');assert.equal(y.S.dyn.wr,X.dyn.wr);
    return {wed,union:R1.name,conquered:t.name,migrants:X.agents.filter(a=>a.from===t.name).length,cap:[cap0,X.cap],pop:[pop0,X.agents.filter(a=>a.alive).length],news:(X.dyn.wnews||[]).length}})();
  console.log(JSON.stringify({world2}));
  // 12. 2차 6·7단계와 [2] 사건: 성장 칭호, 첩보 보고·감시, 정적 뒷조사, 포섭 제안, 이웃의 혼인 동맹 제안, 암살 위협
  const spy2=(()=>{const x=engine.createWorld(11,100),X=x.S;x.dynStart();const st={kinds:{}};const pick=ks=>p=>(p.opts.find(o=>ks.includes(o.k))||p.opts[0]).k;
    drive(x,300,pick(['take','annex']),st);const me=X.byId.get(X.dyn.pid);if(!X.gov){me.cash+=1e7;crownForCheck(x)}else X.gov.chief=me.id;
    const push=(kind,opts,ctx)=>{const p={id:X.dyn.nextP++,kind,d:X.day,text:kind,opts:opts.map(k=>({k,label:k})),ctx};X.dyn.pending.push(p);return p};const ch=(p,k)=>x.dynChoose(p.id,k).text;
    // 성장 칭호: 속령 인구가 크면 읍·성으로
    const t=X.trade.towns[0];X.dyn.realms[t.name].prov={d:X.day,how:'war',old:'mon',unrest:0};t.pop=3000;const tier0=X.dyn.tier??0;drive(x,16,pick(['ok']),st);assert(X.dyn.tier>tier0,'성장 칭호 오름');assert(/우리 (읍|성)/.test(x.dynView().world.us.name),'칭호 표시');
    // 첩보 보고: 1년마다(권력자) / 감시하면 쿠데타 차단
    let intel=0;for(let i=0;i<61;i++){X.gov.chief=me.id;while(X.dyn.pending.length){const p=X.dyn.pending[0];if(p.kind==='intel')intel++;x.dynChoose(p.id,p.opts.some(o=>o.k==='watch')?'watch':p.opts[0].k)}x.step()}assert(intel>=1,'첩보 보고');
    budgetForCheck(x);X.gov.chief=me.id;const sus=X.agents.find(a=>a.alive&&a.id!==me.id&&isA(a));const pi=push('intel',['arrest','watch','bribe','ignore'],{who:sus.id,truth:false});const ap=X.gov.approval??.5;assert(/잡아들였/.test(ch(pi,'arrest')));assert(sus.jailUntil>X.day&&(X.gov.approval??.5)<=ap,'무고 구금 → 지지율');
    const pw=push('intel',['watch'],{who:sus.id,truth:true});ch(pw,'watch');assert(X.dyn.watched[sus.id]>X.day,'감시');
    // 정적 뒷조사 → 약점 폭로
    const rv=X.agents.find(a=>a.alive&&a.id!==me.id&&isA(a)&&!x.dynView().family.kids.some(k=>k.id===a.id));rv.crimes=(rv.caught||0)+2;const r0=rv.rep??1;const pd=push('dirt',['expose','black','keep'],{who:rv.id});ch(pd,'expose');assert((rv.rep??1)<r0,'폭로 → 평판↓');
    // 포섭 제안(외국 간첩 → 이중간첩)
    const pf=push('fspy',['yes','no','report'],{t:X.trade.towns[1].name});ch(pf,'yes');assert(me.spy===X.trade.towns[1].name,'외국 간첩');const pis=push('ispy',['yes','no'],{});assert(/이중간첩/.test(ch(pis,'yes'))&&!me.spy&&X.dyn.informant,'이중간첩');
    // 이웃이 먼저 청한 혼인 동맹
    const sp=me.partner&&X.byId.get(me.partner);if(sp){sp.partner=null;me.partner=null}const t2=X.trade.towns[2];const pw2=push('fwed',['yes','no'],{t:t2.name,who:me.id});ch(pw2,'yes');assert(X.dyn.realms[t2.name].kin&&me.partner,'이웃의 혼인 동맹 제안');
    // 암살 위협 → 경호
    const pa=push('assn',['guard','ignore'],{});ch(pa,'guard');assert(X.dyn.guardUntil>X.day&&me.alive,'경호');
    // 첩보 행동 목록(의원·귀족 이상)
    const acts=x.dynActions().filter(a=>a.group==='첩보').map(a=>a.k);assert(acts.includes('spy:rival')&&acts.some(k=>k.startsWith('spy:realm:')),'첩보 행동');
    const s1=JSON.stringify(x.exportState());const y=engine.createWorld(11,100);y.importState(JSON.parse(s1));assert.deepEqual(y.S.dyn,JSON.parse(JSON.stringify(X.dyn)),'저장 왕복');
    return {tier:X.dyn.tier,intel,acts:acts.length}})();
  console.log(JSON.stringify({spy2}));
  // 13. [2] 나머지: 평판 공격·청부 살인·사건 덮기·배당·증자·왕위 계승권 주장·왕자의 난
  const more2=(()=>{const x=engine.createWorld(7,150),X=x.S;x.dynStart();const st={kinds:{}};const pick=ks=>p=>(p.opts.find(o=>ks.includes(o.k))||p.opts[0]).k;
    drive(x,900,pick(['no','ok','forgive','report']),st);const me=X.byId.get(X.dyn.pid);assert(me&&me.alive,'내 캐릭터 생존');me.cash+=1e6;const out={};
    const act=pre=>{X.dyn.cool={};const a=x.dynActions().find(a=>a.k.startsWith(pre));assert(a,pre+' 없음');assert(a.ok,pre+': '+a.why);return x.dynAct(a.k).text};
    const sm=x.dynActions().find(a=>a.k.startsWith('ext:smear:'));const tg=X.byId.get(Number(sm.k.split(':')[2]));const r0=tg.rep??1;out.smear=act('ext:smear:');assert((tg.rep??1)<r0||(me.rep??1)<1,'평판 공격 결과');
    const hk=x.dynActions().find(a=>a.k.startsWith('ext:hit:'));out.hit=act('ext:hit:');
    if(X.gov){X.gov.cases.push({t:'tax',who:me.id,amt:1,ev:.5,d:X.day});out.fix=act('ext:fix')}
    // 대주주 회사: 회사를 하나 만들어 지분 30% 이상 갖게 한다
    const f=X.firms.find(z=>z.alive!==false);if(f){const tot=engine.votingShares?engine.votingShares(f):Object.values(f.sh).reduce((t,v)=>t+v,0);f.sh[String(me.id)]=(f.sh[String(me.id)]||0)+Math.ceil(tot*.5);f.cash=(f.cash||0)+1e5;const c0=me.cash;out.div=act('ext:div:');assert(/배당/.test(out.div));out.rights=act('ext:rights:')}
    // 왕위 계승권 주장: 군주정 공위
    if(!X.gov){crownForCheck(x)}X.gov.regime='mon';X.gov.interregnum={since:X.day,previous:null};X.gov.chief=null;let crowned=false;for(let i=0;i<20&&!crowned;i++){act('ext:claim');crowned=X.gov.chief===me.id}assert(crowned,'계승권 주장');
    // 왕자의 난: 왕위를 노리는 자식 → 선택지
    const kid=X.agents.find(a=>a.alive&&a.id!==me.id&&a.age>=18*YEAR);kid.g.boss=1;kid.parents=[me.id];me.kids.push(kid.id);X.gov.royalRivals=[kid.id];let asked=false;
    for(let i=0;i<400&&!asked;i++){X.gov.nextRoyalDispute=X.day;X.gov.chief=me.id;x.step();const p=X.dyn.pending.find(p=>p.kind==='prince');if(p){asked=true;out.prince=x.dynChoose(p.id,'reconcile').text}while(X.dyn.pending.length)x.dynChoose(X.dyn.pending[0].id,X.dyn.pending[0].opts[0].k)}
    assert(asked,'왕자의 난 선택지');return out})();
  console.log(JSON.stringify({more2}));
  // 14. 화면 개편 기능: 가게 짓기(완공 → 내 건물), 인물 대상 행동(고용·해고·선물), 법안 전체(숫자·시행 정책 발의 → 의회 표결)
  const ui3=(()=>{const x=engine.createWorld(7,150),X=x.S;x.dynStart();const st={kinds:{}};const pick=ks=>p=>(p.opts.find(o=>ks.includes(o.k))||p.opts[0]).k;
    drive(x,700,pick(['no','ok','forgive']),st);const me=X.byId.get(X.dyn.pid);assert(me&&me.alive);me.cash+=1e5;const out={};
    const b0=X.bldgs.filter(b=>b.owner===me.id).length;X.dyn.cool={};out.build=x.dynAct('biz:build:b1').text;drive(x,90,pick(['no','ok']),st);assert(X.bldgs.some(b=>b.owner===me.id&&b.fx.includes('b1')),'식당 완공');
    const ok2=a=>a.alive&&a.id!==me.id&&isA(a)&&!a.firm&&!a.civ&&!a.study&&!a.soldier&&!(X.gov&&(X.gov.chief===a.id||X.gov.king===a.id));const t=X.agents.find(a=>ok2(a)&&!a.emp)||X.agents.find(ok2);const ta=x.dynTargetActions(t.id).map(a=>a.k);assert(ta.includes('tgt:hire:'+t.id)&&ta.includes('tgt:gift:'+t.id),'대상 행동');
    let hired=false;for(let i=0;i<60&&!hired;i++){x.dynAct('tgt:hire:'+t.id);hired=t.emp===me.id}assert(hired&&t.ct&&t.ct.e===me.id,'고용 계약');drive(x,10,pick(['no','ok']),st);assert(t.emp===me.id,'고용 유지');
    x.dynAct('tgt:fire:'+t.id);assert(!t.emp&&!t.ct,'해고');const tie0=(X.dyn.ties?.[t.family]?.v)||0;x.dynAct('tgt:gift:'+t.id);assert(X.dyn.ties[t.family].v>tie0,'선물 관계');
    if(!X.gov){me.cash+=1e7;crownForCheck(x)}else X.gov.chief=me.id;const laws=x.dynActions().filter(a=>a.k.startsWith('law2:'));assert(laws.length>=30,'법안 '+laws.length+'개');
    const num=laws.find(a=>a.opts.some(o=>o[0]==='up'));const k=num.k.split(':')[1];const v0=X.gov.policy[k];X.dyn.cool={};X.gov.council=[];out.law=x.dynAct(num.k+':up').text;assert(X.gov.policy[k]>v0,'통치자 결정으로 올림');
    const bl=laws.find(a=>typeof X.gov.policy[a.k.split(':')[1]]==='boolean');const k2=bl.k.split(':')[1];const b2=X.gov.policy[k2];x.dynAct(bl.k+':'+bl.opts[0][0]);assert(X.gov.policy[k2]===!b2,'시행/폐지');
    out.laws=laws.length;return out})();
  console.log(JSON.stringify({ui3}));
  // 성향 사건은 자녀 외 인물도 이어받고, 선택 수치와 가문 목표는 저장에 남는다.
  {
    const w=engine.createWorld(21,120),S=w.S;w.dynStart();w.dynSetStory(2);
    const D=S.dyn,me=S.byId.get(D.pid);
    while(D.pending.length){const p=D.pending[0];w.dynChoose(p.id,p.opts[0].k)}
    const others=S.agents.filter(a=>a!==me&&a.alive&&a.age>=18*YEAR);
    const witness=others[0];
    for(const a of others)a.g.cheat=.9;
    witness.g.cheat=me.g.cheat=.1;me.partner=witness.id;witness.partner=me.id;
    assert(!me.kids.includes(witness.id),'자녀 외 증인');
    const {SE,sCtx}=w._story;
    assert.equal(SE.honestLedger.who(sCtx(me,{})),witness);
    const put=(sid,ctx)=>{
      ctx={...ctx,sid};
      const e=SE[sid],id=D.nextP++;
      D.pending.push({id,kind:'story',d:S.day,ctx,text:e.text(sCtx(me,ctx)),opts:e.o.map(([k,label])=>({k,label}))});
      return id
    };
    const p=put('honestLedger',{x:witness.id});
    const stress=w.dynView().pending[0].opts.find(o=>o.k==='cover').stress.points;
    assert(stress>0);
    const result=w.dynChoose(p,'cover');
    assert(result.changes.some(c=>c.key==='stress'&&c.amount===stress));
    assert(result.changes.some(c=>c.key==='rep'&&c.amount===-4));
    for(const [sid,k] of [['honestWitness','hear'],['honestPressure','promise'],['honestReview','publish']]){
      const q=D.story.q.shift();assert.equal(q.id,sid);assert.equal(q.ctx.x,witness.id);
      w.dynChoose(put(sid,q.ctx),k)
    }
    assert.equal(D.story.q[0].id,'honestLegacy');
    me.cash+=1e8;w.dynAct('goal:rich');
    assert(w.dynView().goals.find(g=>g.key==='rich').ready);
    w.dynAct('goal:claim:rich');
    assert.throws(()=>w.dynAct('goal:claim:rich'));
    const y=engine.createWorld(22,120);y.importState(JSON.parse(JSON.stringify(w.exportState())));
    assert.deepEqual(y.S.dyn.story.q,D.story.q);
    assert.equal(y.dynView().stress,stress);
    assert(y.dynView().goals.find(g=>g.key==='rich').claimed);
    console.log(JSON.stringify({personalityStory:true,goalReward:true}))
  }
  // 15. 이야기 사건: 표의 모든 사건·선택지가 오류 없이 실행되고, 자동 플레이에서 설정된 사건 간격을 따른다
  engine.keepStory=true;
  const story=(()=>{const x=engine.createWorld(11,100),X=x.S;x.dynStart();const st={kinds:{}};drive(x,500,p=>(p.opts.find(o=>['take','annex'].includes(o.k))||p.opts[0]).k,st);
    const me=X.byId.get(X.dyn.pid);if(!X.gov){me.cash+=1e6;crownForCheck(x)}else X.gov.chief=me.id;me.cash+=1e6;const {SE,sCtx,sRealm}=x._story;let n=0;
    for(const id in SE){const e=SE[id];for(const o of e.o){const ctx={sid:id,title:e.title};const t=sRealm();if(t)ctx.t=t.name;let p=null;try{p=e.who?e.who(sCtx(me,ctx)):null}catch(er){}
      p=p||X.agents.find(a=>a.alive&&a.id!==me.id&&isA(a));ctx.x=p.id;ctx.y=X.agents.find(a=>a.alive&&a.id!==me.id&&a.id!==p.id&&isA(a)).id;ctx.amt=100;
      if(!x._story.dynStoryEligible(e,me))continue;const valid=x._story.dynStoryContext(e,me,ctx);if(!valid)continue;const c=sCtx(me,valid);if(o[4]?.when&&!o[4].when(c))continue;if(X.gov){X.gov.tre=1e9;X.gov.bud={d:X.day,total:7e9,lines:Object.fromEntries(['adm','welf','pub','def','pol','edu','health'].map(k=>[k,1e9])),spent:{}}}me.cash=1e9;assert.equal(typeof e.text(c),'string',id);if(typeof o[2]==='function')o[2](c);assert.equal(typeof o[3](sCtx(me,valid)),'string',id+':'+o[0]);n++}if(!me.alive)break}
    const y=engine.createWorld(3,100),Y=y.S;y.dynStart();const s2={kinds:{}};drive(y,1200,p=>p.opts[p.id%p.opts.length].k,s2);const cnt=s2.kinds.story||0;
    assert(cnt>=1200/12&&cnt<=1200/4,'사건 빈도 '+cnt);const z=engine.createWorld(3,100);z.importState(JSON.parse(JSON.stringify(y.exportState())));assert.deepEqual(z.S.dyn.story,Y.dyn.story,'사건 상태 저장 왕복');
    return {options:n,events:Object.keys(SE).length,in1200days:cnt}})();
  console.log(JSON.stringify({story}));
  // 5. 원래 마을 불변: 기준 커밋 엔진과 같은 시드·인구로 돌린 exportState가 완전히 같아야 한다.
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'dyn-base-'));const baseFile=path.join(tmp,'engine.js');
  fs.writeFileSync(baseFile,process.env.CHECK_BASE_ENGINE?fs.readFileSync(process.env.CHECK_BASE_ENGINE):execFileSync('git',['show',base+':engine.js'],{cwd:root,maxBuffer:8*1024*1024}));
  const old=require(baseFile);
  const cases=quick?[[7,300,600]]:[[7,300,3000],[20261116,5000,50]];
  for(const [seed,n,days] of cases){const t=Date.now();
    const a=old.createWorld(seed,n),b=engine.createWorld(seed,n);
    for(let i=0;i<days;i++){a.step();b.step()}
    const ja=JSON.stringify(a.exportState()),jb=JSON.stringify(b.exportState());
    assert(!('dyn' in b.S),'원래 마을에는 S.dyn 없음');assert.equal(jb,ja,`원래 마을 불변 실패 (시드 ${seed}, ${n}명, ${days}일)`);
    console.log(JSON.stringify({invariant:{base,seed,population:n,days,bytes:ja.length,identical:true,ms:Date.now()-t}}));
  }
  fs.rmSync(tmp,{recursive:true,force:true});
}
main();
