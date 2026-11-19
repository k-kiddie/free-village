// 가문 모드 화면(/god). remote-client.js 뒤에 붙고, 원래 화면의 지도·카드·기존 탭을 재사용한다.
// 서버가 보내는 view.dyn(내 캐릭터 요약)만 읽는다. 시뮬레이션 계산은 하지 않는다.
let dynNoteT=0,dynView=null,dynTab='home',dynSend=null,dynApi=null,dynApiBase='',dynShownRes='',dynModalId=null;
const DYN_FULL_GROUPS=GROUPS.map(g=>[g[0],g[1].slice()]);
const dynEsc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const DYN_TABS=[['home','🧭','한눈에'],['me','👤','인물'],['fam','🏠','가문'],['asset','💰','영지'],['dip','🌍','외교'],['plot','🗡️','음모'],['law','⚖️','정치'],['news','📰','소식'],['power','📊','통계']];
// 메뉴별 행동 묶음(서버 행동의 group). 목록에 없는 묶음은 인물 메뉴에 나온다.
const DYN_TAB_G={me:['관계 이어가기','궁중 관계','노동·사회','배움·전공','여행·여가','나의 정체성','건강','인맥','일자리','연애·욕망'],fam:['중매','가문의 어두운 면','가족','상속','자녀 교육','가문 목표'],asset:['부동산 개발','공방·생산','물품 거래','보험·조합','자선·기부','직접 수출입','내 건물','향락 사업','용병 회사','용병 계약','회사 경영','회사 확장','회사 · 어두운 경영','가게·일꾼','집·땅','주식','회사','돈'],dip:['외교','전쟁의 후유증','인질 외교','먼 나라 개입'],plot:['경제의 어두운 면','첩보','미인계·스캔들','어두운 길','어두운 길 · 범죄','어두운 길 · 고리대','어두운 길 · 인신매매','어두운 길 · 사법 조작','평판 싸움','교단 · 어둠'],law:['공적 업무','사법부','수사·재판','정부 세우기','조직','선거','법 바꾸기','권력','종교','교단 · 선행']};
const dynTabOfGroup=g=>/^(법|정치)/.test(g)?'law':Object.keys(DYN_TAB_G).find(k=>DYN_TAB_G[k].includes(g))||'me';
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
.dynpanel .actw{position:relative}.dynpanel .actw>.act{padding-right:38px}.dynpanel .actw>.fav{position:absolute;right:2px;top:6px;width:34px;padding:2px 0;background:none;border:none;box-shadow:none;font-size:20px;color:var(--muted)}.dynpanel .actw>.fav.on{color:#e8c25a}.dynpanel .hgrid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.dynpanel .hgrid>div{border:2px solid #000;background:var(--panel2);padding:6px 8px}.dynpanel .hgrid span{display:block;font-size:12px;color:var(--muted)}.dynpanel .hgrid b{display:block;font-size:15px}.dynpanel .hgrid small{display:block;font-size:11px;color:var(--muted)}.dynpanel .dynq{width:100%;box-sizing:border-box;padding:9px;font-size:15px;margin:4px 0}.dynpanel .act.warn{border-color:#a33}.dynpanel .hjump{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}.dynpanel .hjump button{font-size:13px;padding:5px 8px}.dynpanel .actgrp{margin:8px 0}.dynpanel .act{display:block;width:100%;text-align:left;margin:4px 0;padding:8px 10px;font-size:14px}.dynpanel .act small{display:block;color:var(--muted);font-size:12px;line-height:1.4}
.dynpanel .act.arm,.dynpanel .qty button.arm{background:#5a4512}.dynpanel .act.multi{background:var(--panel2);border:2px solid #000}.dynpanel .act.off{opacity:.55}.dynpanel .qty{display:flex;gap:6px;margin-top:6px}.dynpanel .qty button{flex:1;padding:6px 2px;font-size:13px}.dynpanel .act:disabled{opacity:.55}.dynpanel .err{color:#ff6b6b;font-size:13px}
.dynmodal{position:fixed;inset:0;z-index:100;background:#000b;display:flex;align-items:flex-end;justify-content:center;padding:12px}
.dynbox{background:var(--panel);border:3px solid #000;box-shadow:0 0 0 2px var(--gold);max-width:520px;width:100%;padding:14px;max-height:85vh;overflow:auto}
.dynbox h3{margin:0 0 8px;font-family:var(--f-head);font-weight:400;color:var(--gold);font-size:18px}.dynbox p{margin:0 0 10px;font-size:15px;line-height:1.55}
.dynbox .opt{display:block;width:100%;text-align:left;margin:6px 0;padding:10px;font-size:15px}.dynbox .opt small{display:block;color:var(--muted);font-size:12.5px}
.dynbox .stopnote{color:var(--muted);font-size:12.5px;margin-top:8px}.dynbox label{display:block;margin:6px 0;font-size:14px}.dynbox input{width:100%;font-size:16px;padding:6px;margin-top:2px}
.dynbox .err{color:#ff6b6b;font-size:13px;min-height:1em}
/* 폰: 아래로 내려 눌러도 결과가 보이게 — 알림은 하단 탭 위에 고정, 인물 카드는 아래에서 올라오는 시트 */
body.dyn .dynnote{position:fixed;left:8px;right:8px;bottom:calc(64px + env(safe-area-inset-bottom));z-index:70;width:auto;margin:0;box-shadow:0 2px 12px #000a}
body.dyn #card:not([hidden]){position:fixed;left:0;right:0;bottom:0;z-index:80;max-height:72vh;overflow:auto;margin:0;box-shadow:0 -4px 18px #000c;padding-top:4px}
body.dyn #card #cx{position:sticky;top:0;z-index:2}
.dyntop{position:fixed;right:10px;top:calc(10px + env(safe-area-inset-top));z-index:65;padding:8px 10px;font-size:13px;border:2px solid #000;box-shadow:0 2px 8px #000a}
.dynpanel details.actgrp{border:2px solid #000;background:var(--panel2);margin:6px 0;padding:0 8px}.dynpanel details.actgrp>summary{padding:9px 2px;font-size:15px;cursor:pointer;list-style:none}.dynpanel details.actgrp>summary::after{content:' ▾';color:var(--muted)}.dynpanel details[open].actgrp>summary::after{content:' ▴'}
.dynpanel details.actgrp>summary small{color:var(--muted);margin-left:6px}
@media (max-width:700px){body.dyn .tabs.top{position:static;box-shadow:none;background:none;padding:0}
  body.dyn .dyntabs{position:fixed;left:0;right:0;bottom:0;z-index:50;background:#14162a;padding:6px 6px calc(6px + env(safe-area-inset-bottom));margin:0;flex-wrap:nowrap;box-shadow:0 -2px 10px #0008}
  body.dyn .dyntabs button{min-width:0;padding:8px 2px;font-size:13px}}`;
  document.head.appendChild(css);
  $('header.top .eyebrow').textContent='가문 모드 · 인물 중심';
  const bar=document.createElement('div');bar.id='dynBar';bar.className='dynbar';bar.textContent='가문 정보를 불러오는 중…';$('header.top').after(bar);
  const note=document.createElement('button');note.id='dynNote';note.className='dynnote';note.hidden=true;$('.screen').after(note);
  note.onclick=()=>{const u=dynUrg(dynView);if(u.length)dynOpen(u[0],true);else note.hidden=true};
  const top=document.createElement('button');top.className='dyntop';top.textContent='▲ 지도';top.hidden=true;top.onclick=()=>window.scrollTo({top:0,behavior:'smooth'});document.body.appendChild(top);
  addEventListener('scroll',()=>{top.hidden=scrollY<500},{passive:true});
  const tabs=document.createElement('nav');tabs.id='dynTabs';tabs.className='dyntabs';
  const panel=document.createElement('div');panel.id='dynPanel';panel.className='panel dynpanel';
  $('#tabsTop').before(tabs);$('#tabsTop').before(panel);
  tabs.innerHTML=DYN_TABS.filter(t=>t[0]!=='power').map(([k,i,l])=>`<button data-dt="${k}"><span class="ic">${i}</span><span class="lb">${l}</span><i class="cnt" hidden></i></button>`).join('');
  tabs.querySelectorAll('button').forEach(b=>b.onclick=()=>{dynGoTo(b.dataset.dt);if(dynTab==='power'){buildNav();renderPanel()}});
  try{const t=localStorage.getItem('v-dyntab');if(DYN_TABS.some(x=>x[0]===t))dynTab=t}catch(e){}
  const modal=document.createElement('div');modal.id='dynModal';modal.className='dynmodal';modal.hidden=true;document.body.appendChild(modal);
  // 권력+ 탭이 아닐 때는 기존 탭 내용을 서버에 요청하지 않는다.
  const rp=renderPanel;renderPanel=(...a)=>{if(dynTab==='power')return rp(...a)};
  dynInitWorld();
  dynAppLayout();
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
  dynRender();if(dynMapMode==='world')dynDrawWorld();
  {const u=dynUrg(dynView);if(u.length){if(dynModalId!==u[0].id)dynOpen(u[0])}
  else if(dynModalId!=null&&!dynView.pending.some(p=>p.id===dynModalId)){dynModalId=null;$('#dynModal').hidden=true}}
}
const dynAge=x=>x?`${x.age}세`:'';
const dynPerson=x=>x?`<span class="pp${x.alive?'':' dead'}" data-person="${x.id}">${dynEsc(x.name)}</span> (${dynEsc(x.alive?[x.role||x.noble,`${x.age}세`].filter(Boolean).join(' · '):x.cause||'사망')})`:'-';
function dynRender(){
  const v=dynView;if(!v)return;const m=v.me;dynAppRender(v);
  $('header.top h1').textContent=v.house;
  $('#dynBar').innerHTML=m?`<span class="who" data-person="${m.id}">👤 ${dynEsc(m.name)}(${m.age})</span><small>${m.occ?OCC_L[m.occ]:'정해진 업종 없음'} · ${dynEsc(v.house)} ${v.gen}대</small>
    <span>💰 <b>${money(v.assets?.w||0)}</b></span><span>⭐ 평판 <b>${Math.round((m.rep??1)*100)}</b></span><span>🏅 ${v.rankName}</span>${v.over?'<span>⚰️ 가문 단절</span>':''}`:'';
  $('#dynBar').querySelectorAll('[data-person]').forEach(b=>b.onclick=()=>select(+b.dataset.person));
  const note=$('#dynNote');
  const urg=dynUrg(v);if(urg.length){note.hidden=false;note.className='dynnote wait';note.textContent=`🔔 ${urg[0].text.slice(0,40)}${urg[0].text.length>40?'…':''}${urg.length>1?` 외 ${urg.length-1}건`:''} · 눌러서 선택`}
  else if(v.res&&dynShownRes!==JSON.stringify(v.res)){note.hidden=false;note.className='dynnote res';note.textContent='📜 '+v.res.text+(v.res.changes?.length?' · '+v.res.changes.map(dynChangeLabel).join(' · '):'')+'  (눌러서 닫기)';dynShownRes=JSON.stringify(v.res);clearTimeout(dynNoteT);dynNoteT=setTimeout(()=>{if(note.className==='dynnote res')note.hidden=true},8000)}
  else if(!urg.length&&note.className==='dynnote wait')note.hidden=true;
  document.querySelectorAll('#dynTabs button').forEach(b=>b.classList.toggle('on',b.dataset.dt===dynTab));
  const power=dynTab==='power';['#tabsTop','#tabs','#panel'].forEach(q=>$(q).hidden=!power);$('#dynPanel').hidden=power;
  if(power)return;
  const P=$('#dynPanel');const ae=document.activeElement;if(ae&&P.contains(ae)&&(ae.tagName==='SELECT'||(ae.tagName==='INPUT'&&ae.type!=='checkbox'))){if(ae.id==='dynQ'){const r=P.querySelector('#dynQR'),h=dynSearchHTML(v);if(r&&r._html!==h){r._html=h;r.innerHTML=h;dynBindActions(r)}}return;}// 고르는 중에는 다시 그리지 않음
  const html=dynSheetHeader(v)+dynPanelHTML(v);if(P._html===html)return;P._html=html;
  // 교리 선택·교단 이름은 화면이 다시 그려져도 유지
  P.innerHTML=html;
  P.querySelectorAll('[data-person]').forEach(b=>b.onclick=()=>select(+b.dataset.person));dynBindActions(P);dynBindBudget(P);
  P.querySelectorAll('[data-goto]').forEach(b=>b.onclick=()=>dynGoTo(b.dataset.goto,b.dataset.focus));
  P.querySelectorAll('[data-find]').forEach(b=>b.onclick=dynFindActions);
  P.querySelectorAll('[data-wback]').forEach(b=>b.onclick=()=>{dynWSel=null;dynRender();if(dynMapMode==='world')dynDrawWorld()});
  P.querySelectorAll('[data-realm]').forEach(b=>b.onclick=()=>{dynWSel=b.dataset.realm;dynSetMap('world');dynRender();$('#dynSheet').scrollTop=0});
}
function dynKV(rows){return `<div class="kv">${rows.filter(Boolean).map(([k,val])=>`<div><span>${k}</span><b>${val}</b></div>`).join('')}</div>`}
function dynPanelHTML(v){
  const m=v.me;if(!m)return '<p class="muted">캐릭터 정보가 없습니다.</p>';
  if(dynTab==='home')return dynHomeHTML(v);
  if(dynTab==='me')return `<div class="sec"><h4>${dynEsc(m.name)}</h4>${dynKV([['나이·성별',`${m.age}세 · ${m.sex==='F'?'여':'남'}`],['건강',Math.round(m.health)+'점'],['배고픔',Math.round(m.hunger)],
      m.happy!=null&&['행복',Math.round(m.happy*100)+'점'],['평판',Math.round((m.rep??1)*100)],['스트레스',(v.stress||0)+'/100'],v.clergy&&['교단 지위',dynEsc(v.clergy)],['병역',m.drafted?'복무 중':m.altServ?'대체 복무 중':m.served?'군필':'미필'],['학력',EDU_L[m.edu||0]],['업종',m.occ?OCC_L[m.occ]:'없음'],
      !m.publicDuty&&['고용주',m.emp?dynPerson(m.emp):'없음'],m.staff&&['고용한 사람',m.staff+'명'],m.grp&&['소속',dynEsc(m.grp.name)+(m.grp.leader?' (우두머리)':'')],m.caught&&['전과',m.caught+'번'],m.jail&&['처지','수감 중']])}
      <button data-person="${m.id}">자세한 인물 카드</button></div>
      ${v.faithInfo?`<div class="sec"><h4>신앙 · ${dynEsc(v.faithInfo.name)}</h4>${dynKV([['교리',dynEsc(v.faithInfo.docs.join(' · '))],['다른 교단',v.faithInfo.others?.length?dynEsc(v.faithInfo.others.join(' · ')):'없음'],v.faithInfo.dream&&['이달의 계시',dynEsc(v.faithInfo.dream)],v.faithInfo.doomIn!=null&&['종말 예언',v.faithInfo.doomIn?v.faithInfo.doomIn+'일 남음':'오늘!'],['내 자리',v.faithInfo.leader?'교주':v.clergy?'성직자':'신도'],['신도',v.faithInfo.members+'명'],v.faithInfo.care!=null&&['교단 활동',v.faithInfo.care+'점'+(v.faithInfo.care<20?' · 뜸해서 신도가 떠나기 쉬움':v.faithInfo.care>=60?' · 활발해서 신도가 잘 남음':'')+(v.faithInfo.watch?' · 감시 중':'')],v.faithInfo.piety!=null&&['독실함 평균',v.faithInfo.piety+'점'+(v.faithInfo.shaky?` · 흔들리는 신도 ${v.faithInfo.shaky}명`:'')],v.faithInfo.via&&Object.keys(v.faithInfo.via).length&&['데려온 방법',dynEsc(Object.entries(v.faithInfo.via).map(([k,n])=>k+' '+n).join(' · '))],v.faithInfo.school&&['학교·고아원','운영 중'],v.faithInfo.leader&&['교단 금고',money(v.faithInfo.tre)],['교단 평판',dynEsc(v.faithInfo.repName)+` (${Math.round(v.faithInfo.rep*100)})`],v.faithInfo.state&&['지위','국교'],v.faithInfo.lock&&['세습','우리 가문이 대대로 이끎'],v.faithInfo.mutual&&['상호부조 계','운영 중'],v.faithInfo.rumor&&['소문','⚠️ 수상한 소문이 돈다']])}<small class="muted">종교 행동은 ⚖️ 정치 탭(창시·전도·선행)과 🗡️ 음모 탭(어둠)에 있습니다.</small></div>`:''}
      ${dynWorkHTML(v)}
      ${dynSocialHTML(v)}${dynRelationshipsHTML(v)}${dynActionsHTML(v,'me')}${dynNetHTML(v)}`;
  if(dynTab==='fam'){const f=v.family;const list=(t,a)=>`<div class="sec"><h4>${t}</h4>${a.length?`<ul>${a.map(x=>`<li>${dynPerson(x)}</li>`).join('')}</ul>`:'<p class="muted">없음</p>'}</div>`;
    return `<div class="sec"><h4>${dynEsc(v.house)} · ${v.gen}대째</h4>${dynKV([['가문 시작',fmtD(v.start)],['최고 재산',money(v.peak.w)],['현재 지위',v.rankName],v.world&&['우리 땅',`${dynEsc(v.world.us.name)} · 인구 ${(v.world.us.effPop||v.world.us.pop).toLocaleString()}명(속령 포함)`]])}</div>
      <div class="sec"><h4>인구 흐름</h4>${dynKV([['현재 인구',`${v.population.current.toLocaleString()}명`],['수용 상한',`${v.population.capacity.toLocaleString()}명`],['올해 출생·사망',`${v.population.births}명 · ${v.population.deaths}명`],['올해 유입·유출',`${v.population.in}명 · ${v.population.out}명`]])}<small class="muted">출생·이주가 인구에 반영되며, 상한에 가까워지면 새 이주 유입이 제한됩니다.</small></div>
      <div class="sec"><h4>상속 순서</h4>${v.heirs.length?`<ol>${v.heirs.map(x=>`<li>${dynPerson(x)} · ${x.why}</li>`).join('')}</ol>`:'<p class="dynnote">⚠️ 상속자가 없습니다. 이대로 죽으면 가문이 끊깁니다.</p>'}${v.regent?`<p class="dynnote">👤 섭정: ${dynPerson(v.regent)} (16세가 될 때까지 · 재산을 가로챌 수 있음)</p>`:''}</div>
      ${list('부모',f.parents)}${list('배우자',f.partner?[f.partner]:[])}${list('자녀',f.kids)}${f.grand.length?list('손자·손녀',f.grand):''}${list('형제자매',f.siblings)}
      ${(v.past||[]).length?`<div class="sec"><h4>끊어진 가문</h4><ul>${v.past.map(x=>`<li>⚰️ ${dynEsc(x.house)} · ${x.gen}대 ${x.years}년 · 최대 재산 ${money(x.peakW)}${x.title?' · '+dynEsc(x.title):''}</li>`).join('')}</ul></div>`:''}
      ${v.goals?.length?`<div class="sec"><h4>가문 목표</h4>${dynKV(v.goals.map(g=>[dynEsc(g.label),dynEsc(g.claimed?'보상 수령':g.progress+(g.active?' · 선택한 목표':''))]))}</div>`:''}
      ${dynActionsHTML(v,'fam')}
      <div class="sec"><h4>가문 연대기</h4><ul>${v.chron.slice().reverse().map(c=>`<li><small class="muted">${fmtD(c.d)} · ${c.gen}대</small> ${dynEsc(c.text)}</li>`).join('')}</ul></div>`}
  if(dynTab==='asset'){const a=v.assets;const hv=a.houses.reduce((t,h)=>t+h.v,0),sv=a.stocks.reduce((t,s)=>t+s.v,0),bv=a.bld.reduce((t,b)=>t+b.v,0);
    return `<div class="sec"><h4>재산</h4>${dynKV([['💵 현금',money(a.cash)],['📦 물건·도구',money(a.goods)],a.houses.length&&['🏠 집 '+a.houses.length+'채',money(hv)],a.plots&&['🌾 밭 '+a.plots+'필지',money(a.plotV)],
      a.shops&&['🏪 가게 '+a.shops+'곳',money(a.shopV)],a.bld.length&&['🏛️ 건물 '+a.bld.length+'채',money(bv)],a.stocks.length&&['📈 주식',money(sv)],a.dep&&['🏦 예금',money(a.dep)],a.lent&&['🤝 빌려준 돈 '+a.lentN+'건',money(a.lent)],
      a.debt&&['💳 빚 '+a.debtN+'건','-'+money(a.debt)],['순재산',money(a.w)],['하루 평균 소득',money(a.incAvg)],['사는 곳',a.home?(a.houses.some(h=>h.lives)?'내 집':'남의 집(세입자)'):'집 없음']])}</div>
      ${dynCoHTML(v)}${dynMercHTML(v)}${dynEconomyHTML(v)}
      ${a.stocks.length?`<div class="sec"><h4>주식</h4>${dynKV(a.stocks.map(s=>[dynEsc(s.name),`${s.shares.toLocaleString()}주 · ${(s.pct*100).toFixed(1)}% · ${money(s.v)}`]))}</div>`:''}
      ${v.bank?`<div class="sec"><h4>${dynEsc(v.bank.name)} 손익 장부</h4>${dynKV([['설립 자본·준비금',`${money(v.bank.capital)} · ${money(v.bank.reserve)}`],['대출 잔액·예금',`${money(v.bank.loans)} · ${money(v.bank.deposits)}`],['기업 대출 잔액',money(v.bank.corporateLoans)],['중앙은행 기준금리',`${(v.bank.baseRate*100).toFixed(2)}%/10일`],['내 은행 대출 기준',`${(v.bank.loanRate*100).toFixed(2)}%/10일`],['누적 대출 이자 수입',money(v.bank.interestIncome)],['누적 예금 이자 비용',money(v.bank.depositExpense)],['무담보 부실 원금',money(v.bank.badDebt)],['담보 압류 건수',v.bank.foreclosures+'건'],['누적 이자 손익',money(v.bank.net)]])}<small class="muted">대출 원금 회수는 수입이 아니라 자산 회수로 계산합니다. 아직 급여 등 별도 운영비는 없습니다.</small></div>`:''}${v.corpCredit?.length?`<div class="sec"><h4>기업 대출 계약</h4>${dynKV(v.corpCredit.map(l=>[`${dynEsc(l.firm)} · ${dynEsc(l.role)}`,`${money(l.balance)} · ${(l.rate*100).toFixed(2)}%/10일 · ${l.term}회 · ${dynEsc(l.status)} · ${l.collateral}`]))}</div>`:''}${dynProvHTML(v)}${dynActionsHTML(v,'asset')}${dynBudgetHTML(v)}`}
  if(dynTab==='dip')return dynDipHTML(v);
  if(dynTab==='plot')return `${v.spyCareer?`<div class="sec"><h4>${dynEsc(v.spyCareer.title)}</h4><p class="muted">${v.spyCareer.active?'나라 정보기관의 현장 요원입니다. 현장 임무로 경력을 쌓고, 정계에 진출해 정보기관장으로 임명되면 조직을 직접 운영할 수 있습니다.':'예전에 정보기관에서 일했던 경력이 있습니다. 지금은 소속이 없지만 뒷조사·첩자 같은 첩보 기술은 그대로 쓸 수 있습니다. 정부가 서고 정보기관이 생기면 현직으로 돌아가거나 기관장을 노릴 수 있습니다.'}</p></div>`:''}${v.spyAgency?`<div class="sec"><h4>비밀 정보조직</h4><p class="muted">요원 ${v.spyAgency.size}명 · 평균 충성도 ${v.spyAgency.loyalty}% · 운영비 ${money(v.spyAgency.upkeep)}/일 · 발각 위험 ${Math.round(v.spyAgency.risk*100)}%/일</p>${v.spyAgency.reports.map(r=>`<p>${dynEsc(r.text)}</p>`).join('')}</div>`:''}<div class="sec"><h4>음모</h4><p class="muted">뒷조사·첩자·평판 싸움·어두운 길. 들킬 수 있고, 들키면 체제에 따라 스캔들이나 원한이 생깁니다.</p></div>${dynActionsHTML(v,'plot')||'<p class="muted">지금 할 수 있는 음모가 없습니다. 정치적 영향력이 커지면 첩보 임무가 열립니다.</p>'}`;
  if(dynTab==='law')return `${dynPublicSummary(v)}<div class="sec"><h4>정치</h4>${dynKV([['체제',dynEsc(v.world?.us.regName||'-')],['통치자',v.world?.us.ruler?`${dynEsc(v.world.us.ruler.title)} ${dynEsc(v.world.us.ruler.name)}`:'없음'],['내 지위',v.rankName+(v.title?' · '+dynEsc(v.title):'')+(v.me.pardoned?' · 사면·복권':v.me.banned?' · 출마 제한':'')]])}</div>${v.ministry?`<div class="sec"><h4>담당 부처 · ${dynEsc(v.ministry.title)}</h4>${dynKV([['부처',dynEsc(v.ministry.name||'-')],['연간 예산',money(v.ministry.budget||0)],v.ministry.army&&['국가 군대',`군대 단계 ${v.ministry.army.level} · 병력 지수 ${Math.round(v.ministry.army.strength)} · 사기 ${Math.round(v.ministry.army.morale*100)}%`],['업무 능력',Math.round((v.ministry.score||0)*100)+'점']])}</div>`:''}${v.ministerLobby?`<div class="sec"><h4>장관직 로비</h4><p>${dynEsc(v.ministerLobby.title|| (v.ministerLobby.key==='def'?'국방부 장관':v.ministerLobby.key==='sec'?'국가정보원장':'장관'))}직을 요청했습니다 · ${Math.max(0,Math.ceil((v.ministerLobby.until-S.day)/YEAR))}년 유효</p></div>`:''}${v.privateMilitia?`<div class="sec"><h4>비밀 사병 ${v.privateMilitia.exposed?'· 발각됨':''}</h4>${dynKV([['대원',v.privateMilitia.size+'명'],['충성도',Math.round(v.privateMilitia.loyalty*100)+'%'],['운영비',money(v.privateMilitia.upkeep)+'/일'],['발각 위험',v.privateMilitia.risk?(v.privateMilitia.risk<.01?'1% 미만':Math.round(v.privateMilitia.risk*100)+'%'):'0%']])}</div>`:''}${dynActionsHTML(v,'law')||'<p class="muted">지금 할 수 있는 정치 행동이 없습니다.</p>'}`;
  if(dynTab==='net'){const f=v.family;return `<div class="sec"><h4>인맥</h4>${dynKV([['배우자',f.partner?dynPerson(f.partner):'없음'],!m.publicDuty&&['고용주',m.emp?dynPerson(m.emp):'없음'],['고용한 사람',(m.staff||0)+'명'],['소속 조직',m.grp?dynEsc(m.grp.name):'없음'],['신앙',m.faith?'있음':'없음']])}</div>
      <div class="sec"><h4>사돈·가문 관계</h4>${(v.ties||[]).length?dynKV(v.ties.map(t=>[dynEsc(t.name),`${t.v>0?'우호':t.v<0?'적대':'보통'} ${Math.round(t.v*100)} · ${dynEsc(t.why)}`])):'<p class="muted">아직 사돈을 맺은 집안이 없습니다. 혼인으로 다른 집안과 손을 잡을 수 있습니다.</p>'}</div>
      <p class="muted">친구·원수·동업자 관계는 다음 작업에서 보강합니다.</p>`}
  if(dynTab==='news')return `${dynInboxHTML(v)}${v.res?`<div class="sec"><h4>최근 결과</h4><p>${dynEsc(v.res.text)}</p>${v.res.changes?.length?`<ul>${v.res.changes.map(change=>`<li>${dynEsc(dynChangeLabel(change))}</li>`).join('')}</ul>`:''}</div>`:''}${dynNewActsHTML()}${v.specials?.length?`<div class="sec"><h4>⭐ 특별한 순간</h4><ul>${v.specials.slice().reverse().map(x=>`<li><small class="muted">${fmtD(x.d)} · ${x.gen}대</small> <b>${dynEsc(x.title)}</b> — ${dynEsc(x.choice)} → ${dynEsc(x.res)}</li>`).join('')}</ul></div>`:''}<div class="sec"><h4>내 주변 소식</h4>${v.news.length?`<ul>${v.news.map(e=>`<li><small class="muted">${fmtD(e.d)}</small> ${dynEsc(e.text)}</li>`).join('')}</ul>`:'<p class="muted">아직 가족 주변에 별일이 없습니다.</p>'}</div>
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
const dynUrg=v=>(v?.pending||[]).filter(p=>!p.inbox),dynInb=v=>(v?.pending||[]).filter(p=>p.inbox).sort((a,b)=>(a.due??0)-(b.due??0));
function dynInboxHTML(v){const IB=dynInb(v);if(!IB.length)return '';return `<div class="sec inbox"><h4>📥 받은 일 <small>${IB.length}건 · 시간은 계속 흐릅니다</small></h4>${IB.map(p=>{const left=p.due!=null?p.due-S.day:null;return `<button class="act${left!=null&&left<=3?' warn':''}" data-inbox="${p.id}">${dynEsc(p.title||p.text.slice(0,30))}<small>${left!=null?(left>0?left+'일 남음':'오늘까지'):''}${p.kind==='notice'?' · 알림':''}</small></button>`}).join('')}</div>`}
function dynTodayText(v){const t=v.today;if(!t)return '';const head=t.kind==='duty'?`🏛️ 공무${t.office?' ('+t.office+')':''}`:t.kind==='slack'?`😴 땡땡이 → ${t.didN}`:t.kind==='manage'?'💼 사업 경영':`${t.didN}`;return head+(t.why?` · ${t.why}`:'')}
function dynWorkHTML(v){const B=v.budget||{},jobs=v.jobs||[],sel=(key,cur,first)=>`<select data-bud="${key}"><option value="-1" ${cur==null||cur<0?'selected':''}>${first}</option>${jobs.filter(j=>j.k!==100||v.canManage||cur===100).map(j=>`<option value="${j.k}" ${cur===j.k?'selected':''}>${dynEsc(j.n)}${j.wage?` · ${money(j.wage.min)}~${money(j.wage.max)}/일`:''}</option>`).join('')}</select>`;
  const j1=jobs.find(x=>x.k===B.job);
  return `<div class="sec"><h4>하루 일</h4>${v.official?`<label class="bud">공무 (${dynEsc(v.official)}) <select data-bud="duty">${['성실 · 지지율·평판↑, 스트레스↑','보통','땡땡이 · 아래 일을 함, 쌓이면 해임·망신'].map((l,i)=>`<option value="${i}" ${(B.duty??1)===i?'selected':''}>${l}</option>`).join('')}</select>${v.slack?`<small>땡땡이 누적 ${v.slack}</small>`:''}</label>`:''}
    <label class="bud">1순위 ${sel('job',B.job,'성향대로 자동 선택')}</label>${B.job!=null&&B.job>=0?`<label class="bud">2순위 ${sel('job2',B.job2,'없음')}</label>${B.job2!=null&&B.job2>=0?`<label class="bud">3순위 ${sel('job3',B.job3,'없음')}</label>`:''}`:''}
    <small>${dynEsc(j1?j1.h:'기술과 조건에 맞는 합법 일감을 엔진이 고릅니다.')}${v.canManage?` · 최근 30일 경영 ${v.manageRatio}일`:''}</small>
    <p class="today">오늘: <b>${dynEsc(dynTodayText(v)||DYN_ACT_N[v.act]||'-')}</b></p></div>`}
const DYN_ACT_N=['농사','요리','벌목','집짓기','남의 일','도둑질','쉬기','짝 찾기','경비','장인 일','광산','가르치기','장사'];
const DYN_ECO_G=['집·땅','주식','회사','돈'];
function dynRelationshipsHTML(v){return (v.relationships||[]).map(r=>`<div class="sec"><h4>💬 ${dynEsc(r.name)} · ${dynEsc(r.role)}</h4>${dynKV([['애정·신뢰·질투',`${Math.round(r.affection*100)} · ${Math.round(r.trust*100)} · ${Math.round(r.jealousy*100)}`],['원하는 것',dynEsc(r.goal)]])}${r.appointment?`<p>${fmtD(r.appointment)} 만남 약속</p>`:''}${r.promise?`<p>${fmtD(r.promise.due)}까지 함께할 시간${r.promise.broken?' · 지키지 못함':''}</p>`:''}${r.history.map(h=>`<small class="muted">${dynEsc(h.text)}</small>`).join('<br>')}</div>`).join('')}
function dynSocialHTML(v){const s=v.social;if(!s)return '';return `<div class="sec"><h4>생활·사회</h4>${dynKV([['학력·전공',s.education+'단계'+(s.major?' · '+dynEsc(s.major):'')],['나의 지향',dynEsc(s.orient)+(s.public?' · 공개':' · 사생활')],['도박 습관',Math.round(s.gambling*100)+'점']])}${s.study?`<p>${dynEsc(s.study.majorName||'고등 교육')} · ${s.study.days}일 남음 · 학습 ${Math.round(s.study.p)}/${s.study.need}</p>`:''}${s.basic?`<p>성인 교육 · 학습 ${s.basic.progress}일</p>`:''}${s.trip?`<p>${dynEsc(s.trip.country)} 여행 · ${fmtD(s.trip.until)} 귀환 예정</p>`:''}${s.union?`<p>${dynEsc(s.union.fname)} 노조 · ${s.union.n}명 · 협상 승리 ${s.union.wins}회</p>`:''}</div>`}
function dynEconomyHTML(v){const e=v.economy;if(!e||!(e.insurance||e.policies?.length||e.coop||e.debts?.length||e.funds?.length))return '';return `<div class="sec"><h4>보험·조합·재단</h4>${e.insurance?dynKV([['내 보험사',dynEsc(e.insurance.name)],['집계 보험료·보험금',money(e.insurance.premiums)+' · '+money(e.insurance.claims)]]):''}${e.policies.map(p=>`<p>${dynEsc(p.name)} · ${p.kind==='house'?'주택':'도난'} 보장 ${money(p.cover)} · 열흘 보험료 ${money(p.prem)}</p>`).join('')}${e.coop?`<p>조합 ${e.coop.id} · 공동 기금 ${money(e.coop.fund)}</p>`:''}${e.debts.map(d=>`<p>조합 대출 ${money(d.balance)} · 만기 ${fmtD(d.due)}${d.overdue?' · 연체':''}</p>`).join('')}${e.funds.map(f=>`<p>${dynEsc(f.name)} · 잔액 ${money(f.cash)} · 누적 지원 ${money(f.spent)}</p>`).join('')}</div>`}
function dynMercHTML(v){return (v.mercenaries||[]).map(f=>`<div class="sec"><h4>⚔️ ${dynEsc(f.name)}</h4>${dynKV([['회사 현금',money(f.cash)],['대원',f.members.length+'명 · 누적 전사 '+f.losses+'명'],['숙련·사기·피로',`${Math.round(f.training*100)} · ${Math.round(f.morale*100)} · ${Math.round(f.fatigue*100)}`],['장비·계약 신용',`${f.gear}/5 · ${Math.round(f.reputation*100)}`],['미지급 급여',money(f.arrears)],['종전 후 미수 보수',money(f.receivables||0)],['파견 전투력',Math.round(f.power)]])}${f.contract?`<p>${dynEsc(f.contract.country)} · ${dynEsc(f.contract.missionName)} · ${f.contract.days}일 · ${dynEsc(({active:'계약 중',victory:'승전',defeat:'패전',withdraw:'철수',expired:'기간 만료',peace:'종전'})[f.contract.status]||f.contract.status)}${f.contract.paused?' · 정권 교체로 계약 확인 필요':''}<br>미수 보수 ${money(f.contract.arrears)}</p>`:''}<ul>${f.members.map(m=>`<li>${m.commander?'★ ':''}${dynEsc(m.name)} · 건강 ${Math.round(m.health)} · ${m.captive?'포로 ('+dynEsc(m.captive)+')':m.away?'파견 중':'주둔'}</li>`).join('')}</ul>${f.log.map(l=>`<small class="muted">${dynEsc(l.text)}</small>`).join('<br>')}</div>`).join('')}
function dynCoHTML(v){const mercIds=new Set((v.mercenaries||[]).map(x=>x.id)),L=(v.co||[]).filter(x=>!mercIds.has(x.id));if(!L.length)return '';const pct=x=>Math.round((x||0)*100);
  return `<div class="sec"><h4>🏭 회사 현황판</h4>${L.map(c=>{const mor=c.morale==null?'':c.morale<.3?'😡 '+pct(c.morale):c.morale<.5?'😐 '+pct(c.morale):'🙂 '+pct(c.morale);
    return `<details class="coCard" ${L.length===1?'open':''}><summary><b>${dynEsc(c.name)}</b> <small>${c.mine?'내가 사장':'사장 '+dynEsc(c.ceo)} · 지분 ${(c.stake*100).toFixed(1)}%${c.listed?' · 📈상장':''}${c.strike?' · ✊파업 중':''}</small></summary>
    ${dynKV([['분야',dynEsc(c.lines.join('·'))],['한 달 매출 · 순이익',`${money(c.rev)} · ${money(c.prof)}`],['지난달 경영 효과',(c.gain>=0?'+':'')+money(c.gain)],['회사 현금 · 빚',`${money(c.cash)} · ${c.debt?'-'+money(c.debt):'없음'}`],['직원 · 평균 일당',`${c.staff}명 · ${money(c.wage)}`],
      ['주가 · 시가총액',`${money(c.price)} · ${money(c.cap)}`],c.morale!=null&&['직원 사기',mor],(c.fac||c.br)&&['설비 · 지점',`${c.fac}/5단계 · ${c.br}곳`],c.pat.length&&['특허',dynEsc(c.pat.join(', '))],c.ad&&['광고',`매출 +${pct(c.ad)}%`],(c.wel||c.fund)&&['복지',[c.wel?'직원 복지':'',c.fund?'장학 재단':''].filter(Boolean).join(' · ')],
      c.parent&&['모회사',dynEsc(c.parent)],c.subs.length&&['계열사',dynEsc(c.subs.join(', '))],c.heir&&['후계자',dynEsc(c.heir)],c.exec.length&&['임원',dynEsc(c.exec.join(', '))],c.risk>0&&['⚠️ 들킬 위험',pct(c.risk)+'']])}
    ${c.log.length?`<small class="muted">${c.log.map(x=>dynEsc(x.text)).join('<br>')}</small>`:''}</details>`}).join('')}</div>`}
const dynCompanyNames=new Map();
function dynCompanyNameHTML(a){const spec=a.companyNameSpec,key=dynEsc(a.k);return `<div class="act multi${a.ok?'':' off'}"><b>${dynEsc(a.label)}</b><small>${dynEsc(a.ok?a.hint:a.why)}</small><label>회사 이름<input data-company-name="${key}" maxlength="30" value="${dynEsc(dynCompanyNames.get(a.k)??spec.value)}" placeholder="${spec.optional?'비우면 자동으로 정합니다':'새 회사 이름'}" ${a.ok?'':'disabled'}></label><button data-company-submit="${key}" ${a.ok?'':'disabled'}>${spec.optional?'이 이름으로 회사 설립':'회사 이름 변경'}</button></div>`}
function dynActHTML0(a){return (a.companyNameSpec?dynCompanyNameHTML(a):a.bankSpec?`<div class="act multi"><b>${dynEsc(a.label)}</b><small>${dynEsc(a.hint)} · 이율은 열흘 기준</small><label>대출 금리<input data-bank-loan="${a.bankSpec.id}" type="number" min="0.5" max="20" step="0.1" value="${(a.bankSpec.loanRate*100).toFixed(1)}">%</label><label>신규 예금 금리<input data-bank-deposit="${a.bankSpec.id}" type="number" min="0" max="10" step="0.1" value="${(a.bankSpec.depositRate*100).toFixed(1)}">%</label><label>준비금 비율<input data-bank-reserve="${a.bankSpec.id}" type="number" min="5" max="100" step="1" value="${(a.bankSpec.reserveRatio*100).toFixed(0)}">%</label><button data-bank-submit="${a.bankSpec.id}">은행 운영 기준 저장</button></div>`:a.corpLoanSpec?`<div class="act multi"><b>${dynEsc(a.label)}</b><small>${dynEsc(a.hint)} · 기업 신용·담보 심사 후 제안</small><label>원금<input data-corp-amount="${a.corpLoanSpec.id}" type="number" min="${a.corpLoanSpec.min}" max="${a.corpLoanSpec.max}" step="${a.corpLoanSpec.step}" value="${Math.min(a.corpLoanSpec.max,a.corpLoanSpec.min*5)}"></label><label>열흘 이율<select data-corp-rate="${a.corpLoanSpec.id}">${a.corpLoanSpec.rates.map(r=>`<option value="${r}">${(r*100).toFixed(2)}%</option>`).join('')}</select></label><label>상환 기간<select data-corp-term="${a.corpLoanSpec.id}">${a.corpLoanSpec.terms.map(n=>`<option value="${n}">${n}회 · ${Math.round(n*10/30)}개월</option>`).join('')}</select></label><label>담보<select data-corp-coll="${a.corpLoanSpec.id}">${a.corpLoanSpec.coll.map(c=>`<option value="${dynEsc(c.k)}">${dynEsc(c.label)}</option>`).join('')}</select></label><button data-corp-submit="${a.corpLoanSpec.id}">기업에 조건 제안</button></div>`:a.loanSpec?`<div class="act multi"><b>${dynEsc(a.label)}</b><small>${dynEsc(a.hint)} · 원금 ${money(a.loanSpec.min)}~${money(a.loanSpec.max)}</small><label>원금<input data-loan-amount="${a.loanSpec.id}" type="number" min="${a.loanSpec.min}" max="${a.loanSpec.max}" step="${a.loanSpec.step}" value="${Math.min(a.loanSpec.max,a.loanSpec.min*5)}"></label><label>열흘 이율<select data-loan-rate="${a.loanSpec.id}">${a.loanSpec.rates.map(r=>`<option value="${r}">${(r*100).toFixed(1)}%</option>`).join('')}</select></label><label>담보<select data-loan-coll="${a.loanSpec.id}">${a.loanSpec.coll.map(c=>`<option value="${dynEsc(c.k)}">${dynEsc(c.label)}</option>`).join('')}</select></label><button data-loan-submit="${a.loanSpec.id}">이 조건으로 빌려주기</button></div>`:a.faithSpec?`<div class="act multi${a.ok?'':' off'}"><b>${dynEsc(a.label)}</b><small>${dynEsc(a.ok?a.hint:a.why)}</small><div class="fdocs">${a.faithSpec.docs.map(d=>`<button type="button" class="fdoc${dynFaithSel.has(d.k)?' on':''}${d.x?' x':''}" data-faith-doc="${dynEsc(d.k)}"><b>${dynFaithSel.has(d.k)?'✅ ':''}${d.x?'⚠️ 이단 · ':''}${dynEsc(d.n)}</b><small>${dynEsc(d.d)}</small></button>`).join('')}</div><p class="fcount">고른 교리 <b>${dynFaithSel.size}</b>개 ${dynFaithSel.size?`· ${[...dynFaithSel].map(k=>dynEsc((a.faithSpec.docs.find(d=>d.k===k)||{}).n||k)).join(' · ')}`:'· 2개 이상 눌러 고르세요'}</p><label>교단 이름(비우면 자동)<input data-faith-name maxlength="7" placeholder="예: 새빛" value="${dynEsc(dynFaithName)}"></label><button data-faith-submit ${a.ok&&dynFaithSel.size>=a.faithSpec.min?'':'disabled'}>교단 열기</button></div>`:a.valueSpec?`<div class="act multi${a.ok?'':' off'}">${dynEsc(a.label)}<small>${dynEsc(a.ok?a.hint:a.why)} · 허용 ${a.valueSpec.unit==='%'?a.valueSpec.min*100+'~'+a.valueSpec.max*100+'%':a.valueSpec.min+'~'+a.valueSpec.max}</small><span class="qty"><input data-law-value="${dynEsc(a.valueKey)}" type="number" min="${a.valueSpec.min*(a.valueSpec.unit==='%'?100:1)}" max="${a.valueSpec.max*(a.valueSpec.unit==='%'?100:1)}" step="${a.valueSpec.step*(a.valueSpec.unit==='%'?100:1)}" value="${a.valueNow*(a.valueSpec.unit==='%'?100:1)}" ${a.ok?'':'disabled'}><button data-law-submit="${dynEsc(a.valueKey)}" data-law-unit="${a.valueSpec.unit}" ${a.ok?'':'disabled'}>${dynEsc(a.valueLabel||'이 수치로 발의')}</button></span></div>`:a.opts?`<div class="act multi${a.ok?'':' off'}">${dynEsc(a.label)}<small>${dynEsc(a.ok?a.hint:a.why)}</small><span class="qty">${a.opts.map(([v,l])=>{const k=a.k+':'+v;return `<button data-act="${dynEsc(k)}" class="${k===dynActArm?'arm':''}" ${a.ok?'':'disabled'}>${dynEsc(k===dynActArm?l+' 확인':l)}</button>`}).join('')}</span></div>`
      :`<button class="act${a.ok&&a.k===dynActArm?' arm':''}" data-act="${dynEsc(a.k)}" ${a.ok?'':'disabled'}>${dynEsc(a.label)}<small>${dynEsc(a.ok?(a.k===dynActArm?'한 번 더 누르면 실행합니다':a.hint):a.why)}</small></button>`)}
function dynActHTML(a){const fav=dynFav.has(a.k);return `<div class="actw">${dynActHTML0(a)}<button class="fav${fav?' on':''}" data-fav="${dynEsc(a.k)}" title="즐겨찾기">${fav?'★':'☆'}</button></div>`}
const dynFav=new Set((()=>{try{return JSON.parse(localStorage.getItem('v-dynfav')||'[]')}catch(e){return []}})());
let dynQuery='';
const DYN_TL=()=>Object.fromEntries(DYN_TABS.map(t=>[t[0],t[1]+' '+t[2]]));
function dynSearchHits(v,q){q=(q||'').trim().toLowerCase();if(!q)return [];const ws=q.split(/\s+/);return (v.actions||[]).filter(a=>{const t=(a.label+' '+a.group+' '+(a.hint||'')).toLowerCase();return ws.every(w=>t.includes(w))}).sort((x,y)=>(y.ok-x.ok)||(ws.every(w=>y.label.toLowerCase().includes(w))-ws.every(w=>x.label.toLowerCase().includes(w)))).slice(0,30)}
function dynSearchHTML(v){const hits=dynSearchHits(v,dynQuery),TL=DYN_TL();if(!dynQuery.trim())return '';if(!hits.length)return '<p class="muted">찾는 행동이 없습니다. 지금 지위에서는 아직 안 열렸을 수 있습니다.</p>';
  return hits.map(a=>`<small class="muted">${dynEsc(TL[dynTabOfGroup(a.group)]||'')} › ${dynEsc(a.group)}</small>${dynActHTML(a)}`).join('')}
function dynStatusHTML(v){const s=v.statuses||{},w=v.warFamily||{},merc=v.mercenaries||[],wars=s.farWars||[];
  const tile=(label,value,note,tab,group,severity='')=>`<button class="${severity}" title="${dynEsc(note)}" aria-label="${dynEsc(label+' '+value+' · '+note)}" data-goto="${tab}" data-focus="${dynEsc(group)}"><span>${label}</span><b>${dynEsc(value)}</b></button>`;
  const tiles=[[(s.heat||0)>=.3,tile('🚨 수배 열기',(s.heat||0).toFixed(1)+' / 3',s.heat>=1?'수사 위험이 높아졌어요':'현재 수배 상태 확인','plot','어두운 길 · 범죄',s.heat>=1?'danger':'')],
  [s.judgeVacancies>0||s.reviews>0,tile('⚖️ 재판관 공백',(s.judgeVacancies||0)+'석',(s.reviews||0)+'건 심판 대기','law','사법부',s.judgeVacancies?'attention':'')],
  [s.lovers||s.concubines||s.relationshipWarnings,tile('💬 정인 · 후궁/남총',(s.lovers||0)+'명 · '+(s.concubines||0)+'명',s.relationshipWarnings?'서운함·약속을 살펴보세요':'관계의 약속과 기억','me','관계 이어가기',s.relationshipWarnings?'attention':'')],
  [wars.length,tile('🌍 먼 나라 전쟁',wars.length? wars.length+'개 전쟁':'전쟁 없음',wars.length?wars[0].a+' ↔ '+wars[0].b:'현재 먼 나라의 전황','dip','먼 나라 개입',wars.length?'attention':'')],
  [merc.length||s.mercenaryContracts||s.mercenaryCaptives||s.mercenaryArrears,tile('⚔️ 용병 회사',(s.mercenaryContracts||0)+'개 파견 계약',s.mercenaryCaptives?'포로 '+s.mercenaryCaptives+'명':s.mercenaryArrears?'급여 체불 '+money(s.mercenaryArrears):v.mercBankruptcies?.length?'최근 파산 '+v.mercBankruptcies.length+'건':'운영 회사 '+merc.length+'곳','asset','용병 계약',s.mercenaryArrears||s.mercenaryCaptives?'danger':'')],
  [w.hostages?.length||w.captives,tile('🏳️ 인질 · 포로',(w.hostages?.length||0)+'명 · '+(w.captives||0)+'명','인질 기한과 포로 처리','dip','인질 외교',w.hostages?.length?'attention':'')]].filter(t=>t[0]).map(t=>t[1]);
  return tiles.length?`<div class="statusgrid" aria-label="주요 상태">${tiles.join('')}</div>`:''}
let dynQuickKey='';
let dynFavesOpen=true;
function dynHomeHTML(v){
  const m=v.me,a=v.assets||{},acts=v.actions||[],pct=x=>Math.round((x??0)*100),warn=[];
  if(!v.heirs?.length)warn.push(['⚰️ 상속자 없음','fam','상속']);
  if(m.health<40||m.hunger>60||(v.stress||0)>=60)warn.push(['🤒 건강·식사 확인','me','건강']);
  if(m.jail)warn.push(['⛓️ 수감 중','me','']);
  if(a.cash<0||a.debt>a.w)warn.push(['💳 재정 확인','asset','돈']);
  for(const c of v.co||[])if(c.risk>.4)warn.push([`🚨 ${c.name} 비리 위험`,'asset','회사 · 어두운 경영']);
  {const n=dynInb(v).length;if(n)warn.unshift([`📥 받은 일 ${n}건`,'news',''])}
  if(v.social?.trip)warn.push([`🧳 ${v.social.trip.country} 여행 중`,'me','여행·여가']);
  if(v.social?.study)warn.push([`📚 학업 ${v.social.study.days}일 남음`,'me','배움·전공']);
  const byKey=new Map(acts.map(x=>[x.k,x])),favs=[...dynFav].map(k=>byKey.get(k)).filter(Boolean);
  const quick=favs.find(x=>x.k===dynQuickKey);
  return `<div class="sec hero"><div class="hero-top"><div class="wealth"><small>순재산</small> ${money(a.w||0)}</div><span class="pill">${dynEsc(v.title||v.rankName)}</span></div>${v.today?`<div class="hero-sub today">오늘: ${dynEsc(dynTodayText(v))}</div>`:''}<div class="hero-sub">현금 ${money(a.cash||0)} · 하루 소득 ${money(a.incAvg||0)}</div><div class="quickstats"><div><small>건강</small><b>${Math.round(m.health)}점</b></div><div><small>행복</small><b>${pct(m.happy)}점</b></div><div><small>평판</small><b>${pct(m.rep??1)}점</b></div><div><small>스트레스</small><b>${v.stress||0}점</b></div></div></div>
  ${dynStatusHTML(v)}
  <div class="home-actions"><input id="dynQ" class="dynq" type="search" aria-label="전체 행동 검색" placeholder="행동 검색 · 회사, 결혼, 용병…" value="${dynEsc(dynQuery)}"><div id="dynQR">${dynSearchHTML(v)}</div>
  ${(()=>{const okN={},TL=DYN_TL();for(const x of acts)if(x.ok){const t=dynTabOfGroup(x.group);okN[t]=(okN[t]||0)+1}const js=Object.entries(okN).filter(([t])=>TL[t]&&t!=='home');return js.length?`<div class="hjump" aria-label="바로 이동">${js.map(([t,n])=>`<button data-goto="${t}">${TL[t]} <b>${n}</b></button>`).join('')}</div>`:''})()}
  <details class="quick-favs" ${favs.length&&dynFavesOpen?'open':''}><summary>⭐ 즐겨찾기 <small>${favs.length}개</small></summary>
  ${favs.length?`<div class="quick-buttons">${favs.map(x=>`<button title="${dynEsc(x.label)}" aria-expanded="${quick===x}" data-fav-open="${dynEsc(x.k)}">${dynEsc(x.label)}</button>`).join('')}</div>`:'<p class="muted">행동 옆 ☆을 누르면 여기에 모여요.</p>'}
  ${quick?dynActHTML(quick):''}</details></div>
  ${warn.length?`<div class="home-warnings" aria-label="확인할 일">${warn.map(([t,g,f])=>`<button data-goto="${g}" data-focus="${dynEsc(f)}">${dynEsc(t)}</button>`).join('')}</div>`:''}
  ${dynNewActsHTML()}<div class="err" role="alert">${dynEsc(dynActErrText)}</div>`}


let dynOnlyReady=false;
dynOnlyReady=true;try{dynOnlyReady=localStorage.getItem('v-dynready')!=='0'}catch(_){}
const dynScrolls=new Map();
function dynGoTo(tab,group){
  const sheet=$('#dynSheet'),previous=dynTab;
  if(sheet)dynScrolls.set(previous,sheet.scrollTop);
  dynTab=tab;
  if(tab!==previous)dynAutoMap=tab==='dip'&&dynMapSize===2;
  if(group)dynOpenG.add(group);
  const panel=$('#dynPanel');if(panel)panel._html=null;
  if(tab==='dip'&&dynView?.world?.known)dynSetMap('world');
  else dynFitMap();
  dynRender();
  if(sheet)sheet.scrollTop=group?0:(dynScrolls.get(tab)||0);
  if(group)[...document.querySelectorAll('details.actgrp')].find(x=>x.dataset.g===group)?.scrollIntoView({block:'start',behavior:'smooth'});
  try{localStorage.setItem('v-dyntab',tab)}catch(_){}
}
function dynFindActions(){dynGoTo('home');const q=$('#dynQ');if(q){q.scrollIntoView({block:'center',behavior:'smooth'});q.focus({preventScroll:true})}}
function dynPublicSummary(v){return (v.publicAccounts?.length?`<div class="sec"><h4>공공 예산 집행 권한</h4>${dynKV(v.publicAccounts.map(x=>[dynEsc(x.label),money(x.available)+' 집행 가능']))}</div>`:'')+(v.finance?.length?`<div class="sec"><h4>최근 공적 지출</h4>${v.finance.slice(-5).reverse().map(x=>`<p>${fmtD(x.d)} · ${dynEsc(x.source)} · ${money(x.amount)} · ${dynEsc(x.text)}</p>`).join('')}</div>`:'')}
function dynSheetHeader(){return ''}
function dynActionsHTML(v,tk){const all=(v.actions||[]).filter(a=>dynTabOfGroup(a.group)===tk);if(!all.length)return '';const acts=dynOnlyReady?all.filter(a=>a.ok):all,okG=g=>all.some(a=>a.group===g&&a.ok),groups=[...new Set(acts.map(a=>a.group))].sort((a,b)=>okG(b)-okG(a));
  return `<div class="sec action-section"><div class="actiontools"><b>행동 <span>${acts.length}</span></b><button data-ready-filter class="${dynOnlyReady?'on':''}" aria-pressed="${dynOnlyReady}">✓ 실행 가능만</button><button data-fold-actions>모두 접기</button></div>${!acts.length?'<p class="muted">지금 실행할 수 있는 행동이 없습니다. 필터를 끄면 필요한 조건을 볼 수 있어요.</p>':''}
    ${groups.map(g=>{const ga=acts.filter(a=>a.group===g),total=all.filter(a=>a.group===g);const buckets=new Map();for(const a of ga){const parts=a.k.split(':'),co=['co','merc'].includes(parts[0])&&parts[1]!=='found'?parts[2]:null;const name=co?((v.co||[]).find(c=>String(c.id)===co)?.name||(v.mercenaries||[]).find(c=>String(c.id)===co)?.name):null;const key=name||'';if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(a)}return `<details class="actgrp${okG(g)?'':' none'}" data-g="${dynEsc(g)}" ${dynOpenG.has(g)?'open':''}><summary><span>${dynEsc(g)}</span><small>${total.filter(a=>a.ok).length}/${total.length} 가능</small></summary>${[...buckets].map(([name,ba])=>name&&buckets.size>1?`<details class="subgrp" data-g="${dynEsc('sub:'+g+':'+name)}" ${dynOpenG.has('sub:'+g+':'+name)?'open':''}><summary>${dynEsc(name)} <small>${ba.length}개</small></summary>${ba.map(dynActHTML).join('')}</details>`:ba.map(dynActHTML).join('')).join('')}</details>`}).join('')}
    <div class="err" id="dynActErr" role="alert">${dynEsc(dynActErrText)}</div></div>`}
let dynActErrText='';
const dynFaithSel=new Set();let dynFaithName='';
(()=>{const st=document.createElement('style');st.textContent='.fdocs{display:grid;grid-template-columns:1fr;gap:6px;margin:8px 0}.fdoc{display:block;width:100%;text-align:left;padding:8px 10px;background:#232a4a;border:2px solid #3a4270;color:#e8e8f0;border-radius:6px;font:inherit}.fdoc b{display:block}.fdoc small{display:block;opacity:.75;margin-top:2px}.fdoc.x{border-color:#7a3a4a}.fdoc.on{background:#e8c25a;color:#141414;border-color:#fff}.fdoc.on small{opacity:.85}.fcount{margin:6px 0}';document.head.appendChild(st)})();
const dynOpenG=new Set((()=>{try{return JSON.parse(localStorage.getItem('v-dynopen')||'[]')}catch(e){return []}})());
let dynActArm=null;
let dynArmTimer=0;
function dynBindActions(P){
  P.querySelectorAll('[data-ready-filter]').forEach(b=>b.onclick=()=>{dynOnlyReady=!dynOnlyReady;try{localStorage.setItem('v-dynready',dynOnlyReady?'1':'0')}catch(_){}P._html=null;dynRender()});
  P.querySelectorAll('[data-fold-actions]').forEach(b=>b.onclick=()=>{for(const d of P.querySelectorAll('details.actgrp,details.subgrp')){d.open=false;dynOpenG.delete(d.dataset.g)}try{localStorage.setItem('v-dynopen',JSON.stringify([...dynOpenG]))}catch(_){} });

  P.querySelectorAll('[data-company-name]').forEach(x=>x.oninput=()=>{dynCompanyNames.set(x.dataset.companyName,x.value)});
  P.querySelectorAll('[data-company-submit]').forEach(b=>b.onclick=async()=>{const scope=b.closest?.('.act')||P;const key=b.dataset.companySubmit,input=[...scope.querySelectorAll('[data-company-name]')].find(x=>x.dataset.companyName===key),name=(input?.value||'').trim(),a=dynView?.actions?.find(x=>x.k===key);if(!name&&!a?.companyNameSpec?.optional){dynActErrText='회사 이름을 입력해 주세요';P._html=null;dynRender();return}b.disabled=true;try{await dynApi(dynApiBase+'/api/cmd',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'act',k:key+(name?':'+encodeURIComponent(name):'')})});dynCompanyNames.delete(key);dynActErrText='';await dynSend({action:'save'})}catch(e){dynActErrText=e.message;P._html=null;dynRender()}finally{b.disabled=false}});

  P.querySelectorAll('[data-fav]').forEach(b=>b.onclick=e=>{e.stopPropagation();const k=b.dataset.fav;if(dynFav.has(k))dynFav.delete(k);else dynFav.add(k);try{localStorage.setItem('v-dynfav',JSON.stringify([...dynFav]))}catch(_){}const pp=$('#dynPanel');if(pp)pp._html=null;dynRender()});
  const faves=P.querySelector('.quick-favs');if(faves)faves.ontoggle=()=>{if(dynView?.actions?.some(a=>dynFav.has(a.k)))dynFavesOpen=faves.open};
  P.querySelectorAll('[data-fav-open]').forEach(b=>b.onclick=()=>{dynQuickKey=dynQuickKey===b.dataset.favOpen?'':b.dataset.favOpen;P._html=null;dynRender();const n=[...P.querySelectorAll('[data-fav-open]')].find(x=>x.dataset.favOpen===b.dataset.favOpen);if(n)n.focus({preventScroll:true})});
  P.querySelectorAll('[data-pend]').forEach(b=>b.onclick=()=>{const p=dynUrg(dynView)[0]||dynInb(dynView)[0];if(p)dynOpen(p,true)});
  P.querySelectorAll('[data-inbox]').forEach(b=>b.onclick=()=>{const p=dynView?.pending?.find(x=>x.id===Number(b.dataset.inbox));if(p)dynOpen(p,true)});
  const q=P.querySelector('#dynQ');if(q){q.oninput=()=>{dynQuery=q.value;const r=P.querySelector('#dynQR');if(r){r.innerHTML=dynSearchHTML(dynView);r._html=r.innerHTML;dynBindActions(r)}}}
  P.querySelectorAll('details.actgrp,details.subgrp').forEach(d=>d.ontoggle=()=>{const g=d.dataset.g;if(d.open)dynOpenG.add(g);else dynOpenG.delete(g);try{localStorage.setItem('v-dynopen',JSON.stringify([...dynOpenG]))}catch(e){}});
  P.querySelectorAll('[data-corp-submit]').forEach(b=>b.onclick=async()=>{const scope=b.closest?.('.act')||P;const id=b.dataset.corpSubmit,amount=Number(scope.querySelector(`[data-corp-amount="${id}"]`)?.value),rate=Number(scope.querySelector(`[data-corp-rate="${id}"]`)?.value),term=Number(scope.querySelector(`[data-corp-term="${id}"]`)?.value),coll=scope.querySelector(`[data-corp-coll="${id}"]`)?.value;if(!Number.isFinite(amount)||!(amount>0)||!Number.isFinite(rate)||!Number.isFinite(term)){dynActErrText='기업 대출 조건을 확인해 주세요';dynRender();return}b.disabled=true;try{await dynApi(dynApiBase+'/api/cmd',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'act',k:`corp:offer:${id}:${amount}:${rate}:${term}:${coll}`})});dynActErrText='';await dynSend({action:'save'})}catch(e){dynActErrText=e.message;dynRender()}});
  P.querySelectorAll('[data-faith-doc]').forEach(b=>b.onclick=()=>{const k=b.dataset.faithDoc;if(dynFaithSel.has(k))dynFaithSel.delete(k);else dynFaithSel.add(k);dynActErrText='';P._html=null;dynRender()});
  P.querySelectorAll('[data-faith-name]').forEach(x=>x.oninput=()=>{dynFaithName=x.value});
  P.querySelectorAll('[data-faith-submit]').forEach(b=>b.onclick=async()=>{const scope=b.closest?.('.act')||P;const docs=[...dynFaithSel],name=(dynFaithName||'').trim();if(docs.length<2){dynActErrText='교리를 2개 이상 골라 주세요';P._html=null;dynRender();return}if(/[:+]/.test(name)){dynActErrText='교단 이름에 쓸 수 없는 글자가 있습니다';P._html=null;dynRender();return}b.disabled=true;try{await dynApi(dynApiBase+'/api/cmd',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'act',k:`extra:found:${docs.join('+')}:${name}`})});dynActErrText='';dynFaithSel.clear();dynFaithName='';await dynSend({action:'save'})}catch(e){dynActErrText=e.message;P._html=null;dynRender()}});
  P.querySelectorAll('[data-loan-submit]').forEach(b=>b.onclick=async()=>{const scope=b.closest?.('.act')||P;const id=b.dataset.loanSubmit,amount=Number(scope.querySelector(`[data-loan-amount="${id}"]`)?.value),rate=Number(scope.querySelector(`[data-loan-rate="${id}"]`)?.value),coll=scope.querySelector(`[data-loan-coll="${id}"]`)?.value;if(!Number.isFinite(amount)||!(amount>0)){dynActErrText='대출 원금을 입력해 주세요';dynRender();return}b.disabled=true;try{await dynApi(dynApiBase+'/api/cmd',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'act',k:`loan:lend:${id}:${amount}:${rate}:${coll}`})});dynActErrText='';await dynSend({action:'save'})}catch(e){dynActErrText=e.message;dynRender()}});
  P.querySelectorAll('[data-bank-submit]').forEach(b=>b.onclick=async()=>{const scope=b.closest?.('.act')||P;const id=b.dataset.bankSubmit,loan=Number(scope.querySelector(`[data-bank-loan="${id}"]`)?.value)/100,deposit=Number(scope.querySelector(`[data-bank-deposit="${id}"]`)?.value)/100,reserve=Number(scope.querySelector(`[data-bank-reserve="${id}"]`)?.value)/100;if(![loan,deposit,reserve].every(Number.isFinite)){dynActErrText='은행 운영 수치를 확인해 주세요';dynRender();return}b.disabled=true;try{await dynApi(dynApiBase+'/api/cmd',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'act',k:`bank:ops:${id}:${loan}:${deposit}:${reserve}`})});dynActErrText='';await dynSend({action:'save'})}catch(e){dynActErrText=e.message;dynRender()}});
  P.querySelectorAll('[data-law-submit]').forEach(b=>b.onclick=async()=>{const scope=b.closest?.('.act')||P;const key=b.dataset.lawSubmit,input=scope.querySelector(`[data-law-value="${key}"]`),raw=Number(input?.value),value=b.dataset.lawUnit==='%'?raw/100:raw;if(!input?.value.trim()||!Number.isFinite(value)){dynActErrText='정책 수치를 입력해 주세요';dynRender();return}b.disabled=true;try{await dynApi(dynApiBase+'/api/cmd',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'act',k:`lawval:${key}:${value}`})});dynActErrText='';await dynSend({action:'save'})}catch(e){dynActErrText=e.message;dynRender()}});
  const arm=b=>{b.classList.add('arm');const sm=b.querySelector('small');if(sm)sm.textContent='한 번 더 누르면 실행합니다'};
  P.querySelectorAll('[data-act]').forEach(b=>{if(b.dataset.act===dynActArm&&!b.disabled)arm(b);b.onclick=async()=>{
  const k=b.dataset.act;if(dynActArm!==k){dynActArm=k;clearTimeout(dynArmTimer);dynArmTimer=setTimeout(()=>{dynActArm=null;dynRender();if(/^tgt:/.test(k))dynCardActions(true)},5000);P.querySelectorAll('.arm').forEach(x=>x.classList.remove('arm'));arm(b);dynRender();return}
  clearTimeout(dynArmTimer);
  dynActArm=null;dynActErrText='';b.disabled=true;
  try{await dynApi(dynApiBase+'/api/cmd',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'act',k})});await dynSend({action:'save'});if(/^tgt:/.test(k))dynCardActions(true)}
  catch(e){dynActErrText=e.message;dynRender();if(/^tgt:/.test(k))dynCardActions(true)}}})}
