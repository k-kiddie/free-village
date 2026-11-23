'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),zlib=require('node:zlib');
const {spawn,spawnSync}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'fv6-prod-http-')),base='http://127.0.0.1:19751';
// 준비용 프로세스가 종료된 뒤 실제 서버의 512MB Worker를 별도로 검사한다.
const setup=spawnSync(process.execPath,['-e',`
 const fs=require('node:fs'),z=require('node:zlib'),path=require('node:path');
 const {productionFixture}=require('./scripts/fixtures/business-production'),{createSession}=require('./rebuild/core/session');
 const f=productionFixture({population:5000}),s=createSession({mode:'strategy',legacy:f.state,playerId:f.me}),m=s.summary();
 const r={worldId:m.worldId,expectedRevision:m.revision,commandId:'fixture:1',actor:{kind:'person',id:m.playerId},action:'business.policy',args:{firmId:f.firmId,recipe:'meal',mode:'bulk',limit:12,markup:.85,enabled:true}},p=s.preview(r);
 if(!p.allowed||!s.execute({...r,previewToken:p.previewToken}).allowed)throw Error('준비 실패');
 fs.writeFileSync(path.join(process.env.VILLAGE_SAVE_DIR,'canonical.json.gz'),z.gzipSync(JSON.stringify(s.checkpoint())));s.close();
`],{cwd:root,env:{...process.env,VILLAGE_SAVE_DIR:dir},encoding:'utf8'});assert.equal(setup.status,0,setup.stderr);
const child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:'19751',INITIAL_WORLD:'canonical',VILLAGE_SAVE_DIR:dir},stdio:['ignore','pipe','pipe']});let logs='',seq=0,browser;
child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function get(route){const r=await fetch(base+route);assert(r.ok,await r.clone().text());return r.json();}
async function post(route,body){const r=await fetch(base+'/rebuild/api'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert(r.ok);return r.json();}
async function advance(){const v=await get('/rebuild/api/view'),r={worldId:v.worldId,expectedRevision:v.revision,commandId:'production-http:'+(seq+1),actor:v.me.ref,action:'advance',args:{}},p=await post('/preview',r);assert(p.allowed,JSON.stringify(p));const out=await post('/execute',{...r,previewToken:p.previewToken});assert(out.allowed,JSON.stringify(out));seq++;}
async function main(){
 for(let n=0;n<400;n++){if(child.exitCode!==null)throw Error(logs);try{const r=await fetch(base+'/rebuild/api/view');if(r.ok)break;}catch{}await wait(100);}
 assert.equal((await get('/rebuild/api/view')).population,5000);
 const start=Date.now(),pending=advance();await wait(20);const health=await get('/health'),healthMs=Date.now()-start;assert.equal(health.workers,1);await pending;await advance();
 const b=await get('/rebuild/api/business'),c=b.companies[0];assert(c.production.history.length===2&&c.production.history.every(d=>d.produced>0&&d.revenue>0));assert(Buffer.byteLength(JSON.stringify(b))<100000);
 const saved=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir,'canonical.json.gz'))));assert(saved.engine.S.agents.every(a=>a.g&&a.q));assert(saved.engine.S.agents.filter(a=>a.alive).length>=5000);
 const response=await fetch(base+'/rebuild/api/business',{headers:{'accept-encoding':'gzip'}});assert.equal(response.headers.get('content-encoding'),'gzip');
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/rebuild');await page.getByRole('button',{name:'▥ 사업 시작',exact:true}).click();await page.getByRole('heading',{name:'3일 운영 결과',exact:true}).waitFor();assert.equal(await page.evaluate(()=>typeof createWorld),'undefined');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
 await page.screenshot({path:'/workspace/artifacts/stage6-production-5000-mobile.png',fullPage:true});
 console.log(JSON.stringify({passed:'실제 HTTP/512MB Worker·통제5,000명·생산/고객 매출/저장 g/q·gzip·390px·브라우저 엔진 없음',healthMs,bytes:Buffer.byteLength(JSON.stringify(b)),population:saved.engine.S.agents.filter(a=>a.alive).length}));
}
main().catch(e=>{console.error(e.stack);console.error(logs);process.exitCode=1;}).finally(async()=>{await browser?.close();child.kill('SIGTERM');if(child.exitCode===null)await new Promise(r=>child.once('exit',r));});
