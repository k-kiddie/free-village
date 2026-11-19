'use strict';
// 원래 마을(가문 모드 아님) 결과가 바뀌지 않았는지 확인한다.
// 사용법: node scripts/check-village-invariance.js            → 기준 해시와 비교(Node 주 버전별)
//        node scripts/check-village-invariance.js --git [브랜치] → git의 기준 브랜치(기본 origin/main) engine.js와 직접 비교
//        node scripts/check-village-invariance.js <다른 engine.js 경로>  → 두 엔진 결과 비교
// 기준: 시드 7, 300명, 900일 exportState JSON의 sha1.
// 같은 코드라도 Node(V8) 주 버전에 따라 부동소수점 수학 함수 결과가 미세하게 달라 해시가 다르다.
//   Node 22(운영 AWS): 9d242c71…  /  Node 24: 0404e02c…  — 2026-11-19 확인, 같은 코드에서 버전만 다른 값이다.
// 기준값이 없는 Node 버전에서는 --git 비교를 쓴다.
// 원래 마을을 일부러 바꾸는 작업(동현 승인 필요)을 했다면 이 기준값을 새로 갱신한다.
const crypto=require('crypto'),path=require('path'),fs=require('fs'),os=require('os'),{execFileSync}=require('child_process');
const BASE={22:'9d242c718a0d81b63a5aa80d187277f590e099c2',24:'0404e02cd23c2e5b6e849814c8ec5074ed5b35b3'};
function run(file){const {createWorld}=require(path.resolve(file));const w=createWorld(7,300);for(let i=0;i<900;i++)w.step();const s=JSON.stringify(w.exportState());return crypto.createHash('sha1').update(s).digest('hex')}
const root=path.join(__dirname,'..'),major=Number(process.versions.node.split('.')[0]);
let other,label;
if(process.argv[2]==='--git'){const ref=process.argv[3]||'origin/main',dir=fs.mkdtempSync(path.join(os.tmpdir(),'inv-')),file=path.join(dir,'engine.js');
  fs.writeFileSync(file,execFileSync('git',['show',ref+':engine.js'],{cwd:root,maxBuffer:1<<28}));other=run(file);label=ref}
else if(process.argv[2]){other=run(process.argv[2]);label=process.argv[2]}
else{other=BASE[major];label='Node '+major+' 기준값';if(!other){console.error(`Node ${major}의 기준값이 없습니다. --git 으로 비교하세요.`);process.exit(2)}}
const mine=run(path.join(root,'engine.js'));
if(mine!==other){console.error(`원래 마을 결과가 달라졌다(${label}): ${mine} ≠ ${other}`);process.exit(1)}
console.log(`원래 마을 불변 확인(${label}): ${mine}`);