function dynChangeLabel({label,unit,amount}){
  const value=Math.abs(amount);
  return label+' '+(amount<0?'−':'+')+(unit==='money'?money(value):value+(unit==='points'?'점':unit==='days'?'일':''))
}
function dynOpen(p,force){
  const box=$('#dynModal');dynModalId=p.id;box.hidden=false;
  const start=p.kind==='start',m=dynView?.me;
  box.innerHTML=`<div class="dynbox"><h3>${start?'가문 모드 시작':p.kind==='death'?(dynView&&dynView.over?'⚰️ 가문 단절':'⚰️ 가장의 죽음'):p.title?dynEsc(p.title):'🔔 선택'}</h3>${p.cast?.length?`<div class="dyn-cast">${p.cast.map(dynPerson).join(' · ')}</div>`:''}<p style="white-space:pre-line">${dynEsc(p.text)}</p>
    ${start&&m?`<label>성 <input id="dynSur" maxlength="2" value="${dynEsc(m.sur)}"></label><label>이름 <input id="dynGiven" maxlength="3" value="${dynEsc(m.given)}"></label>
      <label>시작 방식 <select id="dynStartMode"><option value="general">일반 시작 · 기존 인물과 가족·재산 유지</option><option value="custom">캐릭터 꾸미기 · 새 인물을 직접 만들어 시작</option></select></label><div id="dynStartCustom" hidden>
      <label>성별 <select id="dynSex"><option value="M" ${m.sex==='M'?'selected':''}>남성</option><option value="F" ${m.sex==='F'?'selected':''}>여성</option></select></label>
      <label>나이 <input id="dynAge" type="number" min="18" max="45" value="${m.age}"></label>
      <label>가족 조건 <select id="dynFamilyStart"><option value="single">혼자 이주</option><option value="partner">배우자와 함께 이주</option><option value="children">배우자·자녀와 함께 이주</option></select></label>
      <label>시작 재산 <select id="dynWealthStart"><option value="keep">보통 · 마을 사람 보통 재산</option><option value="poor">가난한 편 · 보통의 3~6할</option><option value="modest">살림 안정 · 보통의 1.2~1.8배</option><option value="wealthy">넉넉한 편 · 보통의 3배 + 집 한두 채 값</option></select></label>
      <label>외모 <input id="dynLooks" type="number" min="0" max="100" value="${Math.round((m.looks??.5)*100)}"></label>
      <label>시작 지위 <select id="dynStatus"><option value="common">평민</option><option value="king">👑 왕 · 군주정을 세우고 왕좌에서 시작</option><option value="tycoon">💰 갑부 · 마을 어른 재산 합계의 4분의 1 + 집 다섯 채 값</option></select></label>
      <label>병역 <select id="dynServed"><option value="no">미필 · 징병제가 있으면 영장이 나올 수 있음</option><option value="yes">군필 · 징병 면제, 경계심·체력 조금 높음</option></select></label>
      <label>학력 <select id="dynEdu">${['없음','기본','사교육','고등','대학'].map((x,i)=>`<option value="${i}" ${i===(m.edu||0)?'selected':''}>${x}</option>`).join('')}</select></label>
      <label>출신 배경 <select id="dynBackground"><option>평범한 주민</option><option>농촌</option><option>장터</option><option>기술자 집안</option><option>유학 경험</option><option>이주민</option><option value="정보기관 직원">정보기관 출신</option><option>몰락한 왕족</option><option>성직자 집안</option></select></label>
      <label>성격 · 야망 <input id="dynBoss" type="number" min="0" max="100" value="${Math.round((m.g?.boss??.2)*100)}"></label><label>성격 · 공익심 <input id="dynCivic" type="number" min="0" max="100" value="${Math.round((m.g?.civic??.3)*100)}"></label>
      <label>성격 · 배려 <input id="dynCare" type="number" min="0" max="100" value="${Math.round((m.g?.care??.65)*100)}"></label><label>성격 · 정직함 <input id="dynCheat" type="number" min="0" max="100" value="${Math.round((1-(m.g?.cheat??.2))*100)}"></label>
      <label>성격 · 사교성 <input id="dynJoin" type="number" min="0" max="100" value="${Math.round((m.g?.join??.35)*100)}"></label><label>성격 · 사치 <input id="dynLux" type="number" min="0" max="100" value="${Math.round((m.g?.lux??.35)*100)}"></label>
      <label>성격 · 낭만 <input id="dynRoma" type="number" min="0" max="100" value="${Math.round((m.g?.roma??.5)*100)}"></label><label>성격 · 신앙심 <input id="dynFaith" type="number" min="0" max="100" value="${Math.round((m.g?.faith??.35)*100)}"></label>
      <label>기술 · 농사 <input id="dynFarm" type="number" min="0" max="100" value="${Math.round((m.skill?.[0]??.1)*100)}"></label><label>기술 · 장인 <input id="dynCraft" type="number" min="0" max="100" value="${Math.round((m.skill?.[9]??.1)*100)}"></label>
      <label>기술 · 장사 <input id="dynTrade" type="number" min="0" max="100" value="${Math.round((m.skill?.[12]??.1)*100)}"></label>
      <p class="stopnote">설정한 대로 새 인물이 마을에 이주해 옵니다(기존 주민은 그대로). 시작 재산은 정착금으로 새로 지급되고, 배우자·자녀를 고르면 가족도 함께 이주합니다.</p></div>`:''}
    ${p.inbox&&p.due!=null?`<p class="stopnote">📥 ${Math.max(0,p.due-S.day)}일 안에 답하지 않으면 그냥 넘어갑니다. 그동안 시간은 계속 흐릅니다.</p>`:''}<div class="err" id="dynErr"></div>
    ${p.opts.map(o=>`<button class="opt" data-k="${dynEsc(o.k)}" ${o.available===false?'disabled':''}>${dynEsc(o.label)}${o.fundingLabel?`<small>자금 · ${dynEsc(o.fundingLabel)}${o.cost?' · '+money(o.cost):''}</small>`:''}${o.hint?`<small>예상 · ${dynEsc(o.hint)}</small>`:''}${o.stress?.points?`<small>${dynEsc(o.stress.reason)}에 어긋남 · 스트레스 +${o.stress.points}점</small>`:''}</button>`).join('')}
    ${start?'':p.inbox?'<button class="opt" data-later="1">나중에 (받은 일함에 둠)<small>소식 탭의 📥 받은 일에서 다시 열 수 있습니다.</small></button>':'<button class="opt" data-later="1">나중에 고르기 (창 닫기)<small>지도·가문 정보를 먼저 볼 수 있습니다. 위의 알림을 누르면 다시 열립니다.</small></button>'}
    <div class="stopnote">⏸ 고를 때까지 시간이 멈춰 있습니다.</div></div>`;
  box.querySelectorAll('[data-person]').forEach(el=>el.onclick=()=>{box.hidden=true;select(Number(el.dataset.person))});
  const later=box.querySelector('[data-later]');if(later)later.onclick=()=>{box.hidden=true};
  const startMode=box.querySelector('#dynStartMode'),custom=box.querySelector('#dynStartCustom');if(startMode)startMode.onchange=()=>{custom.hidden=startMode.value!=='custom'};
  box.querySelectorAll('.opt[data-k]').forEach(b=>b.onclick=async()=>{
    box.querySelectorAll('.opt').forEach(x=>x.disabled=true);
    try{
      if(start&&m&&startMode?.value==='custom'){const character={sur:$('#dynSur').value,given:$('#dynGiven').value,sex:$('#dynSex').value,age:+$('#dynAge').value,family:$('#dynFamilyStart').value,wealth:$('#dynWealthStart').value,status:$('#dynStatus').value,served:$('#dynServed').value,looks:+$('#dynLooks').value,edu:+$('#dynEdu').value,background:$('#dynBackground').value,boss:+$('#dynBoss').value,civic:+$('#dynCivic').value,care:+$('#dynCare').value,cheat:100-(+$('#dynCheat').value),join:+$('#dynJoin').value,lux:+$('#dynLux').value,roma:+$('#dynRoma').value,faith:+$('#dynFaith').value,farm:+$('#dynFarm').value,craft:+$('#dynCraft').value,trade:+$('#dynTrade').value};await dynApi(dynApiBase+'/api/cmd',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'configureStart',character})})}
      else if(start&&m){const sur=$('#dynSur')?.value.trim(),given=$('#dynGiven')?.value.trim();if(sur&&given&&(sur!==m.sur||given!==m.given))await dynApi(dynApiBase+'/api/cmd',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'rename',sur,given})})}
      box.hidden=true;await dynSend({action:'choose',id:p.id,k:b.dataset.k});
    }catch(e){box.hidden=false;$('#dynErr').textContent=e.message;box.querySelectorAll('.opt').forEach(x=>x.disabled=false)}
  });
}
// ===== 2차 4단계: 세계 지도 =====
// 서버가 보내는 view.dyn.world(이웃 나라 요약)만 그린다. 우리 마을을 누르면 원래 상세 지도로 돌아간다.
let dynMapMode='town',dynWSel=null;
const DYN_WCOL={us:'#d8b04a',너른들:'#5f9a4a',쇠뫼:'#8a6a52',비단나루:'#6a64a8'};
const DYN_WALT=['#4a8a8a','#a0584f','#7a8a3a','#9a6a9a','#5a7ab0','#b07a3a','#3a8a6a','#a04a6a','#6a8a3a','#8a5a3a','#4a6a9a','#9a8a4a'];
function dynShade(hex,f){const n=parseInt(hex.slice(1),16);const c=[n>>16,n>>8&255,n&255].map(v=>Math.max(0,Math.min(255,Math.round(f>=1?v+(255-v)*(f-1):v*f))));return '#'+c.map(v=>v.toString(16).padStart(2,'0')).join('')}
function dynInitWorld(){
  const css=document.createElement('style');css.textContent=`
.dynmapbar{display:flex;gap:4px;margin:6px 3px 0}.dynmapbar button{flex:1;padding:6px;font-size:14px}.dynmapbar button.on{background:var(--gold);color:#000}
.dynwmap{border:4px solid #000;outline:3px solid var(--line);margin:3px;background:#1b2c44}.dynwmap canvas{display:block;width:100%;touch-action:manipulation}
.dynwinfo{background:var(--panel);border:2px solid #000;padding:8px 10px;margin:6px 3px;font-size:14px}.dynwinfo h4{margin:2px 0 6px;font-family:var(--f-head);font-weight:400;color:var(--gold);font-size:16px}
.dynwinfo .kv>div{display:flex;justify-content:space-between;gap:8px;padding:3px 0;border-bottom:1px solid var(--line)}.dynwinfo .kv span{color:var(--muted)}.dynwinfo ul{margin:4px 0 0;padding-left:18px}.dynwinfo li{margin:2px 0}.dynwinfo small{color:var(--muted)}`;
  document.head.appendChild(css);
  const bar=document.createElement('div');bar.className='dynmapbar';bar.id='dynMapBar';bar.innerHTML='<button data-mm="town">🏘 우리 마을</button><button data-mm="world">🌍 세계 지도</button>';
  const box=document.createElement('div');box.id='dynWorld';box.hidden=true;box.innerHTML='<div class="dynwmap"><canvas id="dynWC" aria-label="세계 지도. 나라를 누르면 정보가 보인다"></canvas></div><div class="dynwinfo" id="dynWInfo"></div>';
  $('.screen').before(bar);$('.screen').after(box);
  bar.querySelectorAll('button').forEach(b=>b.onclick=()=>dynSetMap(b.dataset.mm));
  try{if(localStorage.getItem('v-dynmap')==='world')dynMapMode='world'}catch(e){}
  $('#dynWC').onclick=ev=>{const c=ev.currentTarget,r=c.getBoundingClientRect();const o=dynWOwner((ev.clientX-r.left)/r.width,(ev.clientY-r.top)/r.height);
    if(o==='us'){dynWSel=null;dynSetMap('town');return}if(o&&o!=='sea'&&o!=='fog'){dynWSel=o;dynTab='dip';dynDrawWorld();dynRender();const sh=$('#dynSheet');if(sh)sh.scrollTop=0}};
  new ResizeObserver(()=>{if(dynMapMode==='world')dynDrawWorld()}).observe(box);
  dynSetMap(dynMapMode);
}
function dynSetMap(m){dynMapMode=m;try{localStorage.setItem('v-dynmap',m)}catch(e){}
  document.querySelectorAll('#dynMapBar button').forEach(b=>b.classList.toggle('on',b.dataset.mm===m));
  $('.screen').hidden=m==='world';$('#dynWorld').hidden=m!=='world';document.querySelectorAll('#dMap [data-mm2]').forEach(b=>b.classList.toggle('on',b.dataset.mm2===m));if(m==='world')dynDrawWorld();if(typeof dynFitMap==='function')dynFitMap()}
