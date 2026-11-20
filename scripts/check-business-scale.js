'use strict';
const assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const {createSession}=require('../rebuild/core/session'),{businessFixture}=require('./fixtures/business');
// 회사/공급 조건을 둔 5,000명 검사 세계. 일반 시작 성공이나 장기 처리량 검사가 아니다.
const f=businessFixture({population:5000}),s=createSession({mode:'strategy',legacy:f.state,playerId:f.me});
const hash=()=>createHash('sha256').update(JSON.stringify(s.checkpoint())).digest('hex');
const before=hash(),time=Date.now(),view=s.business(),ms=Date.now()-time,bytes=Buffer.byteLength(JSON.stringify(view));
assert.equal(hash(),before);assert.equal(s.summary().population,5000);assert(bytes<100000);assert(view.companies[0].offers.length<=36);assert(!JSON.stringify(view).includes('"q":'));
console.log(JSON.stringify({passed:'통제5,000명 회사 현황/공급자 조회 불변·후보 제한·g/q 비전송',ms,bytes,offers:view.companies[0].offers.length}));s.close();
