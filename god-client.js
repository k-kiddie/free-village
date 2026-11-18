// 가문 모드 화면(/god). remote-client.js 뒤에 붙고, 원래 화면의 지도·카드·기존 탭을 재사용한다.
// 서버가 보내는 view.dyn(내 캐릭터 요약)만 읽는다. 시뮬레이션 계산은 하지 않는다.
let dynNoteT=0,dynView=null,dynTab='me',dynSend=null,dynApi=null,dynApiBase='',dynShownRes='',dynModalId=null;
const DYN_FULL_GROUPS=GROUPS.map(g=>[g[0],g[1].slice()]);
const dynEsc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const DYN_TABS=[['me','👤','인물'],['fam','🏠','가문'],['asset','💰','영지'],['dip','🌍','외교'],['plot','🗡️','음모'],['law','⚖️','정치'],['news','📰','소식'],['power','📊','통계']];
// 메뉴별 행동 묶음(서버 행동의 group). 목록에 없는 묶음은 인물 메뉴에 나온다.
const DYN_TAB_G={me:['건강','인맥','일자리'],fam:['가족','상속','자녀 교육','가문 목표'],asset:['가게·일꾼','집·땅','주식','회사','돈'],dip:['외교'],plot:['첩보','어두운 길','평판 싸움'],law:['정부 세우기','조직','선거','법 바꾸기','권력']};
const dynTabOfGroup=g=>/^법/.test(g)?'law':Object.keys(DYN_TAB_G).find(k=>DYN_TAB_G[k].includes(g))||'me';
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
  note.onclick=()=>{if(dynView?.pending.length)dynOpen(dynView.pending[0],true);else note.hidden=true};
  const top=document.createElement('button');top.className='dyntop';top.textContent='▲ 지도';top.hidden=true;top.onclick=()=>window.scrollTo({top:0,behavior:'smooth'});document.body.appendChild(top);
  addEventListener('scroll',()=>{top.hidden=scrollY<500},{passive:true});
  const tabs=document.createElement('nav');tabs.id='dynTabs';tabs.className='dyntabs';
  const panel=document.createElement('div');panel.id='dynPanel';panel.className='panel dynpanel';
  $('#tabsTop').before(tabs);$('#tabsTop').before(panel);
  tabs.innerHTML=DYN_TABS.filter(t=>t[0]!=='power').map(([k,i,l])=>`<button data-dt="${k}"><span class="ic">${i}</span><span class="lb">${l}</span><i class="cnt" hidden></i></button>`).join('');
  tabs.querySelectorAll('button').forEach(b=>b.onclick=()=>{dynTab=b.dataset.dt;if(dynTab==='dip'&&dynView?.world?.known)dynSetMap('world');$('#dynSheet')&&($('#dynSheet').scrollTop=0);try{localStorage.setItem('v-dyntab',dynTab)}catch(e){}dynRender();if(dynTab==='power'){buildNav();renderPanel()}});
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
  if(dynView.pending.length){const p=dynView.pending[0];if(dynModalId!==p.id)dynOpen(p)}
  else if(dynModalId!=null){dynModalId=null;$('#dynModal').hidden=true}
}
const dynAge=x=>x?`${x.age}세`:'';
const dynPerson=x=>x?`<span class="pp${x.alive?'':' dead'}" data-person="${x.id}">${dynEsc(x.name)}${x.noble?' · '+dynEsc(x.noble):''}</span>${x.alive?` (${x.age}세${x.sex?x.sex==='F'?'·여':'·남':''})`:` (${x.cause||'사망'})`}`:'-';
function dynRender(){
  const v=dynView;if(!v)return;const m=v.me;dynAppRender(v);
  $('header.top h1').textContent=v.house;
  $('#dynBar').innerHTML=m?`<span class="who" data-person="${m.id}">👤 ${dynEsc(m.name)}(${m.age})</span><small>${m.occ?OCC_L[m.occ]:'정해진 업종 없음'} · ${dynEsc(v.house)} ${v.gen}대</small>
    <span>💰 <b>${money(v.assets?.w||0)}</b></span><span>⭐ 평판 <b>${Math.round((m.rep??1)*100)}</b></span><span>🏅 ${v.rankName}</span>${v.over?'<span>⚰️ 가문 단절</span>':''}`:'';
  $('#dynBar').querySelectorAll('[data-person]').forEach(b=>b.onclick=()=>select(+b.dataset.person));
  const note=$('#dynNote');
  if(v.pending.length){note.hidden=false;note.className='dynnote wait';note.textContent=`🔔 ${v.pending[0].text.slice(0,40)}${v.pending[0].text.length>40?'…':''}${v.pending.length>1?` 외 ${v.pending.length-1}건`:''} · 눌러서 선택`}
  else if(v.res&&dynShownRes!==JSON.stringify(v.res)){note.hidden=false;note.className='dynnote res';note.textContent='📜 '+v.res.text+(v.res.changes?.length?' · '+v.res.changes.map(dynChangeLabel).join(' · '):'')+'  (눌러서 닫기)';dynShownRes=JSON.stringify(v.res);clearTimeout(dynNoteT);dynNoteT=setTimeout(()=>{if(note.className==='dynnote res')note.hidden=true},8000)}
  else if(!v.pending.length&&note.className==='dynnote wait')note.hidden=true;
  document.querySelectorAll('#dynTabs button').forEach(b=>b.classList.toggle('on',b.dataset.dt===dynTab));
  const power=dynTab==='power';['#tabsTop','#tabs','#panel'].forEach(q=>$(q).hidden=!power);$('#dynPanel').hidden=power;
  if(power)return;
  const P=$('#dynPanel');const ae=document.activeElement;if(ae&&P.contains(ae)&&ae.tagName==='SELECT')return;// 고르는 중에는 다시 그리지 않음
  const html=dynPanelHTML(v);if(P._html===html)return;P._html=html;P.innerHTML=html;
  P.querySelectorAll('[data-person]').forEach(b=>b.onclick=()=>select(+b.dataset.person));dynBindActions(P);dynBindBudget(P);
  P.querySelectorAll('[data-goto]').forEach(b=>b.onclick=()=>{dynTab=b.dataset.goto;dynRender();$('#dynSheet').scrollTop=0});
  P.querySelectorAll('[data-wback]').forEach(b=>b.onclick=()=>{dynWSel=null;dynRender();if(dynMapMode==='world')dynDrawWorld()});
  P.querySelectorAll('[data-realm]').forEach(b=>b.onclick=()=>{dynWSel=b.dataset.realm;dynSetMap('world');dynRender();$('#dynSheet').scrollTop=0});
}
function dynKV(rows){return `<div class="kv">${rows.filter(Boolean).map(([k,val])=>`<div><span>${k}</span><b>${val}</b></div>`).join('')}</div>`}
function dynPanelHTML(v){
  const m=v.me;if(!m)return '<p class="muted">캐릭터 정보가 없습니다.</p>';
  if(dynTab==='me')return `<div class="sec"><h4>${dynEsc(m.name)}</h4>${dynKV([['나이·성별',`${m.age}세 · ${m.sex==='F'?'여':'남'}`],['건강',Math.round(m.health)+'점'],['배고픔',Math.round(m.hunger)],
      m.happy!=null&&['행복',Math.round(m.happy*100)+'점'],['평판',Math.round((m.rep??1)*100)],['스트레스',(v.stress||0)+'/100'],v.clergy&&['교단 지위',dynEsc(v.clergy)],['학력',EDU_L[m.edu||0]],['업종',m.occ?OCC_L[m.occ]:'없음'],
      ['고용주',m.emp?dynPerson(m.emp):'없음'],m.staff&&['고용한 사람',m.staff+'명'],m.grp&&['소속',dynEsc(m.grp.name)+(m.grp.leader?' (우두머리)':'')],m.caught&&['전과',m.caught+'번'],m.jail&&['처지','수감 중']])}
      <button data-person="${m.id}">자세한 인물 카드</button></div>
      <div class="sec"><h4>초반 생계 · 일 고르기</h4><label class="bud">희망하는 일 <select data-bud="job"><option value="-1" ${v.budget.job==null||v.budget.job<0?'selected':''}>성향대로 자동 선택</option>${(v.jobs||[]).map(j=>`<option value="${j.k}" ${v.budget.job===j.k?'selected':''}>${dynEsc(j.n)}${j.wage?` · ${money(j.wage.min)}~${money(j.wage.max)}/일 예상`:''}</option>`).join('')}</select>
        <small>${(()=>{const j=(v.jobs||[]).find(x=>v.budget.job===x.k);return dynEsc(j?[j.h,j.days,j.wage?`예상 품삯 ${money(j.wage.min)}~${money(j.wage.max)}/일`:''].filter(Boolean).join(' · '):'기술과 조건에 맞는 합법 일감을 엔진이 고릅니다. 품팔이 임금은 마을 일당을 바탕으로 한 예상치입니다.')} )()} · 오늘: ${dynEsc(DYN_ACT_N[v.act]??'-')}</small></label></div>
      ${dynActionsHTML(v,'me')}${dynNetHTML(v)}`;
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
      ${a.stocks.length?`<div class="sec"><h4>주식</h4>${dynKV(a.stocks.map(s=>[dynEsc(s.name),`${s.shares.toLocaleString()}주 · ${(s.pct*100).toFixed(1)}% · ${money(s.v)}`]))}</div>`:''}
      ${v.bank?`<div class="sec"><h4>${dynEsc(v.bank.name)} 손익 장부</h4>${dynKV([['설립 자본·준비금',`${money(v.bank.capital)} · ${money(v.bank.reserve)}`],['대출 잔액·예금',`${money(v.bank.loans)} · ${money(v.bank.deposits)}`],['기업 대출 잔액',money(v.bank.corporateLoans)],['중앙은행 기준금리',`${(v.bank.baseRate*100).toFixed(2)}%/10일`],['내 은행 대출 기준',`${(v.bank.loanRate*100).toFixed(2)}%/10일`],['누적 대출 이자 수입',money(v.bank.interestIncome)],['누적 예금 이자 비용',money(v.bank.depositExpense)],['무담보 부실 원금',money(v.bank.badDebt)],['담보 압류 건수',v.bank.foreclosures+'건'],['누적 이자 손익',money(v.bank.net)]])}<small class="muted">대출 원금 회수는 수입이 아니라 자산 회수로 계산합니다. 아직 급여 등 별도 운영비는 없습니다.</small></div>`:''}${v.corpCredit?.length?`<div class="sec"><h4>기업 대출 계약</h4>${dynKV(v.corpCredit.map(l=>[`${dynEsc(l.firm)} · ${dynEsc(l.role)}`,`${money(l.balance)} · ${(l.rate*100).toFixed(2)}%/10일 · ${l.term}회 · ${dynEsc(l.status)} · ${l.collateral}`]))}</div>`:''}${dynProvHTML(v)}${dynActionsHTML(v,'asset')}${dynBudgetHTML(v)}`}
  if(dynTab==='dip')return dynDipHTML(v);
  if(dynTab==='plot')return `${v.spyCareer?`<div class="sec"><h4>정보기관 직원 · 현장 요원</h4><p class="muted">정보기관 직원으로 시작했습니다. 현장 임무로 경력을 쌓고, 정계에 진출한 뒤 정보기관장으로 임명되면 조직을 직접 운영할 수 있습니다.</p></div>`:''}${v.spyAgency?`<div class="sec"><h4>비밀 정보조직</h4><p class="muted">요원 ${v.spyAgency.size}명 · 평균 충성도 ${v.spyAgency.loyalty}% · 운영비 ${money(v.spyAgency.upkeep)}/일 · 발각 위험 ${Math.round(v.spyAgency.risk*100)}%/일</p>${v.spyAgency.reports.map(r=>`<p>${dynEsc(r.text)}</p>`).join('')}</div>`:''}<div class="sec"><h4>음모</h4><p class="muted">뒷조사·첩자·평판 싸움·어두운 길. 들킬 수 있고, 들키면 체제에 따라 스캔들이나 원한이 생깁니다.</p></div>${dynActionsHTML(v,'plot')||'<p class="muted">지금 할 수 있는 음모가 없습니다. 정치적 영향력이 커지면 첩보 임무가 열립니다.</p>'}`;
  if(dynTab==='law')return `<div class="sec"><h4>정치</h4>${dynKV([['체제',dynEsc(v.world?.us.regName||'-')],['통치자',v.world?.us.ruler?`${dynEsc(v.world.us.ruler.title)} ${dynEsc(v.world.us.ruler.name)}`:'없음'],['내 지위',v.rankName+(v.title?' · '+dynEsc(v.title):'')+(v.me.pardoned?' · 사면·복권':v.me.banned?' · 출마 제한':'')]])}</div>${v.ministry?`<div class="sec"><h4>담당 부처 · ${dynEsc(v.ministry.title)}</h4>${dynKV([['부처',dynEsc(v.ministry.name||'-')],['연간 예산',money(v.ministry.budget||0)],v.ministry.army&&['국가 군대',`군대 단계 ${v.ministry.army.level} · 병력 지수 ${Math.round(v.ministry.army.strength)} · 사기 ${Math.round(v.ministry.army.morale*100)}%`],['업무 능력',Math.round((v.ministry.score||0)*100)+'점']])}</div>`:''}${v.ministerLobby?`<div class="sec"><h4>장관직 로비</h4><p>${dynEsc(v.ministerLobby.title|| (v.ministerLobby.key==='def'?'국방부 장관':v.ministerLobby.key==='sec'?'국가정보원장':'장관'))}직을 요청했습니다 · ${Math.max(0,Math.ceil((v.ministerLobby.until-S.day)/YEAR))}년 유효</p></div>`:''}${v.privateMilitia?`<div class="sec"><h4>비밀 사병 ${v.privateMilitia.exposed?'· 발각됨':''}</h4>${dynKV([['대원',v.privateMilitia.size+'명'],['충성도',Math.round(v.privateMilitia.loyalty*100)+'%'],['운영비',money(v.privateMilitia.upkeep)+'/일'],['발각 위험',v.privateMilitia.risk?(v.privateMilitia.risk<.01?'1% 미만':Math.round(v.privateMilitia.risk*100)+'%'):'0%']])}</div>`:''}${dynActionsHTML(v,'law')||'<p class="muted">지금 할 수 있는 정치 행동이 없습니다.</p>'}`;
  if(dynTab==='net'){const f=v.family;return `<div class="sec"><h4>인맥</h4>${dynKV([['배우자',f.partner?dynPerson(f.partner):'없음'],['고용주',m.emp?dynPerson(m.emp):'없음'],['고용한 사람',(m.staff||0)+'명'],['소속 조직',m.grp?dynEsc(m.grp.name):'없음'],['신앙',m.faith?'있음':'없음']])}</div>
      <div class="sec"><h4>사돈·가문 관계</h4>${(v.ties||[]).length?dynKV(v.ties.map(t=>[dynEsc(t.name),`${t.v>0?'우호':t.v<0?'적대':'보통'} ${Math.round(t.v*100)} · ${dynEsc(t.why)}`])):'<p class="muted">아직 사돈을 맺은 집안이 없습니다. 혼인으로 다른 집안과 손을 잡을 수 있습니다.</p>'}</div>
      <p class="muted">친구·원수·동업자 관계는 다음 작업에서 보강합니다.</p>`}
  if(dynTab==='news')return `${v.res?`<div class="sec"><h4>최근 결과</h4><p>${dynEsc(v.res.text)}</p>${v.res.changes?.length?`<ul>${v.res.changes.map(change=>`<li>${dynEsc(dynChangeLabel(change))}</li>`).join('')}</ul>`:''}</div>`:''}${dynNewActsHTML()}<div class="sec"><h4>내 주변 소식</h4>${v.news.length?`<ul>${v.news.map(e=>`<li><small class="muted">${fmtD(e.d)}</small> ${dynEsc(e.text)}</li>`).join('')}</ul>`:'<p class="muted">아직 가족 주변에 별일이 없습니다.</p>'}</div>
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
function dynActionsHTML(v,tk){const eco=tk==='asset';const acts=(v.actions||[]).filter(a=>dynTabOfGroup(a.group)===tk);if(!acts.length)return '';const groups=[...new Set(acts.map(a=>a.group))];
  return `<div class="sec"><h4>${eco?'투자·거래':tk==='me'?'할 수 있는 일':'행동'}</h4>${tk!=='me'&&!eco?'':`<p class="muted">${eco?'값은 마을 시장 시세를 따릅니다. 사기나 대출 거절도 있을 수 있습니다.':'평소에는 성향대로 생활합니다. 아래 행동은 직접 고를 수 있습니다. 결과는 마을 사람들의 판단(투표·가담)에 달려 있습니다.'}</p>`}
    ${groups.map(g=>`<details class="actgrp" data-g="${dynEsc(g)}" ${dynOpenG.has(g)?'open':''}><summary>${dynEsc(g)}<small>${acts.filter(a=>a.ok).length}/${acts.length}개 가능</small></summary>${acts.filter(a=>a.group===g).map(a=>(a.bankSpec?`<div class="act multi"><b>${dynEsc(a.label)}</b><small>${dynEsc(a.hint)} · 이율은 열흘 기준</small><label>대출 금리<input data-bank-loan="${a.bankSpec.id}" type="number" min="0.5" max="20" step="0.1" value="${(a.bankSpec.loanRate*100).toFixed(1)}">%</label><label>신규 예금 금리<input data-bank-deposit="${a.bankSpec.id}" type="number" min="0" max="10" step="0.1" value="${(a.bankSpec.depositRate*100).toFixed(1)}">%</label><label>준비금 비율<input data-bank-reserve="${a.bankSpec.id}" type="number" min="5" max="100" step="1" value="${(a.bankSpec.reserveRatio*100).toFixed(0)}">%</label><button data-bank-submit="${a.bankSpec.id}">은행 운영 기준 저장</button></div>`:a.corpLoanSpec?`<div class="act multi"><b>${dynEsc(a.label)}</b><small>${dynEsc(a.hint)} · 기업 신용·담보 심사 후 제안</small><label>원금<input data-corp-amount="${a.corpLoanSpec.id}" type="number" min="${a.corpLoanSpec.min}" max="${a.corpLoanSpec.max}" step="${a.corpLoanSpec.step}" value="${Math.min(a.corpLoanSpec.max,a.corpLoanSpec.min*5)}"></label><label>열흘 이율<select data-corp-rate="${a.corpLoanSpec.id}">${a.corpLoanSpec.rates.map(r=>`<option value="${r}">${(r*100).toFixed(2)}%</option>`).join('')}</select></label><label>상환 기간<select data-corp-term="${a.corpLoanSpec.id}">${a.corpLoanSpec.terms.map(n=>`<option value="${n}">${n}회 · ${Math.round(n*10/30)}개월</option>`).join('')}</select></label><label>담보<select data-corp-coll="${a.corpLoanSpec.id}">${a.corpLoanSpec.coll.map(c=>`<option value="${dynEsc(c.k)}">${dynEsc(c.label)}</option>`).join('')}</select></label><button data-corp-submit="${a.corpLoanSpec.id}">기업에 조건 제안</button></div>`:a.loanSpec?`<div class="act multi"><b>${dynEsc(a.label)}</b><small>${dynEsc(a.hint)} · 원금 ${money(a.loanSpec.min)}~${money(a.loanSpec.max)}</small><label>원금<input data-loan-amount="${a.loanSpec.id}" type="number" min="${a.loanSpec.min}" max="${a.loanSpec.max}" step="${a.loanSpec.step}" value="${Math.min(a.loanSpec.max,a.loanSpec.min*5)}"></label><label>열흘 이율<select data-loan-rate="${a.loanSpec.id}">${a.loanSpec.rates.map(r=>`<option value="${r}">${(r*100).toFixed(1)}%</option>`).join('')}</select></label><label>담보<select data-loan-coll="${a.loanSpec.id}">${a.loanSpec.coll.map(c=>`<option value="${dynEsc(c.k)}">${dynEsc(c.label)}</option>`).join('')}</select></label><button data-loan-submit="${a.loanSpec.id}">이 조건으로 빌려주기</button></div>`:a.valueSpec?`<div class="act multi${a.ok?'':' off'}">${dynEsc(a.label)}<small>${dynEsc(a.ok?a.hint:a.why)} · 허용 ${a.valueSpec.min}~${a.valueSpec.max}${a.valueSpec.unit==='%'?'%':''}</small><span class="qty"><input data-law-value="${dynEsc(a.valueKey)}" type="number" min="${a.valueSpec.min*(a.valueSpec.unit==='%'?100:1)}" max="${a.valueSpec.max*(a.valueSpec.unit==='%'?100:1)}" step="${a.valueSpec.step*(a.valueSpec.unit==='%'?100:1)}" value="${a.valueNow*(a.valueSpec.unit==='%'?100:1)}" ${a.ok?'':'disabled'}><button data-law-submit="${dynEsc(a.valueKey)}" data-law-unit="${a.valueSpec.unit}" ${a.ok?'':'disabled'}>이 수치로 발의</button></span></div>`:a.opts?`<div class="act multi${a.ok?'':' off'}">${dynEsc(a.label)}<small>${dynEsc(a.ok?a.hint:a.why)}</small><span class="qty">${a.opts.map(([v,l])=>{const k=a.k+':'+v;return `<button data-act="${dynEsc(k)}" class="${k===dynActArm?'arm':''}" ${a.ok?'':'disabled'}>${dynEsc(k===dynActArm?l+' 확인':l)}</button>`}).join('')}</span></div>`
      :`<button class="act${a.ok&&a.k===dynActArm?' arm':''}" data-act="${dynEsc(a.k)}" ${a.ok?'':'disabled'}>${dynEsc(a.label)}<small>${dynEsc(a.ok?(a.k===dynActArm?'한 번 더 누르면 실행합니다':a.hint):a.why)}</small></button>`)).join('')}</details>`).join('')}
    <div class="err" id="dynActErr">${dynEsc(dynActErrText)}</div></div>`}
let dynActErrText='';
const dynOpenG=new Set((()=>{try{return JSON.parse(localStorage.getItem('v-dynopen')||'[]')}catch(e){return []}})());
let dynActArm=null;
let dynArmTimer=0;
function dynBindActions(P){
  P.querySelectorAll('details.actgrp').forEach(d=>d.ontoggle=()=>{const g=d.dataset.g;if(d.open)dynOpenG.add(g);else dynOpenG.delete(g);try{localStorage.setItem('v-dynopen',JSON.stringify([...dynOpenG]))}catch(e){}});
  P.querySelectorAll('[data-corp-submit]').forEach(b=>b.onclick=async()=>{const id=b.dataset.corpSubmit,amount=Number(P.querySelector(`[data-corp-amount="${id}"]`)?.value),rate=Number(P.querySelector(`[data-corp-rate="${id}"]`)?.value),term=Number(P.querySelector(`[data-corp-term="${id}"]`)?.value),coll=P.querySelector(`[data-corp-coll="${id}"]`)?.value;if(!Number.isFinite(amount)||!(amount>0)||!Number.isFinite(rate)||!Number.isFinite(term)){dynActErrText='기업 대출 조건을 확인해 주세요';dynRender();return}b.disabled=true;try{await dynApi(dynApiBase+'/api/cmd',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'act',k:`corp:offer:${id}:${amount}:${rate}:${term}:${coll}`})});dynActErrText='';await dynSend({action:'save'})}catch(e){dynActErrText=e.message;dynRender()}});
  P.querySelectorAll('[data-loan-submit]').forEach(b=>b.onclick=async()=>{const id=b.dataset.loanSubmit,amount=Number(P.querySelector(`[data-loan-amount="${id}"]`)?.value),rate=Number(P.querySelector(`[data-loan-rate="${id}"]`)?.value),coll=P.querySelector(`[data-loan-coll="${id}"]`)?.value;if(!Number.isFinite(amount)||!(amount>0)){dynActErrText='대출 원금을 입력해 주세요';dynRender();return}b.disabled=true;try{await dynApi(dynApiBase+'/api/cmd',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'act',k:`loan:lend:${id}:${amount}:${rate}:${coll}`})});dynActErrText='';await dynSend({action:'save'})}catch(e){dynActErrText=e.message;dynRender()}});
  P.querySelectorAll('[data-bank-submit]').forEach(b=>b.onclick=async()=>{const id=b.dataset.bankSubmit,loan=Number(P.querySelector(`[data-bank-loan="${id}"]`)?.value)/100,deposit=Number(P.querySelector(`[data-bank-deposit="${id}"]`)?.value)/100,reserve=Number(P.querySelector(`[data-bank-reserve="${id}"]`)?.value)/100;if(![loan,deposit,reserve].every(Number.isFinite)){dynActErrText='은행 운영 수치를 확인해 주세요';dynRender();return}b.disabled=true;try{await dynApi(dynApiBase+'/api/cmd',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'act',k:`bank:ops:${id}:${loan}:${deposit}:${reserve}`})});dynActErrText='';await dynSend({action:'save'})}catch(e){dynActErrText=e.message;dynRender()}});
  P.querySelectorAll('[data-law-submit]').forEach(b=>b.onclick=async()=>{const key=b.dataset.lawSubmit,input=P.querySelector(`[data-law-value="${key}"]`),raw=Number(input?.value),value=b.dataset.lawUnit==='%'?raw/100:raw;if(!Number.isFinite(value)){dynActErrText='정책 수치를 입력해 주세요';dynRender();return}b.disabled=true;try{await dynApi(dynApiBase+'/api/cmd',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'act',k:`lawval:${key}:${value}`})});dynActErrText='';await dynSend({action:'save'})}catch(e){dynActErrText=e.message;dynRender()}});
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
  box.innerHTML=`<div class="dynbox"><h3>${start?'가문 모드 시작':p.kind==='death'?(dynView&&dynView.over?'⚰️ 가문 단절':'⚰️ 가장의 죽음'):p.title?dynEsc(p.title):'🔔 선택'}</h3><p style="white-space:pre-line">${dynEsc(p.text)}</p>
    ${start&&m?`<label>성 <input id="dynSur" maxlength="2" value="${dynEsc(m.sur)}"></label><label>이름 <input id="dynGiven" maxlength="3" value="${dynEsc(m.given)}"></label>
      <label>시작 방식 <select id="dynStartMode"><option value="general">일반 시작 · 기존 인물과 가족·재산 유지</option><option value="custom">캐릭터 꾸미기 · 성격·기술을 직접 설정</option></select></label><div id="dynStartCustom" hidden>
      <label>성별 <select id="dynSex"><option value="M" ${m.sex==='M'?'selected':''}>남성</option><option value="F" ${m.sex==='F'?'selected':''}>여성</option></select></label>
      <label>나이 <input id="dynAge" type="number" min="18" max="45" value="${m.age}"></label>
      <label>가족 조건 <select id="dynFamilyStart"><option value="keep">조건 자유 · 선택 인물의 관계 유지</option><option value="single">미혼·자녀 없음</option><option value="partner">배우자 있음</option><option value="children">자녀 있음</option></select></label>
      <label>시작 재산 <select id="dynWealthStart"><option value="keep">조건 자유 · 선택 인물의 실제 재산</option><option value="poor">가난한 편 · 5일 품삯 이하</option><option value="modest">살림 안정 · 5~30일 품삯</option><option value="wealthy">넉넉한 편 · 30일 품삯 초과</option></select></label>
      <label>외모 <input id="dynLooks" type="number" min="0" max="100" value="${Math.round((m.looks??.5)*100)}"></label>
      <label>학력 <select id="dynEdu">${['없음','기본','사교육','고등','대학'].map((x,i)=>`<option value="${i}" ${i===(m.edu||0)?'selected':''}>${x}</option>`).join('')}</select></label>
      <label>출신 배경 <select id="dynBackground"><option>평범한 주민</option><option>농촌</option><option>장터</option><option>기술자 집안</option><option>유학 경험</option><option>이주민</option><option>정보기관 직원</option></select></label>
      <label>성격 · 야망 <input id="dynBoss" type="number" min="0" max="100" value="${Math.round((m.g?.boss??.2)*100)}"></label><label>성격 · 공익심 <input id="dynCivic" type="number" min="0" max="100" value="${Math.round((m.g?.civic??.3)*100)}"></label>
      <label>성격 · 배려 <input id="dynCare" type="number" min="0" max="100" value="${Math.round((m.g?.care??.65)*100)}"></label><label>성격 · 정직함 <input id="dynCheat" type="number" min="0" max="100" value="${Math.round((1-(m.g?.cheat??.2))*100)}"></label>
      <label>성격 · 사교성 <input id="dynJoin" type="number" min="0" max="100" value="${Math.round((m.g?.join??.35)*100)}"></label><label>성격 · 사치 <input id="dynLux" type="number" min="0" max="100" value="${Math.round((m.g?.lux??.35)*100)}"></label>
      <label>성격 · 낭만 <input id="dynRoma" type="number" min="0" max="100" value="${Math.round((m.g?.roma??.5)*100)}"></label><label>성격 · 신앙심 <input id="dynFaith" type="number" min="0" max="100" value="${Math.round((m.g?.faith??.35)*100)}"></label>
      <label>기술 · 농사 <input id="dynFarm" type="number" min="0" max="100" value="${Math.round((m.skill?.[0]??.1)*100)}"></label><label>기술 · 장인 <input id="dynCraft" type="number" min="0" max="100" value="${Math.round((m.skill?.[9]??.1)*100)}"></label>
      <label>기술 · 장사 <input id="dynTrade" type="number" min="0" max="100" value="${Math.round((m.skill?.[12]??.1)*100)}"></label>
      <p class="stopnote">가족·재산 조건에 맞는 기존 성인 주민을 시작 인물로 고릅니다. 재산은 실제 주민의 것을 사용해 돈을 새로 만들지 않습니다.</p></div>`:''}
    <div class="err" id="dynErr"></div>
    ${p.opts.map(o=>`<button class="opt" data-k="${dynEsc(o.k)}">${dynEsc(o.label)}${o.hint?`<small>예상 · ${dynEsc(o.hint)}</small>`:''}${o.stress?.points?`<small>${dynEsc(o.stress.reason)}에 어긋남 · 스트레스 +${o.stress.points}점</small>`:''}</button>`).join('')}
    ${start?'':'<button class="opt" data-later="1">나중에 고르기 (창 닫기)<small>지도·가문 정보를 먼저 볼 수 있습니다. 위의 알림을 누르면 다시 열립니다.</small></button>'}
    <div class="stopnote">⏸ 고를 때까지 시간이 멈춰 있습니다.</div></div>`;
  const later=box.querySelector('[data-later]');if(later)later.onclick=()=>{box.hidden=true};
  const startMode=box.querySelector('#dynStartMode'),custom=box.querySelector('#dynStartCustom');if(startMode)startMode.onchange=()=>{custom.hidden=startMode.value!=='custom'};
  box.querySelectorAll('.opt[data-k]').forEach(b=>b.onclick=async()=>{
    box.querySelectorAll('.opt').forEach(x=>x.disabled=true);
    try{
      if(start&&m&&startMode?.value==='custom'){const character={sur:$('#dynSur').value,given:$('#dynGiven').value,sex:$('#dynSex').value,age:+$('#dynAge').value,family:$('#dynFamilyStart').value,wealth:$('#dynWealthStart').value,looks:+$('#dynLooks').value,edu:+$('#dynEdu').value,background:$('#dynBackground').value,boss:+$('#dynBoss').value,civic:+$('#dynCivic').value,care:+$('#dynCare').value,cheat:100-(+$('#dynCheat').value),join:+$('#dynJoin').value,lux:+$('#dynLux').value,roma:+$('#dynRoma').value,faith:+$('#dynFaith').value,farm:+$('#dynFarm').value,craft:+$('#dynCraft').value,trade:+$('#dynTrade').value};await dynApi(dynApiBase+'/api/cmd',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'configureStart',character})})}
      else if(start&&m){const sur=$('#dynSur')?.value.trim(),given=$('#dynGiven')?.value.trim();if(sur&&given&&(sur!==m.sur||given!==m.given))await dynApi(dynApiBase+'/api/cmd',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'rename',sur,given})})}
      box.hidden=true;await dynSend({action:'choose',id:p.id,k:b.dataset.k});
    }catch(e){box.hidden=false;$('#dynErr').textContent=e.message;box.querySelectorAll('.opt').forEach(x=>x.disabled=false)}
  });
}
// ===== 2차 4단계: 세계 지도 =====
// 서버가 보내는 view.dyn.world(이웃 나라 요약)만 그린다. 우리 마을을 누르면 원래 상세 지도로 돌아간다.
let dynMapMode='town',dynWSel=null;
const DYN_WCOL={us:'#d8b04a',너른들:'#5f9a4a',쇠뫼:'#8a6a52',비단나루:'#6a64a8'};
const DYN_WALT=['#4a8a8a','#a0584f','#7a8a3a'];
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
  for(const r of W.realms)s.push({id:r.name,x:r.x,y:r.y,w:size(r.name)});return s}