// Seeded physical world: coastlines and territory area are independent of population size.
function dynWSeeds(){const W=dynView?.world;if(!W)return [];const seed=W.us.seed||0;const size=(id)=>{let h=seed>>>0;for(const c of String(id)){h=Math.imul(h^c.charCodeAt(0),16777619)}return .72+dynWHash(h>>>0,seed%997,seed)*.34};const s=[{id:'us',x:0,y:0,w:size('us')}];
  for(const r of W.realms)s.push({id:r.name,x:r.x,y:r.y,w:size(r.name)});for(const f of W.far||[])s.push({id:f.owner,x:f.x,y:f.y,w:f.w});return s}
function dynWHash(x,y,seed=0){let h=Math.imul((x^seed)*374761393+(y+seed)*668265263,1274126177);h^=h>>>13;h=Math.imul(h,1103515245);return((h^h>>>16)>>>0)/4294967296}
function dynWLand(x,y,seed){const oval=(cx,cy,rx,ry)=>1-Math.hypot((x-cx)/rx,(y-cy)/ry);const main=Math.max(oval(-.22,0,.79,.72),oval(.39,.20,.55,.43),oval(.04,-.51,.40,.39));const west=oval(-.99,-.47,.22,.18),south=oval(.92,.58,.23,.16);const far=dynView?.world?.far?.length?Math.max(...DYN_FARC.map(c=>oval(c[0],c[1],c[2]*1.05,c[3]*1.08))):-9;const broad=(dynWHash(Math.floor((x+2)*5),Math.floor((y+2)*5),seed)-.5)*.16,fine=(dynWHash(Math.floor((x+2)*13),Math.floor((y+2)*13),seed+73)-.5)*.055;return Math.max(main,west,south,far)+broad+fine>.015}
function dynWOwnerXY(x,y,seeds,known,seed){
  if(!dynWLand(x,y,seed))return 'sea';
  const n=(dynWHash(Math.floor((x+2)*14),Math.floor((y+2)*14),seed+151)-.5)*.08;
  let best=null,bd=9;for(const s of seeds){if(!known&&s.id!=='us')continue;const d=Math.hypot(x-s.x,y-s.y)/s.w+n;if(d<bd){bd=d;best=s.id}}
  if(!known&&bd>1)return 'fog';if(bd>1.45&&!dynView?.world?.far?.length)return 'fog';return best}
