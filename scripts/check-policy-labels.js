'use strict';
// 단계형 정책(성매매·마약·낙태 등)과 단위 정책이 숫자 대신 이름·단위로 보이고, 정해진 단계 밖으로 못 가는지 검사한다.
const assert=require('node:assert/strict');
const {createWorld}=require('../engine');
const w=createWorld(2429,160);w.dynStart();w.dynConfigureStart({age:34,status:'king'});w.dynChoose(w.S.dyn.pending[0].id,'go');const S=w.S;
const ENUM=['prostLaw','abortLaw','drugLaw','gambleLaw','consentLaw','surrogacy','milBudget','copay','suga','elecPrice','monPol'];
S.gov.ready=S.gov.ready||{};for(const k of [...ENUM,'draftYears','medQuota'])S.gov.ready[k]=1;
Object.assign(S.gov.policy,{prostLaw:2,abortLaw:1,drugLaw:2,gambleLaw:0,consentLaw:0,surrogacy:1,milBudget:1,copay:2,suga:1,elecPrice:1,monPol:0,draftYears:2,medQuota:6});
const acts=w.dynActions().filter(a=>a.k.startsWith('law2:'));const by=k=>acts.find(a=>a.k==='law2:'+k);
for(const k of ENUM){const a=by(k);assert(a,k+' 목록');assert(k==='copay'?/지금 \d+%/.test(a.label):!/지금 \d/.test(a.label),`${k}는 숫자 대신 이름: ${a.label}`);assert(!a.valueSpec,k+' 단계형은 숫자 입력칸 없음');assert(a.opts.every(o=>/^set\d+$/.test(o[0])),k+' 단계를 직접 고름')}
assert(/규제 없음/.test(by('prostLaw').label),'성매매 지금 단계 이름');
assert(/2년/.test(by('draftYears').label)&&/6명/.test(by('medQuota').label),'단위 표시');
assert(/전$|없음/.test(by('wageFloor').label.replace(/\)$/,'')),'최저 일당은 돈 단위');
// 단계 밖 거부
S.dyn.cool={};assert.throws(()=>w.dynAct('law2:prostLaw:set9'));
S.dyn.cool={};assert.throws(()=>w.dynAct('lawval:prostLaw:7'),/숫자로 설정|범위/);
assert.equal(S.gov.policy.prostLaw,2,'잘못된 값은 반영 안 됨');
S.dyn.cool={};const r=w.dynAct('law2:prostLaw:set3').text;assert(/규제 없음 → 합법화/.test(r),'결과 문장도 이름: '+r);assert.equal(S.gov.policy.prostLaw,3);
console.log('정책 표시: 단계형 11종 이름·직접 선택·범위 밖 거부, 복무 기간·의대 정원·최저 일당 단위 통과');
