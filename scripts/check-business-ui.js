'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),zlib=require('node:zlib');
const {spawn}=require('node:child_process'),{chromium}=require('playwright');
const {createSession}=require('../rebuild/core/session'),{businessFixture}=require('./fixtures/business');
const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'fv6-ui-')),base='http://127.0.0.1:19749',fixture=businessFixture();
const session=createSession({mode:'strategy',legacy:fixture.state,playerId:fixture.me});fs.writeFileSync(path.join(dir,'canonical.json.gz'),zlib.gzipSync(JSON.stringify(session.checkpoint())));session.close();
let server,browser,page,logs='';const errors=[],wait=ms=>new Promise(r=>setTimeout(r,ms));
function start(){server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:'19749',INITIAL_WORLD:'canonical',VILLAGE_SAVE_DIR:dir},stdio:['ignore','pipe','pipe']});server.stdout.on('data',d=>logs+=d);server.stderr.on('data',d=>logs+=d);}
async function ready(){for(let i=0;i<300;i++){if(server.exitCode!==null)throw Error(logs);try{if((await fetch(base+'/rebuild/api/view')).ok)return;}catch{}await wait(50);}throw Error('서버 준비 초과');}
async function stop(){server.kill('SIGTERM');if(server.exitCode===null)await new Promise(r=>server.once('exit',r));}
async function get(route){const r=await fetch(base+'/rebuild/api'+route);assert(r.ok);return r.json();}
async function confirmed(){await page.getByRole('button',{name:'이 조건으로 실행',exact:true}).click();await page.getByRole('heading',{name:'결정이 반영되었습니다',exact:true}).waitFor();await page.getByRole('button',{name:'이전 화면으로',exact:true}).click();await page.locator('[data-company]').waitFor();}
async function main(){
 start();await ready();browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/rebuild');await page.getByRole('button',{name:'▥ 사업 시작',exact:true}).click();await page.locator('[data-company]').waitFor();
 await page.locator('#company-fund-'+fixture.firmId).fill('50');await page.getByRole('button',{name:'운영자금 지원 조건 확인',exact:true}).click();await confirmed();assert.equal((await get('/business')).companies[0].cash,50);
 await page.locator('[data-business-good]').selectOption('wood');const o=page.locator('#company-offers-'+fixture.firmId+' .living-offer').first();await o.getByRole('spinbutton').fill('3');await o.getByRole('button').click();await page.getByRole('dialog').getByText(/물품은 도착 전까지/).waitFor();await confirmed();
 const dispatched=await get('/business');assert.equal(dispatched.orders[0].quantity,3);assert.equal(dispatched.orders[0].status,'transit');assert.equal(dispatched.companies[0].warehouse.inv.wood,undefined);
 await page.screenshot({path:'/workspace/artifacts/stage6-order-mobile.png',fullPage:true});
 // 실제 프로세스 재시작 뒤 같은 화물을 이어 받는다.
 await stop();start();await ready();await page.reload();await page.getByRole('button',{name:'▥ 사업 시작',exact:true}).click();await page.locator('[data-company]').waitFor();assert.equal((await get('/business')).orders[0].quantity,3);
 await page.getByRole('button',{name:'하루 진행 →',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#hud').textContent.includes('2일'));await page.waitForFunction(()=>document.querySelector('[data-company]')?.textContent.includes('입고 완료'));
 const delivered=await get('/business');assert.equal(delivered.companies[0].warehouse.inv.wood,3);assert.equal(delivered.orders[0].status,'returning');
 await page.getByText('임금·설비·회사 운영',{exact:true}).click();await page.getByRole('button',{name:/회사 이름 바꾸기/}).click();await page.getByRole('textbox').fill('이어받은상사');await page.getByRole('button',{name:'조건과 비용 확인',exact:true}).click();await confirmed();assert.equal((await get('/business')).companies[0].name,'이어받은상사');assert.equal((await get('/business')).companies.length,1);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'/workspace/artifacts/stage6-received-mobile.png',fullPage:true});await page.setViewportSize({width:844,height:390});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
 console.log('사업 모바일 UI: 회사 자금 지원·공급/운송 비교·실제 수량 발주·배송 중 서버 재시작·날짜 진행/입고·회사 이름 변경·390/844px 통과 (통제120명)');
}
main().catch(async e=>{console.error(e.stack);console.error(await page?.locator('body').innerText().catch(()=>''));console.error(logs);await page?.screenshot({path:'/workspace/artifacts/stage6-ui-failure.png',fullPage:true}).catch(()=>{});process.exitCode=1;}).finally(async()=>{await browser?.close();if(server?.exitCode===null)await stop();});