const DYN_WAR=.68;const DYN_WSC=()=>dynView?.world?.far?.length?4.5:2.4;const dynWXY=(fx,fy)=>{const k=DYN_WSC();return [(fx-.5)*k,(fy-.5)*k*DYN_WAR]};
const DYN_FARC=[[1.58,-.72,.5,.4],[-1.6,.42,.42,.5],[1.22,.98,.56,.3],[-1.3,-.95,.4,.3]];
// 이름표를 실제 글자 크기로 배치하고 이동한 이름표도 누를 수 있게 한다.
let dynWorldLabelHits=[];
function dynLayoutWorldLabels(labels,width,height){const placed=[],reserved=[{x:4,y:4,w:132,h:40},{x:width-112,y:height-42,w:108,h:38}];const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
  for(const label of labels){const w=Math.min(width-12,label.w+10),h=label.h+6;let best=null,bestScore=Infinity;const candidates=[];for(let r=0;r<=150;r+=15){const n=r?12:1;for(let j=0;j<n;j++)candidates.push([label.px+Math.cos(j*Math.PI*2/n)*r-w/2,label.py+Math.sin(j*Math.PI*2/n)*r-h-6])}for(let y=6;y+h<height;y+=18)for(let x=6;x+w<width;x+=24)candidates.push([x,y]);
    for(const [cx,cy] of candidates){const x=Math.max(6,Math.min(width-w-6,cx)),y=Math.max(6,Math.min(height-h-6,cy)),box={x,y,w,h},area=placed.concat(reserved).reduce((n,p)=>n+overlap({...box,x:x-3,y:y-3,w:w+6,h:h+6},p),0),score=area*10000+(x+w/2-label.px)**2+(y+h+6-label.py)**2;if(score<bestScore){best={...label,...box};bestScore=score}}placed.push(best)}return placed}
