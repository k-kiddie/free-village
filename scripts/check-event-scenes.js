'use strict';
const assert=require('node:assert/strict');
const {createWorld}=require('../engine');

const w=createWorld(1119,180);w.dynStart();w.dynConfigureStart({age:32,family:'children'});
const S=w.S,D=S.dyn,me=S.byId.get(D.pid),partner=S.byId.get(me.partner);
assert(partner&&partner.alive,'시작 가정의 배우자');
w.dynChoose(D.pending[0].id,'go');D.pending=[];
const {SE,sCtx,dynStoryContext,dynStoryPush}=w._story,event=SE.adultIntimacy;
const sceneStories=Object.values(SE).filter(x=>x.scene),sceneKinds=new Set(sceneStories.map(x=>x.scene).filter(x=>typeof x==='string'));
assert(sceneStories.length>=500,`기존 이야기 500개 이상 장면 연결 (${sceneStories.length})`);
const dynamicSceneKinds=sceneStories.filter(x=>typeof x.scene==='function').length?1:0;
assert.equal(sceneKinds.size,63,`고유 도트 장면 63종 (${sceneKinds.size})`);
assert.equal(dynamicSceneKinds,1,'업소 장면은 장소 조건에 따라 별도 배경을 선택');
for(const id of ['feudGrudge','debtHelp','scholarDebate','kidsFight','bigProject','heirTraining','ministerQuit','newspaper','envoy','warTax','ambition','quarrelLand','gangRecruit','coRival','bdHealQuack','bdArenaRiot','jrSecretMeet','wfPoisonWitness','wfHostageRescue','mcHomecoming','gambleDebt'])assert(SE[id]?.scene,`${id} 추가 장면 연결`);
for(const id of ['coupWhisper','warDrums','coupHappens','fireRisk','flood','courtDay','bankRun','bdStageStar','adPartyDeath'])assert(SE[id]?.scene,`${id} 주요 사건의 장면 연결`);
const client=require('node:fs').readFileSync(require('node:path').join(__dirname,'../god-client.js'),'utf8');
assert.match(client,/if\(scene\)return dynVenueSceneArt\(scene,p\)/,'모든 장면 분류가 사건별 무대로 연결됨');
assert.match(client,/const sceneCues=\{/,'신규 장면별 도트 소품 렌더러');
const artStart=client.indexOf('function dynVenueSceneArt(scene,p){'),artEnd=client.indexOf('\nfunction dynIntimateSceneArt',artStart);
assert(artStart>=0&&artEnd>artStart,'장면 그림 렌더러');
const sceneArt=new Function('dynPixelPerson',client.slice(artStart,artEnd)+';return dynVenueSceneArt;')(()=>''),rendered=new Set();
for(const scene of sceneKinds){if(scene==='intimate')continue;const svg=sceneArt(scene,{scenePeople:[]});assert.match(svg,/<svg[^>]+aria-label=/,`${scene} 그림 생성`);rendered.add(svg)}
const intimateStart=client.indexOf('function dynIntimateSceneArt(p){'),intimateEnd=client.indexOf('\nfunction dynSceneArt',intimateStart);
const intimateArt=new Function('dynPixelPerson',client.slice(intimateStart,intimateEnd)+';return dynIntimateSceneArt;')(()=>'' )({scenePeople:[]});rendered.add(intimateArt);
assert.equal(rendered.size,sceneKinds.size,'63개 장면의 도트 그림이 서로 구별됨');
assert.equal(event.scene,'intimate','친밀한 장면 표시');
assert(w.isAdult(me)&&w.isAdult(partner),'배우자 둘 다 성인');
const ctx=dynStoryContext(event,me);
assert(ctx,'성인 부부의 친밀한 사건 조건');
const minorAge=partner.age;partner.age=1;
assert.equal(dynStoryContext(event,me),null,'미성년 배우자는 사건 대상에서 제외');
partner.age=minorAge;
assert(dynStoryPush(event,ctx,me),'장면 사건 대기열 등록');
const intimacyView=w.dynView().pending[0];
assert.equal(intimacyView.scene,'intimate','화면에 장면 분류 전달');
assert.equal(intimacyView.scenePeople.length,2,'장면에 주인공과 배우자 등장');
assert(Number.isFinite(intimacyView.scenePeople[0].physique),'인물별 체형 특징을 장면 데이터로 전달');
const options=event.o.map(o=>o[0]);
assert.deepEqual(options,['together','talk','rest'],'합의된 친밀함·대화·거절 선택 제공');
const venueScenes={este:'mens-esthetic',health:'hostess',soap:'soap',deli:'delivery',hotel:'hotel'},venueEvent=SE.adultVenueBoundary;
for(const [type,scene] of Object.entries(venueScenes)){
  const id=90000+Object.keys(venueScenes).indexOf(type);S.fz=[{id,t:type,owner:me.id,nm:type}];partner.fz=id;D.pending=[];
  const venueCtx=dynStoryContext(venueEvent,me);assert(venueCtx,`${type} 사업장의 장면 사건`);
  assert(dynStoryPush(venueEvent,venueCtx,me),`${type} 사건 대기열 등록`);
  const view=w.dynView().pending[0];assert.equal(view.scene,scene,`${type} 장소별 장면`);assert.equal(view.scenePeople.length,2,`${type} 인물 표현`);
}
assert.equal(SE.adultVenueAfter.chain,1,'업소 경계 사건에 후속 이야기가 연결됨');
console.log(JSON.stringify({ok:true,scene:event.scene,adultOnly:true,choices:options,venueScenes:Object.keys(venueScenes),sceneKinds:sceneKinds.size,distinctPixelArt:rendered.size,storyEvents:sceneStories.length,people:true,followup:true}));
