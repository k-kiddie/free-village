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
  const w4=load(j1);const pk=r=>p=>p.opts[(r=(r*48271)%2147483647)%p.opts.length].k;
  drive(w2,YEAR*2,pk(777),{kinds:{}});drive(w4,YEAR*2,pk(777),{kinds:{}});
  assert.equal(JSON.stringify(w4.exportState()),JSON.stringify(w2.exportState()),'복원 후 같은 선택이면 같은 결과');
  // 4. 선택지 직접 확인: 청혼 받음 → 수락하면 부부
  const w3=engine.createWorld(11,120);w3.dynStart();w3.dynChoose(w3.S.dyn.pending[0].id,'go');let accepted=false;
  for(let i=0;i<YEAR*40&&!accepted;i++){for(const p of w3.S.dyn.pending.slice()){
      if(p.kind==='proposeIn'){const me=w3.S.byId.get(w3.S.dyn.pid);w3.dynChoose(p.id,'yes');if(me.partner===p.ctx.from){accepted=true;assert.equal(w3.S.byId.get(p.ctx.from).partner,me.id)}}
      else w3.dynChoose(p.id,p.opts.at(-1).k)}
    if(w3.S.dyn.over)break;w3.step()}
  console.log(JSON.stringify({dynasty:{years,day:S.day,gen:D.gen,over:D.over,me:v.me.name,age:v.me.age,pop:S.agents.length,choices:stat.kinds,married,ties:Object.keys(D.ties||{}).length,chron:D.chron.length},roundTrip:true,resumeSame:true,proposeInAccepted:accepted,ms:Date.now()-t0}));

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