function dynWOwner(fx,fy){const W=dynView?.world;if(!W)return null;const cw=$('#dynWC')?.clientWidth||360,ch=Math.round(cw*DYN_WAR),hit=dynWorldLabelHits.find(b=>fx*cw>=b.x&&fx*cw<=b.x+b.w&&fy*ch>=b.y&&fy*ch<=b.y+b.h);if(hit)return hit.id;const [x,y]=dynWXY(fx,fy);return dynWOwnerXY(x,y,dynWSeeds(),W.known,W.us.seed||0)}

function dynDrawWorld(){
  const W=dynView?.world,c=$('#dynWC');if(!c||$('#dynWorld').hidden)return;
  const cw=c.clientWidth||360,ch=Math.round(cw*DYN_WAR),d=window.devicePixelRatio||1;
  if(c.width!==Math.round(cw*d)){c.width=Math.round(cw*d);c.height=Math.round(ch*d)}c.style.height=ch+'px';
  const g=c.getContext('2d');g.setTransform(d,0,0,d,0,0);
  if(!W){g.fillStyle='#1b2c44';g.fillRect(0,0,cw,ch);return}
  const seeds=dynWSeeds(),cell=Math.max(4,Math.round(cw/90)),cols=Math.ceil(cw/cell),rows=Math.ceil(ch/cell),own=[];
  const provN=new Set(W.realms.filter(r=>r.prov).map(r=>r.name));
  const col=id=>provN.has(id)?'#b8923a':DYN_WCOL[id]||DYN_WALT[[...String(id)].reduce((t,ch2)=>t+ch2.charCodeAt(0),0)%DYN_WALT.length];
  for(let j=0;j<rows;j++){own[j]=[];for(let i=0;i<cols;i++){const [x,y]=dynWXY((i+.5)/cols,(j+.5)/rows);own[j][i]=dynWOwnerXY(x,y,seeds,W.known,W.us.seed||0)}}
  const warN=new Set(W.realms.filter(r=>r.war).map(r=>r.name));
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const o=own[j][i];
    if(o==='sea'||o==='fog')g.fillStyle=o==='sea'?((i+j)%7===0?'#22385a':'#1b2c44'):'#2a2a30';else{const [wx,wy]=dynWXY((i+.5)/cols,(j+.5)/rows),sd=W.us.seed||0;const e=dynWHash(Math.floor((wx+3)*6),Math.floor((wy+3)*6),sd+999)*.6+dynWHash(Math.floor((wx+3)*15),Math.floor((wy+3)*15),sd+777)*.4;g.fillStyle=dynShade(col(o),e>.72?.72:e>.6?.86:e<.3?1.1:1)}
    g.fillRect(i*cell,j*cell,cell,cell);
    if(o!=='sea'&&o!=='fog'&&dynWSel===o){g.fillStyle='#ffffff44';g.fillRect(i*cell,j*cell,cell,cell)}}
  // 국경: 옆 칸 주인이 다르면 선. 전쟁 중인 우리-상대 국경은 붉게.
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const o=own[j][i];if(o==='sea'||o==='fog')continue;
    for(const [di,dj] of [[1,0],[0,1]]){const p=own[j+dj]?.[i+di];if(p==null||p===o)continue;
      const war=(o==='us'&&warN.has(p))||(p==='us'&&warN.has(o));const inner=(o==='us'&&provN.has(p))||(p==='us'&&provN.has(o));g.fillStyle=war?'#ff3b30':inner?'#00000044':p==='sea'?'#79bfe5':p==='fog'?'#00000088':'#000';
      const bw=p==='sea'||inner?2:3;if(di)g.fillRect((i+1)*cell-bw/2,j*cell,bw,cell);else g.fillRect(i*cell,(j+1)*cell-bw/2,cell,bw)}}
  const SC=DYN_WSC(),P=(x,y)=>[(x/SC+.5)*cw,(y/(SC*DYN_WAR)+.5)*ch];
  // 선: 교역로(금색 점선)·동맹(파란 점선)·전선(붉은 선)
  const line=(a,b,color,dash,wd)=>{const [ax,ay]=P(a[0],a[1]),[bx,by]=P(b[0],b[1]);g.save();g.strokeStyle=color;g.lineWidth=wd||2;g.setLineDash(dash||[]);g.beginPath();g.moveTo(ax,ay);g.lineTo(bx,by);g.stroke();g.restore()};
  for(const r of W.realms){if(r.prov)continue;if(r.fta)line([0,0],[r.x,r.y],'#e8c25acc',[6,4],2);if(r.ally)line([0,0],[r.x,r.y],'#6fb6ffcc',[2,4],2.5);if(r.war)line([0,0],[r.x,r.y],'#ff3b30',[],3)}
  const FN=Object.fromEntries((W.far||[]).filter(f=>f.alive).map(f=>[f.name,f]));const done=new Set();
  for(const f of Object.values(FN)){for(const n of f.ally||[]){const b=FN[n],key=[f.name,n].sort().join('|');if(b&&!done.has(key)){done.add(key);line([f.x,f.y],[b.x,b.y],'#6fb6ffaa',[2,4],2)}}if(f.war&&FN[f.war]){const key='w'+[f.name,f.war].sort().join('|');if(!done.has(key)){done.add(key);line([f.x,f.y],[FN[f.war].x,FN[f.war].y],'#ff3b30dd',[8,3],3)}}}
  g.textAlign='center';g.textBaseline='middle';
  const labelQueue=[],titleSize=Math.max(12,Math.min(16,Math.round(cw/28))),subSize=Math.max(10,Math.min(12,Math.round(cw/36)));
  const label=(x,y,t1,t2,mark,id)=>{const [px,py]=P(x,y);const title=(mark?mark+' ':'')+t1;g.font=`600 ${titleSize}px sans-serif`;const tw=g.measureText(title).width;g.font=`${subSize}px sans-serif`;const sw=t2?g.measureText(t2).width:0;labelQueue.push({id,px,py,title,sub:t2,w:Math.max(tw,sw),h:titleSize+(t2?subSize+4:0)})};
  const us=W.us;label(0,0,'🏠 '+us.name,us.regName+(us.faith?' · ⛪'+us.faith:''),null,'us');
  const capital=(x,y,home)=>{const [px,py]=P(x,y);g.beginPath();g.arc(px,py,home?4:3,0,Math.PI*2);g.fillStyle=home?'#fff2a6':'#fff';g.fill();g.lineWidth=1.5;g.strokeStyle='#20252d';g.stroke()};capital(0,0,true);
  for(const r of W.realms)capital(r.x,r.y,false);
  for(const r of W.realms)label(r.x,r.y,r.name,SC>3&&cw<560?r.regName:`${r.regName} · ${r.title} ${r.ruler.name}`,r.war?'⚔️':r.prov?'🏴':r.ally?'🛡️':r.fta?'🤝':r.tension>=60?'⚠️':null,r.name);
  for(const f of Object.values(FN)){capital(f.x,f.y,false);label(f.x,f.y,f.name,f.regName,f.war?'⚔️':f.rel>=40?'🤝':null,f.name)}
  dynWorldLabelHits=dynLayoutWorldLabels(labelQueue,cw,ch);for(const b of dynWorldLabelHits){g.beginPath();g.moveTo(b.px,b.py);g.lineTo(b.x+b.w/2,b.y+b.h/2);g.lineWidth=1;g.strokeStyle='#dae6db88';g.stroke();g.fillStyle=b.id===dynWSel?'#514933ee':'#102632dc';g.fillRect(b.x,b.y,b.w,b.h);g.strokeStyle=b.id===dynWSel?'#e4c586':'#a2c0c044';g.strokeRect(b.x,b.y,b.w,b.h);g.textAlign='center';g.font=`600 ${titleSize}px sans-serif`;g.fillStyle='#f2f1e7';g.fillText(b.title,b.x+b.w/2,b.y+titleSize/2+3);if(b.sub){g.font=`${subSize}px sans-serif`;g.fillStyle='#c1d2cf';g.fillText(b.sub,b.x+b.w/2,b.y+titleSize+subSize/2+7)}}

  for(const m of W.marks||[]){const [px,py]=P(m.x,m.y);g.font=`${Math.round(cw/26)}px sans-serif`;g.fillText(m.i,px,py)}
  if(W.fw){const A=W.realms.find(r=>r.name===W.fw.a),B=W.realms.find(r=>r.name===W.fw.b);if(A&&B){const [ax,ay]=P(A.x,A.y),[bx,by]=P(B.x,B.y);g.font=`${Math.round(cw/18)}px sans-serif`;g.fillText('⚔️',(ax+bx)/2,(ay+by)/2)}}
  if(!W.known){const [px,py]=P(0,.55);g.font=`${Math.round(cw/28)}px sans-serif`;g.fillStyle='#ccc';g.fillText('바깥 세상은 아직 모릅니다. 이웃과 장사가 트이면 열립니다.',px,py)}
  dynWInfo(W)}