function dynWHash(x,y,seed=0){let h=Math.imul((x^seed)*374761393+(y+seed)*668265263,1274126177);h^=h>>>13;h=Math.imul(h,1103515245);return((h^h>>>16)>>>0)/4294967296}
function dynWLand(x,y,seed){const oval=(cx,cy,rx,ry)=>1-Math.hypot((x-cx)/rx,(y-cy)/ry);const main=Math.max(oval(-.22,0,.79,.72),oval(.39,.20,.55,.43),oval(.04,-.51,.40,.39));const west=oval(-.99,-.47,.22,.18),south=oval(.92,.58,.23,.16);const broad=(dynWHash(Math.floor((x+2)*5),Math.floor((y+2)*5),seed)-.5)*.16,fine=(dynWHash(Math.floor((x+2)*13),Math.floor((y+2)*13),seed+73)-.5)*.055;return Math.max(main,west,south)+broad+fine>.015}
function dynWOwnerXY(x,y,seeds,known,seed){
  if(!dynWLand(x,y,seed))return 'sea';
  const n=(dynWHash(Math.floor((x+2)*14),Math.floor((y+2)*14),seed+151)-.5)*.08;
  let best=null,bd=9;for(const s of seeds){if(!known&&s.id!=='us')continue;const d=Math.hypot(x-s.x,y-s.y)/s.w+n;if(d<bd){bd=d;best=s.id}}
  if(!known&&bd>1)return 'fog';if(bd>1.45)return 'fog';return best}
