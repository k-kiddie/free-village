const assert=require('node:assert/strict');
const {createWorld}=require('../engine.js');
const ad=w=>w.S.agents.filter(a=>a.alive&&a.age>=14*60);
function cult(seed,docs,n=150,frac=.7){const w=createWorld(seed,n);w.dynStart();w.dynConfigureStart({age:30});const S=w.S,me=S.byId.get(S.dyn.pid);me.cash=1e6;
  w.dynAct(`extra:found:${docs}:`);const fa=S.faiths.find(f=>f.leader===me.id);const xs=ad(w);for(const a of xs.slice(0,Math.floor(xs.length*frac)))a.faith=fa.id;return {w,S,me,fa}}
const run=(w,d)=>{for(let i=0;i<d;i++){w.step();for(const p of w.S.dyn.pending.slice())try{w.dynChoose(p.id,p.opts[0].k)}catch(e){}}};
// 1) 창시: 이단 교리 목록·충돌 규칙
{const w=createWorld(1201,100);w.dynStart();w.dynConfigureStart({age:30});const me=w.S.byId.get(w.S.dyn.pid);me.cash=1e6;
  const spec=w.dynActions().find(a=>a.k==='extra:found').faithSpec;assert.equal(spec.docs.filter(d=>d.x).length,21,'이단 교리 21개');assert.throws(()=>w.dynAct('extra:found:nude+mirror:'),/함께 고를 수 없습니다/);
  assert.throws(()=>w.dynAct('extra:found:celibate+breed:'),/함께 고를 수 없습니다/);assert.throws(()=>w.dynAct('extra:found:lust+freelove:'),/하나만/);
  w.dynAct('extra:found:doom+chosen:');const fa=w.S.faiths.find(f=>f.leader===me.id);assert(fa.doomD>w.S.day,'종말 날짜');assert(/종말교$/.test(fa.name),'이단 교리 이름');
  assert(w.dynView().faithInfo.heresy.length===2,'화면에 이단 표시')}
// 2) 번영: 헌금이 쌓이고 신도 성향이 탐욕스러워짐
{const {w,fa}=cult(1202,'prosper+work');const t0=fa.tre,c0=ad(w).filter(a=>a.faith===fa.id).reduce((t,a)=>t+a.g.cheat,0);run(w,95);assert(fa.tre>t0,'번영 헌금');
  const ms=ad(w).filter(a=>a.faith===fa.id);assert(ms.reduce((t,a)=>t+a.g.cheat,0)/ms.length>c0/Math.max(1,ms.length)*.9,'탐욕 성향 유지·상승')}
// 3) 향락: 중독자가 생김
{const {w,fa}=cult(1203,'hedon+equal');run(w,200);assert(ad(w).some(a=>a.faith===fa.id&&a.addict),'향락 중독')}
// 4) 다산: 같은 시드에서 출생이 뚜렷이 많음
{const a=cult(1204,'breed+work',200,.9),b=cult(1204,'work+equal',200,.9);run(a.w,600);run(b.w,600);const ba=a.S.tot.births,bb=b.S.tot.births;console.log('출생(다산/일반)',ba,bb);assert(ba>bb*1.15,'다산 교리 출생 증가')}
// 5) 종말: 날짜가 되면 종말의 날 사건
{const {w,S,fa}=cult(1205,'doom+obey');fa.doomD=S.day+12;w.dynSetStory(2);S.dyn.story.next=S.day+999;let p=null;for(let i=0;i<40&&!p;i++){w.step();p=S.dyn.pending.find(x=>x.ctx&&x.ctx.sid==='xDoomDay');if(!p)for(const q of S.dyn.pending.slice())try{w.dynChoose(q.id,q.opts[0].k)}catch(e){}}
  assert(p&&/⭐/.test(p.ctx.title),'종말의 날 특별 사건');w.dynChoose(p.id,'confess');assert(!fa.doc.includes('doom'),'고백하면 종말 교리 폐기')}
