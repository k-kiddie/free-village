'use strict';
// 개발 환경의 Playwright로 실제 서버·모바일 UI를 검사한다. 운영 저장은 사용하지 않는다.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),zlib=require('node:zlib'),vm=require('node:vm'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),saveDir=fs.mkdtempSync(path.join(os.tmpdir(),'village-ui-')),artifacts=process.env.UI_ARTIFACT_DIR||'/workspace/artifacts';fs.mkdirSync(artifacts,{recursive:true});
const ec={module:{exports:{}},console};vm.createContext(ec);vm.runInContext(fs.readFileSync(path.join(root,'engine.js'),'utf8').replace('return{dynSetStory,','return{initTrade,farInit,realmInit,dynSetStory,'),ec);
const w=ec.module.exports.createWorld(2429,180);w.dynStart();w.dynConfigureStart({age:34,status:'king',family:'children',sur:'김',given:'동현'});const S=w.S,D=S.dyn,me=S.byId.get(D.pid);me.cash=1e6;me.jailUntil=0;D.pending=[];w.initTrade();S.trade.on=true;D.realms=Object.fromEntries(S.trade.towns.map(t=>[t.name,w.realmInit(t)]));w.farInit();
const F=D.far[0],E=D.far[1];F.war={vs:E.name,d:S.day,att:1,score:0};E.war={vs:F.name,d:S.day,score:0};F.treasury=1e5;D.heat=1.6;S.gov.jr={vac:{stage:'nom'},rev:[],law:{},log:[],cjUntil:0};S.gov.judges=[];
const lover=S.agents.find(x=>x.alive&&x!==me&&x.age>=18*60&&!me.kids.includes(x.id)&&x.id!==me.partner);me.affair=lover.id;lover.affair=me.id;const conc=S.agents.find(x=>x.alive&&x!==me&&x.id!==lover.id&&x.age>=18*60&&x.id!==me.partner);conc.dynConc=me.id;
const regular={id:S.nextFirm++,name:'새빛 상회',pre:'새빛',suf:'상사',ceo:me.id,sh:{[me.id]:10000},shareVersion:74,totalShares:10000,cash:5000,price:1,p30:1,peak:1,bld:[],lines:['trade'],born:S.day,divE:0,hist:[]};S.firms.push(regular);w.dynAct('merc:found:'+encodeURIComponent('푸른 방패'));const merc=S.firms.find(f=>f.merc);for(let i=0;i<3;i++){const a=w.dynActions().find(a=>a.k==='merc:recruit:'+merc.id);w.dynAct(a.k+':'+a.opts[0][0])}w.dynAct(`merc:contract:${merc.id}:${encodeURIComponent(F.name)}:defend`);D.pending=[];w.dynView();
fs.writeFileSync(path.join(saveDir,'god.json.gz'),zlib.gzipSync(JSON.stringify({version:1,seed:2429,population:180,state:w.exportState()})));
const port=19592,base='http://127.0.0.1:'+port;let log='';const server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),POPULATION:'80',DYNASTY_POPULATION:'180',WORLD_SWITCH_MIN_MS:'0',VILLAGE_SAVE_DIR:saveDir},stdio:['ignore','pipe','pipe']});server.stdout.on('data',x=>log+=x);server.stderr.on('data',x=>log+=x);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{let browser;try{
  for(let i=0;i<200;i++){try{if((await fetch(base+'/health')).ok)break}catch{}await wait(50)}
  browser=await chromium.launch({headless:true,...(fs.existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
  for(const size of [{width:390,height:844},{width:380,height:760},{width:820,height:1000}]){
    const context=await browser.newContext({viewport:size,deviceScaleFactor:1}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
    await page.goto(base+'/god');await page.waitForSelector('.statusgrid button',{timeout:30000});await page.waitForFunction(()=>document.querySelectorAll('.statusgrid button').length===6);
    const fb=page.locator('#dFeedback button');if(await fb.isVisible())await fb.click();
    assert(await page.locator('.statusgrid').innerText().then(t=>['수배 열기','재판관 공백','정인','먼 나라 전쟁','용병 회사'].every(x=>t.includes(x))));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'가로 스크롤 없음');
    for(const selector of ['#dStrip','.statusgrid button:last-child','#dynQ','.quick-favs summary']){
      const element=await page.locator(selector).boundingBox(),sheet=await page.locator('#dynSheet').boundingBox();
      assert(element.y+element.height<=sheet.y+sheet.height,'첫 화면에서 스크롤 없이 '+selector);
    }
    await page.screenshot({path:path.join(artifacts,`free-village-home-${size.width}.png`)});
    await page.locator('.statusgrid button').filter({hasText:'수배 열기'}).click();assert.equal(await page.locator('.sheethead h2').textContent(),'음모');assert(await page.locator('details[data-g="어두운 길 · 범죄"]').getAttribute('open')!==null,'상태→관련 묶음');
    await page.locator('#dynTabs [data-dt="asset"]').click();await page.locator('[data-ready-filter]').click();assert.equal(await page.locator('.action-section .act.off').count(),0,'실행 가능 필터');await page.locator('[data-ready-filter]').click();
    const group=page.locator('details.actgrp[data-g="회사 경영"]');await group.locator(':scope > summary').click();const sub=group.locator('details.subgrp').filter({hasText:size.width===390?'새빛 상회':'동현 무역'});if(await sub.count())await sub.locator(':scope > summary').click();
    const input=group.locator(`[data-company-name="co:rename:${regular.id}"]`);await input.fill('동현 무역');await group.locator(`[data-company-submit="co:rename:${regular.id}"]`).click();await page.waitForFunction(async()=>{const v=await(await fetch('/god/api/view')).json();return v.dyn.co.some(c=>c.name==='동현 무역')});
    const scroll=await page.evaluate(()=>{const e=document.querySelector('#dynSheet');e.scrollTop=300;return e.scrollTop});await page.locator('#dynTabs [data-dt="me"]').click();await page.locator('#dynTabs [data-dt="asset"]').click();assert(Math.abs((await page.evaluate(()=>document.querySelector('#dynSheet').scrollTop))-scroll)<3,'탭별 스크롤 위치 기억');await page.locator('[data-fold-actions]').click();assert.equal(await page.locator('details.actgrp[open],details.subgrp[open]').count(),0,'하위 묶음까지 모두 접기');
    await page.locator('.sheethead [data-find]').click();await page.locator('#dynQ').fill('동현 무역');await page.waitForSelector('#dynQR [data-company-name]');
    const fav=page.locator(`#dynQR [data-fav="co:rename:${regular.id}"]`);await fav.click();assert(await page.evaluate(key=>JSON.parse(localStorage.getItem('v-dynfav')).includes(key),'co:rename:'+regular.id),'즐겨찾기 저장');
    await page.locator('#dynQ').clear();
    await page.locator(`[data-fav-open="co:rename:${regular.id}"]`).click();
    assert(await page.locator('.quick-favs [data-company-name]').isVisible(),'즐겨찾기에서 회사 이름 입력 열림');
    await page.locator('#dynTabs [data-dt="dip"]').click();await page.waitForFunction(()=>{const e=document.querySelector('#dMap');return Math.abs(e.getBoundingClientRect().height-parseFloat(e.style.height))<1&&e.getBoundingClientRect().height>150});if(await fb.isVisible())await fb.click();await page.waitForFunction(()=>typeof dynWorldLabelHits!=='undefined'&&dynWorldLabelHits.length>5);
    const collisions=await page.evaluate(()=>dynWorldLabelHits.flatMap((a,i)=>dynWorldLabelHits.slice(i+1).filter(b=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y)).length);assert.equal(collisions,0,'세계 지도 이름표 겹침 없음');
    await page.screenshot({path:path.join(artifacts,`free-village-world-${size.width}.png`)});
    const hit=await page.evaluate(()=>{const b=dynWorldLabelHits.find(x=>x.id!=='us');return {id:b.id,x:b.x+b.w/2,y:b.y+b.h/2}});const box=await page.locator('#dynWC').boundingBox();await page.mouse.click(box.x+hit.x,box.y+hit.y);assert.equal(await page.evaluate(()=>dynWSel),hit.id,'이동한 이름표 클릭');
    await page.locator('#dynTabs [data-dt="home"]').click();
    assert.equal(await page.locator('#dMap').getAttribute('data-collapsed'),'true','외교를 나가면 접힌 지도 복원');
    assert.deepEqual(errors,[],'브라우저 실행 오류');await context.close();
  }
  console.log('390·380·820px 실제 서버 UI: 주요 상태·메뉴 이동·필터·회사 개명·검색·즐겨찾기·지도 배치/클릭·가로 넘침 검사 완료');
}finally{if(browser)await browser.close();server.kill('SIGTERM')}})().catch(e=>{console.error(e);console.error(log);process.exitCode=1});
