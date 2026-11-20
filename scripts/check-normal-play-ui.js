'use strict';
// 새 빈 저장/기본 5,000명 세계. 자금·기술·직원·공사 진척 주입과 명령 API 대리 호출 금지.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'fv-normal-ui-')),base='http://127.0.0.1:19747';
let child,browser,page,logs='',steps=0,decisions=0;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function start(){child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:'19747',INITIAL_WORLD:'canonical',CANONICAL_POPULATION:'5000',CANONICAL_SEED:'42',VILLAGE_SAVE_DIR:dir},stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);}
async function ready(){for(let i=0;i<400;i++){try{if((await fetch(base+'/health')).ok)return;}catch{}if(child.exitCode!==null)throw Error(logs);await sleep(100);}throw Error('서버 준비 실패');}
async function stop(){child.kill('SIGTERM');if(child.exitCode===null)await new Promise(r=>child.once('exit',r));}
async function view(){const r=await fetch(base+'/rebuild/api/view');assert(r.ok);return r.json();}
async function confirm(){await page.getByRole('button',{name:'이 조건으로 실행',exact:true}).click();await page.getByRole('heading',{name:'결정이 반영되었습니다'}).waitFor();await page.getByRole('button',{name:'이전 화면으로',exact:true}).click();}
async function decide(){
  for(let guard=0;guard<30;guard++){
    const v=await view();if(!v.pending.length)return;
    const p=v.pending[0],options=[...p.opts].sort((a,b)=>Number(/wait|leave|ignore|no|__defer/.test(b.k))-Number(/wait|leave|ignore|no|__defer/.test(a.k)));
    let accepted=false;
    for(const o of options){
      if(o.available===false)continue;
      await page.getByRole('button',{name:'내용 보기',exact:true}).click();
      const button=page.getByRole('dialog').getByRole('button',{name:o.label,exact:false}).first();
      await button.click();
      await page.getByRole('dialog').getByRole('heading',{name:'결정 전 확인'}).waitFor();
      if(await page.getByRole('button',{name:'이 조건으로 실행',exact:true}).count()){await confirm();accepted=true;decisions++;break;}
      await page.getByRole('button',{name:'돌아가기',exact:true}).click();
    }
    assert(accepted,'대기 결정을 실제 선택 UI에서 해결할 수 있음: '+p.kind);
  }
  throw Error('결정 반복 한도');
}
async function day(){await page.waitForFunction(()=>document.body.getAttribute('aria-busy')!=='true');await decide();const before=await view();const finished=page.waitForResponse(async r=>r.url().endsWith('/execute')&&r.request().method()==='POST'&&r.ok());await page.getByRole('button',{name:'하루 진행 →',exact:true}).click();await finished;await page.waitForFunction(day=>document.querySelector('#hud').textContent.includes((day+2)+'일'),before.day);await page.waitForFunction(()=>document.body.getAttribute('aria-busy')!=='true');const next=await view();assert.equal(next.day,before.day+1);steps++;if(steps%10===0)console.log(JSON.stringify({day:next.day,cash:next.me.cash,projects:next.projects,decisions}));}
async function main(){
 start();await ready();browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});page=await ctx.newPage();page.setDefaultTimeout(90000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/rebuild');await page.getByRole('button',{name:'내용 보기',exact:true}).waitFor();const initial=await view();assert.equal(initial.population,5000);console.log('일반 시작',JSON.stringify({cash:initial.me.cash,player:initial.me.name,population:initial.population}));
 await decide();await page.getByRole('button',{name:'☀ 생활과 일',exact:true}).click();await page.getByRole('button',{name:'품팔이 중심',exact:true}).click();await confirm();
 await page.getByRole('button',{name:'▥ 사업 시작',exact:true}).click();
 // 실제 차입 심사와 채무를 감수하는 창업 경로. UI를 통해 두 규모의 대출을 비교/선택한다.
 for(const amount of [100,30]){await page.getByRole('searchbox').fill('돈 빌리기 '+amount+'냥');await page.getByRole('button',{name:new RegExp('^돈 빌리기 '+amount+'냥')}).click();await confirm();}
 const borrowed=await view();assert(borrowed.me.cash>initial.me.cash);assert(borrowed.me.cash<initial.me.cash+131,'주입 없이 실제 대출 금액만 입금');
 await page.getByRole('searchbox').fill('주막 짓기');await page.getByRole('button',{name:/^주막 짓기/}).click();await confirm();assert.equal((await view()).projects.length,1);
 while((await view()).projects.length){
   assert(steps<80,'실제 공사 완료 한도');await day();
   assert.equal(await page.getByRole('searchbox').inputValue(),'주막 짓기','날짜 진행 후 사업 검색 유지');
   if(steps===20){const saved=await view();await stop();start();await ready();await page.reload();await page.getByRole('button',{name:'내 인물 살펴보기',exact:true}).waitFor();await page.getByRole('button',{name:'▥ 사업 시작',exact:true}).click();const restored=await view();assert.equal(restored.day,saved.day);assert.equal(restored.worldId,saved.worldId);assert.equal(restored.projects[0].progress,saved.projects[0].progress);}
 }
 await decide();await page.getByRole('searchbox').fill('회사 세우기');await page.getByRole('button',{name:/^회사 세우기/}).click();await page.getByRole('textbox').fill('첫걸음상사');await page.getByRole('button',{name:'조건과 비용 확인',exact:true}).click();await confirm();
 const end=await view();assert.equal(end.firms[0].name,'첫걸음상사');assert.equal(end.day,steps);assert.deepEqual(errors,[]);
 await page.getByRole('button',{name:'☷ 활동과 결과',exact:true}).click();await page.getByRole('heading',{name:'결정이 남긴 변화'}).waitFor();await page.screenshot({path:'/workspace/artifacts/stage4-normal-start-mobile.png',fullPage:true});
 await page.setViewportSize({width:844,height:390});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 console.log(JSON.stringify({result:'일반 5,000명 시작→차입→건설→실제 UI 하루 진행→공사 중 서버 재시작→회사 설립 통과',initialCash:initial.me.cash,days:steps,decisions,endingCash:end.me.cash,population:end.population}));
}
main().catch(async e=>{console.error(e.stack);console.error(logs);if(page){console.error(await page.locator('body').innerText().catch(()=>''));await page.screenshot({path:'/workspace/artifacts/normal-ui-failure.png',fullPage:true}).catch(()=>{});}process.exitCode=1;}).finally(async()=>{await browser?.close();if(child?.exitCode===null)await stop();});
