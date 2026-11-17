// 가문 모드 화면(/god). remote-client.js 뒤에 붙고, 원래 화면의 지도·카드·기존 탭을 재사용한다.
// 서버가 보내는 view.dyn(내 캐릭터 요약)만 읽는다. 시뮬레이션 계산은 하지 않는다.
let dynView=null,dynTab='me',dynSend=null,dynApi=null,dynApiBase='',dynShownRes='',dynModalId=null;
const DYN_FULL_GROUPS=GROUPS.map(g=>[g[0],g[1].slice()]);
const dynEsc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const DYN_TABS=[['me','나'],['fam','가문'],['asset','재산'],['net','인맥'],['news','소식'],['power','권력+']];
function initDyn(send,api,base){
  dynSend=send;dynApi=api;dynApiBase=base;document.body.classList.add('dyn');
  const css=document.createElement('style');css.textContent=`
body.dyn .stats,body.dyn .foot{display:none!important}
.dynbar{background:var(--panel);border:2px solid #000;padding:8px 10px;margin:8px 0;display:flex;flex-wrap:wrap;gap:4px 12px;align-items:center;font-family:var(--f-head);font-size:15px}
.dynbar b{color:var(--gold);font-weight:400}.dynbar .who{font-size:17px;cursor:pointer;text-decoration:underline dotted}.dynbar small{color:var(--muted)}
.dynnote{display:block;width:100%;text-align:left;margin:6px 0;padding:8px 10px;border:2px solid #000;background:#3a2f12;color:var(--cream);font-family:var(--f-head);font-size:15px}
.dynnote.res{background:#1d2b22}.dynnote.wait{animation:dynblink 1.2s ease-in-out infinite alternate}@keyframes dynblink{to{background:#5a4512}}
.dyntabs{display:flex;gap:4px;flex-wrap:wrap;margin:6px 0}.dyntabs button{flex:1;min-width:52px;padding:7px 4px;font-size:14px}.dyntabs button.on{background:var(--gold);color:#000}
.dynpanel .sec{margin-bottom:10px}.dynpanel h4{margin:6px 0 4px;font-family:var(--f-head);font-weight:400;color:var(--gold);font-size:15px}
.dynpanel .kv>div{display:flex;justify-content:space-between;gap:8px;padding:3px 0;border-bottom:1px solid var(--line)}.dynpanel .kv span{color:var(--muted)}
.dynpanel .pp{cursor:pointer;text-decoration:underline dotted}.dynpanel .dead{opacity:.55}.dynpanel ul{margin:0;padding-left:18px}.dynpanel li{margin:2px 0}
.dynpanel .muted{color:var(--muted)}
.dynpanel .bud{display:block;margin:6px 0}.dynpanel .bud select{font-size:15px;padding:3px;margin-left:6px}.dynpanel .bud small{display:block;color:var(--muted);font-size:12px}
.dynpanel .actgrp{margin:8px 0}.dynpanel .act{display:block;width:100%;text-align:left;margin:4px 0;padding:8px 10px;font-size:14px}.dynpanel .act small{display:block;color:var(--muted);font-size:12px;line-height:1.4}
.dynpanel .act.arm{background:#5a4512}.dynpanel .act:disabled{opacity:.55}.dynpanel .err{color:#ff6b6b;font-size:13px}
.dynmodal{position:fixed;inset:0;z-index:100;background:#000b;display:flex;align-items:flex-end;justify-content:center;padding:12px}
.dynbox{background:var(--panel);border:3px solid #000;box-shadow:0 0 0 2px var(--gold);max-width:520px;width:100%;padding:14px;max-height:85vh;overflow:auto}
.dynbox h3{margin:0 0 8px;font-family:var(--f-head);font-weight:400;color:var(--gold);font-size:18px}.dynbox p{margin:0 0 10px;font-size:15px;line-height:1.55}
.dynbox .opt{display:block;width:100%;text-align:left;margin:6px 0;padding:10px;font-size:15px}.dynbox .opt small{display:block;color:var(--muted);font-size:12.5px}
.dynbox .stopnote{color:var(--muted);font-size:12.5px;margin-top:8px}.dynbox label{display:block;margin:6px 0;font-size:14px}.dynbox input{width:100%;font-size:16px;padding:6px;margin-top:2px}
.dynbox .err{color:#ff6b6b;font-size:13px;min-height:1em}
@media (max-width:700px){body.dyn .tabs.top{position:static;box-shadow:none;background:none;padding:0}
  body.dyn .dyntabs{position:fixed;left:0;right:0;bottom:0;z-index:50;background:#14162a;padding:6px 6px calc(6px + env(safe-area-inset-bottom));margin:0;flex-wrap:nowrap;box-shadow:0 -2px 10px #0008}
  body.dyn .dyntabs button{min-width:0;padding:8px 2px;font-size:13px}}`;
  document.head.appendChild(css);
  $('header.top .eyebrow').textContent='가문 모드 · 인물 중심';
  const bar=document.createElement('div');bar.id='dynBar';bar.className='dynbar';bar.textContent='가문 정보를 불러오는 중…';$('header.top').after(bar);
  const note=document.createElement('button');note.id='dynNote';note.className='dynnote';note.hidden=true;$('.screen').after(note);
  note.onclick=()=>{if(dynView?.pending.length)dynOpen(dynView.pending[0],true);else note.hidden=true};
  const tabs=document.createElement('nav');tabs.id='dynTabs';tabs.className='dyntabs';
  const panel=document.createElement('div');panel.id='dynPanel';panel.className='panel dynpanel';
  $('#tabsTop').before(tabs);$('#tabsTop').before(panel);
  tabs.innerHTML=DYN_TABS.map(([k,l])=>`<button data-dt="${k}">${l}</button>`).join('');
  tabs.querySelectorAll('button').forEach(b=>b.onclick=()=>{dynTab=b.dataset.dt;try{localStorage.setItem('v-dyntab',dynTab)}catch(e){}dynRender();if(dynTab==='power'){buildNav();renderPanel()}});
  try{const t=localStorage.getItem('v-dyntab');if(DYN_TABS.some(x=>x[0]===t))dynTab=t}catch(e){}
  const modal=document.createElement('div');modal.id='dynModal';modal.className='dynmodal';modal.hidden=true;document.body.appendChild(modal);
  // 권력+ 탭이 아닐 때는 기존 탭 내용을 서버에 요청하지 않는다.
  const rp=renderPanel;renderPanel=(...a)=>{if(dynTab==='power')return rp(...a)};
}
// 지위에 맞는 기존 탭만 남긴다(서버도 같은 규칙으로 막는다).
function dynFilterTabs(allowed){
  GROUPS.length=0;
  for(const [g,list] of DYN_FULL_GROUPS){const l=allowed?list.filter(t=>allowed.includes(t[0])):list;if(l.length)GROUPS.push([g,l])}
  if(!GROUPS.some(g=>g[1].some(t=>t[0]===tab)))tab=GROUPS[0]?.[1][0][0]||'mkt';
}
function dynHook(o){
  const prev=dynView;dynView=o.dyn||null;if(!dynView)return;
  const allowedKey=JSON.stringify(dynView.tabs);if(!prev||JSON.stringify(prev.tabs)!==allowedKey){dynFilterTabs(dynView.tabs);buildNav()}
  dynRender();
  if(dynView.pending.length){const p=dynView.pending[0];if(dynModalId!==p.id)dynOpen(p)}
  else if(dynModalId!=null){dynModalId=null;$('#dynModal').hidden=true}
}
const dynAge=x=>x?`${x.age}세`:'';
const dynPerson=x=>x?`<span class="pp${x.alive?'':' dead'}" data-person="${x.id}">${dynEsc(x.name)}</span>${x.alive?` (${x.age}세${x.sex?x.sex==='F'?'·여':'·남':''})`:` (${x.cause||'사망'})`}`:'-';
function dynRender(){
  const v=dynView;if(!v)return;const m=v.me;
  $('header.top h1').textContent=v.house;
  $('#dynBar').innerHTML=m?`<span class="who" data-person="${m.id}">👤 ${dynEsc(m.name)}(${m.age})</span><small>${m.occ?OCC_L[m.occ]:'정해진 업종 없음'} · ${dynEsc(v.house)} ${v.gen}대</small>
    <span>💰 <b>${money(v.assets?.w||0)}</b></span><span>⭐ 평판 <b>${Math.round((m.rep??1)*100)}</b></span><span>🏅 ${v.rankName}</span>${v.over?'<span>⚰️ 가문 단절</span>':''}`:'';
  $('#dynBar').querySelectorAll('[data-person]').forEach(b=>b.onclick=()=>select(+b.dataset.person));
  const note=$('#dynNote');
  if(v.pending.length){note.hidden=false;note.className='dynnote wait';note.textContent=`🔔 ${v.pending[0].text.slice(0,40)}${v.pending[0].text.length>40?'…':''}${v.pending.length>1?` 외 ${v.pending.length-1}건`:''} · 눌러서 선택`}
  else if(v.res&&dynShownRes!==JSON.stringify(v.res)){note.hidden=false;note.className='dynnote res';note.textContent='📜 '+v.res.text;dynShownRes=JSON.stringify(v.res)}
  document.querySelectorAll('#dynTabs button').forEach(b=>b.classList.toggle('on',b.dataset.dt===dynTab));
  const power=dynTab==='power';['#tabsTop','#tabs','#panel'].forEach(q=>$(q).hidden=!power);$('#dynPanel').hidden=power;
  if(power)return;
  const P=$('#dynPanel');const ae=document.activeElement;if(ae&&P.contains(ae)&&ae.tagName==='SELECT')return;// 고르는 중에는 다시 그리지 않음
  const html=dynPanelHTML(v);if(P._html===html)return;P._html=html;P.innerHTML=html;
  P.querySelectorAll('[data-person]').forEach(b=>b.onclick=()=>select(+b.dataset.person));dynBindActions(P);dynBindBudget(P);
}
function dynKV(rows){return `<div class="kv">${rows.filter(Boolean).map(([k,val])=>`<div><span>${k}</span><b>${val}</b></div>`).join('')}</div>`}
function dynPanelHTML(v){
  const m=v.me;if(!m)return '<p class="muted">캐릭터 정보가 없습니다.</p>';
  if(dynTab==='me')return `<div class="sec"><h4>${dynEsc(m.name)}</h4>${dynKV([['나이·성별',`${m.age}세 · ${m.sex==='F'?'여':'남'}`],['건강',Math.round(m.health)+'점'],['배고픔',Math.round(m.hunger)],
      m.happy!=null&&['행복',Math.round(m.happy*100)+'점'],['평판',Math.round((m.rep??1)*100)],['학력',EDU_L[m.edu||0]],['업종',m.occ?OCC_L[m.occ]:'없음'],
      ['고용주',m.emp?dynPerson(m.emp):'없음'],m.staff&&['고용한 사람',m.staff+'명'],m.grp&&['소속',dynEsc(m.grp.name)+(m.grp.leader?' (우두머리)':'')],m.caught&&['전과',m.caught+'번'],m.jail&&['처지','수감 중']])}
      <button data-person="${m.id}">자세한 인물 카드</button></div>
      <div class="sec"><h4>일</h4><label class="bud">하고 싶은 일 <select data-bud="job"><option value="-1" ${v.budget.job==null||v.budget.job<0?'selected':''}>성향대로(자동)</option>${(v.jobs||[]).map(j=>`<option value="${j.k}" ${v.budget.job===j.k?'selected':''}>${dynEsc(j.n)}</option>`).join('')}</select>
        <small>${dynEsc(((v.jobs||[]).find(j=>j.k===v.budget.job)||{}).h||'매일 할 일을 엔진이 성향과 벌이로 고릅니다. 고르면 그 일을 우선하되, 조건이 안 되면 다른 일을 합니다.')} · 오늘: ${dynEsc(DYN_ACT_N[v.act]??'-')}</small></label></div>
      ${dynActionsHTML(v)}`;
  if(dynTab==='fam'){const f=v.family;const list=(t,a)=>`<div class="sec"><h4>${t}</h4>${a.length?`<ul>${a.map(x=>`<li>${dynPerson(x)}</li>`).join('')}</ul>`:'<p class="muted">없음</p>'}</div>`;
    return `<div class="sec"><h4>${dynEsc(v.house)} · ${v.gen}대째</h4>${dynKV([['가문 시작',fmtD(v.start)],['최고 재산',money(v.peak.w)],['현재 지위',v.rankName]])}</div>
      <div class="sec"><h4>상속 순서</h4>${v.heirs.length?`<ol>${v.heirs.map(x=>`<li>${dynPerson(x)} · ${x.why}</li>`).join('')}</ol>`:'<p class="dynnote">⚠️ 상속자가 없습니다. 이대로 죽으면 가문이 끊깁니다.</p>'}</div>
      ${list('부모',f.parents)}${list('배우자',f.partner?[f.partner]:[])}${list('자녀',f.kids)}${f.grand.length?list('손자·손녀',f.grand):''}${list('형제자매',f.siblings)}
      <div class="sec"><h4>가문 연대기</h4><ul>${v.chron.slice().reverse().map(c=>`<li><small class="muted">${fmtD(c.d)} · ${c.gen}대</small> ${dynEsc(c.text)}</li>`).join('')}</ul></div>`}
  if(dynTab==='asset'){const a=v.assets;const hv=a.houses.reduce((t,h)=>t+h.v,0),sv=a.stocks.reduce((t,s)=>t+s.v,0),bv=a.bld.reduce((t,b)=>t+b.v,0);
    return `<div class="sec"><h4>재산</h4>${dynKV([['💵 현금',money(a.cash)],['📦 물건·도구',money(a.goods)],a.houses.length&&['🏠 집 '+a.houses.length+'채',money(hv)],a.plots&&['🌾 밭 '+a.plots+'필지',money(a.plotV)],
      a.shops&&['🏪 가게 '+a.shops+'곳',money(a.shopV)],a.bld.length&&['🏛️ 건물 '+a.bld.length+'채',money(bv)],a.stocks.length&&['📈 주식',money(sv)],a.dep&&['🏦 예금',money(a.dep)],a.lent&&['🤝 빌려준 돈 '+a.lentN+'건',money(a.lent)],
      a.debt&&['💳 빚 '+a.debtN+'건','-'+money(a.debt)],['순재산',money(a.w)],['하루 평균 소득',money(a.incAvg)],['사는 곳',a.home?(a.houses.some(h=>h.lives)?'내 집':'남의 집(세입자)'):'집 없음']])}</div>
      ${a.stocks.length?`<div class="sec"><h4>주식</h4>${dynKV(a.stocks.map(s=>[dynEsc(s.name),`${s.shares.toLocaleString()}주 · ${(s.pct*100).toFixed(1)}% · ${money(s.v)}`]))}</div>`:''}
      ${dynActionsHTML(v,true)}${dynBudgetHTML(v)}`}
  if(dynTab==='net'){const f=v.family;return `<div class="sec"><h4>인맥</h4>${dynKV([['배우자',f.partner?dynPerson(f.partner):'없음'],['고용주',m.emp?dynPerson(m.emp):'없음'],['고용한 사람',(m.staff||0)+'명'],['소속 조직',m.grp?dynEsc(m.grp.name):'없음'],['신앙',m.faith?'있음':'없음']])}</div>
      <div class="sec"><h4>사돈·가문 관계</h4>${(v.ties||[]).length?dynKV(v.ties.map(t=>[dynEsc(t.name),`${t.v>0?'우호':t.v<0?'적대':'보통'} ${Math.round(t.v*100)} · ${dynEsc(t.why)}`])):'<p class="muted">아직 사돈을 맺은 집안이 없습니다. 혼인으로 다른 집안과 손을 잡을 수 있습니다.</p>'}</div>
      <p class="muted">친구·원수·동업자 관계는 다음 작업에서 보강합니다.</p>`}
  if(dynTab==='news')return `<div class="sec"><h4>내 주변 소식</h4>${v.news.length?`<ul>${v.news.map(e=>`<li><small class="muted">${fmtD(e.d)}</small> ${dynEsc(e.text)}</li>`).join('')}</ul>`:'<p class="muted">아직 가족 주변에 별일이 없습니다.</p>'}</div>
      <div class="sec"><h4>마을 공지</h4><ul>${v.notices.slice().reverse().map(e=>`<li><small class="muted">${fmtD(e.d)}</small> ${dynEsc(e.text)}</li>`).join('')}</ul></div>`;
  return '';
}
const DYN_BUD=[['life','생활 수준',['궁핍','검소','보통','여유','사치'],['돈을 크게 아껴 금고에 모음 · 건강·행복·평판↓','조금 아껴 금고에 모음 · 행복 약간↓','추가 지출 없음','5일마다 일당 1일치 · 행복·건강↑','5일마다 일당 4일치 · 행복·건강·평판↑, 좋은 옷']],
  ['edu','자녀 교육비',['없음','기본','사교육','유학'],['집안 교육만','5일마다 자녀 1명당 일당 0.3일치','1일치 · 학력이 빨리 오름','2.5일치 · 고등·대학까지']],
  ['save','저축 비율',[0,.1,.2,.3,.4,.5].map(x=>Math.round(x*100)+'%'),['수입의 일부를 가문 금고에(대가 바뀌어도 이어짐)']],
  ['give','기부·후원',['없음','교회','촌장','가난한 이웃'],['','신앙·행복·평판↑','촌장 집안과 관계↑','평판↑']],
  ['debt','빚 상환',['최소','빨리'],['','5일마다 현금 30%까지 빚 갚기']]];