function dynWRel(r){return r.rel||(r.war?'전쟁 중':r.fta?'자유무역':r.tension>=60?'적대':r.tension>=35?'긴장':'보통')}
function dynWInfo(W){const el=$('#dynWInfo');if(!el)return;const h=dynWInfoHTML(W);if(el._h!==h){el._h=h;el.innerHTML=h;dynBindActions(el)}}
function dynJo(w,a,b){const c=(w||'').charCodeAt((w||'').length-1)-0xAC00;return w+(c>=0&&c<11172&&c%28?a:b)}
function dynFarHTML(f){return `<h4>${dynEsc(f.name)} <small>바다 건너 먼 나라</small></h4>${dynKV([['체제',dynEsc(f.regName)],[dynEsc(f.title),`${dynEsc(f.ruler.name)} (${f.ruler.age}세·${f.ruler.sex==='F'?'여':'남'})`],['인구',f.pop.toLocaleString()+'명'],['군대',typeof f.mil==='number'?f.mil.toLocaleString():dynEsc(f.mil)],['거느린 땅',f.land+'곳'],['전쟁',f.war?'⚔️ '+dynJo(dynEsc(f.war),'과','와')+' 전쟁 중':'없음'],['동맹',f.ally.length?dynEsc(f.ally.join(', ')):'없음'],['우리와의 관계',`${f.rel>=40?'가까움':f.rel>=15?'알고 지냄':f.rel<=-20?'나쁨':'잘 모름'} (${f.rel})`]])}
  ${dynWActs(f.name)}${f.hist.length?`<b class="muted">최근 일</b><ul>${f.hist.map(e=>`<li><small>${fmtD(e.d)}</small> ${dynEsc(e.text)}</li>`).join('')}</ul>`:''}`}
function dynWInfoHTML(W){let h='';const r=W.realms.find(x=>x.name===dynWSel);const ff=!r&&(W.far||[]).find(x=>x.alive&&x.name===dynWSel);if(ff)return dynFarHTML(ff)+(W.news?.length?`<b class="muted">세계 소식</b><ul>${W.news.slice(0,8).map(e=>`<li><small>${fmtD(e.d)}</small> ${dynEsc(e.text)}</li>`).join('')}</ul>`:'');
  if(r){const rl=r.ruler;h=`<h4>${dynEsc(r.name)} <small>${dynEsc(r.tag)}</small></h4>${dynKV([['체제',dynEsc(r.regName)],[dynEsc(r.title),`${dynEsc(rl.name)} (${rl.age}세·${rl.sex==='F'?'여':'남'})`],
      ['통치 가문',`${dynEsc(r.house)} · ${r.since>0?fmtD(r.since)+'부터':'우리 마을이 생기기 전부터'}`],r.heir&&['후계자',`${dynEsc(r.heir.name)} (${r.heir.age}세·${r.heir.sex==='F'?'여':'남'})`],['인구',r.pop.toLocaleString()+'명'],
      ['군대',typeof r.mil==='number'?r.mil.toLocaleString():dynEsc(r.mil)],['기술',typeof POWER_L!=='undefined'?POWER_L[r.era]||r.era:r.era],r.prov?['속령',`${fmtD(r.prov.d)}부터 · 거둔 세금 ${money(r.prov.tax)} · 불만 ${r.prov.unrest}${r.prov.unrest>=55?' ⚠️ 독립 위험':''}`]:['우리와의 관계',`${dynWRel(r)} (긴장 ${r.tension})`],r.kin&&['사돈',`${dynEsc(r.kin.name)} ↔ ${dynEsc(r.kin.spouse)}`]])}
      ${rl.traits?`<p><small>성향(첩보): ${rl.traits.map(([k,v])=>`${k} ${v}`).join(' · ')}</small></p>`:'<p><small>통치자의 속내는 의원·귀족 이상이 되어야 알 수 있습니다.</small></p>'}
      ${dynWActs(r.name)}
      ${r.hist.length?`<b class="muted">최근 일</b><ul>${r.hist.map(e=>`<li><small>${fmtD(e.d)}</small> ${dynEsc(e.text.replace(r.name+': ',''))}</li>`).join('')}</ul>`:''}`}
  else{const us=W.us;h=`<h4>🏠 ${dynEsc(us.name)}</h4>${dynKV([['체제',dynEsc(us.regName)],us.ruler&&[dynEsc(us.ruler.title),`${dynEsc(us.ruler.name)} (${us.ruler.age}세)`],['인구',us.pop.toLocaleString()+'명'],['군대',us.mil.toLocaleString()]])}
    <p><small>${W.known?'다른 나라를 누르면 통치 가문과 관계가 보입니다. 우리 마을을 누르면 마을 지도로 돌아갑니다.':'이웃과 장사가 트이면 이웃 나라가 지도에 나타납니다.'}</small></p>${W.known?'<p><small>지도 표시: <span style="color:#e8c25a">- - 교역로</span> · <span style="color:#6fb6ff">··· 동맹</span> · <span style="color:#ff3b30">━ 전선</span> · 💥 전쟁터 · 📢 큰 사건 · 🏴 속령 · ⛪ 국교</small></p>':''}`}
  if(W.news&&W.news.length)h+=`<b class="muted">세계 소식</b><ul>${W.news.slice(0,8).map(e=>`<li><small>${fmtD(e.d)}</small> ${dynEsc(e.text)}</li>`).join('')}</ul>`;
  return h}
// 선택한 나라에 대한 외교 행동(서버가 지위에 맞게 보낸 것만). 나 탭의 행동 목록과 같은 버튼·두 번 눌러 실행.
function dynWActs(name){const acts=(dynView?.actions||[]).filter(a=>a.group==='외교'&&a.k.split(':')[2]===name);
  if(!acts.length)return (dynView?.rank??0)<3?'<p><small>외교는 의원·귀족 이상이 되어야 할 수 있습니다(전쟁·동맹은 최고 권력자만).</small></p>':'';
  return `<div class="dynpanel"><b class="muted">외교</b>${acts.map(a=>`<button class="act${a.ok&&a.k===dynActArm?' arm':''}" data-act="${dynEsc(a.k)}" ${a.ok?'':'disabled'}>${dynEsc(a.label)}<small>${dynEsc(a.ok?(a.k===dynActArm?'한 번 더 누르면 실행합니다':a.hint):a.why)}</small></button>`).join('')}<div class="err">${dynEsc(dynActErrText)}</div></div>`}

// ===== 한 화면 앱 배치 (/god 전용) =====
// 페이지 스크롤 없이: 위 상태 줄 · 지도 · 사건 띠 · 메뉴 창(안에서만 스크롤) · 아래 메뉴. 원래 마을 화면(/)은 그대로.
function dynNetHTML(v){const f=v.family,m=v.me;return `<div class="sec"><h4>인맥</h4>${dynKV([['배우자',f.partner?dynPerson(f.partner):'없음'],!m.publicDuty&&['고용주',m.emp?dynPerson(m.emp):'없음'],['고용한 사람',(m.staff||0)+'명'],['소속 조직',m.grp?dynEsc(m.grp.name):'없음']])}</div>
  <div class="sec"><h4>사돈·가문 관계</h4>${(v.ties||[]).length?dynKV(v.ties.map(t=>[dynEsc(t.name),`${t.v>0?'우호':t.v<0?'적대':'보통'} ${Math.round(t.v*100)} · ${dynEsc(t.why)}`])):'<p class="muted">아직 사돈을 맺은 집안이 없습니다.</p>'}</div>`}
function dynProvHTML(v){const P=(v.world?.realms||[]).filter(r=>r.prov);if(!P.length)return '';return `<div class="sec"><h4>속령</h4>${dynKV(P.map(r=>[dynEsc(r.name),`인구 ${r.pop.toLocaleString()} · 세금 ${money(r.prov.tax)} · 불만 ${r.prov.unrest}${r.prov.unrest>=55?' ⚠️':''}`]))}</div>`}
function dynDipHTML(v){const W=v.world;if(W&&W.known&&dynWSel&&(W.realms.some(r=>r.name===dynWSel)||(W.far||[]).some(f=>f.alive&&f.name===dynWSel)))return `<div class="sec"><button class="act" data-wback="1">← 나라 목록</button></div><div class="dynwinfo">${dynWInfoHTML(W)}</div>`;if(!W||!W.known)return '<div class="sec"><h4>외교</h4><p class="muted">아직 이웃 나라를 모릅니다. 이웃과 장사가 트이면 세계 지도와 외교가 열립니다.</p></div>';
  return `<div class="sec"><h4>이웃 나라</h4><p class="muted">위 세계 지도에서 나라를 눌러도 됩니다.</p>${W.realms.map(r=>`<button class="act realm" data-realm="${dynEsc(r.name)}">${r.war?'⚔️':r.prov?'🏴':r.ally?'🛡️':r.fta?'🤝':''} ${dynEsc(r.name)} · ${dynEsc(r.regName)}<small>${dynEsc(r.title)} ${dynEsc(r.ruler.name)}(${r.ruler.age}) · 인구 ${r.pop.toLocaleString()} · ${dynEsc(dynWRel(r))}</small></button>`).join('')}</div>${(W.far||[]).some(f=>f.alive)?`<div class="sec"><h4>바다 건너 먼 나라</h4>${W.far.filter(f=>f.alive).map(f=>`<button class="act realm" data-realm="${dynEsc(f.name)}">${f.war?'⚔️':f.rel>=40?'🤝':''} ${dynEsc(f.name)} · ${dynEsc(f.regName)}<small>${dynEsc(f.title)} ${dynEsc(f.ruler.name)}(${f.ruler.age}) · 인구 ${f.pop.toLocaleString()} · 땅 ${f.land}곳${f.war?' · '+dynJo(dynEsc(f.war),'과','와')+' 전쟁 중':''}${f.ally.length?' · 동맹 '+dynEsc(f.ally.join('/')):''}</small></button>`).join('')}</div>`:''}
  ${v.warFamily?`<div class="sec"><h4>전쟁의 후유증·인질</h4>${dynKV([['강제 노동 중인 포로',v.warFamily.captives+'명'],['국제적 비난',Math.round(v.warFamily.cruelty*100)+'점']])}${v.warFamily.hostages.map(h=>`<p>${dynEsc(h.country)} · ${dynEsc(h.name)} · ${h.days}일 남음 · ${h.blocks?'침공 억제 중':'왕조 변화로 억제력 없음'}</p>`).join('')}${v.warFamily.grievances.map(g=>`<small class="muted">${dynEsc(g.country)}의 원한 ${Math.round(g.value*100)}</small>`).join('')}</div>`:''}
  ${dynActionsHTML(v,'dip')||'<p class="muted">외교는 의원·귀족 이상이 되어야 할 수 있습니다(전쟁·동맹은 최고 권력자만).</p>'}`}
