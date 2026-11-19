'use strict';
// 내 조직: 이끄는/속한 단체마다 정보와 양지/음지 행동이 모이고, 화면 규칙으로 실제 행동이 골라지는지 검사한다.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'check-story-fuzz.js'),'utf8');const rich=eval('('+src.match(/function rich[\s\S]*?\n}\n/)[0]+')');const {createWorld}=require('../engine.js');
const {w,S,D,me}=rich(1101);me.cash=1e6;w.dynAct('merc:found:'+encodeURIComponent('푸른 방패'));
D.shark={d:S.day,book:[{id:S.agents.find(a=>a.alive&&a!==me).id,bal:30,miss:1}]};
const v=w.dynView(),ids=v.orgs.map(o=>o.id);
for(const k of ['gov','faith','gang','bank','spy','shark'])assert(ids.includes(k),k+' 조직 표시: '+ids.join(','));assert(ids.some(k=>k.startsWith('merc')),'용병 회사 표시');
// 화면 쪽 고르기 규칙(god-client.js)을 그대로 실행
const gc=fs.readFileSync(path.join(__dirname,'..','god-client.js'),'utf8');const blk=gc.slice(gc.indexOf('function dynOrgKey'),gc.indexOf('function dynOrgChips'));const ctx={};vm.createContext(ctx);vm.runInContext(blk+';this.acts=dynOrgActs',ctx);
const pick=(id,side)=>ctx.acts(v,v.orgs.find(o=>o.id===id),side).map(a=>a.k);
const fl=pick('faith','light'),fd=pick('faith','dark');assert(fl.includes('extra:preach')&&fl.includes('extra:rite'),'교단 양지: 전도·예배');assert(fd.includes('extra:force')&&fd.some(k=>k.startsWith('fdark:')),'교단 음지: 강압·어둠');assert(!fl.includes('extra:force'),'강압은 양지에 없음');
const gd=pick('gang','dark');assert(gd.some(k=>k.startsWith('crime:'))&&!gd.includes('crime:shark'),'패거리 음지: 범죄(고리대 제외)');
assert(pick('gov','dark').some(k=>k.startsWith('pol2:')),'정부 음지: 공안');assert(pick('gov','light').some(k=>k.startsWith('law2:')||k.startsWith('govern:')),'정부 양지: 법·국정');
const m=v.orgs.find(o=>o.id.startsWith('merc'));assert(pick(m.id,'light').length>0,'용병 회사 행동');assert(pick('shark','dark').includes('crime:shark'),'고리대 음지');
for(const o of v.orgs)assert(o.stats.length>=2,o.id+' 정보');
console.log(`내 조직: ${v.orgs.map(o=>o.icon+o.name).join(' · ')} · 양지/음지 분류 통과`);