function dynBudgetHTML(v){const B=v.budget,sp=v.spent,wA=v.wageAvg||1;
  const sel=([k,l,opts,hints])=>{const cur=k==='save'?Math.round(B.save*10):B[k];return `<label class="bud">${l} <select data-bud="${k}">${opts.map((o,i)=>`<option value="${i}" ${i===cur?'selected':''}>${o}</option>`).join('')}</select><small>${dynEsc(hints[Math.min(cur,hints.length-1)]||'')}</small></label>`};
  return `<div class="sec"><h4>지출 설정</h4>${DYN_BUD.map(sel).join('')}
    ${sp?`<p class="muted">최근 5일 지출: 생활 ${money(sp.life)} · 교육 ${money(sp.edu)} · 기부 ${money(sp.give)} · 빚 ${money(sp.debt)} · 금고로 ${money(sp.saved)}</p>`:''}</div>
    <div class="sec"><h4>🔒 가문 금고 ${money(v.vault||0)}</h4><p class="muted">세금·도둑에 안 걸리고 다음 가장에게 그대로 넘어갑니다. 대신 투표·혼담에서 보는 재산에는 안 잡힙니다.</p>
    <button data-vault="out:0.5">절반 꺼내기</button> <button data-vault="out:1">전부 꺼내기</button> <button data-vault="in:0.5">현금 절반 넣기</button></div>`}