const DYN_WAR=.68;const dynWXY=(fx,fy)=>[(fx-.5)*2.4,(fy-.5)*2.4*DYN_WAR];
function dynWOwner(fx,fy){const W=dynView?.world;if(!W)return null;const [x,y]=dynWXY(fx,fy);return dynWOwnerXY(x,y,dynWSeeds(),W.known,W.us.seed||0)}
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
    g.fillStyle=o==='sea'?((i+j)%7===0?'#22385a':'#1b2c44'):o==='fog'?'#2a2a30':col(o);
    g.fillRect(i*cell,j*cell,cell,cell);
    if(o!=='sea'&&o!=='fog'&&dynWSel===o){g.fillStyle='#ffffff44';g.fillRect(i*cell,j*cell,cell,cell)}}
  // 국경: 옆 칸 주인이 다르면 선. 전쟁 중인 우리-상대 국경은 붉게.
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const o=own[j][i];if(o==='sea'||o==='fog')continue;
    for(const [di,dj] of [[1,0],[0,1]]){const p=own[j+dj]?.[i+di];if(p==null||p===o)continue;
      const war=(o==='us'&&warN.has(p))||(p==='us'&&warN.has(o));const inner=(o==='us'&&provN.has(p))||(p==='us'&&provN.has(o));g.fillStyle=war?'#ff3b30':inner?'#00000044':p==='sea'?'#79bfe5':p==='fog'?'#00000088':'#000';
      if(di)g.fillRect((i+1)*cell-1,j*cell,2,cell);else g.fillRect(i*cell,(j+1)*cell-1,cell,2)}}
  const P=(x,y)=>[(x/2.4+.5)*cw,(y/(2.4*DYN_WAR)+.5)*ch];
  g.textAlign='center';g.textBaseline='middle';
  const label=(x,y,t1,t2,mark)=>{const [px,py]=P(x,y);g.font=`bold ${Math.round(cw/24)}px sans-serif`;g.lineWidth=3;g.strokeStyle='#000';g.fillStyle='#fff';
    g.strokeText(t1,px,py);g.fillText(t1,px,py);if(t2){g.font=`${Math.round(cw/34)}px sans-serif`;g.strokeText(t2,px,py+cw/22);g.fillStyle='#f3e6c4';g.fillText(t2,px,py+cw/22)}
    if(mark){g.font=`${Math.round(cw/20)}px sans-serif`;g.fillText(mark,px,py-cw/20)}};
  const us=W.us;label(0,0,'🏠 '+us.name,us.regName,null);
  const capital=(x,y,home)=>{const [px,py]=P(x,y);g.beginPath();g.arc(px,py,home?4:3,0,Math.PI*2);g.fillStyle=home?'#fff2a6':'#fff';g.fill();g.lineWidth=1.5;g.strokeStyle='#20252d';g.stroke()};capital(0,0,true);
  for(const r of W.realms)capital(r.x,r.y,false);
  for(const r of W.realms)label(r.x,r.y,r.name,`${r.regName} · ${r.title} ${r.ruler.name}`,r.war?'⚔️':r.prov?'🏴':r.ally?'🛡️':r.fta?'🤝':r.tension>=60?'⚠️':null);
  if(W.fw){const A=W.realms.find(r=>r.name===W.fw.a),B=W.realms.find(r=>r.name===W.fw.b);if(A&&B){const [ax,ay]=P(A.x,A.y),[bx,by]=P(B.x,B.y);g.font=`${Math.round(cw/18)}px sans-serif`;g.fillText('⚔️',(ax+bx)/2,(ay+by)/2)}}
  if(!W.known){const [px,py]=P(0,.55);g.font=`${Math.round(cw/28)}px sans-serif`;g.fillStyle='#ccc';g.fillText('바깥 세상은 아직 모릅니다. 이웃과 장사가 트이면 열립니다.',px,py)}
  dynWInfo(W)}
