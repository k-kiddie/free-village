'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const { createWorld } = require('../engine');
const { createSession } = require('../rebuild/core/session');
const root = path.resolve(__dirname,'..'), dir = fs.mkdtempSync(path.join(os.tmpdir(),'fv4-ui-'));
const artifacts = '/workspace/artifacts', base = 'http://127.0.0.1:19745';
fs.mkdirSync(artifacts,{recursive:true});
// 자금이 있는 시작 fixture. 기존 주민·공간·생산·학습·공사 기간을 그대로 사용한다.
const world = createWorld(42,100); world.dynStart(); world.dynSetStory(0);
world.S.byId.get(world.S.dyn.pid).cash = 30000;
const session = createSession({mode:'strategy',legacy:structuredClone(world.exportState()),worldId:'ui-stage4'});
fs.writeFileSync(path.join(dir,'canonical.json.gz'),zlib.gzipSync(JSON.stringify(session.checkpoint())));session.close();
let server, logs='', browser, page, apiSeq=0;
const sleep = ms => new Promise(r=>setTimeout(r,ms));
function start(){server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:'19745',INITIAL_WORLD:'canonical',CANONICAL_POPULATION:'100',WORLD_SWITCH_MIN_MS:'0',VILLAGE_SAVE_DIR:dir},stdio:['ignore','pipe','pipe']});server.stdout.on('data',d=>logs+=d);server.stderr.on('data',d=>logs+=d);}
async function ready(){for(let i=0;i<200;i++){try{if((await fetch(base+'/health')).ok)return;}catch{}if(server.exitCode!==null)throw Error(logs);await sleep(50);}throw Error('서버 준비 실패 '+logs);}
async function stop(){server.kill('SIGTERM');if(server.exitCode===null)await new Promise(r=>server.once('exit',r));}
async function get(route){const r=await fetch(base+'/rebuild/api'+route);assert(r.ok,await r.clone().text());return r.json();}
async function post(route,body){const r=await fetch(base+'/rebuild/api'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert(r.ok,await r.clone().text());return r.json();}
async function driver(action,args){const v=await get('/view');const c={worldId:v.worldId,commandId:'driver:'+(apiSeq+1),expectedRevision:v.revision,actor:v.me.ref,action,args};const p=await post('/preview',c);if(!p.allowed)return p;const r=await post('/execute',{...c,previewToken:p.previewToken});if(r.allowed)apiSeq++;return r;}
async function tick(){
  for(let guard=0;guard<20;guard++){
    const v=await get('/view');if(!v.pending.length)break;
    const pending=(await get('/catalog')).decisions[0];let accepted=false;
    for(const option of pending.opts){const r=await driver('choose',{id:pending.id,key:option.k});if(r.allowed){accepted=true;break;}}
    assert(accepted,'공사 대기 중 발생한 실제 결정에 실행 가능한 선택지가 있음');
  }
  const r=await driver('advance',{});assert(r.allowed,JSON.stringify(r));
}
async function main(){
  start();await ready();browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/rebuild');await page.getByRole('button',{name:'내용 보기',exact:true}).click();
  await page.getByRole('button',{name:'시작',exact:true}).click();await page.getByRole('button',{name:'이 조건으로 실행',exact:true}).click();
  await page.getByRole('heading',{name:'결정이 반영되었습니다'}).waitFor();await page.getByRole('button',{name:'이전 화면으로',exact:true}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'모바일 가로 넘침 없음');
  const map=await get('/map');const houses=map.entities.filter(e=>e.ref.kind==='house').slice(0,2);
  for(const h of houses){await page.getByRole('button',{name:'이 화면의 대상 목록',exact:true}).click();await page.getByRole('button',{name:h.name,exact:true}).click();await page.getByRole('button',{name:'비교함에 담기',exact:true}).click();}
  await page.getByRole('button',{name:/비교함 \(2\/3\)/}).click();await page.getByRole('heading',{name:'대상 비교'}).waitFor();
  await page.screenshot({path:path.join(artifacts,'stage4-compare-mobile.png'),fullPage:true});
  await page.getByRole('button',{name:houses[0].name+'로 돌아가기',exact:true}).click();
  await page.getByRole('button',{name:'지도 확대',exact:true}).click();await page.getByRole('button',{name:'주민 찾기',exact:true}).click();
  const me=(await get('/view')).me;await page.getByRole('textbox',{name:'주민 이름'}).fill(me.name);await page.getByRole('button',{name:'찾기',exact:true}).click();await page.getByRole('button',{name:me.name,exact:true}).click();
  await page.locator('#target').getByRole('heading',{name:me.name}).waitFor();
  await page.screenshot({path:path.join(artifacts,'stage4-map-mobile.png'),fullPage:true});
  await page.getByRole('button',{name:'☀ 생활과 일',exact:true}).click();await page.getByRole('button',{name:'품팔이 중심',exact:true}).click();
  await page.getByRole('button',{name:'이 조건으로 실행',exact:true}).click();await page.getByRole('heading',{name:'결정이 반영되었습니다'}).waitFor();await page.getByRole('button',{name:'이전 화면으로',exact:true}).click();
  const beforeDay=(await get('/view')).day;await page.getByRole('button',{name:'하루 진행 →',exact:true}).click();
  await page.waitForFunction(day=>document.querySelector('#hud').textContent.includes((day+2)+'일'),beforeDay);
  assert.equal((await get('/view')).day,beforeDay+1);
  console.log('모바일 시작·지도/주민 선택·비교/복귀·일 지침·하루 진행 통과');
  // 서버는 집행/저장을 마쳤지만 응답을 잃은 경우: 같은 요청을 재전송한다.
  const before=(await get('/view'));
  await page.route('**/rebuild/api/execute',async route=>{await route.fetch();await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'응답 유실 검사'})});await page.unroute('**/rebuild/api/execute');},{times:1});
  await page.getByRole('button',{name:'현금 절반 보관',exact:true}).click();await page.getByRole('button',{name:'이 조건으로 실행',exact:true}).click();
  await page.getByRole('heading',{name:'처리 결과를 확인하지 못했습니다'}).waitFor();await page.getByRole('button',{name:'다시 확인',exact:true}).click();
  await page.getByRole('heading',{name:'결정이 반영되었습니다'}).waitFor();
  const after=await get('/view');assert.equal(after.revision,before.revision+1);assert(Math.abs(after.vault-before.vault-before.me.cash*.5)<1e-8);
  await page.getByRole('button',{name:'이전 화면으로',exact:true}).click();
  await page.getByRole('button',{name:'▥ 사업 시작',exact:true}).click();await page.getByRole('searchbox').fill('공장 짓기');
  await page.getByRole('button',{name:/^공장 짓기/}).click();await page.getByRole('dialog').getByText(/일꾼이 3명/).waitFor();
  assert.equal(await page.getByRole('button',{name:'이 조건으로 실행',exact:true}).count(),0);
  await page.getByRole('button',{name:'돌아가기',exact:true}).click();
  await page.getByRole('searchbox').fill('주막 짓기');await page.getByRole('button',{name:/^주막 짓기/}).click();
  await page.getByRole('button',{name:'이 조건으로 실행',exact:true}).click();await page.getByRole('heading',{name:'결정이 반영되었습니다'}).waitFor();await page.getByRole('button',{name:'이전 화면으로',exact:true}).click();
  assert.equal((await get('/view')).projects.length,1);
  // 공사 완료 대기 40일도 동일 공통 명령 API로 진행한다. 버튼 40회 조작 검사는 아니다.
  for(let i=0;i<40;i++)await tick();
  await page.reload();await page.getByRole('button',{name:'▥ 사업 시작',exact:true}).click();
  await page.getByRole('searchbox').fill('회사 세우기');await page.getByRole('button',{name:/^회사 세우기/}).click();
  await page.getByRole('textbox').fill('햇살상사');await page.getByRole('button',{name:'조건과 비용 확인',exact:true}).click();
  await page.getByRole('button',{name:'이 조건으로 실행',exact:true}).click();await page.getByRole('heading',{name:'결정이 반영되었습니다'}).waitFor();
  await page.getByRole('button',{name:'활동에서 다시 보기',exact:true}).click();await page.getByRole('heading',{name:'결정이 남긴 변화'}).waitFor();
  const finished=await get('/view');assert.equal(finished.firms.length,1);assert.equal(finished.firms[0].name,'햇살상사');
  await page.screenshot({path:path.join(artifacts,'stage4-results-mobile.png'),fullPage:true});
  console.log('자격 부족 거절·응답 유실 재전송·실제 건설 시작→40일 공사→회사 설립→활동 결과 통과');
  const snapshot=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir,'canonical.json.gz'))));
  assert(snapshot.engine.S.agents.every(a=>a.g&&a.q));assert.equal(snapshot.strategy.revision,finished.revision);
  const invalid=await fetch(base+'/rebuild/api/execute',{method:'POST',headers:{origin:'http://elsewhere.invalid','Content-Type':'application/json'},body:'{}'});assert.equal(invalid.status,403);
  const forbidden=await fetch(base+'/rebuild/api/checkpoint');assert.equal(forbidden.status,404);
  await stop();start();await ready();await page.reload();await page.getByRole('button',{name:'내 인물 살펴보기',exact:true}).waitFor();
  const restored=await get('/view');assert.equal(restored.day,finished.day);assert.equal(restored.firms[0].name,'햇살상사');assert.equal(restored.worldId,finished.worldId);
  const desktop=await browser.newPage({viewport:{width:1440,height:1000}});await desktop.goto(base+'/rebuild');await desktop.getByRole('button',{name:'내 인물 살펴보기',exact:true}).waitFor();await desktop.screenshot({path:path.join(artifacts,'stage4-desktop.png'),fullPage:true});
  assert.deepEqual(errors,[]);console.log('실제 gzip 저장·서버 재시작 복원·g/q·Origin/경로 제한·390px/1440px 레이아웃 통과');
}
main().catch(async e=>{console.error(e.stack);console.error(await page?.locator('body').innerText().catch(()=>''));await page?.screenshot({path:path.join(artifacts,'stage4-failure.png'),fullPage:true}).catch(()=>{});console.error(logs);process.exitCode=1;}).finally(async()=>{await browser?.close();if(server?.exitCode===null)await stop();});