function dynAppLayout(){
  const css=document.createElement('style');css.textContent=`
body.dyn{overflow:hidden;overscroll-behavior:none}
body.dyn header.top,body.dyn .caption,body.dyn .legend,body.dyn .stopbox,body.dyn .main>.col>.controls,body.dyn .savebar,body.dyn #dynMapBar{display:none!important}
#dynApp{position:fixed;inset:0;display:flex;flex-direction:column;max-width:620px;margin:0 auto;background:var(--bg,#0f1020);z-index:20;padding:env(safe-area-inset-top) 0 0}
#dynApp .dtop{display:flex;align-items:center;gap:6px;padding:6px 8px;background:#14162a;border-bottom:2px solid #000;font-family:var(--f-head);font-size:14px;flex:none}
#dynApp .dtop .who{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;cursor:pointer}
#dynApp .dtop .who b{font-weight:400;color:var(--cream,#fff)}#dynApp .dtop .who small{color:var(--muted);margin-left:4px}
#dynApp .dtop .num{white-space:nowrap;color:var(--gold)}#dynApp .dtop button{padding:5px 8px;font-size:14px;min-width:34px}
#dynApp .dstat{display:flex;gap:10px;padding:3px 10px;font-size:12.5px;color:var(--muted);background:#14162a;flex:none;white-space:nowrap;overflow-x:auto}
#dynApp .dstat b{color:var(--cream,#fff);font-weight:400}
#dynApp .dmap{position:relative;flex:none;background:#000;overflow:hidden;transition:height .2s}
#dynApp .dmap>.screen,#dynApp .dmap>#dynWorld{position:relative}
#dynApp .dmap .msz{position:absolute;left:6px;bottom:6px;z-index:5;padding:4px 8px;font-size:12.5px;opacity:.92}
#dynApp .dmap .screen{margin:0;border-width:0;outline:0;box-shadow:none}
#dynApp .dmap .dynwmap{margin:0;border:0;outline:0}
#dynApp .dmap .mapsw{position:absolute;left:6px;top:6px;z-index:5;display:flex;gap:4px}
#dynApp .dmap .mapsw button{padding:4px 8px;font-size:12.5px;opacity:.92}#dynApp .dmap .mapsw button.on{background:var(--gold);color:#000}
#dynApp .dmap .bell{position:absolute;right:6px;bottom:6px;z-index:5;padding:5px 9px;font-size:14px;background:#5a4512;animation:dynblink 1.2s ease-in-out infinite alternate}
#dynApp .dstrip{flex:none;padding:6px 10px;font-size:13px;background:#1d2b22;border-top:2px solid #000;border-bottom:2px solid #000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;min-height:1.2em}
#dynApp .dstrip.wait{background:#3a2f12;color:var(--cream)}
#dynApp #dynSheet{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:4px 8px 10px;overscroll-behavior:contain}
#dynApp #dynSheet .panel{margin:0}
#dynApp #dynWorld .dynwinfo{display:none}
body.dyn #dynApp .dyntabs{position:static;flex:none;display:flex;flex-wrap:nowrap;gap:2px;margin:0;padding:4px 4px calc(4px + env(safe-area-inset-bottom));background:#14162a;box-shadow:0 -2px 10px #0008}
body.dyn #dynApp .dyntabs button{flex:1;min-width:0;padding:4px 0;font-size:11.5px;display:flex;flex-direction:column;align-items:center;gap:1px;position:relative}
body.dyn #dynApp .dyntabs .ic{font-size:17px;line-height:1.1}body.dyn #dynApp .dyntabs .cnt{position:absolute;top:0;right:4px;background:#c0392b;color:#fff;border-radius:8px;font-size:10px;padding:0 4px;font-style:normal}
body.dyn .dynnote{display:none!important}body.dyn .dyntop{display:none!important}
body.dyn #card:not([hidden]){max-height:78vh}
.dynpanel .act.realm{background:var(--panel2)}
.dynsetbox .row2{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.dynsetbox .row2 button{flex:1;min-width:30%}.dynsetbox .row2 button.on{background:var(--gold);color:#000}`;
  document.head.appendChild(css);
  const theme=document.createElement('style');theme.id='dynTheme';theme.textContent=`/* 가문 모드 전용: 읽기 쉬운 모바일 대시보드 */
body.dyn{--bg:#10171c;--panel:#182329;--panel2:#1d2b32;--cream:#edf2f2;--muted:#a2b1b6;--gold:#e4c586;--line:#33434a;background:#0a1115;color:var(--cream);font-family:system-ui,-apple-system,'Noto Sans KR',sans-serif;font-size:14px;line-height:1.55}
body.dyn button,body.dyn input,body.dyn select,body.dyn .dynbox,body.dyn .dynpanel{font-family:inherit;letter-spacing:0}
body.dyn button{border:1px solid #41515a;border-radius:10px;background:#22323b;color:#edf2f2;box-shadow:none;min-height:42px;cursor:pointer;touch-action:manipulation}
body.dyn button:hover:not(:disabled){border-color:#bcaa80;background:#2c3e45}body.dyn button:focus-visible,body.dyn summary:focus-visible,body.dyn input:focus-visible,body.dyn select:focus-visible{outline:2px solid #e4c586;outline-offset:3px}
body.dyn button:disabled{cursor:default}body.dyn input,body.dyn select{min-height:44px;max-width:100%;border:1px solid #455962;border-radius:9px;background:#111d24;color:#edf2f2;padding:8px 10px;font-size:16px;box-sizing:border-box}
body.dyn input::placeholder{color:#81949d}body.dyn label{line-height:1.6}body.dyn [hidden]{display:none!important}
#dynApp{max-width:820px;background:#10191f;box-shadow:0 0 70px #0007;padding-top:env(safe-area-inset-top)}
#dynApp .dtop{gap:7px;padding:11px 14px;background:#142128;border-bottom:1px solid #30424a;font-family:inherit;min-height:60px;box-sizing:border-box}
#dynApp .dtop .who b{font-weight:700;font-size:16px}#dynApp .dtop .who small{display:block;margin:1px 0 0;font-size:11px;line-height:1.3}
#dynApp .dtop button{padding:5px 8px;min-width:40px;min-height:40px}#dynApp .dtop #dPlay{background:#e4c586;color:#192127;border-color:#e4c586}
#dynApp .dtop .num{font-size:12px;max-width:120px;overflow:hidden;text-overflow:ellipsis}#dynApp .dstat{padding:5px 14px;background:#142128;font-size:11px;scrollbar-width:none;gap:14px;border-bottom:1px solid #283941}
#dynApp .dmap{background:#14242b}#dynApp .dmap .msz{min-height:28px;border-radius:7px;bottom:3px;left:auto;right:8px;font-size:11px;padding:2px 8px;background:#172a34e8}
#dynApp .dmap .mapsw button{min-height:32px;font-size:12px;background:#162c38e8}#dynApp .dmap .mapsw button.on{background:#e4c586;color:#142128}
#dynApp .dstrip{padding:8px 14px;border-top:1px solid #293d43;border-bottom:1px solid #293d43;background:#1a2b2c;color:#c5d8d3;font-size:12px;min-height:20px}#dynApp .dstrip.wait{background:#3d3320;color:#f2d89f}
#dynApp #dynSheet{padding:0 14px 18px;scroll-padding-top:78px;scrollbar-width:thin;scrollbar-color:#455b66 transparent}
#dynApp #dynSheet .panel{padding:0;border:none;outline:none;background:transparent;box-shadow:none;min-width:0}
.sheethead{position:sticky;top:0;z-index:8;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0 10px;background:#10191ff5;backdrop-filter:blur(12px)}
.sheethead small{display:block;color:#8fa5af;font-size:10px;letter-spacing:.13em}.sheethead h2{font-size:21px;margin:0;color:#edf2f2;font-weight:650;font-family:inherit;line-height:1.4}.sheethead button{font-size:12px;padding:6px 11px;min-height:36px}
.dynpanel .sec{padding:14px;background:#17252d;border:1px solid #2c414b;border-radius:15px;margin-bottom:12px;min-width:0;overflow-wrap:anywhere}
.dynpanel h4{font:650 14px/1.5 system-ui,sans-serif;color:#e2c895;margin:0 0 10px}.dynpanel p{margin:6px 0 10px}.dynpanel .muted{color:#a2b1b6}.dynpanel .kv>div{padding:7px 0;font-size:12.5px;border-color:#2c3c44;gap:12px}.dynpanel .kv>div>span:last-child{text-align:right;color:#e2ebec}
.dynpanel .actw{margin:7px 0}.dynpanel .act{border-radius:11px;padding:12px 42px 12px 12px;margin:0;background:#20313b;border:1px solid #3b505b;font-size:13px;line-height:1.55;min-height:48px;box-sizing:border-box;white-space:normal;overflow-wrap:anywhere}
.dynpanel .act small{margin-top:4px;font-size:11.5px;color:#a9bbc5}.dynpanel .act.off{background:#18262e;border-color:#30414a;color:#8b9ca5;opacity:1}.dynpanel .act.off small{color:#93a4ad}.dynpanel button.act:disabled{background:#18262e;color:#8b9ca5;opacity:1}
.dynpanel .act.arm{border-color:#e4c586;background:#3e3829;color:#ffdfa0}.dynpanel .actw>.fav{right:4px;top:6px;min-width:32px;min-height:36px;border:0;padding:2px;font-size:21px;box-shadow:none}.dynpanel .actw>.fav:hover{background:#ffffff09}
.dynpanel .act.multi{padding-bottom:12px}.dynpanel .act.multi .qty{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.dynpanel .act.multi .qty button{font-size:12px;min-height:40px;padding:7px 10px;flex:1 1 100px}.dynpanel .act.multi label{display:block;font-size:12px;margin-top:8px}.dynpanel .act.multi input:not([type=number]),.dynpanel .act.multi select{display:block;width:100%;margin-top:5px}.dynpanel .act.multi>button{margin-top:8px;padding:8px 12px;font-size:12px}
.dynpanel .actgrp{margin:8px 0;border:1px solid #344953;border-radius:12px;overflow:hidden;background:#14232b}.dynpanel .actgrp>summary,.dynpanel .subgrp>summary{display:flex;align-items:center;justify-content:space-between;gap:10px;list-style:none;cursor:pointer;padding:13px 12px;font-size:13px;font-weight:600;min-height:25px;touch-action:manipulation}.dynpanel summary::-webkit-details-marker{display:none}.dynpanel .actgrp>summary::before{content:'＋';font-size:17px;color:#d8be84}.dynpanel .actgrp[open]>summary::before{content:'−'}.dynpanel .actgrp>summary span{flex:1}.dynpanel .actgrp summary small{font-weight:400;color:#99aeb8;font-size:11px}.dynpanel .actgrp>.actw{margin:8px}.dynpanel .subgrp{margin:8px;border-radius:9px;border:1px solid #334852}.dynpanel .subgrp>summary{font-size:12px}.dynpanel .subgrp>.actw{margin:6px}
.dynpanel .action-section{padding:10px}.actiontools{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:10px}.actiontools b{flex:1;font-size:13px}.actiontools b span{color:#a2b1b6;font-weight:400}.actiontools button{font-size:11px;padding:4px 8px;min-height:34px}.actiontools button.on{background:#e4c586;color:#17242b}
.dynpanel .hero{background:linear-gradient(125deg,#253a40,#1b2a32);border-color:#52645c;padding:16px}.hero .eyebrow{font-size:10px;letter-spacing:.12em;color:#cbbd9c}.hero .hero-top{display:flex;justify-content:space-between;gap:10px;align-items:center}.hero h3{font:650 20px/1.5 system-ui,sans-serif;margin:3px 0 0;color:#f3f4ec}.hero .pill{font-size:10px;border:1px solid #657369;color:#e9d6a6;border-radius:20px;padding:4px 9px}.hero .wealth{font-size:24px;font-weight:650;color:#efd6a5;margin:9px 0 2px;font-variant-numeric:tabular-nums}.hero .wealth small{font-size:10px;color:#a9bcbf;font-weight:400;margin-right:8px}.hero .hero-sub{font-size:11px;color:#a8bec4}.hero .quickstats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid #51615d}.hero .quickstats small{display:block;color:#a9b9bc;font-size:10px}.hero .quickstats b{font-size:13px;font-weight:600}
.statusgrid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}.statusgrid button{display:flex;flex-direction:column;align-items:flex-start;text-align:left;padding:11px 12px;min-height:86px;border-radius:12px;background:#17262f;border:1px solid #354b57;gap:4px;overflow:hidden}.statusgrid button>span{font-size:11px;color:#b4c5cb}.statusgrid button>b{font-size:15px;color:#e7eef0;font-weight:650;line-height:1.35}.statusgrid button>small{font-size:10px;color:#92aab5;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.statusgrid button.danger{border-color:#915e58;background:#342a2c}.statusgrid button.danger>b{color:#f2b5a3}.statusgrid button.attention{border-color:#82734a;background:#302e25}.statusgrid button.attention>b{color:#ead092}
.dynpanel .sectioncaption{font-size:12px;color:#b5c4ca;margin:14px 2px 8px;display:flex;justify-content:space-between}.dynpanel .sectioncaption small{color:#7f99a4;font-size:10px}.dynpanel .hjump{gap:7px}.dynpanel .hjump button{padding:7px 10px;min-height:36px;font-size:11px;border-radius:20px}.dynpanel .dynq{border-radius:11px;background:#101e27;padding:11px 12px;min-height:46px;margin:0 0 8px;font-size:16px}.dynpanel .warn{border-color:#915e58;background:#342a2c}
body.dyn #dynApp .dyntabs{padding:7px 5px calc(7px + env(safe-area-inset-bottom));border-top:1px solid #344852;background:#14232b;box-shadow:0 -8px 24px #0002;gap:3px}body.dyn #dynApp .dyntabs button{border:none;background:transparent;color:#a2b3bd;border-radius:10px;min-height:50px;font-size:10px;gap:4px;padding:6px 0}body.dyn #dynApp .dyntabs button.on{background:#2c3d42;color:#efd6a5;box-shadow:inset 0 2px #d6be88}body.dyn #dynApp .dyntabs .ic{font-size:18px}body.dyn #dynApp .dyntabs .cnt{background:#415d68;color:#e0ebef;font-size:8px;top:2px;right:2px;padding:0 3px;min-width:8px}body.dyn #dynApp .dyntabs button.on .cnt{background:#d9bc7b;color:#1a252b}
body.dyn .dynmodal{background:#060c12c9;backdrop-filter:blur(6px);padding:14px}body.dyn .dynbox{box-sizing:border-box;width:min(100%,560px);max-height:88dvh;overflow-y:auto;background:#192a34;border:1px solid #51646d;border-radius:18px;padding:20px;color:#e4ecef;box-shadow:0 16px 70px #0008;font-size:14px}body.dyn .dynbox h3{font:650 19px/1.5 system-ui,sans-serif;color:#e5cc96;margin:0 0 12px}body.dyn .dynbox .opt{border:1px solid #405865;border-radius:10px;background:#233b47;padding:12px;font-size:13px;margin:8px 0;line-height:1.5}body.dyn .dynbox label{display:block;margin:10px 0}body.dyn .dynbox label input,body.dyn .dynbox label select{width:100%;margin-top:4px}
#dFeedback{display:flex;align-items:flex-start;gap:8px;margin:8px 14px 0;padding:10px 12px;border:1px solid #4c7167;border-radius:10px;background:#203b35;font-size:12px;line-height:1.5;flex:none;max-height:105px;overflow-y:auto}#dFeedback span{flex:1}#dFeedback button{min-height:26px;min-width:26px;padding:0;background:transparent;border:0}#dFeedback.error{background:#422e30;border-color:#9a6866;color:#ffd4c7}.dynpanel .err:empty{display:none}
@media(max-width:420px){#dynApp .dtop{padding:9px 12px}#dynApp .dtop .num{display:none}#dynApp #dynSheet{padding-left:10px;padding-right:10px}.sheethead h2{font-size:19px}.dynpanel .sec{padding:12px}.dynpanel .hero{padding:14px}.hero h3{font-size:18px}.hero .wealth{font-size:23px}.statusgrid button{min-height:82px;padding:10px}.statusgrid button>b{font-size:14px}}
@media(min-width:680px){.statusgrid{grid-template-columns:repeat(3,1fr)}.dynpanel .hero .hero-top h3{font-size:24px}.dynpanel .hgrid{grid-template-columns:repeat(3,1fr)}}
@media(prefers-reduced-motion:reduce){body.dyn *,body.dyn *::before{animation:none!important;transition:none!important;scroll-behavior:auto!important}}

@media(max-width:420px){.sheethead{padding:8px 0}.sheethead h2{font-size:18px}.dynpanel .hero{padding:12px}.hero h3{font-size:17px}.hero .wealth{font-size:21px;line-height:1.3;margin:6px 0 0}.hero .hero-sub{font-size:10px}.hero .quickstats{margin-top:8px;padding-top:8px}.hero .quickstats small{font-size:9px}.hero .quickstats b{font-size:12px}.statusgrid button{min-height:76px;padding:9px 10px}.statusgrid{gap:7px}}

#dynApp .dtop{min-height:52px;padding-top:6px;padding-bottom:6px}
#dynApp .dstat{padding-top:3px;padding-bottom:3px}
#dynApp .dstrip{padding-top:5px;padding-bottom:5px}
#dynApp .sheethead{padding:7px 0}
#dynApp #dynSheet .hero{margin:8px 0;padding:9px 11px}
#dynApp .hero .wealth{margin:0;line-height:1.25;font-size:21px}
#dynApp .hero .wealth small{display:inline;color:#bac9c9}
#dynApp .hero .hero-sub{margin:3px 0}
#dynApp .hero .quickstats{margin-top:5px;padding-top:5px}
#dynApp .statusgrid{gap:5px;margin:0 0 8px}
#dynApp .statusgrid button{justify-content:center;gap:1px;min-height:44px;padding:4px 8px;border-radius:8px;line-height:1.2}
#dynApp .statusgrid button>b{font-size:13px}
#dynApp .home-actions .dynq{margin:0 0 5px}
#dynApp .quick-favs{margin-bottom:6px;border:1px solid #344953;border-radius:10px;background:#17262f}
#dynApp .quick-favs summary{cursor:pointer;min-height:39px;padding:7px 9px;box-sizing:border-box;font-size:13px}
#dynApp .quick-favs summary small{color:#a2b1b6;margin-left:5px}
#dynApp .quick-favs .muted{margin:0 9px 9px}
#dynApp .quick-favs .actw{margin:5px}
#dynApp .quick-buttons{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;padding:0 6px 6px;max-height:84px;overflow:auto}
#dynApp .quick-buttons button{min-height:36px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:4px 8px;font-size:12px}
#dynApp .quick-buttons button[aria-expanded=true]{border-color:#e4c586}
#dynApp .home-warnings{display:flex;gap:5px;overflow:auto;margin-bottom:8px}
#dynApp .home-warnings button{min-height:34px;white-space:nowrap;background:#312c22;border-color:#60573f;padding:4px 8px;font-size:11px}
#dynApp #dFeedback{padding:5px 8px;margin-top:4px;max-height:55px}
#dynApp .dtop .who small{display:inline;margin-left:6px}
#dynApp #dFind{font-size:17px}
#dynApp .inbox h4 small{font-weight:400;color:#a2b1b6;margin-left:6px}#dynApp .inbox .act.warn{border-color:#a07a3a}
#dynApp .today{margin:6px 0 0;font-size:12px;color:#c9d6d6}#dynApp .hero .today{color:#e4c586}
#dynApp .hjump{display:flex;gap:5px;overflow-x:auto;margin:0 0 6px;padding-bottom:2px}
#dynApp .hjump button{flex:none;min-height:34px;padding:4px 9px;font-size:12px;white-space:nowrap;border-radius:8px}
#dynApp .hjump button b{color:#e4c586;margin-left:3px}
#dynApp .dynpanel .actgrp{margin:5px 0}
#dynApp .dynpanel .actgrp>summary{min-height:38px;padding-top:5px;padding-bottom:5px}
#dynApp .dynpanel .actgrp.none>summary{opacity:.55}
#dynApp .dynpanel .action-section{padding-top:8px}
#dynApp #dynSheet .sec{margin-top:8px}
body.dyn .dyn-cast{font-size:12px;color:#b8c8cb}
`;theme.textContent+=`#dMap[data-collapsed="true"]>.screen,#dMap[data-collapsed="true"]>#dynWorld{visibility:hidden}#dMap[data-collapsed="true"]::before{content:'마을 · 세계 지도';position:absolute;left:14px;top:8px;font-size:11px;color:#a0b5bc}#dMap[data-collapsed="true"]{border-bottom:1px solid #30434b}`;document.head.appendChild(theme);
  const app=document.createElement('div');app.id='dynApp';
  app.innerHTML=`<div class="dtop"><div class="who" id="dTopWho">불러오는 중…</div><span class="num" id="dTopNum"></span><button id="dFind" data-find aria-label="행동 찾기">⌕</button><button id="dPlay" aria-label="재생">▶</button><button id="dSpeed" aria-label="진행 속도">×1</button><button id="dMenu" aria-label="설정">⚙</button></div>
    <div class="dstat" id="dStat"></div><div class="dmap" id="dMap"><div class="mapsw"><button data-mm2="town">🏘 마을</button><button data-mm2="world">🌍 세계</button></div><button class="bell" id="dBell" hidden>🔔</button><button class="msz" id="dMsz">지도 ▾</button></div>
    <div class="dstrip" id="dStrip" role="button" tabindex="0" aria-label="사건과 소식 열기">-</div><div id="dFeedback" role="status" aria-live="polite" hidden></div><div id="dynSheet"></div>`;
  document.body.appendChild(app);
  const map=$('#dMap');map.appendChild($('.screen'));map.appendChild($('#dynWorld'));
  const sheet=$('#dynSheet');for(const q of ['#dynPanel','#tabsTop','#tabs','#panel'])sheet.appendChild($(q));
  app.appendChild($('#dynTabs'));
  map.querySelectorAll('[data-mm2]').forEach(b=>b.onclick=()=>dynSetMap(b.dataset.mm2));
  try{dynMapSize=+(localStorage.getItem('v-dynmsz')??2)}catch(e){}
  $('#dMsz').onclick=()=>{dynMapSize=dynAutoMap?1:(dynMapSize+1)%3;dynAutoMap=false;try{localStorage.setItem('v-dynmsz',dynMapSize)}catch(e){}dynFitMap()};
  new ResizeObserver(()=>dynFitMap()).observe(app);
  $('#dBell').onclick=$('#dStrip').onclick=()=>{const u=dynUrg(dynView);if(u.length)dynOpen(u[0],true);else dynGoTo('news')};
  $('#dTopWho').onclick=()=>{if(dynView?.me)select(dynView.me.id)};
  $('#dPlay').onclick=()=>$('#play').click();
  const SP=[2,6,30];$('#dSpeed').onclick=async()=>{const i=(SP.indexOf(speed)+1)%SP.length;await dynSend({action:'speed',value:SP[i]})};
  $('#dMenu').onclick=()=>dynSettings();$('#dFind').onclick=()=>dynFindActions();
  $('#dStrip').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('#dStrip').click()}};
  addEventListener('keydown',e=>{const tag=document.activeElement?.tagName;if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(tag)&&$('#dynModal').hidden){e.preventDefault();dynFindActions()}if(e.key==='Escape'&&!$('#dynModal').hidden){$('#dynModal').hidden=true;if(dynModalId==='settings')dynModalId=null}});
  // 세계 지도 정보 카드는 메뉴 창(외교)으로 옮긴다
  const wi=$('#dynWInfo');if(wi){wi.classList.add('dynpanel');}
  addEventListener('resize',()=>{if(dynMapMode==='world')dynDrawWorld()});
  new MutationObserver(()=>{const c=$('#card');if(c.hidden){dynCardFor=null;return}if(!c.querySelector('#dynTgt')||dynCardFor!==sel)dynCardActions()}).observe($('#card'),{childList:true,attributes:true,attributeFilter:['hidden']});
}
function dynSettings(){const box=$('#dynModal');box.hidden=false;dynModalId='settings';
  box.innerHTML=`<div class="dynbox dynsetbox"><h3>⚙ 설정</h3><div class="row2"><button data-c="ff1">+1년 건너뛰기</button><button data-c="ff10">+10년 건너뛰기</button></div>
    <div class="row2"><button data-c="save">지금 저장</button><a class="modelink" href="/" style="flex:1;text-align:center;padding:8px">원래 마을로</a></div>
    <div class="row2"><button data-c="stats">📊 마을 통계 보기</button></div>
    <p class="muted" style="margin:6px 0 0;font-size:12.5px">이야기 사건 빈도 (지금까지 ${dynView?.story?.n||0}번)</p><div class="row2">${[[0,'끄기'],[1,'적게 (15~20일)'],[2,'보통 (8~12일)'],[3,'많이 (4~6일)']].map(([f,l])=>`<button data-sf="${f}" class="${(dynView?.story?.freq??2)===f?'on':''}">${l}</button>`).join('')}</div>
    <p class="muted" style="font-size:12.5px">${dynEsc($('#saveTxt')?.textContent||'')}</p><div class="row2"><button data-c="new" style="background:#5a1a1a">새 가문 마을 (지금 마을 지움)</button></div>
    <button class="opt" data-c="close">닫기</button></div>`;
  box.querySelectorAll('[data-sf]').forEach(b=>b.onclick=async()=>{try{await dynApi(dynApiBase+'/api/cmd',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'story',freq:+b.dataset.sf})});await dynSend({action:'save'})}catch(e){}box.hidden=true;dynModalId=null});
  box.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{const c=b.dataset.c;
    if(c==='ff1')$('#ff1').click();else if(c==='ff10')$('#ff10').click();else if(c==='save')$('#saveNow').click();
    else if(c==='stats'){dynTab='power';dynRender();buildNav();renderPanel()}else if(c==='new'){if(!b.dataset.arm){b.dataset.arm=1;b.textContent='정말 지울까요? 한 번 더 누르세요';return}$('#reset').click();$('#reset').click()}
    box.hidden=true;dynModalId=null})}