function dynWRel(r){return r.rel||(r.war?'전쟁 중':r.fta?'자유무역':r.tension>=60?'적대':r.tension>=35?'긴장':'보통')}
function dynWInfo(W){const el=$('#dynWInfo');if(!el)return;const h=dynWInfoHTML(W);if(el._h!==h){el._h=h;el.innerHTML=h;dynBindActions(el)}}
function dynWInfoHTML(W){let h='';const r=W.realms.find(x=>x.name===dynWSel);
  if(r){const rl=r.ruler;h=`<h4>${dynEsc(r.name)} <small>${dynEsc(r.tag)}</small></h4>${dynKV([['체제',dynEsc(r.regName)],[dynEsc(r.title),`${dynEsc(rl.name)} (${rl.age}세·${rl.sex==='F'?'여':'남'})`],
      ['통치 가문',`${dynEsc(r.house)} · ${r.since>0?fmtD(r.since)+'부터':'우리 마을이 생기기 전부터'}`],r.heir&&['후계자',`${dynEsc(r.heir.name)} (${r.heir.age}세·${r.heir.sex==='F'?'여':'남'})`],['인구',r.pop.toLocaleString()+'명'],
      ['군대',typeof r.mil==='number'?r.mil.toLocaleString():dynEsc(r.mil)],['기술',typeof POWER_L!=='undefined'?POWER_L[r.era]||r.era:r.era],r.prov?['속령',`${fmtD(r.prov.d)}부터 · 거둔 세금 ${money(r.prov.tax)} · 불만 ${r.prov.unrest}${r.prov.unrest>=55?' ⚠️ 독립 위험':''}`]:['우리와의 관계',`${dynWRel(r)} (긴장 ${r.tension})`],r.kin&&['사돈',`${dynEsc(r.kin.name)} ↔ ${dynEsc(r.kin.spouse)}`]])}
      ${rl.traits?`<p><small>성향(첩보): ${rl.traits.map(([k,v])=>`${k} ${v}`).join(' · ')}</small></p>`:'<p><small>통치자의 속내는 의원·귀족 이상이 되어야 알 수 있습니다.</small></p>'}
      ${dynWActs(r.name)}
      ${r.hist.length?`<b class="muted">최근 일</b><ul>${r.hist.map(e=>`<li><small>${fmtD(e.d)}</small> ${dynEsc(e.text.replace(r.name+': ',''))}</li>`).join('')}</ul>`:''}`}
  else{const us=W.us;h=`<h4>🏠 ${dynEsc(us.name)}</h4>${dynKV([['체제',dynEsc(us.regName)],us.ruler&&[dynEsc(us.ruler.title),`${dynEsc(us.ruler.name)} (${us.ruler.age}세)`],['인구',us.pop.toLocaleString()+'명'],['군대',us.mil.toLocaleString()]])}
    <p><small>${W.known?'다른 나라를 누르면 통치 가문과 관계가 보입니다. 우리 마을을 누르면 마을 지도로 돌아갑니다.':'이웃과 장사가 트이면 이웃 나라가 지도에 나타납니다.'}</small></p>`}
  if(W.news&&W.news.length)h+=`<b class="muted">세계 소식</b><ul>${W.news.slice(0,8).map(e=>`<li><small>${fmtD(e.d)}</small> ${dynEsc(e.text)}</li>`).join('')}</ul>`;
  return h}
