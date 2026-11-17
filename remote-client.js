// 서버 모드: 폰에서는 step/createWorld/importState를 호출하지 않는다.
function initRemote(){
  const API=window.API_BASE||'';
  // 원래 마을('/')과 가문 모드('/god')를 오가는 링크. 서버 모드에서만 보인다.
  const mode=$('#modeLink');if(mode){mode.hidden=false;mode.href=API?'/':'/god';mode.textContent=API?'원래 마을로':'가문 모드';}
  const sessionId=Array.from({length:4},()=>Math.random().toString(36).slice(2)).join('');
  const isVisible=()=>document.visibilityState!=='hidden';
  function session(active){
    const body=JSON.stringify({id:sessionId,active});
    if(!active&&typeof navigator!=='undefined'&&navigator.sendBeacon){
      navigator.sendBeacon(API+'/api/session',new Blob([body],{type:'application/json'}));return;
    }
    fetch(API+'/api/session',{method:'POST',headers:{'content-type':'application/json'},body,keepalive:true}).catch(()=>{});
  }
  document.addEventListener('visibilitychange',()=>{session(isVisible());if(isVisible())poll()});
  window.addEventListener('pagehide',()=>session(false));
  window.addEventListener('pageshow',()=>{if(isVisible()){session(true);poll()}});
  session(isVisible());setInterval(()=>{if(isVisible())session(true)},15000);
  let view=null,etag='',panelToken=0,cardToken=0,lastPanel='',lastCard='',pollBusy=false,commandBusy=false,migrationTried=false,lastStop='';
  running=false;
  S={agents:[],houses:[],byId:new Map(),fx:[]};
  visAgents=()=>[];
  const api=async(url,options)=>{const r=await fetch(url,options);if(!r.ok){const e=await r.json().catch(()=>({error:r.statusText}));throw Error(e.error||'서버 요청 실패')}return r.json()};
  const send=async command=>{
    if(commandBusy)return;commandBusy=true;
    try{await api(API+'/api/cmd',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(command)});etag='';await poll();}
    catch(e){setSave('err',e.message)}finally{commandBusy=false}
  };
  async function migrateLocal(){
    if(migrationTried||!view.canImport)return;migrationTried=true;
    let db=null,uid=null;try{if(window.claude?.use){const[d,u]=await Promise.all([window.claude.use('db'),window.claude.use('user')]);if(d&&u){uid=await u.id();db=d}}}catch{}
    store.kind=db&&uid?'db':'local';store.db=db;store.uid=uid;
    let blob=await SV.read(false).catch(()=>null);if(!blob)blob=await SV.legacy();if(!blob)return;
    const saved=await unpack(blob);setSave('busy','기존 마을을 서버로 옮기는 중…');
    await api(API+'/api/import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(saved)});etag='';
  }
  W0={isAdult:a=>a.age>=ADULT,season:()=>view?.season||0,grpById:id=>(S.groups||[]).find(g=>g.id===id),houseById:id=>S.houses.find(h=>h.id===id),bName:b=>b.name||'건물'};
  select=id=>{sel=id;$('#card').hidden=false;lastCard='';renderCard();if(tab==='rich'){lastPanel='';renderPanel()}};
  renderPanel=async()=>{
    if(!view)return;const key=[seed,S.day,tab,logF,tab==='rich'?sel:''].join(':');if(key===lastPanel)return;
    const token=++panelToken;const wanted=tab;
    try{const o=await api(API+'/api/panel?'+new URLSearchParams({tab,filter:logF,selected:sel||''}));if(token!==panelToken||wanted!==tab)return;
      $('#panel').innerHTML=o.html;lastPanel=key;postPanel($('#panel'));
      $('#panel').querySelectorAll('.row[data-id]').forEach(r=>r.onclick=()=>select(+r.dataset.id));
      $('#panel').querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{logF=b.dataset.f;lastPanel='';renderPanel()});
    }catch(e){if(token===panelToken)setSave('err',e.message)}
  };
  renderCard=async()=>{
    if(!view||!sel)return;const key=[seed,S.day,sel].join(':');if(key===lastCard)return;const token=++cardToken,id=sel;
    try{const o=await api(API+'/api/resident/'+id);if(token!==cardToken||sel!==id)return;$('#card').innerHTML=o.html;lastCard=key;
      $('#card').querySelectorAll('[data-person]').forEach(b=>b.onclick=()=>select(+b.dataset.person));
      $('#cx').onclick=()=>{sel=null;++cardToken;$('#card').hidden=true;lastPanel='';renderPanel()};
    }catch(e){if(token===cardToken)setSave('err',e.message)}
  };
  renderUI=()=>{if(!view)return;
    const h=view.hud;$('#yr').textContent=view.year+'년차';$('#sea').textContent=SEASON[view.season]+' '+((S.day%15)+1)+'일';
    $('#sPop').textContent=view.population+'명';$('#sTop').textContent=money(h.top);$('#sMeal').textContent=money(dayFood(h.price)/3);
    $('#sHouse').textContent=h.houses+' / '+h.homeless;$('#sHungry').textContent=h.wageAvg!=null?money(h.wageAvg):'-';
    const m=h.miles.at(-1);$('#capText').textContent=m?m.text:'주민들이 막 정착했다. 아직 아무 규칙도 없다';$('#capWhen').textContent=m?fmtD(m.d)+' · 문명 기록 '+h.miles.length+'번째':'';
    $('#play').textContent=running?'일시정지':'재생';$('#play').classList.toggle('on',running);
    document.querySelectorAll('[data-sp]').forEach(b=>b.classList.toggle('on',+b.dataset.sp===speed));
    ['#ff1','#ff10','#reset'].forEach(q=>$(q).disabled=!!view.jump);$('#ff10').textContent=view.jump?'진행 '+Math.round((view.jump.total-view.jump.left)/view.jump.total*100)+'%':'+10년';
    setSave('ok',h.savedDay>=0?'서버에 저장됨 · '+(Math.floor(h.savedDay/YEAR)+1)+'년차':'서버에서 실행 중');
    renderPanel();if(sel)renderCard();
  };
  async function poll(){if(pollBusy||!isVisible())return;pollBusy=true;
    try{const r=await fetch(API+'/api/view',{headers:etag?{'if-none-match':etag}:{},cache:'no-store'});if(r.status===304)return;if(!r.ok){if(r.status===503){setSave('busy','마을 준비 중…');return}throw Error('서버 요청 실패')}
      const o=await r.json();etag=r.headers.get('etag')||'';const changed=seed!==o.seed;seed=o.seed;view=o;S=o.map;
      S.byId=new Map(S.agents.map(a=>[a.id,a]));S.miles=o.hud.miles;S.events=[];
      setMap(!!o.geometry.mapBig);restoreGeo(o.geometry.geo);PLOTS.length=0;PLOTS.push(...o.geometry.plots);EXPL.length=0;EXPL.push(...o.geometry.expl);
      fitMap();if(changed){sel=null;$('#card').hidden=true;lastPanel='';lastCard='';markStop()}
      running=o.running;speed=o.speed;bgKey='';
      if(o.stopped){const key=seed+':'+o.day;if(lastStop!==key){lastStop=key;showStop(o.stopped)}}
      if(window.DYN&&typeof dynHook==='function')dynHook(o);
      renderUI();render();await migrateLocal();
    }catch(e){setSave('err',e.message)}finally{pollBusy=false}
  }
  $('#play').onclick=()=>{markStop();send({action:running?'pause':'play'})};
  resumeRun=()=>{document.getElementById('stopBox').hidden=true;markStop();send({action:'play'})};$('#stopGo').onclick=resumeRun;
  document.querySelectorAll('[data-sp]').forEach(b=>b.onclick=async()=>{await send({action:'speed',value:+b.dataset.sp});await send({action:'play'})});
  $('#ff1').onclick=()=>send({action:'advance',days:YEAR});$('#ff10').onclick=()=>send({action:'advance',days:YEAR*10});
  $('#saveNow').onclick=()=>send({action:'save'});
  $('#autoStop').onchange=e=>{autoStop=e.target.value;send({action:'autostop',value:autoStop})};
  $('#reset').onclick=()=>{const b=$('#reset');if(!resetArm){resetArm=setTimeout(()=>{resetArm=0;b.textContent='새 마을';b.classList.remove('warn')},3000);b.textContent='지금 마을 지우기?';b.classList.add('warn');return}clearTimeout(resetArm);resetArm=0;b.textContent='새 마을';b.classList.remove('warn');send({action:'new',population:START_N})};
  function paint(now){requestAnimationFrame(paint);if(view&&now-last>100){last=now;try{render()}catch(e){showErr('지도',e)}}}
  if(window.DYN&&typeof initDyn==='function')initDyn(send,api,API);
  const initialized=poll();setInterval(poll,2000);requestAnimationFrame(paint);return initialized;
}
