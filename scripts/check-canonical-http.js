'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),zlib=require('node:zlib'),{spawn}=require('node:child_process');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'fv4-http-')),base='http://127.0.0.1:19746';
const child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:'19746',INITIAL_WORLD:'canonical',CANONICAL_POPULATION:'5000',POPULATION:'20',WORLD_SWITCH_MIN_MS:'0',VILLAGE_SAVE_DIR:dir},stdio:['ignore','pipe','pipe']});let logs='',seq=0;
child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function json(route,body){const response=await fetch(base+route,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const value=await response.json();assert(response.ok,JSON.stringify(value));return value;}
async function view(prefix='/rebuild'){for(let i=0;i<500;i++){if(child.exitCode!==null)throw Error(logs);const r=await fetch(base+prefix+'/api/view');if(r.ok)return r.json();await sleep(100);}throw Error('세계 준비 시간 초과');}
async function command(action,args){const v=await view();const r={worldId:v.worldId,expectedRevision:v.revision,commandId:'http:'+ ++seq,actor:v.me.ref,action,args};const p=await json('/rebuild/api/preview',r);assert(p.allowed,JSON.stringify(p));const out=await json('/rebuild/api/execute',{...r,previewToken:p.previewToken});assert(out.allowed,JSON.stringify(out));return out;}
async function main(){
  for(let i=0;i<200;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}if(child.exitCode!==null)throw Error(logs);await sleep(100);}
  const v=await view();assert.equal(v.population,5000);assert(!JSON.stringify(v).includes('"q":'));
  const response=await fetch(base+'/rebuild/api/view',{headers:{'accept-encoding':'gzip'}});const etag=response.headers.get('etag');assert.equal((await fetch(base+'/rebuild/api/view',{headers:{'if-none-match':etag}})).status,304);
  const map=await json('/rebuild/api/map');assert(map.residentsLimited);assert(map.entities.some(e=>e.ref.kind==='house'));
  const last=await json('/rebuild/api/people?page=124');assert.equal(last.people.length,40);
  await command('choose',{id:v.pending[0].id,key:'go'});
  const malformed=await json('/rebuild/api/preview',{worldId:v.worldId});assert.equal(malformed.allowed,false);
  const now=await view();const build={worldId:now.worldId,expectedRevision:now.revision,commandId:'http:'+ (seq+1),actor:now.me.ref,action:'act',args:{key:'biz:build:fac'}};
  const denied=await json('/rebuild/api/preview',build);assert.equal(denied.allowed,false);
  const time=Date.now();const advancement=command('advance',{});await sleep(20);const health=await json('/health');assert.equal(health.workers,1);const healthMs=Date.now()-time;
  const result=await advancement;assert(Buffer.byteLength(JSON.stringify(result))<50000);
  const me=await json('/rebuild/api/detail?kind=person&id='+now.me.ref.id);assert(me.resident.g&&me.resident.q);
  const active=await view();const saved=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir,'canonical.json.gz'))));assert.equal(saved.engine.S.agents.filter(a=>a.alive).length,active.population);assert(saved.engine.S.agents.every(a=>a.g&&a.q));
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/rebuild');await page.getByRole('button',{name:'내 인물 살펴보기',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>typeof createWorld),'undefined','휴대폰에서 엔진을 실행하지 않음');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:'/workspace/artifacts/stage4-5000-mobile.png',fullPage:true});
    await page.getByRole('button',{name:'내 인물 살펴보기',exact:true}).click();await page.locator('#target h2').waitFor();assert.deepEqual(errors,[]);
  }finally{await browser.close();}
  await view('');const returned=await view();assert.equal(returned.worldId,active.worldId);assert.equal(returned.day,active.day);
  const restored=await json('/rebuild/api/detail?kind=person&id='+now.me.ref.id);assert.deepEqual(restored.resident.g,me.resident.g);assert.deepEqual(restored.resident.q,me.resident.q);
  assert.equal((await json('/health')).workers,1);
  console.log(`실제 HTTP/512MB Worker/5,000명: 경량 view ${Buffer.byteLength(JSON.stringify(v))}B, ETag, 지도/페이지/상세, 자격 거절, 하루 ${Buffer.byteLength(JSON.stringify(result))}B, 전체 g/q 저장, 기존 세계 전환 후 복원 통과 (병렬 health 관측 ${healthMs}ms)`);
}
main().catch(e=>{console.error(e.stack);console.error(logs);process.exitCode=1;}).finally(async()=>{child.kill('SIGTERM');if(child.exitCode===null)await new Promise(r=>child.once('exit',r));});
