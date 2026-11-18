'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createWorld}=require('../engine.js');
const w=createWorld(812,180);w.dynStart();w.dynConfigureStart({age:40});
const S=w.S,D=S.dyn,me=S.byId.get(D.pid);me.cash=1e6;me.jailUntil=0;
for(const x of S.agents){if(x.alive&&w.isAdult(x)){x.cash=1e5;x.g.lend=.9}}
S.bldgs.push({id:90001,lot:0,owner:me.id,firm:null,fx:['pub'],cond:1,fee:1,rev:0,revE:0,built:S.day,users:0});
const run=(key,name)=>w.dynAct(key+':'+encodeURIComponent(name));
assert(w.dynActions().find(a=>a.k==='firm:new').companyNameSpec.optional);
assert.throws(()=>run('firm:new','<script>'),/회사 이름/);
assert(!me.firm,'잘못된 이름으로 회사를 설립하지 않음');
run('firm:new','동현 무역: 100%');
const f=S.firms.find(x=>x.id===me.firm);assert(f);assert.equal(f.name,'동현 무역: 100%');assert(f.dynName);assert.equal(f.totalShares,10000);assert.deepEqual(f.sh,{[me.id]:10000},'단독 설립은 지분 매각 없이 100% 소유');assert.equal(f.raised,0);assert.equal(f.listed,undefined);
assert(D.chron.some(x=>JSON.stringify(x).includes(f.name)),'설립 기록에 지정한 이름');
const shares=JSON.stringify(f.sh),cash=f.cash;
(S.unions=S.unions||[]).push({firm:f.id,fname:f.name,emp:me.id});
run('co:rename:'+f.id,'  자유 용병단  ');assert.equal(f.name,'자유 용병단');assert.equal(S.unions.at(-1).fname,f.name);assert.equal(f.cash,cash);assert.equal(JSON.stringify(f.sh),shares);
for(const name of ['', '가'.repeat(31),'<img src=x>','줄\n바꿈'])assert.throws(()=>run('co:rename:'+f.id,name),/회사 이름/);
S.firms.push({...f,id:90002,name:'경쟁 회사',ceo:S.agents.find(x=>x.alive&&x!==me&&w.isAdult(x)).id});
assert.throws(()=>run('co:rename:'+f.id,'경쟁 회사'),/같은 이름/);
assert.throws(()=>run('co:rename:90002','빼앗은 이름'),/할 수 없는/);
assert.equal(f.name,'자유 용병단');
const restored=createWorld(812,180);restored.importState(JSON.parse(JSON.stringify(w.exportState())));
assert.equal(restored.S.firms.find(x=>x.id===f.id).name,f.name);assert(restored.S.firms.find(x=>x.id===f.id).dynName);
// 업종 전환을 실행해 수동 이름 보존과 실제 업종 갱신을 함께 확인한다.
const ec={module:{exports:{}},console};vm.createContext(ec);vm.runInContext(fs.readFileSync(require.resolve('../engine.js'),'utf8').replace('return{dynSetStory,','return{firmIndTick,dynSetStory,'),ec);
const ew=ec.module.exports.createWorld(813,100);ew.dynStart();const em=ew.S.byId.get(ew.S.dyn.pid);
const ef={id:90003,name:'지킬 이름',pre:'지킬',suf:'농산',ceo:em.id,dynName:true,lines:['agri'],sh:{[em.id]:10000},price:1,bld:[]};ew.S.firms.push(ef);
for(const a of ew.S.agents.filter(a=>a!==em).slice(0,4)){a.emp=em.id;a.workAct=12}
// TRADE=12, 전환 판정 두 번으로 수동 이름 유지 확인.
ew.S.day=21;ew.firmIndTick();ew.S.day=51;ew.firmIndTick();assert.equal(ef.name,'지킬 이름');assert(ef.suf!=='농산','업종은 새 업무에 맞게 바뀜');
// 화면 입력·요청 바인딩을 모형에서 실행한다.
const ctx={document:{createElement(){return {}},head:{appendChild(){}}},GROUPS:[],localStorage:{getItem(){return null}},console,setTimeout,clearTimeout};vm.createContext(ctx);vm.runInContext(fs.readFileSync(require.resolve('../god-client.js'),'utf8'),ctx);
const spec=w.dynActions().find(a=>a.k==='co:rename:'+f.id);ctx.spec=spec;
assert(vm.runInContext('dynActHTML0(spec)',ctx).includes('data-company-name'));
let payload;const input={value:'새 이름:100%',dataset:{companyName:spec.k}},button={dataset:{companySubmit:spec.k}};
ctx.P={querySelectorAll(selector){return selector==='[data-company-name]'?[input]:selector==='[data-company-submit]'?[button]:[]},querySelector(){return null}};
ctx.api=async(url,opts)=>{payload=JSON.parse(opts.body)};
vm.runInContext('dynView={actions:[spec]};dynApi=api;dynSend=async()=>{};dynBindActions(P)',ctx);
(async()=>{await button.onclick();assert.equal(payload.k,spec.k+':'+encodeURIComponent(input.value));assert.equal(button.disabled,false);console.log('회사 설립 이름·변경·권한·중복·저장·입력 요청 확인 완료')})().catch(e=>{console.error(e);process.exitCode=1});