// 선택한 나라에 대한 외교 행동(서버가 지위에 맞게 보낸 것만). 나 탭의 행동 목록과 같은 버튼·두 번 눌러 실행.
function dynWActs(name){const acts=(dynView?.actions||[]).filter(a=>a.group==='외교'&&a.k.split(':')[2]===name);
  if(!acts.length)return (dynView?.rank??0)<3?'<p><small>외교는 의원·귀족 이상이 되어야 할 수 있습니다(전쟁·동맹은 최고 권력자만).</small></p>':'';
  return `<div class="dynpanel"><b class="muted">외교</b>${acts.map(a=>`<button class="act${a.ok&&a.k===dynActArm?' arm':''}" data-act="${dynEsc(a.k)}" ${a.ok?'':'disabled'}>${dynEsc(a.label)}<small>${dynEsc(a.ok?(a.k===dynActArm?'한 번 더 누르면 실행합니다':a.hint):a.why)}</small></button>`).join('')}<div class="err">${dynEsc(dynActErrText)}</div></div>`}

// ===== 한 화면 앱 배치 (/god 전용) =====
// 페이지 스크롤 없이: 위 상태 줄 · 지도 · 사건 띠 · 메뉴 창(안에서만 스크롤) · 아래 메뉴. 원래 마을 화면(/)은 그대로.
function dynNetHTML(v){const f=v.family,m=v.me;return `<div class="sec"><h4>인맥</h4>${dynKV([['배우자',f.partner?dynPerson(f.partner):'없음'],['고용주',m.emp?dynPerson(m.emp):'없음'],['고용한 사람',(m.staff||0)+'명'],['소속 조직',m.grp?dynEsc(m.grp.name):'없음']])}</div>
  <div class="sec"><h4>사돈·가문 관계</h4>${(v.ties||[]).length?dynKV(v.ties.map(t=>[dynEsc(t.name),`${t.v>0?'우호':t.v<0?'적대':'보통'} ${Math.round(t.v*100)} · ${dynEsc(t.why)}`])):'<p class="muted">아직 사돈을 맺은 집안이 없습니다.</p>'}</div>`}
