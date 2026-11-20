'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),zlib=require('node:zlib');
const {spawn}=require('node:child_process'),{chromium}=require('playwright');
const {createSession}=require('../rebuild/core/session'),{productionFixture}=require('./fixtures/business-production');
const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'fv6-ops-ui-')),base='http://127.0.0.1:19750',f=productionFixture();
const s=createSession({mode:'strategy',legacy:f.state,playerId:f.me}),m=s.summary(),command={worldId:m.worldId,expectedRevision:m.revision,commandId:'fixture:1',actor:{kind:'person',id:m.playerId},action:'business.order',args:{firmId:f.firmId,supplierId:f.seller,carrierId:f.carrier,good:'wood',quantity:4}},p=s.preview(command);assert(p.allowed);assert(s.execute({...command,previewToken:p.previewToken}).allowed);
const saved=s.checkpoint();s.close();saved.engine.S.agents.find(a=>a.id===f.carrier).jailUntil=100;
// 원료·회사·직원 조건과 운송인 구금은 통제 fixture. 화면에서 방침/발주 계획/회수/날짜를 조작한다.
fs.writeFileSync(path.join(dir,'canonical.json.gz'),zlib.gzipSync(JSON.stringify(saved)));
let child,browser,page,logs='';const errors=[],wait=ms=>new Promise(r=>setTimeout(r,ms));
function start(){child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:'19750',INITIAL_WORLD:'canonical',VILLAGE_SAVE_DIR:dir},stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);}
async function ready(){for(let n=0;n<300;n++){if(child.exitCode!==null)throw Error(logs);try{if((await fetch(base+'/rebuild/api/view')).ok)return;}catch{}await wait(50);}throw Error('서버 대기 초과');}
async function stop(){child.kill('SIGTERM');if(child.exitCode===null)await new Promise(r=>child.once('exit',r));}
async function get(route){const r=await fetch(base+'/rebuild/api'+route);assert(r.ok);return r.json();}
async function confirmed(){await page.getByRole('button',{name:'이 조건으로 실행',exact:true}).click();await page.getByRole('heading',{name:'결정이 반영되었습니다',exact:true}).waitFor();await page.getByRole('button',{name:'이전 화면으로',exact:true}).click();await page.locator('[data-company]').waitFor();}
async function day(number){await page.getByRole('button',{name:'하루 진행 →',exact:true}).click();await page.waitForFunction(n=>document.querySelector('#hud').textContent.includes(n+'일'),number);await page.getByRole('heading',{name:number+'일 운영 결과',exact:true}).waitFor();}
async function main(){
 start();await ready();browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/rebuild');await page.getByRole('button',{name:'▥ 사업 시작',exact:true}).click();await page.locator('#production-recipe-'+f.firmId).selectOption('meal');
 await page.getByRole('button',{name:'생산·판매 조건 확인',exact:true}).click();await page.getByRole('dialog').getByText(/하루 12공정/).waitFor();await confirmed();
 await page.locator('[data-business-good]').selectOption('grain');await page.getByRole('button',{name:'이 조건으로 반복 발주 계획',exact:true}).first().click();await page.locator('#supply-minimum').fill('12');await page.getByRole('button',{name:'반복 발주 조건 확인',exact:true}).click();await page.getByRole('dialog').getByText(/재고\+운송 중 12 미만/).waitFor();await confirmed();
 await day(2);let c=(await get('/business')).companies[0];assert(c.production.daily.produced>0&&c.production.daily.revenue>0);assert.equal((await get('/business')).orders[0].status,'blocked');assert(c.plans.grain.lastReason.includes('충분'));
 await page.screenshot({path:'/workspace/artifacts/stage6-production-mobile.png',fullPage:true});
 const r=c.recoveryOptions[0],carrier=r.carriers[0];await page.getByRole('button',{name:carrier.name+'에게 회수 운송',exact:true}).click();await page.getByRole('dialog').getByText(/공급자 상품 대금은 중복 지급하지 않습니다/).waitFor();await confirmed();
 await page.locator('#production-mode-'+f.firmId).selectOption('quality');assert.equal(await page.locator('#production-price-'+f.firmId).inputValue(),'1.2');await page.getByRole('button',{name:'생산·판매 조건 확인',exact:true}).click();await confirmed();
 const before=await get('/business');await stop();start();await ready();await page.reload();await page.getByRole('button',{name:'▥ 사업 시작',exact:true}).click();await page.locator('[data-company]').waitFor();assert.equal((await get('/business')).companies[0].production.mode,'quality');assert.equal((await get('/business')).companies[0].cash,before.companies[0].cash);
 await day(3);c=(await get('/business')).companies[0];assert.equal(c.warehouse.inv.wood,4);assert(c.production.daily.produced>0);await page.getByRole('button',{name:'반복 발주 중지',exact:true}).click();await confirmed();assert.equal((await get('/business')).companies[0].plans.grain.enabled,false);
 let hired=false;for(const a of (await get('/business')).companies[0].hireCandidates){await page.getByText('직원 한 명씩 채용 제안',{exact:true}).click();await page.locator(`[data-company-hire="${f.firmId}:${a.id}"]`).click();await page.getByRole('dialog').getByText(/제안 일당/).waitFor();await confirmed();if((await get('/business')).companies[0].staff.some(x=>x.id===a.id)){hired=true;break;}}assert(hired,'실제 채용 제안/수락과 회사 지정 직원 표시');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'/workspace/artifacts/stage6-production-restored-mobile.png',fullPage:true});await page.setViewportSize({width:844,height:390});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
 console.log('실제 모바일 UI: 공정/방침 설정·원료→생산→고객 매출/손익·자동 발주 조건/중지·중단 화물 회수·운영 도중 재시작·고품질 방침/입고 연속·개별 채용 수락·390/844px 통과 (통제120명)');
}
main().catch(async e=>{console.error(e.stack);console.error(await page?.locator('body').innerText().catch(()=>''));console.error(logs);await page?.screenshot({path:'/workspace/artifacts/stage6-ops-failure.png',fullPage:true}).catch(()=>{});process.exitCode=1;}).finally(async()=>{await browser?.close();if(child?.exitCode===null)await stop();});
