'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),zlib=require('node:zlib');
const {spawn}=require('node:child_process'),{chromium}=require('playwright');
const {createSession}=require('../rebuild/core/session'),{fixture}=require('./fixtures/living');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fv5-ui-')),base='http://127.0.0.1:19748',root=path.resolve(__dirname,'..');
const f=fixture(),raw=f.state;
// 임대 매물과 교사·판매자가 있는 인과 검사 세계. 모든 개입은 브라우저에서 수행한다.
const origin=raw.S.geo.lots[raw.S.houses.find(h=>h.id===f.mine).lot];
const lot=raw.S.geo.lots.map((p,id)=>({p,id})).find(({p,id})=>!raw.S.houses.some(h=>h.lot===id)&&Math.hypot(p.x-origin.x,p.y-origin.y)>64&&Math.hypot(p.x-origin.x,p.y-origin.y)<120);
assert(lot);const home={id:raw.S.nextHouse++,lot:lot.id,owner:f.seller,occ:null,cond:1,rent:12,sale:null,jeon:null,deposit:0};raw.S.houses.push(home);raw.S.lotUsed[lot.id]=1;
const session=createSession({mode:'strategy',legacy:raw,playerId:f.me,worldId:'living-ui'});
fs.writeFileSync(path.join(dir,'canonical.json.gz'),zlib.gzipSync(JSON.stringify(session.checkpoint())));session.close();
let child,browser,page,logs='';const errors=[];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function start(){child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:'19748',INITIAL_WORLD:'canonical',VILLAGE_SAVE_DIR:dir},stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);}
async function ready(){for(let i=0;i<300;i++){if(child.exitCode!==null)throw Error(logs);try{if((await fetch(base+'/rebuild/api/view')).ok)return;}catch{}await wait(50);}throw Error('서버 대기 초과 '+logs);}
async function stop(){child.kill('SIGTERM');if(child.exitCode===null)await new Promise(r=>child.once('exit',r));}
async function get(route){const r=await fetch(base+'/rebuild/api'+route);assert(r.ok);return r.json();}
async function execute(){await page.getByRole('button',{name:'이 조건으로 실행',exact:true}).click();await page.getByRole('heading',{name:'결정이 반영되었습니다'}).waitFor();await page.getByRole('button',{name:'이전 화면으로',exact:true}).click();await page.locator('#living-details h3').first().waitFor();}
async function main(){
 start();await ready();browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/rebuild');await page.getByRole('button',{name:'☀ 생활과 일',exact:true}).click();await page.locator('#living-details h3').first().waitFor();
 const before=await get('/living'),seller=before.offers.sellers.find(x=>x.id===f.seller);assert(seller);
 const offer=page.locator('.living-offer').filter({has:page.getByRole('button',{name:seller.label,exact:true})});await offer.getByRole('spinbutton').fill('2');await offer.getByRole('button').click();await page.getByRole('dialog').getByText('개인 자금 사용', {exact:false}).waitFor();await execute();
 const bought=await get('/living');assert.equal(bought.me.food,before.me.food+2);assert.equal(bought.me.freeHours,3.5);
 const lesson=bought.offers.teachers.find(x=>x.id===f.teacher&&x.skill===3);assert(lesson);await page.getByRole('button',{name:lesson.label,exact:true}).click();await page.getByRole('dialog').getByText(/기술 숙련 증가/).waitFor();await execute();assert((await get('/living')).me.skills.find(x=>x.id===3).level>before.me.skills.find(x=>x.id===3).level);
 await page.getByRole('button',{name:'두 시간 쉬기',exact:true}).click();await execute();assert.equal((await get('/living')).me.freeHours,.5);
 await page.getByRole('button',{name:'두 시간 쉬기',exact:true}).click();await page.getByRole('dialog').getByText('오늘의 여유 시간이 모자랍니다.',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'이 조건으로 실행',exact:true}).count(),0);await page.getByRole('button',{name:'돌아가기',exact:true}).click();
 await page.getByRole('combobox',{name:'생활 수준',exact:true}).selectOption('1');await page.getByRole('combobox',{name:'자녀 과외',exact:true}).selectOption('2');await page.getByRole('button',{name:'지침 비용 확인',exact:true}).click();await execute();assert.equal((await get('/view')).budget.edu,2);
 await page.getByRole('button',{name:'생활권 비교',exact:true}).click();await page.getByRole('heading',{name:'생활권 비교',exact:true}).waitFor();await page.getByRole('button',{name:'일·교육',exact:true}).click();await page.getByRole('columnheader',{name:'고용 연결',exact:true}).waitFor();await page.getByRole('button',{name:'인구 이동',exact:true}).click();await page.getByRole('columnheader',{name:'주소 이동 입/출',exact:true}).waitFor();await page.getByRole('button',{name:'닫기',exact:true}).click();
 await page.screenshot({path:'/workspace/artifacts/stage5-living-mobile.png',fullPage:true});
 // 남은 시간과 지침을 실제 디스크 저장·프로세스 재시작 후 확인한다.
 await stop();start();await ready();await page.reload();await page.getByRole('button',{name:'☀ 생활과 일',exact:true}).click();await page.locator('#living-details h3').first().waitFor();assert.equal((await get('/living')).me.freeHours,.5);assert.equal((await get('/view')).budget.life,1);
 await page.getByRole('button',{name:'하루 진행 →',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#hud').textContent.includes('2일'));await page.locator('#living-details h3').first().waitFor();assert.equal((await get('/living')).me.freeHours,4);
 await page.getByRole('button',{name:'주택 '+home.id+' 임대 계약',exact:true}).click();await page.getByRole('dialog').getByText(/이후 열흘 임대료/).waitFor();await execute();assert.equal((await get('/living')).me.rent,12);
 await page.getByRole('button',{name:'생활권 비교',exact:true}).click();const region=(await get('/living')).regions.find(r=>r.population);await page.getByRole('button',{name:region.name,exact:true}).click();await page.getByRole('heading',{name:/관측 기록/}).waitFor();assert.equal(await page.getByRole('cell',{name:'2일',exact:true}).count(),1);await page.getByRole('button',{name:'닫기',exact:true}).click();
 await page.getByRole('button',{name:'마을 지도',exact:false}).click();await page.getByRole('button',{name:'식량',exact:true}).click();await page.getByRole('button',{name:'생활 압박',exact:true}).click();await page.screenshot({path:'/workspace/artifacts/stage5-needs-map-mobile.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.setViewportSize({width:844,height:390});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
 console.log('생활 모바일 UI: 실제 구매·기술 수업·휴식/시간 거절·가계 지침·지역 비교/기록·임대·지도·재시작/시간 초기화 통과 (통제 조건 120명)');
}
main().catch(async e=>{console.error(e.stack);console.error(await page?.locator('body').innerText().catch(()=>''));console.error(logs);await page?.screenshot({path:'/workspace/artifacts/stage5-failure.png',fullPage:true}).catch(()=>{});process.exitCode=1;}).finally(async()=>{await browser?.close();if(child?.exitCode===null)await stop();});