function dynProvHTML(v){const P=(v.world?.realms||[]).filter(r=>r.prov);if(!P.length)return '';return `<div class="sec"><h4>속령</h4>${dynKV(P.map(r=>[dynEsc(r.name),`인구 ${r.pop.toLocaleString()} · 세금 ${money(r.prov.tax)} · 불만 ${r.prov.unrest}${r.prov.unrest>=55?' ⚠️':''}`]))}</div>`}
function dynDipHTML(v){const W=v.world;if(W&&W.known&&dynWSel&&W.realms.some(r=>r.name===dynWSel))return `<div class="sec"><button class="act" data-wback="1">← 나라 목록</button></div><div class="dynwinfo">${dynWInfoHTML(W)}</div>`;if(!W||!W.known)return '<div class="sec"><h4>외교</h4><p class="muted">아직 이웃 나라를 모릅니다. 이웃과 장사가 트이면 세계 지도와 외교가 열립니다.</p></div>';
  return `<div class="sec"><h4>이웃 나라</h4><p class="muted">위 세계 지도에서 나라를 눌러도 됩니다.</p>${W.realms.map(r=>`<button class="act realm" data-realm="${dynEsc(r.name)}">${r.war?'⚔️':r.prov?'🏴':r.ally?'🛡️':r.fta?'🤝':''} ${dynEsc(r.name)} · ${dynEsc(r.regName)}<small>${dynEsc(r.title)} ${dynEsc(r.ruler.name)}(${r.ruler.age}) · 인구 ${r.pop.toLocaleString()} · ${dynEsc(dynWRel(r))}</small></button>`).join('')}</div>
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
  const app=document.createElement('div');app.id='dynApp';
  app.innerHTML=`<div class="dtop"><div class="who" id="dTopWho">불러오는 중…</div><span class="num" id="dTopNum"></span><button id="dPlay">▶</button><button id="dSpeed">×1</button><button id="dMenu">⚙</button></div>
    <div class="dstat" id="dStat"></div><div class="dmap" id="dMap"><div class="mapsw"><button data-mm2="town">🏘 마을</button><button data-mm2="world">🌍 세계</button></div><button class="bell" id="dBell" hidden>🔔</button><button class="msz" id="dMsz">지도 ▾</button></div>
    <div class="dstrip" id="dStrip">-</div><div id="dynSheet"></div>`;
  document.body.appendChild(app);
  const map=$('#dMap');map.appendChild($('.screen'));map.appendChild($('#dynWorld'));
  const sheet=$('#dynSheet');for(const q of ['#dynPanel','#tabsTop','#tabs','#panel'])sheet.appendChild($(q));
  app.appendChild($('#dynTabs'));
  map.querySelectorAll('[data-mm2]').forEach(b=>b.onclick=()=>dynSetMap(b.dataset.mm2));
  try{dynMapSize=+(localStorage.getItem('v-dynmsz')??1)}catch(e){}
  $('#dMsz').onclick=()=>{dynMapSize=(dynMapSize+1)%3;try{localStorage.setItem('v-dynmsz',dynMapSize)}catch(e){}dynFitMap()};
  new ResizeObserver(()=>dynFitMap()).observe(app);
  $('#dBell').onclick=$('#dStrip').onclick=()=>{if(dynView?.pending.length)dynOpen(dynView.pending[0],true);else{dynTab='news';dynRender()}};
  $('#dTopWho').onclick=()=>{if(dynView?.me)select(dynView.me.id)};
  $('#dPlay').onclick=()=>$('#play').click();
  const SP=[2,6,30];$('#dSpeed').onclick=async()=>{const i=(SP.indexOf(speed)+1)%SP.length;await dynSend({action:'speed',value:SP[i]});await dynSend({action:'play'})};
  $('#dMenu').onclick=()=>dynSettings();
  // 세계 지도 정보 카드는 메뉴 창(외교)으로 옮긴다
  const wi=$('#dynWInfo');if(wi){wi.classList.add('dynpanel');}
  addEventListener('resize',()=>{if(dynMapMode==='world')dynDrawWorld()});
  new MutationObserver(()=>{const c=$('#card');if(c.hidden){dynCardFor=null;return}if(!c.querySelector('#dynTgt')||dynCardFor!==sel)dynCardActions()}).observe($('#card'),{childList:true,attributes:true,attributeFilter:['hidden']});
}
function dynSettings(){const box=$('#dynModal');box.hidden=false;dynModalId='settings';
  box.innerHTML=`<div class="dynbox dynsetbox"><h3>⚙ 설정</h3><div class="row2"><button data-c="ff1">+1년 건너뛰기</button><button data-c="ff10">+10년 건너뛰기</button></div>
    <div class="row2"><button data-c="save">지금 저장</button><a class="modelink" href="/" style="flex:1;text-align:center;padding:8px">원래 마을로</a></div>
    <div class="row2"><button data-c="stats">📊 마을 통계 보기</button></div>
    <p class="muted" style="margin:6px 0 0;font-size:12.5px">이야기 사건 빈도 (지금까지 ${dynView?.story?.n||0}번)</p><div class="row2">${[[0,'끄기'],[1,'적게 (10~14일)'],[2,'보통 (5~7일)'],[3,'많이 (3~4일)']].map(([f,l])=>`<button data-sf="${f}" class="${(dynView?.story?.freq??2)===f?'on':''}">${l}</button>`).join('')}</div>
    <p class="muted" style="font-size:12.5px">${dynEsc($('#saveTxt')?.textContent||'')}</p><div class="row2"><button data-c="new" style="background:#5a1a1a">새 가문 마을 (지금 마을 지움)</button></div>
    <button class="opt" data-c="close">닫기</button></div>`;
  box.querySelectorAll('[data-sf]').forEach(b=>b.onclick=async()=>{try{await dynApi(dynApiBase+'/api/cmd',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'story',freq:+b.dataset.sf})});await dynSend({action:'save'})}catch(e){}box.hidden=true;dynModalId=null});
  box.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{const c=b.dataset.c;
    if(c==='ff1')$('#ff1').click();else if(c==='ff10')$('#ff10').click();else if(c==='save')$('#saveNow').click();
    else if(c==='stats'){dynTab='power';dynRender();buildNav();renderPanel()}else if(c==='new'){if(!b.dataset.arm){b.dataset.arm=1;b.textContent='정말 지울까요? 한 번 더 누르세요';return}$('#reset').click();$('#reset').click()}
    box.hidden=true;dynModalId=null})}
function dynAppRender(v){if(!$('#dynApp'))return;const m=v.me;dynTrackNew(v);
  $('#dTopWho').innerHTML=m?`<b>👤 ${dynEsc(m.name)}</b><small>${m.age}세 · ${dynEsc(v.title||v.rankName)}</small>`:`<b>${dynEsc(v.house)}</b>`;
  $('#dTopNum').textContent=m?'💰'+money(v.assets?.w||0):'';
  $('#dPlay').textContent=running?'⏸':'▶';$('#dSpeed').textContent=speed>=30?'×3':speed>=6?'×2':'×1';
  const W=v.world;$('#dStat').innerHTML=`<span>🏠 <b>${dynEsc(v.house)}</b> ${v.gen}대</span><span>⭐ 평판 <b>${Math.round((m?.rep??1)*100)}</b></span><span>🏅 <b>${dynEsc(v.rankName)}</b></span>${W?`<span>🏰 <b>${dynEsc(W.us.name)}</b> ${(W.us.effPop||W.us.pop).toLocaleString()}명</span><span>🏛️ ${dynEsc(W.us.regName)}</span>`:''}<span>📅 ${fmtD(S.day)}</span>`;
  const st=$('#dStrip'),bell=$('#dBell');
  if(v.pending.length){st.className='dstrip wait';st.textContent=`🔔 ${v.pending[0].title?v.pending[0].title+' · ':''}${v.pending[0].text.replace(/\n/g,' ')}${v.pending.length>1?` 외 ${v.pending.length-1}건`:''} · 눌러서 선택`;bell.hidden=false;bell.textContent='🔔 '+v.pending.length}
  else{bell.hidden=true;st.className='dstrip';const r=v.res&&S.day-v.res.d<30?v.res:null;const n=v.news[0];st.textContent=r?'📜 '+(r.changes?.length?r.changes.slice(0,3).map(dynChangeLabel).join(' · ')+' · ': '')+r.text:n?`📰 ${fmtD(n.d)} ${n.text}`:'📰 아직 주변에 별일이 없습니다'}
  document.querySelectorAll('#dMap [data-mm2]').forEach(b=>b.classList.toggle('on',b.dataset.mm2===dynMapMode));
  // 메뉴별 할 수 있는 행동 개수
  const cnt={};for(const a of v.actions||[])if(a.ok){const t=dynTabOfGroup(a.group);cnt[t]=(cnt[t]||0)+1}
  document.querySelectorAll('#dynTabs button').forEach(b=>{const i=b.querySelector('.cnt');const n=cnt[b.dataset.dt]||0;if(i){i.hidden=!n;i.textContent=n}});
}

// 지도 크기: 0 크게(전체) · 1 보통(가운데 60%) · 2 접기(띠만). 보통일 때는 지도 가운데를 잘라 보여 준다(누르는 위치는 그대로 맞음).
let dynMapSize=1;
function dynFitMap(){const box=$('#dMap');if(!box)return;const inner=dynMapMode==='world'?$('#dynWorld'):$('.screen');const full=(inner&&inner.offsetHeight)||Math.round(box.clientWidth*.68);
  const h=dynMapSize===0?full:dynMapSize===1?Math.round(full*.6):34;box.style.height=h+'px';
  const off=dynMapSize===1?Math.round((full-h)/2):0;for(const el of [$('.screen'),$('#dynWorld')])if(el)el.style.top=-off+'px';const zu=$('.screen .zoomui');if(zu)zu.style.marginTop=off+'px';
  const b=$('#dMsz');if(b)b.textContent=dynMapSize===0?'지도 작게 ▴':dynMapSize===1?'지도 접기 ▴':'지도 펴기 ▾';
  box.querySelectorAll('.mapsw,.zoomui').forEach(e=>e.style.display=dynMapSize===2?'none':'')}

// 새로 할 수 있게 된 일: 처음으로 가능해진 행동을 소식 맨 위에 모아 보여 준다(기다림이 풀린 것은 빼고)
let dynEver=null,dynNewActs=[];
try{dynEver=new Set(JSON.parse(localStorage.getItem('v-dynever')||'[]'));dynNewActs=JSON.parse(localStorage.getItem('v-dynnew')||'[]')}catch(e){dynEver=new Set()}
function dynTrackNew(v){const base=k=>k.split(':').slice(0,2).join(':');let ch=false;const first=dynEver.size===0;
  for(const a of v.actions||[]){if(!a.ok)continue;const b=base(a.k);if(dynEver.has(b))continue;dynEver.add(b);ch=true;if(!first)dynNewActs.unshift({d:S.day,label:a.label,group:a.group,tab:dynTabOfGroup(a.group)})}
  if(ch){dynNewActs=dynNewActs.slice(0,12);try{localStorage.setItem('v-dynever',JSON.stringify([...dynEver]));localStorage.setItem('v-dynnew',JSON.stringify(dynNewActs))}catch(e){}}}
function dynNewActsHTML(){if(!dynNewActs.length)return '';const TL=Object.fromEntries(DYN_TABS.map(t=>[t[0],t[1]+' '+t[2]]));
  return `<div class="sec"><h4>✨ 새로 할 수 있게 된 일</h4>${dynNewActs.map(n=>`<button class="act" data-goto="${n.tab}">${dynEsc(n.label)}<small>${fmtD(n.d)} · ${dynEsc(TL[n.tab]||'')} 메뉴 · ${dynEsc(n.group)}</small></button>`).join('')}</div>`}
// 인물 카드에 "이 사람에게" 행동 버튼을 붙인다(서버가 대상·지위에 맞게 고른 것만)
let dynCardFor=null,dynCardActs=null,dynCardBusy=false;
async function dynCardActions(force){const card=$('#card');if(!card||card.hidden||sel==null)return;if(card.querySelector('#dynTgt')&&!force&&dynCardFor===sel)return;
  if(dynCardBusy)return;dynCardBusy=true;const id=sel;
  try{const r=await dynApi(dynApiBase+'/api/cmd',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'targets',id})});if(sel!==id)return;dynCardFor=id;dynCardActs=r.result||[];}catch(e){dynCardActs=[]}finally{dynCardBusy=false}
  let box=card.querySelector('#dynTgt');if(!box){box=document.createElement('div');box.id='dynTgt';box.className='dynpanel';const head=card.querySelector('#cx')?.parentElement;if(head&&head.nextSibling)card.insertBefore(box,head.nextSibling);else card.prepend(box)}
  box.innerHTML=dynCardActs.length?`<div class="sec" style="margin:4px 0"><b class="muted">이 사람에게</b>${dynCardActs.map(a=>`<button class="act${a.ok&&a.k===dynActArm?' arm':''}" data-act="${dynEsc(a.k)}" ${a.ok?'':'disabled'}>${dynEsc(a.label)}<small>${dynEsc(a.ok?(a.k===dynActArm?'한 번 더 누르면 실행합니다':a.hint):a.why)}</small></button>`).join('')}<div class="err">${dynEsc(dynActErrText)}</div></div>`:'';
  dynBindActions(box)}