function dynBindBudget(P){P.querySelectorAll('[data-bud]').forEach(el=>el.onchange=async()=>{const k=el.dataset.bud;let val=+el.value;if(k==='save')val=val/10;
    try{await dynApi(dynApiBase+'/api/cmd',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'budget',budget:{[k]:val}})});await dynSend({action:'save'})}catch(e){alert(e.message)}});
  P.querySelectorAll('[data-vault]').forEach(b=>b.onclick=async()=>{const [dir,frac]=b.dataset.vault.split(':');b.disabled=true;
    try{await dynApi(dynApiBase+'/api/cmd',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'vault',dir,frac:+frac})});await dynSend({action:'save'})}catch(e){alert(e.message)}finally{b.disabled=false}})}
const DYN_ACT_N=['농사','요리','벌목','집짓기','남의 일','도둑질','쉬기','짝 찾기','경비','장인 일','광산','가르치기','장사'];
const DYN_ECO_G=['집·땅','주식','회사','돈'];
function dynActionsHTML(v,eco){const acts=(v.actions||[]).filter(a=>DYN_ECO_G.includes(a.group)===!!eco);if(!acts.length)return '';const groups=[...new Set(acts.map(a=>a.group))];
  return `<div class="sec"><h4>${eco?'투자·거래':'할 수 있는 일'}</h4><p class="muted">${eco?'값은 마을 시장 시세를 따릅니다. 사기나 대출 거절도 있을 수 있습니다.':'평소에는 성향대로 생활합니다. 아래 행동은 직접 고를 수 있습니다. 결과는 마을 사람들의 판단(투표·가담)에 달려 있습니다.'}</p>
    ${groups.map(g=>`<div class="actgrp"><b class="muted">${dynEsc(g)}</b>${acts.filter(a=>a.group===g).map(a=>`<button class="act${a.ok&&a.k===dynActArm?' arm':''}" data-act="${dynEsc(a.k)}" ${a.ok?'':'disabled'}>${dynEsc(a.label)}<small>${dynEsc(a.ok?(a.k===dynActArm?'한 번 더 누르면 실행합니다':a.hint):a.why)}</small></button>`).join('')}</div>`).join('')}
    <div class="err" id="dynActErr">${dynEsc(dynActErrText)}</div></div>`}
