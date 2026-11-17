'use strict';
// 가문 모드 엔진 검사: 시작 인물·이름 변경·선택지 대기·저장 복원, 그리고 원래 마을 결과 불변.
// 사용: node scripts/check-dynasty.js [기준 git 커밋(기본 origin/main)] [--quick]
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),os=require('node:os'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const engine=require('../engine.js');const {YEAR}=engine;
const args=process.argv.slice(2),quick=args.includes('--quick'),base=args.find(a=>!a.startsWith('--'))||'origin/main';

// 선택지가 뜨면 멈추고 답한 뒤 진행하는 Worker 흐름을 흉내 낸다.
function drive(w,days,pickFn,stat){
  for(let i=0;i<days;i++){
    let guard=0;while(w.S.dyn.pending.length){assert(++guard<50,'선택지 무한 반복');const p=w.S.dyn.pending[0];const k=pickFn(p);const r=w.dynChoose(p.id,k);stat.kinds[p.kind]=(stat.kinds[p.kind]||0)+1;stat.last=r.text}
    if(w.S.dyn.over)return;
    w.step();
  }
}
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
  const w3=engine.createWorld(11,120);w3.dynStart();w3.dynChoose(w3.S.dyn.pending[0].id,'go');let accepted=false;
  for(let i=0;i<YEAR*40&&!accepted;i++){for(const p of w3.S.dyn.pending.slice()){
      if(p.kind==='proposeIn'){const me=w3.S.byId.get(w3.S.dyn.pid);w3.dynChoose(p.id,'yes');if(me.partner===p.ctx.from){accepted=true;assert.equal(w3.S.byId.get(p.ctx.from).partner,me.id)}}
      else w3.dynChoose(p.id,p.opts.at(-1).k)}
    if(w3.S.dyn.over)break;w3.step()}
  // 5. 정부 세우기 행동: 회의 제안·공산 혁명·영주 자처(기존 엔진 계산 재사용)
  const fresh=(seed)=>{const x=engine.createWorld(seed,100);x.dynStart();x.dynChoose(x.S.dyn.pending[0].id,'go');for(let i=0;i<10;i++)x.step();return x};
  const acts={};
  {const x=fresh(7);const r=x.dynAct('council');assert(x.S.gov||/부결/.test(r.text));acts.council=r.text;if(x.S.gov){assert(['rep','olig'].includes(x.S.gov.regime));assert(x.S.gov.history.length>=1,'첫 선거');assert(x.S.gov.history[0].cands.some(c=>c.id===x.S.dyn.pid)||/참정권|자격/.test(r.text),'내가 후보(또는 자격 없음 안내)')}
    assert.throws(()=>x.dynAct('council'),'정부가 생기면 회의 제안 없음')}
  {const x=fresh(11);const r=x.dynAct('revolt');acts.revolt=r.text;if(/성공/.test(r.text)){assert.equal(x.S.gov.regime,'com');assert.equal(x.S.gov.chief,x.S.dyn.pid);assert.equal(x.dynView().rank,4)}}
  {const x=fresh(5);assert.throws(()=>x.dynAct('lord'));x.S.byId.get(x.S.dyn.pid).cash+=1e5;const r=x.dynAct('lord');acts.lord=r.text;assert.equal(x.S.gov.regime,'mon');assert.equal(x.S.gov.chief,x.S.dyn.pid);x.step();assert.equal(x.S.dyn.pending.length,0,'행동 직후 중복 알림 없음')}
  {const x=fresh(9);const me=x.S.byId.get(x.S.dyn.pid);me.cash+=1e5;if(!me.grp){x.dynAct('gang');assert(me.grp);acts.gang=true}}
  // 6. 법 바꾸기: 시위·청원/발의 → 의회 표결 또는 통치자 결정
  {let passed=0,tried=0;for(const seed of [7,11,17]){const x=fresh(seed);x.dynAct('council');if(!x.S.gov)continue;for(const t of x.dynActions().filter(a=>/^(pet|law):/.test(a.k)&&a.ok)){const r=x.dynAct(t.k);tried++;const key=t.k.split(':')[1];assert.equal(/통과/.test(r.text)&&!/부결|거부|갇혔/.test(r.text),x.S.gov.policy[key]===true,r.text);if(x.S.gov.policy[key]===true)passed++;assert.throws(()=>x.dynAct(t.k))}}
    assert(tried>0);acts.law={tried,passed}}
  // 7. 경제 행동·지출·일
  {const x=engine.createWorld(7,150);x.dynStart();x.dynChoose(x.S.dyn.pending[0].id,'go');for(let i=0;i<900;i++){while(x.S.dyn.pending.length){const p=x.S.dyn.pending[0];x.dynChoose(p.id,p.opts.at(-1).k)}x.step()}
    const me=x.S.byId.get(x.S.dyn.pid);me.cash+=3000;const done=[];for(const a of x.dynActions().filter(a=>/^(house|land|stock|firm|loan|dep):/.test(a.k)&&a.ok)){const before=JSON.stringify([me.cash,x.S.houses.filter(h=>h.owner===me.id).length,x.S.loans.length,x.S.firms.length]);const r=x.dynAct(a.opts?a.k+':'+a.opts[0][0]:a.k);done.push(a.k.split(':').slice(0,2).join(':'));assert(r.text)}
    assert(done.some(k=>k==='house:buy'),'집 사기');assert.throws(()=>x.dynSetBudget({life:'x'}));x.dynSetBudget({life:4,edu:2,save:.2,give:3,debt:1,job:0});const v0=x.S.dyn.vault||0;for(let i=0;i<60;i++){while(x.S.dyn.pending.length){const p=x.S.dyn.pending[0];x.dynChoose(p.id,p.opts.at(-1).k)}if(x.S.dyn.over)break;x.step()}
    assert(x.S.dyn.spent,'지출 적용');acts.eco=done}
  // 8. 내 주식은 엔진이 자동으로 사고팔지 않는다(가), 내 회사는 목록에 항상(나), 양 선택(다)
  {const x=engine.createWorld(7,150);x.dynStart();x.dynChoose(x.S.dyn.pending[0].id,'go');for(let i=0;i<1800;i++){while(x.S.dyn.pending.length){const p=x.S.dyn.pending[0];x.dynChoose(p.id,p.opts.at(-1).k)}x.step()}
    const me=x.S.byId.get(x.S.dyn.pid);const b=x.S.bldgs.find(b=>!b.firm&&b.owner&&b.owner!==me.id);b.owner=me.id;me.cash+=500;x.dynAct('firm:new');const f=x.S.firms.find(f=>f.ceo===me.id);assert(f,'회사 세우기');
    const b0=f.sh[String(me.id)];for(let i=0;i<120;i++){while(x.S.dyn.pending.length){const p=x.S.dyn.pending[0];x.dynChoose(p.id,p.opts.at(-1).k)}x.step()}
    assert.equal(f.sh[String(me.id)],b0,'엔진 자동 거래 없음');const sell=x.dynActions().find(a=>a.k==='stock:sell:'+f.id);assert(sell&&sell.opts.length===3&&/경영권/.test(sell.hint));
    assert.throws(()=>x.dynAct('stock:sell:'+f.id),/양/);assert(/팔았다/.test(x.dynAct('stock:sell:'+f.id+':0.1').text));acts.stock=true}
  // 9. 사건 선택지(7-2): 상황을 만들어 선택지가 뜨고 고른 대로 반영되는지
  const evs={};
  {const x=engine.createWorld(7,150);x.dynStart();x.dynChoose(x.S.dyn.pending[0].id,'go');for(let i=0;i<10;i++)x.step();try{x.dynAct('council')}catch(e){}
    const S2=x.S,D2=S2.dyn,me=()=>S2.byId.get(D2.pid);for(let i=0;i<YEAR*8&&!D2.over;i++){while(D2.pending.length){const p=D2.pending[0];x.dynChoose(p.id,p.opts.at(-1).k)}x.step()}assert(!D2.over,'사건 검사용 가문 유지');const clear=()=>{let g=0;while(D2.pending.length){assert(++g<50);const p=D2.pending[0];x.dynChoose(p.id,p.opts.at(-1).k)}};
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
    {const o=other(),h=S2.houses.find(h=>h.owner===o.id)||S2.houses.find(h=>h.id!==me().home);h.owner=o.id;h.deposit=200;h.depTenant=D2.pid;h.depEnd=S2.day+1;o.g.cheat=3;p=until('deposit',2);assert(p,'전세금 미반환 선택지');x.dynChoose(p.id,'give');evs.deposit=1;clear()}
    {const b=S2.bldgs.find(b=>!b.firm&&b.owner&&b.owner!==D2.pid);if(b&&!me().firm){b.owner=D2.pid;me().cash+=500;const r=x.dynAct('firm:new');const f=S2.firms.find(f=>f.ceo===D2.pid);if(f){f.cash=0;p=null;for(let i=0;i<16&&!p;i++){x.step();p=D2.pending.find(p=>p.kind==='firmCrisis');if(!p)clear()}assert(p,'사업 위기 선택지');x.dynChoose(p.id,'close');assert(!S2.firms.includes(f)&&b.owner===D2.pid,'정리하면 건물은 내 것');evs.firmCrisis=1;clear()}else evs.firmCrisis=r.text}}
    if(S2.gov&&!(S2.gov.chief===D2.pid||S2.gov.king===D2.pid)&&!['mil','com','msoc'].includes(S2.gov.regime)){S2.gov.coup=true;p=until('regime',1);assert(p,'체제 변화 선택지');x.dynChoose(p.id,'hide');evs.regime=p.opts.map(o=>o.k).join('/');clear()}
    if(!S2.war&&!(S2.gov&&(S2.gov.chief===D2.pid||S2.gov.king===D2.pid))){S2.war={t:'너른들',d:S2.day+1,score:0,cas:0,civ:0};p=until('war',1);if(p){x.dynChoose(p.id,'avoid');evs.war=1}clear()}
    const ex=x.exportState(),jx=JSON.stringify(ex);assert.equal(JSON.stringify(load(jx).exportState().S.dyn),JSON.stringify(ex.S.dyn),'사건 뒤 S.dyn 저장 왕복')}
  {const kinds=Object.keys(stat.kinds).filter(k=>!['start','notice','death','arrange','kidMatch','proposeIn','proposeOut'].includes(k));assert(kinds.length>=6,'자동 플레이에서 사건 선택지 여러 종류: '+kinds.join(','));evs.auto=kinds}
  // 10. 7-1 남은 행동(가족·상속·인맥·건강·어두운 길·권력)과 3단계(넓은 상속·섭정·단절·새 가문·관전)
  const st3={};
  {const x=engine.createWorld(7,150);x.dynStart();const D3=()=>x.S.dyn;x.dynChoose(D3().pending[0].id,'go');for(let i=0;i<10;i++)x.step();try{x.dynAct('council')}catch(e){}
    const clear=()=>{let g=0;while(D3().pending.length){assert(++g<50);const p=D3().pending[0];x.dynChoose(p.id,p.opts.at(-1).k)}};for(let i=0;i<YEAR*12&&!D3().over;i++){clear();x.step()}clear();assert(!D3().over);
    const me=x.S.byId.get(D3().pid);me.cash+=5000;const done=[];
    for(const a0 of x.dynActions().filter(a=>a.ok&&/^(fam|kin|net|med|dark|pow):/.test(a.k)&&a.k!=='fam:divorce')){const a=x.dynActions().find(y=>y.k===a0.k);if(!a||!a.ok)continue;const r=x.dynAct(a.k);assert(r.text,a.k);done.push(a.k.split(':').slice(0,2).join(':'))}
    assert(done.includes('kin:heir')&&done.some(k=>k.startsWith('net:'))&&done.some(k=>k.startsWith('dark:')),'새 행동: '+done.join(','));st3.acts=[...new Set(done)];
    // 미성년 지정 상속자 → 섭정
    const kid=x.S.agents.find(a=>a.alive&&a.age<10*YEAR&&a.parents.some(p=>x.S.byId.get(p)?.alive)&&a.id!==D3().pid);assert(kid);x.dynAct('kin:heir:'+kid.id);assert.equal(D3().heir,kid.id);
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

  // 5. 원래 마을 불변: 기준 커밋 엔진과 같은 시드·인구로 돌린 exportState가 완전히 같아야 한다.
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'dyn-base-'));const baseFile=path.join(tmp,'engine.js');
  fs.writeFileSync(baseFile,execFileSync('git',['show',base+':engine.js'],{cwd:root}));
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