// 6) 계단: 헌금이 쌓이고 흔들리면 붕괴 사건
{const {w,S,fa}=cult(1206,'ladder+work');run(w,70);assert((fa.ladder||0)>0,'계단 헌금 누적');fa.ladderShaky=S.day;w.dynSetStory(2);S.dyn.story.next=S.day+999;let p=null;for(let i=0;i<20&&!p;i++){w.step();p=S.dyn.pending.find(x=>x.ctx&&x.ctx.sid==='xLadderCollapse');if(!p)for(const q of S.dyn.pending.slice())try{w.dynChoose(q.id,q.opts[0].k)}catch(e){}}
  assert(p,'계단 붕괴 사건');w.dynChoose(p.id,'bail');assert(!fa.ladderShaky,'수습')}
// 7) 선민·피의 보복: 폭력 사건이 쌓임
{let feud=0;for(const sd of [1207,1307,1407]){const {w,fa}=cult(sd,'chosen+vendetta');run(w,400);feud+=fa.feud||0;if(feud)break}assert(feud>0,'피의 보복 발생')}
// 8) 저장 복원
{const {w,fa}=cult(1208,'doom+ladder');run(w,40);const b=createWorld(1,1);b.importState(JSON.parse(JSON.stringify(w.exportState())));const f2=b.S.faiths.find(f=>f.id===fa.id);assert(f2.doomD===fa.doomD&&f2.doc.includes('ladder'),'이단 교단 저장 복원')}
// 9) 2차 교리: 현인신 지지율·꿈 계시·공유 분배·맨몸 겨울·주사위 선택지
{const {w,S,me,fa}=cult(1209,'godking+obey');me.cash=1e7;for(const a of w.S.agents){a.g.comply=1;a.g.civic=0}me.rep=1;w.dynAct('lord');run(w,35);assert((S.gov.approval??0)>=.45,'현인신 지지율 하한');}
{const {w,fa}=cult(1210,'dream+work');run(w,35);assert(fa.dreamRev&&w.dynView().faithInfo.dream,'이달의 계시')}
{const {w,S,fa}=cult(1211,'commune+work');const ms=()=>ad(w).filter(a=>a.faith===fa.id);for(const a of ms())a.cash=0;ms()[0].cash=1000;run(w,35);const cs=ms().map(a=>a.cash);assert(Math.max(...cs)<1000,'공유교 재산 분배')}
{const {w,S,me,fa}=cult(1212,'nude+equal');const fs=require('node:fs'),Module=require('node:module'),file=require.resolve('../engine.js'),m=new Module(file);m.filename=file;m.paths=module.paths;m._compile(fs.readFileSync(file,'utf8').replace('return{dynSetStory,','return{dynDocTick2,dynSetStory,'),file);const t=m.exports.createWorld(1212,100);t.importState(JSON.parse(JSON.stringify(w.exportState())));t.S.day=50;const f=t.S.faiths.find(x=>x.id===fa.id),members=ad(t).filter(a=>a.faith===f.id);f.nudeWinter='firm';for(const a of members)a.health=100;t.dynDocTick2(f,t.S.byId.get(t.S.dyn.pid),ad(t));assert(members.every(a=>a.health===96),'동일한 성인 신도의 맨몸 겨울 피해');f.nudeWinter='cloak';t.dynDocTick2(f,t.S.byId.get(t.S.dyn.pid),ad(t));assert(members.every(a=>a.health===96),'망토 허용 시 추가 겨울 피해 없음')}
{const {w,S,me}=cult(1213,'dice+work');w.dynSetStory(3);let p=null;for(let i=0;i<80&&!p;i++){for(const q of S.dyn.pending.slice())if(q.kind!=='story')try{w.dynChoose(q.id,q.opts[0].k)}catch(e){}w.step();p=S.dyn.pending.find(x=>x.kind==='story');}assert(p&&p.opts.some(o=>o.k==='__dice'),'주사위 선택지');const r=w.dynChoose(p.id,'__dice');assert(/🎲/.test(r.text),'주사위 결과')}
console.log('이단 교리 21개: 창시 규칙·번영·향락·다산·종말·계단·선민/보복·저장 복원 확인 완료');
