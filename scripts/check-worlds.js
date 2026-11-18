'use strict';
// 가문 모드 1단계: '/'(원래 마을)와 '/god'(가문 모드 마을)의 분리·전환 검사.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto'),zlib=require('node:zlib'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function start(port,saveDir,extra={}){
  const child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),POPULATION:'300',DYNASTY_POPULATION:'100',WORLD_SWITCH_MIN_MS:'0',VILLAGE_SAVE_DIR:saveDir,...extra},stdio:['ignore','pipe','pipe']});
  let out='';child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>{out+=b;process.stderr.write(b)});
  const base='http://127.0.0.1:'+port;
  return {child,base,log:()=>out};
}
async function waitHealth(base){for(let i=0;i<200;i++){await sleep(50);try{const h=await(await fetch(base+'/health')).json();if(h.ready)return h}catch{}}throw Error('서버 준비 안 됨')}
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
async function main(){
  const saveDir=path.join(root,'save','worlds-'+Date.now());
  const s=start(19301,saveDir);const {base}=s;
  const healthSamples=[];let sampling=true;
  const sampler=(async()=>{while(sampling){const t=performance.now();try{const h=await(await fetch(base+'/health')).json();healthSamples.push({ms:performance.now()-t,workers:h.workers,world:h.world})}catch{}await sleep(25)}})();
  try{
    await waitHealth(base);
    const page=await(await fetch(base+'/')).text(),god=await(await fetch(base+'/god')).text();
    assert(page.includes('window.API_BASE=""')&&god.includes('window.API_BASE="/god"'),'페이지별 API 접두어');
    assert(page.includes('id="modeLink"'),'가문 모드 링크');
    async function view(prefix,wantDay){
      for(let i=0;i<1200;i++){const r=await fetch(base+prefix+'/api/view');
        if(r.status===200){const v=await r.json();if(wantDay==null||v.day===wantDay)return {v,r}}else{assert.equal(r.status,503);const e=await r.json();assert(e.preparing)}
        await sleep(50)}
      throw Error(prefix+' 화면 대기 시간 초과');
    }
    const cmd=async(prefix,c)=>{const r=await fetch(base+prefix+'/api/cmd',{method:'POST',body:JSON.stringify(c)});assert.equal(r.status,200,await r.clone().text());return r.json()};

    let {v,r}=await view('');assert.equal(v.world,'village');assert.equal(v.population,300);assert.equal(r.headers.get('x-village-world'),'village');
    await cmd('',{action:'advance',days:30});({v}=await view('',30));
    // 가문 모드 마을로 전환
    const first=await fetch(base+'/god/api/view');assert.equal(first.status,503,'전환 중에는 기다리지 않고 503');
    ({v,r}=await view('/god'));assert.equal(v.world,'dynasty');assert.equal(v.population,100);assert.equal(v.canImport,false);
    const villageFile=path.join(saveDir,'village.json.gz'),godFile=path.join(saveDir,'god.json.gz');
    assert(fs.existsSync(villageFile),'전환 전에 원래 마을 저장');
    const savedVillage=JSON.parse(zlib.gunzipSync(fs.readFileSync(villageFile)));assert.equal(savedVillage.state.S.day,30);assert.equal(savedVillage.population,300);
    const villageHash=hash(villageFile);
    // 가문 모드: 시작 선택지가 떠 있으면 재생해도 날짜가 가지 않는다.
    assert(v.dyn&&v.waiting&&v.dyn.pending[0].kind==='start','시작 선택지 대기');
    await cmd('/god',{action:'advance',days:5});await cmd('/god',{action:'play'});await sleep(1500);
    ({v}=await view('/god'));assert.equal(v.day,0,'대기 중에는 진행 안 함');await cmd('/god',{action:'pause'});
    const rn=await cmd('/god',{action:'rename',sur:'홍',given:'길동'});assert.equal(rn.result.name,'홍길동');
    assert.equal((await fetch(base+'/god/api/cmd',{method:'POST',body:JSON.stringify({action:'rename',sur:'x',given:''})})).status,500);
    await cmd('/god',{action:'choose',id:v.dyn.pending[0].id,k:'go'});
    for(let i=0;i<100;i++){({v}=await view('/god'));if(v.day>=20)break;
      if(v.waiting){const p=v.dyn.pending[0];await cmd('/god',{action:'choose',id:p.id,k:p.opts.at(-1).k});continue}
      if(!v.jump)await cmd('/god',{action:'advance',days:20-v.day});await sleep(100)}
    assert.equal(v.day,20);assert.equal(v.dyn.me.sur==='홍'||v.dyn.gen>1,true);
    // 정보 제한: 내 캐릭터 카드는 보이고, 모르는 사람·열리지 않은 탭은 막힌다(최고 권력자 전에는).
    const me=v.dyn.me.id;const resident=await(await fetch(base+'/god/api/resident/'+me)).json();assert(resident.resident.g&&resident.resident.q&&resident.html);
    if(v.dyn.rank<4){assert.equal((await fetch(base+'/god/api/panel?tab=gov')).status,500);
      const stranger=v.map.agents.find(a=>a.id!==me&&!v.dyn.family.kids.some(k=>k.id===a.id)&&v.dyn.family.partner?.id!==a.id);
      if(stranger){const r=await fetch(base+'/god/api/resident/'+stranger.id);assert([200,403].includes(r.status))}}
    const panel=await(await fetch(base+'/god/api/panel?tab=mkt')).json();assert(panel.html.length>0);
    assert.equal((await fetch(base+'/god/api/import',{method:'POST',body:'{}'})).status,404,'가문 모드에는 기존 저장 가져오기 없음');
    // 반복 전환: 각 마을 날짜 유지, 원래 마을 저장 파일 불변
    for(let k=0;k<3;k++){
      ({v}=await view(''));assert.equal(v.day,30,'원래 마을 날짜 유지');assert.equal(v.world,'village');assert.equal(v.population,savedVillage.state.S.agents.length);
      assert.equal(hash(villageFile),villageHash,'가문 모드 진행이 원래 마을 저장을 바꾸지 않음');
      ({v}=await view('/god'));assert.equal(v.day,20,'가문 모드 날짜 유지');assert.equal(v.world,'dynasty');
    }
    assert(fs.existsSync(godFile));assert.equal(JSON.parse(zlib.gunzipSync(fs.readFileSync(godFile))).state.S.day,20);
    // 명령 요청은 전환을 기다렸다가 처리한다.
    const c=await cmd('',{action:'save'});assert.equal(c.day,30);
    sampling=false;await sampler;
    const maxWorkers=Math.max(...healthSamples.map(x=>x.workers)),maxMs=Math.max(...healthSamples.map(x=>x.ms));
    assert(maxWorkers<=1,'동시에 Worker 1개 이하: '+maxWorkers);
    assert(new Set(healthSamples.map(x=>x.world)).size>=2);
    // 종료 시 활성 마을 저장 후 정상 종료
    await cmd('',{action:'advance',days:5});await view('',35);await cmd('',{action:'save'});
    s.child.kill('SIGTERM');const exit=await new Promise(res=>s.child.once('exit',(code,signal)=>res({code,signal})));assert(exit.code===0||(process.platform==='win32'&&exit.code===null&&exit.signal==='SIGTERM'),s.log());
    assert.equal(JSON.parse(zlib.gunzipSync(fs.readFileSync(villageFile))).state.S.day,35,'종료 때 활성 마을 저장');
    assert.equal(JSON.parse(zlib.gunzipSync(fs.readFileSync(godFile))).state.S.day,20);
    // 최소 유지 시간: 방금 켠 마을을 다른 탭이 바로 빼앗지 못한다.
    const t=start(19302,saveDir,{WORLD_SWITCH_MIN_MS:'60000'});
    try{await waitHealth(t.base);
      for(let i=0;i<10;i++){const x=await fetch(t.base+'/god/api/view');assert.equal(x.status,503);await sleep(30)}
      const h=await(await fetch(t.base+'/health')).json();assert.equal(h.world,'village');assert.equal(h.switching,null);
      assert.equal((await(await fetch(t.base+'/api/view')).json()).day,35,'재시작 후 원래 마을 이어하기');
    }finally{t.child.kill()}
    console.log(JSON.stringify({switches:'village↔dynasty ×4',villageDay:35,dynastyDay:20,maxWorkers,healthSamples:healthSamples.length,maxHealthMs:+maxMs.toFixed(1),villageSaveUnchangedByDynasty:true,shutdownSaved:true,switchHold:true}));
    fs.rmSync(saveDir,{recursive:true,force:true});
  }finally{sampling=false;if(s.child.exitCode==null)s.child.kill()}
}
main().catch(e=>{console.error(e);process.exitCode=1});
