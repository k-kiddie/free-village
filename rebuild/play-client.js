'use strict';
(() => {
  const $ = selector => document.querySelector(selector), esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const readStore = (key, fallback) => { try { return JSON.parse(localStorage.getItem('fv4:' + key)) ?? fallback; } catch { return fallback; } };
  const store = (key, value) => { try { localStorage.setItem('fv4:' + key, JSON.stringify(value)); } catch {} };
  const client = readStore('client', null) || 'phone-' + crypto.randomUUID(); store('client', client);
  const api = '/rebuild/api';
  let mapRequest=0;
  let V, M, selected = null, tab = 'map', camera = null, layer = 'all', refs = [], targetData = null, busy = false, loadId = 0, drawItems = [], catalog = null, prepared = null, actionChoices = [], clustered = [];
  const money = n => Number.isFinite(n) ? (n / (V?.currencyUnit || 1)).toLocaleString('ko-KR', {maximumFractionDigits:1}) + '냥' : '미확인';
  const note = text => { $('#status').textContent = text; $('#status').style.display = 'block'; clearTimeout(note.timer); note.timer = setTimeout(() => $('#status').style.display = 'none', 4000); };
  async function call(path, body) {
    const response = await fetch(api + path, body === undefined ? {} : {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const value = await response.json(); if (!response.ok) throw Error(value.error || '연결을 확인해 주세요'); return value;
  }
  const same = data => data && V && data.worldId === V.worldId && data.revision === V.revision;
  const accountName = id => id.startsWith('family:') ? '가문 금고' : id.startsWith('government:') ? '공공 예산' : id.startsWith('firm:') ? '회사 자금' : id.startsWith('person:' + V.me.ref.id + ':') ? '내 자금' : '거래 상대 계정';
  const goods = {grain:'곡식',meal:'밥',wood:'목재',tool:'도구',stone:'돌',gold:'금',iron:'쇠',jewel:'보석',fiber:'삼',plank:'판재',brick:'벽돌',cloth:'옷',furn:'가구',liquor:'술'};
  const jobName = n => ({0:'농사',1:'요리',2:'벌목·채집',3:'건축',4:'품팔이',5:'도둑질',6:'휴식',7:'짝찾기',8:'치안',9:'제조',10:'채석',11:'가르치기',12:'장사',100:'사업 경영',[-1]:'주민 판단'})[n] || '선택한 일';
  const jobPlan = b => [b.job,b.job2,b.job3].map(jobName).join(' → ');
  function resultHTML(r) {
    return `${r.result?.job !== undefined ? '<p>하루 일: '+esc(jobPlan(r.result))+'</p>' : ''}<p>${esc(r.result?.text || (r.duration?.advancedDays ? '하루를 마쳤습니다.' : '지침을 반영했습니다.'))}</p>${(r.ledger || []).map(x => `<div class="kv"><span>${esc(accountName(x.id))}</span><b>${x.amount > 0 ? '+' : ''}${money(x.amount)}</b></div>`).join('')}${r.duration?.cooldowns?.length ? `<p class="muted">다음 실행: ${r.duration.cooldowns.map(x => x.remainingDays + '일 뒤').join(' · ')}</p>` : ''}`;
  }
  function renderBase() {
    $('#hud').innerHTML = `<div><span>마을의 시간</span><b>${V.day + 1}일 <small class="season">${esc(V.season)}</small></b></div><div><span>내 자금</span><b>${money(V.me.cash)}</b></div><div><span>주민</span><b>${V.population.toLocaleString()}명</b></div>`;
    $('#identity').innerHTML = `<div class="avatar">${esc(V.me.name.slice(0,1))}</div><h3>${esc(V.me.name)}</h3><p class="muted">${Math.floor(V.me.age)}세 · ${esc(V.me.job || '주민')}</p><button class="small" data-do="me">내 위치 보기</button>`;
    $('#connection').textContent = V.savedRevision === V.revision ? '저장됨 · 연결됨' : '연결됨';
    const pending = readStore('pending', null);
    $('#banner').innerHTML = pending ? `<div class="error">이전 요청의 처리 결과를 확인해야 합니다. 중복 실행 없이 이어서 확인합니다. <button data-do="retry">결과 다시 확인</button></div>` : V.pending.length ? `<div class="notice"><strong>결정할 일이 ${V.pending.length}건 있습니다.</strong> 선택 전까지 시간은 멈춥니다. <button data-do="decision">내용 보기</button></div>` : '';
    document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  }
  async function refresh(full = true) {
    const next = await call('/view');
    const changed = !V || next.worldId !== V.worldId || next.revision !== V.revision;
    if (V && V.worldId !== next.worldId) { selected = null; refs = []; camera = null; M = null; }
    if(!V) refs=readStore('compare:'+next.worldId,[]);
    V = next; renderBase();
    if (full || changed) await render();
  }
  function heading(title, subtitle, buttons = '') { return `<div class="heading"><div><p class="eyebrow">YOUR VILLAGE, YOUR STORY</p><h2>${title}</h2><p class="muted">${subtitle}</p></div><div class="row">${buttons}</div></div>`; }
  async function render() {
    const generation = ++loadId;
    if (tab === 'map') {
      $('#main').innerHTML = heading('마을을 읽다', '장소와 사람을 선택해 기회와 관계를 살펴보세요.', '<button data-do="advance">하루 진행 →</button>') + `<div class="map-layout"><section><div class="map-card"><div class="map-toolbar"><div class="tabs" aria-label="지도 표시"><button class="small ${layer === 'all' ? 'active' : ''}" data-layer="all">전체</button><button class="small ${layer === 'person' ? 'active' : ''}" data-layer="person">주민</button><button class="small ${layer === 'assets' ? 'active' : ''}" data-layer="assets">건물·농지</button></div><div class="row"><button class="small" data-do="zoom-in" aria-label="지도 확대">＋</button><button class="small" data-do="zoom-out" aria-label="지도 축소">−</button><button class="small" data-do="reset-map">전체 보기</button></div></div><canvas id="map" tabindex="0" aria-label="마을 지도. 드래그와 방향키로 이동, 확대 버튼으로 확대, 아래 목록으로 대상 선택"></canvas><div class="map-footer"><span><i class="dot"></i>초록: 내 자산 · 주황: 내 인물</span><span id="map-count">실제 공간을 불러오는 중</span></div></div><div class="compare-bar"><button data-do="compare">비교함 (${refs.length}/3)</button><button data-do="me">내 위치</button><button data-do="nearby">이 화면의 대상 목록</button><button data-do="people">주민 찾기</button></div></section><section id="target" class="card target" aria-live="polite"></section></div>`;
      if (!M || M.revision !== V.revision) { const data = await call('/map'); if (generation !== loadId || !same(data)) return; M = data; }
      if (!camera) camera = readStore('camera:' + V.worldId, null) || {x:0,y:0,w:M.width,h:M.height};
      attachMap(); draw();
      if (selected) await select(selected, false, false); else $('#target').innerHTML = `<p class="eyebrow">EXPLORE</p><h2>여기서 시작하세요</h2><p>집, 농지, 건물, 주민을 누르면 현재 상태와 연결된 행동이 나타납니다.</p><p class="muted">같은 장소에 모인 주민은 목록에서 고를 수 있습니다.</p><button data-do="me">내 인물 살펴보기</button>`;
    } else if (tab === 'life') {
      const food = (V.me.goods?.grain || 0) + (V.me.goods?.meal || 0) * 1.5;
      $('#main').innerHTML = heading('오늘의 생활과 일', '일 지침을 비교하고, 하루를 보낸 뒤 실제 수입과 상태를 확인하세요.', '<button data-do="advance">하루 진행 →</button>') + `<div class="grid"><div class="card"><p class="muted">식량 보유 · 곡물 환산</p><b class="stat">${food.toFixed(1)}</b><p class="muted">곡식 ${V.me.goods?.grain?.toFixed(1) || 0} · 식사 ${V.me.goods?.meal?.toFixed(1) || 0}</p></div><div class="card"><p class="muted">건강 / 배고픔</p><b class="stat">${Math.round(V.me.health)} / ${Math.round(V.me.hunger)}</b><p class="muted">배고픔은 낮을수록 좋습니다.</p></div></div><section class="card job" style="margin-top:14px"><h3>하루 일 지침</h3><p class="muted">현재 1순위: ${['농사','요리','벌목','건축','품팔이','도둑질','휴식','짝찾기','치안','제조','채석','가르치기','장사'][V.budget.job] || '자율 선택'}. 실제로 가능한 일인지 매일 다시 판단합니다.</p><div class="row toolbar"><button data-job="work">품팔이 중심</button><button data-job="trade">장사 중심</button><button data-job="auto">주민 판단에 맡기기</button></div>${V.today ? `<p>최근 하루: ${esc(V.today.kind==='duty'?'공무':jobName(V.today.did))} · ${esc(V.today.why || '실제 가능한 일을 수행했습니다.')}</p>` : ''}<p class="help">지침 변경만으로 임금이나 물건이 생기지 않습니다. 하루 진행 후 결과를 확인하세요.</p></section><section class="card"><h3>가문 금고</h3><p>보관 중 ${money(V.vault)} · 내 현금과 분리해서 보관합니다.</p><div class="row toolbar"><button data-do="vault-in">현금 절반 보관</button><button data-do="vault-out">금고 절반 꺼내기</button></div></section><h3>실제 일감과 생활 기회</h3><div id="opportunities" class="action-list"></div>`;
      await opportunities('life', generation);
    } else if (tab === 'business') {
      $('#main').innerHTML = heading('작게 시작하는 사업', '내 공간과 자금을 확인하고 실제 비용을 비교하세요.') + `<div class="card"><div class="business-path"><span>생활·자금</span>→<span>건물 마련</span>→<span>회사 설립</span></div><p class="muted">회사는 내 건물이 있어야 세울 수 있습니다. 자금이 부족하면 생계를 유지하거나 차입 조건을 비교하세요.</p><div class="row toolbar"><button data-go="life">생활·일로 돌아가기</button><button data-do="me">내 자산 위치 보기</button><button data-do="compare">비교함 (${refs.length}/3)</button></div>${V.firms.map(f => `<button data-select="firm:${f.ref.id}">${esc(f.name)} · ${money(f.cash)}</button>`).join('')}${V.projects.length ? '<p>진행 중인 공사 ' + V.projects.length + '건 · ' + V.projects.map(p => Math.round(p.progress/p.need*100)+'%').join(' · ') + ' · 하루씩 진행하며 완공을 확인하세요.</p>' : ''}</div><label>기회 찾기 <input id="action-search" type="search" placeholder="공방, 가게, 회사, 대출…"></label><div id="opportunities" class="action-list"></div>`;
      await opportunities('business', generation);
    } else {
      $('#main').innerHTML = heading('결정이 남긴 변화', '처리 결과와 실제 계정 변화를 다시 확인하세요.', '<button data-do="save">지금 저장</button>') + (V.activity.length ? V.activity.map(r => `<article class="card activity"><small>${r.day}일 · ${esc(r.commandId?.split(':')[0] === client ? '내 결정' : '처리 기록')}</small>${resultHTML(r)}</article>`).join('') : '<div class="empty">아직 처리한 행동이 없습니다.</div>') + V.news.map(n => `<article class="card"><p>${esc(n.text)}</p></article>`).join('');
    }
  }
  async function opportunities(kind, generation) {
    const data = await call('/catalog'); if (generation !== loadId || !same(data)) return;
    catalog = data;
    const rows = data.actions.filter(a => kind === 'life' ? a.group === '일자리' || /^gig:/.test(a.k) : /^(biz:build:|firm:new|loan:take:|dep:|stock:|house:|land:)/.test(a.k));
    actionChoices = rows;
    function fill(query = '') { $('#opportunities').innerHTML = rows.map((a,i) => ({a,i})).filter(({a}) => (a.label + a.hint).includes(query)).map(({a,i}) => `<button class="action" data-action-index="${i}"><strong>${esc(a.label)}</strong><span>${esc(a.hint)}</span>${a.preliminaryReason ? `<span class="warning">${esc(a.preliminaryReason)}</span>` : ''}<span>조건과 비용 확인</span></button>`).join('') || '<div class="empty">지금은 해당하는 모집·기회가 없습니다. 하루가 지나면 상황이 바뀔 수 있습니다.</div>'; }
    fill(); if ($('#action-search')) $('#action-search').oninput = e => fill(e.target.value);
  }
  function show(html) { $('#dialog').innerHTML = `<button class="close" data-do="close" aria-label="닫기">×</button>${html}`; if (!$('#dialog').open) $('#dialog').showModal(); }
  async function select(ref, move = true, reveal = true) {
    selected = ref;
    if (tab !== 'map') { tab = 'map'; await render(); return; }
    const data = await call(`/detail?kind=${encodeURIComponent(ref.kind)}&id=${ref.id}`);
    if (!same(data) || selected?.id !== ref.id || selected?.kind !== ref.kind || !$('#target')) return;
    targetData = data;
    if (move && data.position) { camera.x = data.position.x - camera.w/2; camera.y = data.position.y - camera.h/2; draw(); }
    $('#target').innerHTML = `<p class="eyebrow">${ref.kind === 'person' ? 'RESIDENT' : 'PLACE'}</p><h2>${esc(data.name)}</h2><dl class="kv">${ref.kind === 'person' ? `<dt>현재 상태</dt><dd>${data.known ? esc(data.job) : '아직 잘 모르는 인물'}</dd><dt>현금</dt><dd>${money(data.cash)}</dd>${data.known && data.alive ? `<dt>건강 / 배고픔</dt><dd>${Math.round(data.health)} / ${Math.round(data.hunger)}</dd>` : ''}` : `<dt>소유자</dt><dd>${esc(data.owner?.name || '공공·주인 없음')}</dd><dt>입주자</dt><dd>${esc(data.occupant?.name || '없음')}</dd><dt>상태</dt><dd>${Number.isFinite(data.condition) ? Math.round(data.condition*100) + '%' : '—'}</dd><dt>매매가</dt><dd>${data.sale ? money(data.sale) : '매물 아님'}</dd><dt>임대료 / 보증금</dt><dd>${money(data.rent || 0)} / ${money(data.deposit || 0)}</dd>`}</dl><div class="row"><button data-do="add-compare">비교함에 담기</button><button data-do="map-focus">지도 보기</button><button data-do="business">사업 기회</button></div>${(data.related || []).map(r => `<button data-select="person:${r.id}">${esc(r.name)} 살펴보기 →</button>`).join('')}${Number.isFinite(data.progress) ? `<p>공사 진행 ${data.progress.toFixed(1)} / ${data.need}</p>` : ''}<div id="target-actions" class="action-list"></div>`;
    {
      const actions = await call(ref.kind === 'person' ? '/catalog?target=' + ref.id : '/catalog'); if (!same(actions) || selected?.id !== ref.id || selected?.kind !== ref.kind || !$('#target-actions')) return;
      actionChoices = actions.actions.filter(a => ref.kind === 'person' ? a.k.startsWith('tgt:') : ref.kind === 'house' ? a.k.startsWith('house:') && a.k.split(':')[2] === String(ref.id) : ref.kind === 'plot' ? a.k.startsWith('land:') && a.k.split(':')[2] === String(ref.id) : ref.kind === 'building' && data.owner?.id === V.me.ref.id ? a.k === 'firm:new' : false);
      $('#target-actions').innerHTML = actionChoices.map((a,i) => `<button class="action" data-action-index="${i}"><strong>${esc(a.label)}</strong><span>${esc(a.hint)}</span><span>${esc(a.preliminaryReason || '조건과 비용 확인')}</span></button>`).join('');
    }
    draw();
    if(reveal && innerWidth<=720) $('#target').scrollIntoView({block:'nearest',behavior:'instant'});
  }
  async function compare() {
    const data = await Promise.all(refs.map(r => call(`/detail?kind=${r.kind}&id=${r.id}`)));
    if (data.some(x => !same(x))) { await refresh(); note('상황이 바뀌어 비교 자료를 새로 확인합니다.'); return; }
    show(`<h2 id="dialogTitle">대상 비교</h2><p class="muted">같은 시점의 정보입니다. 미확인 정보는 추정하지 않습니다.</p>${data.length ? `<div class="scroll"><table><thead><tr><th>항목</th>${data.map(x => `<th>${esc(x.name)}</th>`).join('')}</tr></thead><tbody>${[['현금',x=>money(x.cash)],['매매가',x=>x.sale?money(x.sale):'매물 아님'],['임대료',x=>money(x.rent)],['보증금',x=>money(x.deposit)],['소유자',x=>x.owner?.name || '—'],['건강',x=>x.health ?? '—']].map(([label,fn]) => `<tr><th>${label}</th>${data.map(x=>`<td>${esc(fn(x))}</td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="row toolbar">${data.map(x => `<button data-select="${x.ref.kind}:${x.ref.id}" data-return="1">${esc(x.name)}로 돌아가기</button>`).join('')}</div><button data-do="clear-compare">비교함 비우기</button>` : '<p>지도에서 대상을 선택해 최대 3개까지 담아 보세요.</p>'}`);
  }
  function request(action, args) { const n = readStore('sequence:' + V.worldId, 0) + 1; return { worldId:V.worldId,commandId:client+':'+n,expectedRevision:V.revision,actor:V.me.ref,action,args }; }
  async function preview(action, args, title, immediate = false) {
    if (readStore('pending',null)) { note('이전 요청의 결과부터 확인해 주세요.'); return; }
    busy = true;
    try {
      const command = request(action,args), p = await call('/preview',command);
      if (p.alreadyExecuted) { await refresh(); return; }
      prepared = p.allowed ? {...command,previewToken:p.previewToken} : null;
      if (immediate && prepared) return await execute(prepared);
      show(`<h2 id="dialogTitle">${esc(title)}</h2>${p.allowed ? `<p>${action === 'budget' ? esc(jobPlan(args.budget)) + '</p><p class="muted">고용주·밑천·토지 조건이 맞아야 실행됩니다. 다음 순위도 못 하면 주민의 판단을 따릅니다.</p><p>' : ''}${esc(p.quote?.hint || p.quote?.label || (action === 'budget' ? '다음 하루부터 이 지침으로 생활합니다.' : '현재 조건에서 실행할 수 있습니다.'))}</p>${p.uncertainty ? '<div class="notice">결과가 달라질 수 있습니다. 아래 설명은 확정 수익이나 성공을 보장하지 않습니다.</div>' : (p.accounts || []).map(x=>`<div class="kv"><span>${esc(accountName(x.id))}</span><b>${money(x.before)} → ${money(x.after)}</b></div>`).join('')}${(p.inventory || []).map(x=>`<p class="muted">보유 물량 변화 · ${esc(goods[x.good] || x.good)} ${x.amount>0?'+':''}${x.amount.toFixed(1)}</p>`).join('')}<p class="muted">날짜 진행: ${p.duration.advancedDays}일${p.duration.cooldowns.length ? ' · 다시 실행까지 '+p.duration.cooldowns.map(x=>x.remainingDays+'일').join(', ') : ''}</p><div class="actions"><button data-do="close">돌아가기</button><button class="primary" data-do="execute">이 조건으로 실행</button></div>` : `<div class="error">${p.reasons.map(r=>esc(r.message)).join('<br>')}</div><p class="muted">이 요청으로 돈·물건·시간은 바뀌지 않았습니다. 조건을 마련하거나 다른 방법을 비교해 보세요.</p><div class="actions"><button data-do="close">돌아가기</button></div>`}`);
    } finally { busy = false; }
  }
  async function execute(command) {
    store('pending',command); busy = true;
    try {
      const r = await call('/execute',command);
      store('pending',null);
      if (!r.allowed) { await refresh(); show(`<h2 id="dialogTitle">조건을 다시 확인해 주세요</h2><p class="error">${r.reasons.map(x=>esc(x.message)).join('<br>')}</p><button data-do="close">돌아가기</button>`); return; }
      store('sequence:' + command.worldId,Number(command.commandId.split(':').at(-1)));
      prepared = null; await refresh();
      if (command.action === 'advance') { $('#dialog').close(); note('하루를 마쳤습니다. 생활과 활동에서 변화를 확인하세요.'); }
      else show(`<h2 id="dialogTitle">결정이 반영되었습니다</h2>${resultHTML(r)}<div class="actions"><button data-do="close">이전 화면으로</button><button data-go="activity">활동에서 다시 보기</button></div>`);
    } catch (e) { renderBase(); show(`<h2 id="dialogTitle">처리 결과를 확인하지 못했습니다</h2><p>${esc(e.message)}</p><p class="muted">같은 요청 번호로 결과를 다시 확인합니다. 돈이나 행동이 두 번 집행되지 않습니다.</p><button data-do="retry">다시 확인</button>`); }
    finally { busy = false; }
  }
  function chooseAction(a) {
    if (a.opts?.length) { show(`<h2 id="dialogTitle">${esc(a.label)}</h2><p>${esc(a.hint)}</p><div class="cluster">${a.opts.map((o,i)=>`<button data-option="${i}">${esc(o[1])}</button>`).join('')}</div>`); chooseAction.current=a; }
    else if (a.companyNameSpec) { show(`<h2 id="dialogTitle">회사 설립</h2><p>${esc(a.hint)}</p><label>회사 이름 (선택) <input id="company-name" maxlength="20"></label><div class="actions"><button data-do="company-preview">조건과 비용 확인</button></div>`); }
    else preview('act',{key:a.k},a.label).catch(e=>note(e.message));
  }
  async function people(page = 0, query = '') {
    const data=await call('/people?'+new URLSearchParams({page,q:query})); if(!same(data))return;
    show(`<h2 id="dialogTitle">주민 찾기</h2><div class="row toolbar"><input id="people-query" aria-label="주민 이름" placeholder="이름으로 찾기" value="${esc(query)}"><button data-do="people-search">찾기</button></div><p class="muted">${data.total}명 · ${page+1}페이지</p><div class="cluster">${data.people.map(a=>`<button data-select="person:${a.ref.id}">${esc(a.name)}</button>`).join('')}</div><div class="row toolbar">${page>0?`<button data-people-page="${page-1}">이전</button>`:''}${(page+1)*40<data.total?`<button data-people-page="${page+1}">다음</button>`:''}</div>`);
  }
  function draw() {
    const c = $('#map'); if (!c || !M || !camera) return;
    camera.w=Math.max(25,Math.min(M.width,camera.w));camera.h=Math.max(20,Math.min(M.height,camera.h));
    camera.x=Math.max(-5,Math.min(M.width-camera.w+5,camera.x));camera.y=Math.max(-5,Math.min(M.height-camera.h+5,camera.y));
    store('camera:'+V.worldId,camera);
    const ratio=devicePixelRatio||1; c.width=c.clientWidth*ratio; c.height=c.clientHeight*ratio;
    const ctx=c.getContext('2d'); ctx.scale(ratio,ratio); const sx=c.clientWidth/camera.w,sy=c.clientHeight/camera.h;
    const px=x=>(x-camera.x)*sx, py=y=>(y-camera.y)*sy;
    ctx.fillStyle='#e3ead7';ctx.fillRect(0,0,c.clientWidth,c.clientHeight);
    const colors={g:'#d6e0bd',f:'#96b38c',r:'#c7c6b4',w:'#9ac8ca',m:'#a6afa0'};
    for(const t of M.terrain){ctx.fillStyle=colors[t.type]||colors.g;ctx.fillRect(px(t.x),py(t.y),11*sx,10*sy);ctx.strokeStyle='#ffffff25';ctx.strokeRect(px(t.x),py(t.y),11*sx,10*sy);}
    ctx.strokeStyle=M.paved>2000?'#b5b4a5':'#c7b48e';ctx.lineWidth=Math.max(2,2*sx);for(const path of M.roads){ctx.beginPath();path.forEach((p,i)=>i?ctx.lineTo(px(p.x),py(p.y)):ctx.moveTo(px(p.x),py(p.y)));ctx.stroke();}
    ctx.fillStyle='#dbb77b';ctx.fillRect(px(M.market.x),py(M.market.y),M.market.w*sx,M.market.h*sy);ctx.fillStyle='#72512c';ctx.font='12px system-ui';ctx.fillText('장터',px(M.market.x+8),py(M.market.y+18));
    drawItems=[];
    if(layer!=='person')for(const e of M.entities){ctx.fillStyle=e.mine?'#275a40':e.ref.kind==='plot'?'#c2a978':e.ref.kind==='house'?'#e9dfc5':'#987e61';ctx.strokeStyle=e.mine?'#163e29':'#8e8f78';const size=e.ref.kind==='plot'?8:5;ctx.fillRect(px(e.x)-size,py(e.y)-size,size*2,size*2);ctx.strokeRect(px(e.x)-size,py(e.y)-size,size*2,size*2);drawItems.push(e);}
    if(layer!=='assets')for(const e of M.residents){ctx.beginPath();ctx.fillStyle=e.mine?'#d07e32':'#37584c';ctx.arc(px(e.x),py(e.y),e.mine?6:2.5,0,Math.PI*2);ctx.fill();if(e.mine){ctx.strokeStyle='white';ctx.lineWidth=2;ctx.stroke();}drawItems.push(e);}
    const sel=drawItems.find(e=>e.ref.kind===selected?.kind&&e.ref.id===selected.id);if(sel){ctx.strokeStyle='#cf6f2f';ctx.lineWidth=2;ctx.strokeRect(px(sel.x)-10,py(sel.y)-10,20,20);}
    $('#map-count').textContent=`표시 주민 ${M.residents.length} / ${M.residentCount}${M.residentsLimited?' · 확대 후 주변 주민 보기':''}`;
  }
  function attachMap() {
    const c=$('#map'); let drag=null;
    c.onpointerdown=e=>{drag={x:e.offsetX,y:e.offsetY,camera:{...camera},moved:false};c.setPointerCapture(e.pointerId);};
    c.onpointermove=e=>{if(!drag)return;const dx=e.offsetX-drag.x,dy=e.offsetY-drag.y;if(Math.hypot(dx,dy)>5)drag.moved=true;if(drag.moved){camera.x=drag.camera.x-dx/c.clientWidth*camera.w;camera.y=drag.camera.y-dy/c.clientHeight*camera.h;draw();}};
    c.onpointercancel=()=>{drag=null;};
    c.onpointerup=async e=>{if(!drag||tab!=='map'||c!==$('#map'))return;const moved=drag.moved;drag=null;if(moved){await loadViewport();return;}const points=drawItems.filter(p=>Math.hypot((p.x-camera.x)/camera.w*c.clientWidth-e.offsetX,(p.y-camera.y)/camera.h*c.clientHeight-e.offsetY)<13);if(points.length===1)await select(points[0].ref,false);else if(points.length>1)cluster(points);else{const tile=M.terrain.find(t=>(e.offsetX/c.clientWidth*camera.w+camera.x)>=t.x&&(e.offsetX/c.clientWidth*camera.w+camera.x)<=t.x+11&&(e.offsetY/c.clientHeight*camera.h+camera.y)>=t.y&&(e.offsetY/c.clientHeight*camera.h+camera.y)<=t.y+10);if(tile)await select({kind:'lot',id:tile.id},false);}};
    c.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();camera.x+=(e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0)*camera.w*.1;camera.y+=(e.key==='ArrowDown'?1:e.key==='ArrowUp'?-1:0)*camera.h*.1;draw();loadViewport().catch(x=>note(x.message));};
  }
  async function loadViewport(){if(!camera)return;const request=++mapRequest;draw();const data=await call('/map?'+new URLSearchParams(camera));if(request===mapRequest&&same(data)){M=data;draw();}}
  function cluster(points, page=0){clustered=points;show(`<h2 id="dialogTitle">이곳의 사람과 장소</h2><p class="muted">${points.length}개 대상 · ${page+1}페이지. 같은 위치의 대상은 이름으로 선택하세요.</p><div class="cluster">${points.slice(page*40,page*40+40).map(e=>`<button data-select="${e.ref.kind}:${e.ref.id}">${esc(e.name)}</button>`).join('')}</div><div class="row toolbar">${page>0?`<button data-cluster-page="${page-1}">이전</button>`:''}${(page+1)*40<points.length?`<button data-cluster-page="${page+1}">다음</button>`:''}</div>`);}
  document.addEventListener('click',async e=>{
    const b=e.target.closest('button');if(!b||busy)return;
    try{
      if(b.dataset.clusterPage){cluster(clustered,Number(b.dataset.clusterPage));return;}
      if(b.dataset.peoplePage){await people(Number(b.dataset.peoplePage),$('#people-query').value);return;}
      if(b.dataset.tab||b.dataset.go){tab=b.dataset.tab||b.dataset.go;$('#dialog').close();window.scrollTo(0,0);renderBase();await render();return;}
      if(b.dataset.layer){layer=b.dataset.layer;await render();return;}
      if(b.dataset.select){$('#dialog').close();const[k,id]=b.dataset.select.split(':');await select({kind:k,id:Number(id)},!b.dataset.return);return;}
      if(b.dataset.actionIndex){chooseAction(actionChoices[Number(b.dataset.actionIndex)]);return;}
      if(b.dataset.option){const a=chooseAction.current;await preview('act',{key:a.k+':'+a.opts[Number(b.dataset.option)][0]},a.label);return;}
      if(b.dataset.job){const job={work:[4,2,-1],trade:[12,0,-1],auto:[-1,-1,-1]}[b.dataset.job];await preview('budget',{budget:{job:job[0],job2:job[1],job3:job[2]}},'하루 일 지침 비교');return;}
      if(b.dataset.choice){const p=V.pending.find(p=>p.id===Number(b.dataset.decision));await preview('choose',{id:p.id,key:b.dataset.choice},'결정 전 확인');return;}
      switch(b.dataset.do){
        case 'close':$('#dialog').close();break;
        case 'decision':{const p=V.pending[0];if(!p)return;show(`<h2 id="dialogTitle">${esc(p.title)}</h2><p>${esc(p.text)}</p><div class="cluster">${p.opts.map(o=>`<button data-decision="${p.id}" data-choice="${esc(o.k)}">${esc(o.label)}${o.hint?'<span class="muted"> · '+esc(o.hint)+'</span>':''}</button>`).join('')}</div>`);break;}
        case 'vault-in':await preview('vault',{dir:'in',frac:.5},'현금 절반을 금고에 보관');break;
        case 'vault-out':await preview('vault',{dir:'out',frac:.5},'금고 절반을 꺼내기');break;
        case 'advance':await preview('advance',{},'하루 진행',true);break;
        case 'execute':if(prepared)await execute(prepared);break;
        case 'retry':{const pending=readStore('pending',null);if(pending)await execute(pending);break;}
        case 'save':await call('/cmd',{action:'save'});note('마을을 저장했습니다.');break;
        case 'map-focus':$('#map')?.scrollIntoView({block:'start'});break;
        case 'me':tab='map';await render();await select(V.me.ref);break;
        case 'business':tab='business';renderBase();await render();break;
        case 'company-preview':await preview('act',{key:'firm:new:'+encodeURIComponent($('#company-name').value)},'회사 설립');break;
        case 'add-compare':if(selected&&!refs.some(r=>r.kind===selected.kind&&r.id===selected.id)){if(refs.length>=3){note('비교함에는 3개까지 담을 수 있습니다.');break;}refs.push({...selected});store('compare:'+V.worldId,refs);}note('비교함에 담았습니다.');if(tab==='map')await render();break;
        case 'compare':await compare();break;
        case 'clear-compare':refs=[];store('compare:'+V.worldId,refs);await compare();break;
        case 'people':await people();break;
        case 'people-search':await people(0,$('#people-query').value);break;
        case 'nearby':cluster(drawItems.filter(p=>p.x>=camera.x&&p.x<=camera.x+camera.w&&p.y>=camera.y&&p.y<=camera.y+camera.h));break;
        case 'zoom-in':case 'zoom-out':{const scale=b.dataset.do==='zoom-in'?.65:1.5;camera.x+=camera.w*(1-scale)/2;camera.y+=camera.h*(1-scale)/2;camera.w*=scale;camera.h*=scale;await loadViewport();break;}
        case 'reset-map':camera=null;M=null;await render();break;
      }
    }catch(error){note(error.message);}
  });
  addEventListener('resize',draw);
  const sessionId=crypto.randomUUID();
  const heartbeat=active=>fetch(api+'/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:sessionId,active}),keepalive:true}).catch(()=>{});
  document.addEventListener('visibilitychange',()=>heartbeat(!document.hidden));addEventListener('pagehide',()=>heartbeat(false));
  async function boot(){try{await refresh();refs=readStore('compare:'+V.worldId,[]);heartbeat(true);}catch(e){$('#main').innerHTML=`<div class="card"><h2>마을을 준비하고 있습니다</h2><p class="muted">${esc(e.message)}</p></div>`;setTimeout(boot,2000);}}
  setInterval(()=>{if(!document.hidden&&!busy&&!$('#dialog').open)refresh(false).catch(e=>$('#connection').textContent=e.message);heartbeat(!document.hidden);},15000);
  boot();
})();