let dynFeedbackHidden='',dynFeedbackTimer=0,dynFeedbackTimerKey='';
function dynAppRender(v){if(!$('#dynApp'))return;const m=v.me;dynTrackNew(v);
  $('#dTopWho').innerHTML=m?`<b>👤 ${dynEsc(m.name)}</b><small>${m.age}세 · ${dynEsc(v.title||v.rankName)}</small>`:`<b>${dynEsc(v.house)}</b>`;
  $('#dTopNum').textContent=m?'💰'+money(v.assets?.w||0):'';
  $('#dPlay').textContent=running?'⏸':'▶';$('#dPlay').setAttribute('aria-label',running?'일시정지':'재생');
  const feedback=$('#dFeedback'),resKey=JSON.stringify(v.res||null),showError=!!dynActErrText;feedback.hidden=!showError&&(!v.res||dynFeedbackHidden===resKey);if(!feedback.hidden){feedback.className=showError?'error':'';feedback.innerHTML=`<span>${dynEsc(showError?dynActErrText:v.res.text)}</span><button aria-label="알림 닫기">×</button>`;feedback.querySelector('button').onclick=()=>{dynFeedbackHidden=resKey;dynActErrText='';feedback.hidden=true;$('#dStrip').hidden=false};if(!showError&&dynFeedbackTimerKey!==resKey){dynFeedbackTimerKey=resKey;clearTimeout(dynFeedbackTimer);dynFeedbackTimer=setTimeout(()=>{if(dynFeedbackHidden!==resKey){dynFeedbackHidden=resKey;feedback.hidden=true;$('#dStrip').hidden=false}},7000)}}$('#dSpeed').textContent=speed>=30?'×3':speed>=6?'×2':'×1';
  const W=v.world;$('#dStat').innerHTML=`<span>🏠 <b>${dynEsc(v.house)}</b> ${v.gen}대</span><span>⭐ 평판 <b>${Math.round((m?.rep??1)*100)}</b></span><span>🏅 <b>${dynEsc(v.rankName)}</b></span>${W?`<span>🏰 <b>${dynEsc(W.us.name)}</b> ${(W.us.effPop||W.us.pop).toLocaleString()}명</span><span>🏛️ ${dynEsc(W.us.regName)}</span>`:''}<span>📅 ${fmtD(S.day)}</span>`;
  const st=$('#dStrip'),bell=$('#dBell'),U=dynUrg(v),IB=dynInb(v);st.hidden=!U.length&&!feedback.hidden;
  if(U.length){st.className='dstrip wait';st.textContent=`🔔 ${U[0].title?U[0].title+' · ':''}${U[0].text.replace(/\n/g,' ')}${U.length>1?` 외 ${U.length-1}건`:''} · 눌러서 선택`;bell.hidden=false;bell.textContent='🔔 '+U.length}
  else{bell.hidden=!IB.length;bell.textContent='📥 '+IB.length;st.className='dstrip';const r=v.res&&S.day-v.res.d<30?v.res:null;const n=v.news[0];st.textContent=!feedback.hidden?(running?'시간이 흐르고 있어요':'일시정지 · 행동을 고르거나 ▶를 눌러 진행하세요'):r?'📜 '+(r.changes?.length?r.changes.slice(0,3).map(dynChangeLabel).join(' · ')+' · ': '')+r.text:n?`📰 ${fmtD(n.d)} ${n.text}`:'📰 아직 주변에 별일이 없습니다'}
  document.querySelectorAll('#dMap [data-mm2]').forEach(b=>b.classList.toggle('on',b.dataset.mm2===dynMapMode));
  // 메뉴별 할 수 있는 행동 개수
  const cnt={};for(const a of v.actions||[])if(a.ok){const t=dynTabOfGroup(a.group);cnt[t]=(cnt[t]||0)+1}
  document.querySelectorAll('#dynTabs button').forEach(b=>{const i=b.querySelector('.cnt');const n=cnt[b.dataset.dt]||0;if(i){i.hidden=!n;i.textContent=n}});
}

// 지도 크기: 0 크게(전체) · 1 보통(가운데 60%) · 2 접기(띠만). 보통일 때는 지도 가운데를 잘라 보여 준다(누르는 위치는 그대로 맞음).
let dynMapSize=2,dynAutoMap=false;
function dynFitMap(){const box=$('#dMap');if(!box)return;const inner=dynMapMode==='world'?$('#dynWorld'):$('.screen');const full=(inner&&inner.offsetHeight)||Math.round(box.clientWidth*.68);
  const size=dynAutoMap&&dynTab==='dip'&&dynView?.world?.known?0:dynMapSize;
  box.dataset.collapsed=String(size===2);const h=size===0?full:size===1?Math.round(full*.6):34;box.style.height=h+'px';
  const off=size===1?Math.round((full-h)/2):0;for(const el of [$('.screen'),$('#dynWorld')])if(el)el.style.top=-off+'px';const zu=$('.screen .zoomui');if(zu)zu.style.marginTop=off+'px';
  const b=$('#dMsz');if(b)b.textContent=size===0?'지도 작게 ▴':size===1?'지도 접기 ▴':'지도 펴기 ▾';
  box.querySelectorAll('.mapsw,.zoomui').forEach(e=>e.style.display=size===2?'none':'')}

// 새로 할 수 있게 된 일: 처음으로 가능해진 행동을 소식 맨 위에 모아 보여 준다(기다림이 풀린 것은 빼고)
// 목록은 판(시드·시조·시작일)마다 따로 기억한다. 판이 바뀌면 새로 시작하고, 지금 실제로 할 수 있는 행동만 보여 준다.
const DYN_NEW_KEY='v-dynacts';
let dynNewGame=null,dynEver=new Set(),dynNewActs=[],dynNewShown=[];
try{localStorage.removeItem('v-dynever');localStorage.removeItem('v-dynnew')}catch(e){}
const dynActBase=k=>String(k||'').split(':').slice(0,2).join(':');
function dynNewLoad(game){dynNewGame=game;dynEver=new Set();dynNewActs=[];
  try{const o=JSON.parse(localStorage.getItem(DYN_NEW_KEY)||'null');if(o&&o.game===game){dynEver=new Set(o.ever||[]);dynNewActs=(o.news||[]).filter(n=>n&&n.k)}}catch(e){}}
function dynNewSave(){try{localStorage.setItem(DYN_NEW_KEY,JSON.stringify({game:dynNewGame,ever:[...dynEver],news:dynNewActs}))}catch(e){}}
function dynTrackNew(v){const game=v.game||'';if(game!==dynNewGame)dynNewLoad(game);let ch=false;const first=dynEver.size===0,ready=new Map();
  for(const a of v.actions||[]){if(!a.ok)continue;const b=dynActBase(a.k);if(!ready.has(b))ready.set(b,a);if(dynEver.has(b))continue;dynEver.add(b);ch=true;if(!first)dynNewActs.unshift({k:b,d:S.day,label:a.label,group:a.group,tab:dynTabOfGroup(a.group)})}
  if(ch){dynNewActs=dynNewActs.slice(0,12);dynNewSave()}
  dynNewShown=dynNewActs.filter(n=>ready.has(n.k)).map(n=>({...n,label:ready.get(n.k).label,group:ready.get(n.k).group,tab:dynTabOfGroup(ready.get(n.k).group)}))}
function dynNewActsHTML(){if(!dynNewShown.length)return '';const TL=Object.fromEntries(DYN_TABS.map(t=>[t[0],t[1]+' '+t[2]]));
  return `<div class="sec"><h4>✨ 새로 할 수 있게 된 일</h4>${dynNewShown.map(n=>`<button class="act" data-goto="${n.tab}">${dynEsc(n.label)}<small>${fmtD(n.d)} · ${dynEsc(TL[n.tab]||'')} 메뉴 · ${dynEsc(n.group)}</small></button>`).join('')}</div>`}
// 인물 카드에 "이 사람에게" 행동 버튼을 붙인다(서버가 대상·지위에 맞게 고른 것만)
let dynCardFor=null,dynCardActs=null,dynCardBusy=false;
async function dynCardActions(force){const card=$('#card');if(!card||card.hidden||sel==null)return;if(card.querySelector('#dynTgt')&&!force&&dynCardFor===sel)return;
  if(dynCardBusy)return;dynCardBusy=true;const id=sel;
  try{const r=await dynApi(dynApiBase+'/api/cmd',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'targets',id})});if(sel!==id)return;dynCardFor=id;dynCardActs=r.result||[];}catch(e){dynCardActs=[]}finally{dynCardBusy=false}
  let box=card.querySelector('#dynTgt');if(!box){box=document.createElement('div');box.id='dynTgt';box.className='dynpanel';const head=card.querySelector('#cx')?.parentElement;if(head&&head.nextSibling)card.insertBefore(box,head.nextSibling);else card.prepend(box)}
  box.innerHTML=dynCardActs.length?`<div class="sec" style="margin:4px 0"><b class="muted">이 사람에게</b>${dynCardActs.map(a=>`<button class="act${a.ok&&a.k===dynActArm?' arm':''}" data-act="${dynEsc(a.k)}" ${a.ok?'':'disabled'}>${dynEsc(a.label)}<small>${dynEsc(a.ok?(a.k===dynActArm?'한 번 더 누르면 실행합니다':a.hint):a.why)}</small></button>`).join('')}<div class="err">${dynEsc(dynActErrText)}</div></div>`:'';
  dynBindActions(box)}
