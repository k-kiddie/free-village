'use strict';
const assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const {createSession}=require('../rebuild/core/session'),{productionFixture}=require('./fixtures/business-production');
const f=productionFixture({population:5000});let s=createSession({mode:'strategy',legacy:f.state,playerId:f.me}),seq=0;
function run(action,args){const m=s.summary(),r={worldId:m.worldId,expectedRevision:m.revision,commandId:'production-scale:'+(seq+1),actor:{kind:'person',id:m.playerId},action,args},p=s.preview(r);assert(p.allowed,JSON.stringify(p));const out=s.execute({...r,previewToken:p.previewToken});assert(out.allowed,JSON.stringify(out));seq++;return out;}
run('business.policy',{firmId:f.firmId,recipe:'meal',mode:'bulk',limit:12,markup:.85,enabled:true});
for(let day=0;day<3;day++)run('advance',{});
const company=s.business().companies[0];assert(company.production.history.every(d=>d.produced>0&&d.revenue>0));assert(s.summary().population>=5000);assert(s.checkpoint().engine.S.agents.every(a=>a.g&&a.q));
const saved=JSON.parse(JSON.stringify(s.checkpoint()));run('advance',{});
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex'),expected=hash(s.checkpoint()),report={days:3,population:s.summary().population,businessBytes:Buffer.byteLength(JSON.stringify(s.business())),revenue:company.production.history.reduce((n,d)=>n+d.revenue,0)};s.close();
s=createSession({checkpoint:saved});seq=saved.strategy.commands.clients['production-scale'].highWater;run('advance',{});assert.equal(hash(s.checkpoint()),expected,'5,000명 생산·판매 저장 복원 다음 하루 동일');s.close();
console.log(JSON.stringify({passed:'통제5,000명 실제 공정/고객/임금·전체 g/q·저장 다음 하루 동일',...report}));