let dynActErrText='';
let dynActArm=null;
let dynArmTimer=0;
function dynBindActions(P){
  const arm=b=>{b.classList.add('arm');b.querySelector('small').textContent='한 번 더 누르면 실행합니다'};
  P.querySelectorAll('[data-act]').forEach(b=>{if(b.dataset.act===dynActArm&&!b.disabled)arm(b);b.onclick=async()=>{
  const k=b.dataset.act;if(dynActArm!==k){dynActArm=k;clearTimeout(dynArmTimer);dynArmTimer=setTimeout(()=>{dynActArm=null;dynRender()},5000);dynRender();return}
  clearTimeout(dynArmTimer);
  dynActArm=null;dynActErrText='';b.disabled=true;
  try{await dynApi(dynApiBase+'/api/cmd',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'act',k})});await dynSend({action:'save'})}
  catch(e){dynActErrText=e.message;dynRender()}}})}
function dynOpen(p,force){
  const box=$('#dynModal');dynModalId=p.id;box.hidden=false;
  const start=p.kind==='start',m=dynView?.me;
  box.innerHTML=`<div class="dynbox"><h3>${start?'가문 모드 시작':p.kind==='death'?'⚰️ 가장의 죽음':'🔔 선택'}</h3><p>${dynEsc(p.text)}</p>
    ${start&&m?`<label>성 <input id="dynSur" maxlength="2" value="${dynEsc(m.sur)}"></label><label>이름 <input id="dynGiven" maxlength="3" value="${dynEsc(m.given)}"></label>`:''}
    <div class="err" id="dynErr"></div>
    ${p.opts.map(o=>`<button class="opt" data-k="${dynEsc(o.k)}">${dynEsc(o.label)}${o.hint?`<small>${dynEsc(o.hint)}</small>`:''}</button>`).join('')}
    ${start?'':'<button class="opt" data-later="1">나중에 고르기 (창 닫기)<small>지도·가문 정보를 먼저 볼 수 있습니다. 위의 알림을 누르면 다시 열립니다.</small></button>'}
    <div class="stopnote">⏸ 고를 때까지 시간이 멈춰 있습니다.</div></div>`;
  const later=box.querySelector('[data-later]');if(later)later.onclick=()=>{box.hidden=true};
  box.querySelectorAll('.opt[data-k]').forEach(b=>b.onclick=async()=>{
    box.querySelectorAll('.opt').forEach(x=>x.disabled=true);
    try{
      if(start&&m){const sur=$('#dynSur').value.trim(),given=$('#dynGiven').value.trim();if(sur!==m.sur||given!==m.given)await dynApi(dynApiBase+'/api/cmd',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'rename',sur,given})})}
      box.hidden=true;await dynSend({action:'choose',id:p.id,k:b.dataset.k});
    }catch(e){box.hidden=false;$('#dynErr').textContent=e.message;box.querySelectorAll('.opt').forEach(x=>x.disabled=false)}
  });
}
