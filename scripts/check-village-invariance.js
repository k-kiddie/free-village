'use strict';
// 원래 마을(가문 모드 아님) 결과가 바뀌지 않았는지 확인한다.
// 사용법: node scripts/check-village-invariance.js            → 기준 해시와 비교
//        node scripts/check-village-invariance.js <다른 engine.js 경로>  → 두 엔진 결과 비교
// 기준: 시드 7, 300명, 900일 exportState JSON의 sha1. 2026-11-18 PR #24~#33 내내 이 값이 유지됐다.
// 원래 마을을 일부러 바꾸는 작업(동현 승인 필요)을 했다면 이 기준값을 새로 갱신한다.
const crypto=require('crypto'),path=require('path');
const BASE='9d242c718a0d81b63a5aa80d187277f590e099c2';
function run(file){const {createWorld}=require(path.resolve(file));const w=createWorld(7,300);for(let i=0;i<900;i++)w.step();const s=JSON.stringify(w.exportState());return crypto.createHash('sha1').update(s).digest('hex')}
const mine=run(path.join(__dirname,'..','engine.js'));
const other=process.argv[2]?run(process.argv[2]):BASE;
if(mine!==other){console.error(`원래 마을 결과가 달라졌다: ${mine} ≠ ${other}`);process.exit(1)}
console.log(`원래 마을 불변 확인: ${mine}`);
