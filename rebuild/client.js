"use strict";
(() => {
  const $ = (s) => document.querySelector(s);
  const makeId = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const money = (n) => Math.round(n || 0).toLocaleString("ko-KR") + "원";
  const percent = (n) => Math.round(n * 100) + "%";
  const API = location.pathname.startsWith("/editor") ? "/editor" : "/play";
  let V = null,
    tab = "village",
    selected = 3,
    layer = "food",
    busy = false,
    etag = "",
    eventId = null,
    profile = null,
    peopleFilter = "all",
    peoplePage = 0,
    toastTimer;
  let peopleData = null;
  let importRaw = null;
  async function loadPeople() {
    try {
      const r = await fetch(
        API + "/api/people?page=" + peoplePage + "&filter=" + peopleFilter,
      );
      if (!r.ok) return;
      peopleData = await r.json();
      render();
    } catch {
      toast("인물 목록을 불러오지 못했습니다.");
    }
  }
  const positions = {};
  let lastTab = tab;
  const ACTION_TIME = {
    open: 1,
    fund: 1,
    policy: 1,
    supplier: 1,
    source: 1,
    destination: 1,
    hire: 1,
    wage: 1,
    delegate: 1,
    expand: 1,
    close: 1,
    acquire: 1,
    partner: 1,
    fire: 1,
    work: 2,
    visit: 2,
    organize: 1,
    campaign: 1,
    road: 1,
    school: 1,
    housing: 1,
    transport: 1,
    tax: 1,
    educate: 1,
    succession: 1,
    home: 1,
    loan: 1,
    repay: 1,
    party: 1,
    recruit: 1,
    debate: 2,
    rally: 2,
    coalition: 1,
    appoint: 1,
    bill: 1,
    reform: 1,
    oversight: 2,
    talk: 1,
    marry: 1,
    child: 1,
    adopt: 1,
    heir: 1,
    will: 1,
  };
  function button(text, action, data = {}, primary = false, disabled = "") {
    return `<button ${primary ? 'class="primary"' : ""} data-action="${esc(action)}" ${Object.entries(
      data,
    )
      .map(([k, v]) => `data-${k}="${esc(v)}"`)
      .join(
        " ",
      )} ${disabled ? 'disabled aria-disabled="true"' : ""} ${disabled ? `title="${esc(disabled)}"` : ""}>${esc(text)}${ACTION_TIME[action] && !text.includes("시간") ? `<small>시간 ${ACTION_TIME[action]}칸</small>` : ""}${disabled ? `<small>${esc(disabled)}</small>` : ""}</button>`;
  }
  const openButton = (text, kind, data = {}) =>
    `<button data-dialog="${kind}" ${Object.entries(data)
      .map(([k, v]) => `data-${k}="${esc(v)}"`)
      .join(" ")}>${esc(text)}</button>`;
  const select = (id, values, current) =>
    `<select id="${id}" aria-label="${id}">${values.map(([key, name]) => `<option value="${esc(key)}" ${String(key) === String(current) ? "selected" : ""}>${esc(name)}</option>`).join("")}</select>`;
  const hint = (text) => `<p class="muted">${esc(text)}</p>`;
  const card = (title, body) =>
    `<section class="card"><h2>${esc(title)}</h2>${body}</section>`;
  const stats = (values) =>
    `<div class="stats">${values.map(([label, value]) => `<div class="stat">${esc(label)}<b>${esc(value)}</b></div>`).join("")}</div>`;
  function toast(text) {
    $("#toast").textContent = text;
    $("#toast").style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ($("#toast").style.display = "none"), 5000);
  }
  async function poll() {
    try {
      const r = await fetch(API + "/api/view", {
        headers: etag ? { "If-None-Match": etag } : {},
      });
      if (r.status === 304) return;
      if (!r.ok) {
        const e = await r.json();
        if (!V)
          $("#app").innerHTML = `<h1>마을 준비 중</h1><p>${esc(e.error)}</p>`;
        return;
      }
      etag = r.headers.get("etag");
      V = await r.json();
      render();
    } catch {
      toast("연결을 다시 확인하고 있습니다. 마지막 저장은 서버에 유지됩니다.");
    }
  }
  async function send(c) {
    if (busy) return;
    busy = true;
    document
      .querySelectorAll("[data-action]")
      .forEach((b) => (b.disabled = true));
    try {
      const r = await fetch(API + "/api/cmd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(c),
      });
      const result = await r.json();
      if (!r.ok || result.error) throw Error(result.error || "요청 실패");
      etag = "";
      peopleData = null;
      await poll();
      if (tab === "people") await loadPeople();
      if (c.action === "save") toast("서버 저장을 완료했습니다.");
      if ($("#sheet").open) {
        $("#sheet").close();
        profile = null;
      }
    } catch (e) {
      toast(e.message);
    } finally {
      busy = false;
      if (profile && $("#sheet").open) show(profile.kind, profile.data);
      eventId = null;
      render();
    }
  }
  function map() {
    const label = (d) =>
      layer === "food"
        ? percent(d.food)
        : layer === "jobs"
          ? percent(d.jobs)
          : layer === "housing"
            ? percent(d.housing)
            : layer === "prices"
              ? money(d.prices.food)
              : layer === "road"
                ? d.road + "단계"
                : Math.round(d.support) + "%";
    return `<section class="map-area"><div class="map-tools"><span class="muted">장소를 골라 시작하세요</span>${select(
      "layer",
      [
        ["food", "식량"],
        ["jobs", "일자리"],
        ["housing", "주거"],
        ["prices", "물가"],
        ["road", "운송"],
        ["support", "여론"],
      ],
      layer,
    )}</div><svg class="world-map" viewBox="0 0 420 250" role="img" aria-label="마을의 장소와 운송 경로"><defs><pattern id="fields" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M0 16L16 0" stroke="#c1d1a3" stroke-width="1"/></pattern></defs><rect width="420" height="250" rx="16" fill="#e3ead1"/><rect width="170" height="250" fill="url(#fields)"/><path d="M355 -10 Q300 75 365 130 T370 270" fill="none" stroke="#9dc8cf" stroke-width="45"/>
      ${V.routes.map((r) => `<path d="M210 ${40 + r.from * 80}L210 ${40 + r.to * 80}" stroke="${r.level ? "#c0ae85" : "#cbbfa4"}" stroke-width="${3 + r.level * 2}" stroke-dasharray="${r.level ? "" : "5 4"}"/>`).join("")}
      ${V.districts
        .map(
          (d) =>
            `<g><text x="12" y="${20 + d.id * 80}" fill="#36533c" font-size="12">${esc(d.name)} · ${esc(label(d))}</text>${V.sites
              .filter((s) => s.district === d.id)
              .map((s) => {
                const f = V.firms.find((f) => f.id === s.owner),
                  p = V.plans.find(
                    (p) =>
                      p.type === "open" &&
                      p.target === s.id &&
                      p.status === "active",
                  );
                return `<g data-site="${s.id}" tabindex="0" role="button" aria-label="${esc(s.name)} ${f ? V.goods[f.good] : "빈 점포"}" aria-pressed="${s.id === selected}" class="map-site"><rect x="${34 + Math.floor(s.id / 3) * 112}" y="${20 + d.id * 80}" width="100" height="73" fill="transparent"/><rect x="${42 + Math.floor(s.id / 3) * 112}" y="${28 + d.id * 80}" width="84" height="43" rx="8" fill="${f?.owner === "player" ? "#c8dfbf" : f ? "#f1e4c9" : "#fffdf3"}" stroke="${s.id === selected ? "#28634a" : "#b6c3a7"}" stroke-width="${s.id === selected ? 3 : 1}"/><text x="${84 + Math.floor(s.id / 3) * 112}" y="${46 + d.id * 80}" text-anchor="middle" font-size="18" fill="#234232">${f ? esc(V.goods[f.good]) : p ? "개업 준비" : "빈 점포"}</text><text x="${84 + Math.floor(s.id / 3) * 112}" y="${61 + d.id * 80}" text-anchor="middle" font-size="14" fill="#566953">${f ? (f.owner === "player" ? "내 사업" : f.owner === "public" ? "공공 사업" : "경쟁 상회") : money(s.rent) + "/일"}</text></g>`;
              })
              .join("")}</g>`,
        )
        .join("")}
      ${V.shipments
        .filter((s) => s.status === "transit")
        .slice(0, 12)
        .map(
          (s, i) =>
            `<circle cx="${195 + (i % 3) * 10}" cy="${40 + Math.max(0, s.to) * 80 - (i % 4) * 6}" r="3" fill="#b78435"><title>${s.quantity.toFixed(1)}개 · ${s.arrives}일 도착</title></circle>`,
        )
        .join("")}</svg></section>`;
  }
  function panel() {
    const s = V.sites.find((s) => s.id === selected),
      d = V.districts.find((d) => d.id === s.district),
      f = V.firms.find((f) => f.id === s.owner),
      p = V.plans.find(
        (p) => p.type === "open" && p.target === s.id && p.status === "active",
      );
    let body = `<div class="panel-title"><div><span class="eyebrow">${esc(d.name)} · ${layer === "support" ? "생활과 신뢰" : "선택한 장소"}</span><h2>${esc(s.name)}</h2></div>${openButton("지역 살펴보기", "district", { district: d.id })}</div>`;
    if (!f && !p) {
      body +=
        stats([
          ["식량 부족", Math.round(d.needs.food) + "개"],
          ["주거 충족", percent(d.housing)],
          ["임대료", money(s.rent) + "/일"],
        ]) +
        `<div class="setup-grid"><label>상품${select("good", Object.entries(V.goods), "food")}</label><label>방침${select(
          "policy",
          Object.entries(V.policies).map(([k, r]) => [k, r.name]),
          "volume",
        )}</label></div>${hint(`개업 3일 · 개인 ${money(s.setup + 60)} (운영자금 60원 포함) · 시간 1칸. 입지 수요와 공급·운송이 손익을 바꿉니다.`)}<div class="actions">${button("이곳에서 사업 시작", "open", { site: s.id }, true)}${openButton("매입 조건", "land", { site: s.id })}</div>`;
    }
    if (p)
      body += `<p>${esc(p.title)}</p><div class="progress"><span style="width:${(p.progress / p.duration) * 100}%"></span></div>${hint(`${p.progress}/${p.duration}일 · 예약 예산 ${money(p.cash)} · ${p.reason || "준비 중"}`)}<div class="actions">${button(p.paused ? "계속" : "일시정지", "plan", { id: p.id })}${button("취소·잔액 반환", "plan", { id: p.id, value: "cancel" })}</div>`;
    if (f) {
      body +=
        stats([
          ["오늘 손익", money(f.profit)],
          ["사업 자금", money(f.cash)],
          ["재고", Math.floor(f.stock) + "개"],
        ]) +
        hint(
          `${V.goods[f.good]} · ${V.policies[f.policy].name} · 직원 ${f.workers.length}/${f.level * 3}명 · 임금 ${money(f.wage)}. ${f.manager ? "담당자 운영" : "직접 운영"} · 원료 ${(f.materials || 0).toFixed(1)}개.`,
        ) +
        `<div class="actions">${f.owner === "player" || (f.owner === "public" && V.player.office) ? openButton("고용·운영", "firm", { firm: f.id }) : openButton("경쟁자 정보", "competitor", { firm: f.id })}${openButton("공급·물류", "logistics", { firm: f.id })}</div>`;
    }
    return `<section class="target-panel card">${body}</section>`;
  }
  function activity() {
    const P = V.player,
      active = V.plans.filter((p) => p.status === "active"),
      issues = V.events.length + active.filter((p) => p.reason).length;
    return `<div class="activity-grid"><section>${card(
      "현재 목표",
      `<label>${select(
        "goal",
        [
          ["사업 기반 만들기", "사업 기반 만들기"],
          ["지역 선거 도전", "지역 선거 도전"],
          ["가문 이어가기", "가문 이어가기"],
        ],
        V.goal,
      )}</label>${hint(`개입 필요 ${issues}건 · ${V.achievements.map((a) => a.label).join(" · ") || "지도에서 수요·주거·고용 문제를 찾아 목표를 진행하세요."}`)}`,
    )}${active.map((p) => card(p.title, `<div class="progress"><span style="width:${(p.progress / p.duration) * 100}%"></span></div>${hint(`${p.progress}/${p.duration}일 · ${p.payer === "public" ? "국고" : "개인"} 예약 잔액 ${money(p.cash)} · ${p.paused ? "일시정지" : p.reason || "진행 중"}`)}${p.risk ? hint(p.risk) : ""}<div class="actions">${button(p.paused ? "계속" : "멈춤", "plan", { id: p.id })}${button(p.priority === 2 ? "우선순위 낮춤" : "우선 처리", "plan", { id: p.id, value: "priority" })}${button("취소·잔액 반환", "plan", { id: p.id, value: "cancel" })}${openButton("담당자 배치", "plan", { id: p.id })}</div>`)).join("") || card("진행 계획", hint("진행 중인 계획이 없습니다. 사업·조직·공공사업·가문 교육을 시작할 수 있습니다."))}</section><section>${card("정치와 공공 운영", `<p>${esc(V.regimes[V.government.regime])} · ${esc(V.economies[V.government.economy])}</p>${hint(`${P.office ? "집행 권한 있음" : "주민·야당 활동 가능"} · 다음 선거 ${V.election}일 · 국고 ${money(V.treasury)}`)}<div class="actions">${openButton("선거·정당·연대", "politics")}${openButton("의회·제도·인사", "government")}</div>`)}${card(`${P.generation}대 가문`, hint(`후계자 ${V.family.members.find((m) => m.id === V.family.heir)?.name || "미지정"} · 세대 명성 ${V.family.legacy} · 자녀 ${V.family.members.filter((m) => m.kind === "child" && m.alive).length}명`) + `<div class="actions">${openButton("가족·교육·상속", "family")}${openButton("생계·주거·재기", "life")}</div>`)}${card(
      "거래와 약속",
      V.promises
        .slice(-4)
        .reverse()
        .map(
          (p) =>
            `<p>${esc(p.kind === "exclusive" ? "후원·독점 약속" : p.kind === "coalition" ? "정당 연대" : `${p.delivered?.toFixed(0) || 0}/${p.quantity}개 납품`)} <span class="pill">${esc({ active: "이행 중", kept: "이행", broken: "불이행", settled: "합의", expired: "종료" }[p.status] || p.status)}</span><br><small>${p.due}일 기한</small></p>`,
        )
        .join("") || hint("거래·후원·연대의 약속과 결과가 여기에 남습니다."),
    )}${card("기록과 저장", `<div class="actions">${openButton("마을 기록", "notes")}${openButton("저장 관리", "storage")}${V.editor ? openButton("세계 편집", "editor") : ""}</div>`)}</section></div>`;
  }
  function people() {
    let list = V.people.filter(
      (p) =>
        peopleFilter === "all" ||
        (peopleFilter === "staff" &&
          V.firms.some((f) => f.owner === "player" && f.id === p.job)) ||
        (peopleFilter === "contacts" && p.relation > 0) ||
        (peopleFilter === "free" && !p.job && !p.position),
    );
    const pages = peopleData?.pages || Math.max(1, Math.ceil(list.length / 8));
    peoplePage = Math.min(peoplePage, pages - 1);
    return `<div class="toolbar">${select(
      "people-filter",
      [
        ["all", "모든 사람"],
        ["staff", "내 직원"],
        ["contacts", "인맥"],
        ["free", "구직·영입 가능"],
      ],
      peopleFilter,
    )}<span class="muted">${V.population}명 중 ${peopleData?.total ?? list.length}명 · ${peoplePage + 1}/${pages}쪽</span></div><div class="two">${(peopleData?.people || list.slice(peoplePage * 8, peoplePage * 8 + 8)).map((p) => `<button class="card person" data-dialog="person" data-person="${p.id}"><span class="avatar">${esc(p.name[0])}</span><span><b>${esc(p.name)}</b><small>${esc(V.districts[p.district].name)} · ${esc(p.goal)}<br>숙련 ${p.skill.toFixed(1)} · 관계 ${Math.round(p.relation)} · ${p.position ? "관료" : p.job ? "고용 중" : "구직 중"}</small></span><span>›</span></button>`).join("")}</div><div class="actions"><button data-page="-1" ${peoplePage === 0 ? "disabled" : ""}>이전</button><button data-page="1" ${peoplePage + 1 >= pages ? "disabled" : ""}>다음</button></div>`;
  }
  function show(kind, data = {}) {
    profile = { kind, data };
    let title = "",
      body = "";
    const P = V.player,
      d = V.districts.find(
        (d) => d.id === Number(data.district ?? V.sites[selected].district),
      );
    const firm = V.firms.find((f) => f.id === Number(data.firm));
    const person = [...V.people, ...(peopleData?.people || [])].find(
      (p) => p.id === Number(data.person),
    );
    switch (kind) {
      case "district":
        title = d.name + "의 생활";
        body =
          stats([
            ["식량", percent(d.food)],
            ["고용", percent(d.jobs)],
            ["주거", percent(d.housing)],
          ]) +
          Object.values(d.groups)
            .map(
              (g) =>
                `<p><b>${esc(g.name)} · ${g.support.toFixed(0)}%</b><br><small>${esc(g.reason)}</small></p>`,
            )
            .join("") +
          `<div class="actions">${button("현장 면담 · 시간 2", "visit", { district: d.id })}${button("조직 · 개인 35원 / 5일", "organize", { district: d.id })}${button("도로 · 국고 140원 / 8일", "road", { district: d.id }, false, !P.office ? "집행 권한 필요" : "")}${button("학교 · 국고 180원 / 8일", "school", { district: d.id }, false, !P.office ? "집행 권한 필요" : "")}${button("주택 · 국고 160원 / 10일", "housing", { district: d.id }, false, !P.office ? "집행 권한 필요" : "")}</div>`;
        break;
      case "firm":
        title = firm.name + " 운영";
        body =
          hint(
            `사업 자금 ${money(firm.cash)} · 임금은 사업 자금에서 지급됩니다.`,
          ) +
          `<h3>운영 방침 · 시간 1</h3><div class="actions">${Object.entries(
            V.policies,
          )
            .map(([k, r]) =>
              button(
                `${r.name} · 개당 ${r.price}원`,
                "policy",
                { firm: firm.id, value: k },
                firm.policy === k,
              ),
            )
            .join("")}</div><h3>고용과 위임</h3>${select(
            "hire",
            V.people
              .filter((p) => !p.job && !p.position)
              .map((p) => [p.id, `${p.name} · 숙련 ${p.skill.toFixed(1)}`]),
          )}<div class="actions">${button("직원 고용 · 시간 1", "hire", { firm: firm.id })}${button("운영자금 50원", "fund", { firm: firm.id })}</div>${
            firm.workers.length
              ? select(
                  "manager",
                  firm.workers.map((id) => {
                    const p = V.people.find((p) => p.id === id);
                    return [id, p?.name || id];
                  }),
                )
              : ""
          }<div class="actions">${button("경영 위임 · 시간 1", "delegate", { firm: firm.id }, false, !firm.workers.length ? "직원 필요" : "")}${button("고용 종료 · 퇴직금 최대 이틀", "fire", { firm: firm.id }, false, !firm.workers.length ? "직원 필요" : "")}</div><h3>임금</h3><div class="actions">${[5, 7, 9].map((n) => button("일급 " + n + "원", "wage", { firm: firm.id, value: n }, firm.wage === n)).join("")}</div><h3>투자</h3>${select(
            "partner",
            V.people
              .filter((p) => p.relation >= 10 && p.cash >= 60)
              .map((p) => [p.id, p.name]),
          )}${hint("동업: 상대가 60원 투자, 배당 30% 권리. 확장: 직원 필요, 6일. 정리: 잔여 현금 회수, 물건은 청산합니다.")}<div class="actions">${button("동업 제안", "partner", { firm: firm.id }, false, firm.partner ? "이미 동업 중" : "")}${button("확장 · " + (firm.owner === "public" ? "국고 " : "개인 ") + money(100 * firm.level), "expand", { firm: firm.id }, false, firm.level >= 3 ? "최대 규모" : "")}${button("사업 정리", "close", { firm: firm.id })}</div>`;
        break;
      case "competitor":
        title = firm.name;
        body = hint(
          `방침 ${V.policies[firm.policy].name} · 직원 ${firm.workers.length} · 일급 ${money(firm.wage)} · 손익 ${money(firm.profit)}. 수요·현금과 직원 목표에 따라 가격·고용·입지가 바뀝니다.`,
        );
        break;
      case "logistics":
        title = "공급과 운송";
        body =
          hint(
            "지역 원료는 저렴하지만 재고·운송 용량에 제한됩니다. 외부 공급은 개당 2.3원, 2일이 걸립니다. 지역 간 거리는 도로망이 결정합니다.",
          ) +
          V.routes
            .map(
              (r) =>
                `<p>${V.districts[r.from].name} ↔ ${V.districts[r.to].name} · 거리 ${r.length} · 도로 ${r.level}단계</p>`,
            )
            .join("") +
          (firm &&
          (firm.owner === "player" || (firm.owner === "public" && P.office))
            ? `<h3>원료 조달 지역</h3>${select(
                "source",
                V.districts.map((d) => [
                  d.id,
                  `${d.name} · 원료 ${d.raw.toFixed(0)}`,
                ]),
                firm.supplierDistrict ??
                  (firm.good === "food" ? 0 : firm.good === "tools" ? 1 : 2),
              )}<div class="actions">${button("지역 원료 계약", "source", { firm: firm.id })}${button("외부 원료 계약", "supplier", { firm: firm.id, value: "import" })}</div><h3>판매 지역</h3>${select(
                "destination",
                V.districts.map((d) => [
                  d.id,
                  `${d.name} · 부족 ${d.needs[firm.good].toFixed(1)}개`,
                ]),
                firm.marketDistrict,
              )}<div class="actions">${button("판매처 변경", "destination", { firm: firm.id })}</div>`
            : "") +
          `<details><summary>운송 중인 물건</summary>${
            V.shipments
              .filter((s) => s.status === "transit")
              .map(
                (s) =>
                  `<p>${s.kind === "raw" ? "원료" : "상품"} ${s.quantity.toFixed(1)}개 → ${V.districts[s.to].name} · ${s.arrives}일</p>`,
              )
              .join("") || hint("운송 대기 없음")
          }</details>`;
        break;
      case "land": {
        const s = V.sites.find((s) => s.id === Number(data.site));
        title = "부지 소유";
        body =
          hint(
            `현재 ${s.landOwner === "player" ? "내 부지" : "임대 가능"} · 임대 일급 ${money(s.rent)} · 매입 ${money(s.purchase)}. 매입하면 임대료가 없어지며 경쟁자가 입주하면 임대 수입이 생깁니다.`,
          ) +
          button(
            "개인 " + money(s.purchase) + "에 매입",
            "acquire",
            { site: s.id },
            true,
            s.landOwner === "player" ? "이미 소유" : "",
          );
        break;
      }
      case "person":
        title = person.name;
        body =
          hint(
            `${person.age.toFixed(0)}세 · ${person.goal} · 야심 ${Math.round(person.ambition * 100)} · 숙련 ${person.skill.toFixed(1)} · 관계 ${person.relation.toFixed(0)}`,
          ) +
          hint(person.voteReason) +
          `<div class="actions">${button("이야기 듣기 · 시간 1", "talk", { person: person.id, value: "listen" })}${button("개인 후원 · 20원", "talk", { person: person.id, value: "sponsor" })}${button("직원 교육 · 사업 15원", "talk", { person: person.id, value: "train" })}${button("정당 인재 영입", "recruit", { person: person.id }, false, !P.party ? "정당 가입 필요" : person.relation < 10 ? "관계 10 필요" : "")}${button("혼인 · 개인 30원", "marry", { person: person.id }, false, V.family.spouse ? "이미 혼인" : person.relation < 15 ? "관계 15 필요" : "")}</div><details open><summary>기억과 약속</summary>${person.memory.map((m) => `<p>${m.day}일 · ${esc(m.text)}</p>`).join("") || hint("아직 함께 쌓은 기억이 없습니다.")}</details>`;
        if (P.office)
          body += `<h3>공공 역할 위임</h3><div class="actions">${button("행정 책임자 임명 · 국고 일급 3원", "appoint", { person: person.id, value: "administration" }, false, person.job || person.position ? "겸직 불가" : person.relation < 5 ? "관계 5 필요" : "")}${button("치안 책임자 임명 · 국고 일급 3원", "appoint", { person: person.id, value: "army" }, false, person.job || person.position ? "겸직 불가" : person.relation < 5 ? "관계 5 필요" : "")}</div>`;
        if (V.firms.some((f) => f.owner === "player"))
          body += `<h3>내 사업에 고용</h3>${select(
            "person-firm",
            V.firms
              .filter((f) => f.owner === "player")
              .map((f) => [f.id, f.name]),
          )}<div class="actions">${button("고용 계약", "hire", { person: person.id }, false, person.job || person.position ? "기존 직책 정리 필요" : "")}</div>`;
        break;
      case "politics":
        title = "선거와 조직";
        body =
          hint(
            `${V.election}일 선거. 주민의 생활·집단별 이해·신뢰·공약·조직·투표 참여와 경쟁 정당이 득표를 결정합니다.`,
          ) +
          V.districts
            .map((d) => `<p>${d.name} · ${d.support.toFixed(0)}%</p>`)
            .join("") +
          `<h3>정당과 공약</h3>${select(
            "party",
            V.parties.map((p) => [p.id, p.name]),
            P.party,
          )}<div class="actions">${button("정당 가입 · 시간 1", "party")}</div>${select(
            "platform",
            [
              ["jobs", "고용 안정"],
              ["food", "식량 공급"],
              ["education", "교육 기회"],
            ],
            P.platform,
          )}<div class="actions">${button(P.office ? "재선 출마" : "선거 출마", "campaign", {}, true, P.candidate ? "이미 출마 중" : "")}${button("공개 토론 · 시간 2", "debate")}${button("집행 감시 · 시간 2", "oversight")}</div><h3>정당 간 연대</h3>${select(
            "coalition",
            V.parties
              .filter((p) => p.id !== P.party)
              .map((p) => [p.id, p.name]),
          )}${hint("같은 공약 또는 해당 정당 인물들과 평균 관계 5가 필요합니다. 생활 성과 약속을 이행하지 않으면 연대가 해체됩니다.")}<div class="actions">${button("연대 협상", "coalition")}${button("지역 연설 · 개인 15원·시간 2", "rally", { district: d.id })}</div><details><summary>최근 선거와 집단별 투표</summary>${V.history
            .slice(-3)
            .reverse()
            .map(
              (h) =>
                `<p>${h.day}일 · ${h.won ? "당선" : "낙선"} · 득표 ${h.score.toFixed(1)}%</p>${Object.entries(
                  h.byGroup || {},
                )
                  .map(
                    ([g, n]) =>
                      `<small>${g}: 찬성 ${n.player} / 경쟁 ${n.rival} / 기권 ${n.abstain}</small><br>`,
                  )
                  .join("")}`,
            )
            .join("")}</details>`;
        break;
      case "government":
        title = "의회와 제도";
        body =
          hint(
            `${V.regimes[V.government.regime]} · ${V.economies[V.government.economy]} · 정당성 ${V.government.legitimacy.toFixed(0)} · 행정 ${V.government.administration.toFixed(0)} · 치안 ${V.government.army.toFixed(0)}`,
          ) +
          `<p>의회 ${V.government.council.length}석 · 연대 확보 ${V.readiness.council.toFixed(0)}%</p><h3>정책안 · 시간 1 · 5일 심의</h3>${select(
            "bill-kind",
            [
              ["tax", "세율"],
              ["welfare", "구호"],
              ["wage", "최저임금"],
            ],
            "tax",
          )}${select(
            "bill-value",
            [
              [0.04, "세율 4%"],
              [0.08, "세율 8%"],
              [0.12, "세율 12%"],
            ],
            0.08,
          )}<div class="actions">${button("의회에 발의", "bill", {}, false, !P.party ? "정당 가입 필요" : "")}</div><h3>책임자 임명</h3>${select(
            "minister",
            V.people
              .filter((p) => !p.job && !p.position)
              .map((p) => [
                p.id,
                `${p.name} · 숙련 ${p.skill.toFixed(1)}·관계 ${p.relation.toFixed(0)}`,
              ]),
          )}${select("office", [
            ["administration", "행정"],
            ["army", "치안"],
          ])}${hint("집행자만 임명할 수 있습니다. 관계 5 필요. 국고 일급 3원. 능력·이해관계가 행정 역량에 반영됩니다.")}<div class="actions">${button("임명", "appoint", {}, false, !P.office ? "집행 권한 필요" : "")}</div><h3>제도 개편 · 15일 준비</h3>${select(
            "reform-kind",
            [
              ["constitution", "권력 구조"],
              ["economy", "소유·경제 체제"],
            ],
            "constitution",
          )}${select("reform-target", Object.entries(V.regimes), "council")}${select(
            "reform-method",
            [
              ["legal", "의회 협상 · 개인 90원"],
              ["movement", "사회운동 · 개인 60원"],
            ],
            "legal",
          )}${hint("완료 시 주민 60%(운동 65%), 정당성 40·행정 30 필요. 의회 협상은 2/3 의석, 운동은 지역 조직 2곳·치안 지지 35가 필요합니다. 실패해도 준비 비용은 소모되며 자동 집권하지 않습니다.")}<div class="actions">${button("준비 계획 시작", "reform")}</div><h3>운송망 공공 투자</h3>${V.routes.map((r) => button(`${V.districts[r.from].name}↔${V.districts[r.to].name} · 국고 120원·8일`, "transport", { id: r.id }, false, !P.office ? "집행 권한 필요" : r.level >= 3 ? "확장 완료" : "")).join("")}<details><summary>의회 표결 기록</summary>${V.government.bills.map((b) => `<p>${esc(b.kind)} ${b.value} · ${esc(b.status)} · ${b.due}일 표결 ${b.votes ? b.votes.yes + "/" + V.government.council.length : ""}</p>`).join("") || hint("심의 기록이 없습니다.")}</details>`;
        break;
      case "family":
        title = "가문과 세대";
        body =
          V.family.members
            .map(
              (m) =>
                `<p><b>${esc(m.name)}</b> · ${m.age}세 · 숙련 ${m.skill.toFixed(1)} · ${!m.alive ? "사망" : m.kind === "head" ? "가장" : m.kind === "child" ? "자녀" : m.kind === "spouse" ? "배우자" : "선대"} · 재산 ${money(m.cash)}</p>`,
            )
            .join("") +
          `<h3>후계와 교육</h3>${select(
            "heir",
            V.family.members
              .filter((m) => m.alive && m.kind === "child")
              .map((m) => [m.id, m.name]),
            V.family.heir,
          )}<div class="actions">${button("후계 지정 · 시간 1", "heir")}${button("교육 · 개인 45원 / 12일", "educate")}${button("계승 · 120일·성년 후계자", "succession")}</div><h3>유언과 가족 계획</h3>${select(
            "will",
            [
              ["equal", "자녀 균등 분배"],
              ["primogeniture", "후계자 85% 우선"],
            ],
            V.family.will,
          )}${hint("우선 상속은 다른 자녀의 이의를 부를 수 있습니다. 계승 시 사업·계약·재산과 관계 일부를 물려받습니다.")}<div class="actions">${button("유언 변경 · 시간 1", "will")}${button("출산 준비 · 40원 / 12일", "child", {}, false, !V.family.spouse ? "혼인 필요" : "")}${button("입양 · 개인 40원", "adopt")}</div>`;
        break;
      case "life":
        title = "생활과 재기";
        body =
          hint(
            "품팔이로 생계를 유지하고, 주거와 기술·관계·신용을 바탕으로 새 사업이나 지역 활동을 시작할 수 있습니다. 대출은 부채이며 상환해야 합니다.",
          ) +
          stats([
            ["내 숙련", P.skill.toFixed(1)],
            ["개인 자금", money(P.cash)],
            [
              "주거",
              P.housing === 2 ? "자가" : P.housing === 1 ? "임대" : "임시 거처",
            ],
          ]) +
          `<div class="actions">${button("품팔이 · 시간 2", "work", {}, false, P.office ? "공직 중" : "")}${button("재기 대출 · 100원", "loan")}${button("임대 · 개인 20원", "home", { district: d.id, value: "rent" })}${button("주택 매입 · 개인 180원", "home", { district: d.id, value: "buy" })}</div>${V.loans
            .filter((l) => ["active", "default"].includes(l.status))
            .map(
              (l) =>
                `<p>${l.due}일에 ${money(l.balance)} 상환</p>${button("지금 상환", "repay", { id: l.id })}`,
            )
            .join("")}`;
        break;
      case "plan": {
        const p = V.plans.find((p) => p.id === Number(data.id));
        title = "계획 담당자";
        body =
          hint(
            `${p.title} · 숙련 5 이상 담당자는 격일로 추가 진행합니다. 관계가 악화되면 이탈하고, 우선 계획에 인력을 배정하면 다른 계획이 지연됩니다.`,
          ) +
          select(
            "plan-manager",
            V.people
              .filter((p) => p.relation >= 5)
              .map((p) => [p.id, `${p.name} · 숙련 ${p.skill.toFixed(1)}`]),
          ) +
          button("담당자 배치", "plan", { id: p.id }, true);
        break;
      }
      case "notes":
        title = "마을의 기록";
        body = V.notes
          .map(
            (n) =>
              `<p><b>${n.day}일 · ${esc(n.title)}</b><br><small>${esc(n.text)}</small></p>`,
          )
          .join("");
        break;
      case "storage":
        title = "저장과 이어하기";
        body =
          hint(
            "명령이 성공할 때 서버에 저장합니다. 전체 저장을 내보내거나 새 게임의 첫날에 가져올 수 있습니다. 진행 중인 게임은 덮어쓰지 않습니다. 편집실은 별도 저장을 사용합니다.",
          ) +
          `<div class="actions">${button("지금 저장", "save")}<a class="button" href="${API}/api/export" download>전체 저장 내보내기</a><a class="button" href="/editor">별도 세계 편집실</a></div><label class="label" for="import-file">전체 JSON 저장 또는 기존 마을 저장</label><input type="file" id="import-file" accept=".json,application/json"><button id="import-button" ${!V.canImport && !V.editor ? "disabled" : ""}>선택 파일 가져오기</button>${V.importInfo ? hint(V.importInfo.notes) : ""}`;
        break;
      case "editor":
        title = "별도 세계 편집실";
        body =
          hint(
            "일반 플레이와 다른 저장입니다. 편집은 현재 실험 세계에만 반영됩니다.",
          ) +
          select(
            "edit-district",
            V.districts.map((d) => [d.id, d.name]),
          ) +
          select("edit-key", [
            ["road", "도로"],
            ["school", "학교"],
            ["homes", "주택"],
            ["raw", "원료"],
          ]) +
          `<input id="edit-value" type="number" min="0" max="10000" value="3" aria-label="편집 값"><div class="actions">${button("지역 상태 편집", "edit:district")}${button("시장 계정에서 100원 이전", "edit:transfer", { value: 100 })}</div><h3>정부 역량</h3>${select(
            "edit-government-key",
            [
              ["administration", "행정"],
              ["army", "치안"],
              ["legitimacy", "정당성"],
            ],
          )}<input id="edit-government-value" type="number" min="0" max="100" value="70" aria-label="정부 편집 값"><div class="actions">${button("정부 역량 편집", "edit:government")}</div><h3>인물 편집</h3>${select(
            "edit-person",
            V.people.map((p) => [p.id, p.name]),
          )}${select("edit-person-key", [
            ["skill", "숙련"],
            ["relation", "관계"],
            ["loyalty", "충성"],
            ["ambition", "야심"],
          ])}<input id="edit-person-value" type="number" min="0" max="100" value="10" aria-label="인물 편집 값">${button("인물 편집", "edit:person")}`;
        break;
    }
    $("#sheet").innerHTML =
      `<div class="sheet-top"><h2>${esc(title)}</h2><button data-close aria-label="닫기">닫기</button></div><div class="sheet-body">${body}</div>`;
    if (!$("#sheet").open) $("#sheet").showModal();
  }
  function render() {
    if (!V) return;
    const scroller = $("#app");
    positions[lastTab] = scroller.scrollTop;
    lastTab = tab;
    $("#hud").innerHTML =
      `<span>${V.editor ? "실험 세계" : "마을 시간"}<b>${V.day}일</b></span><span>개인 자금<b>${money(V.player.cash)}</b></span><span>오늘 시간<b>${V.player.energy}/3</b></span>`;
    $("#app").classList.toggle("village-screen", tab === "village");
    $("#app").innerHTML =
      `<div class="toolbar"><div><span class="eyebrow">${esc(V.role)} · ${V.population}명의 마을</span><h1>${tab === "village" ? "마을에서 기회를 찾으세요" : tab === "activity" ? "내 활동과 계획" : "사람과 관계"}</h1></div><div class="row">${button("하루", "advance", { days: 1 }, true)}${button("7일", "advance", { days: 7 })}</div></div>` +
      (tab === "village"
        ? `<div class="layout">${map()}${panel()}</div>`
        : tab === "activity"
          ? activity()
          : people());
    scroller.scrollTop = positions[tab] || 0;
    document
      .querySelectorAll("[data-tab]")
      .forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    const e = V.events[0];
    if (e) {
      if ($("#sheet").open) $("#sheet").close();
      if (eventId !== e.id || !$("#event").open) {
        eventId = e.id;
        $("#event").innerHTML =
          `<span class="eyebrow">판단을 기다리는 중 · 시간 정지</span><h2>${esc(e.title)}</h2><div class="scene-illustration" aria-hidden="true"><svg viewBox="0 0 360 70"><rect width="360" height="70" fill="#dbe5cc"/><path d="M0 60L70 20L120 50L210 10L310 60" fill="#b6cba3"/><path d="M150 70V32L185 12L220 32V70" fill="#597657"/><circle cx="85" cy="44" r="8" fill="#b78435"/><circle cx="270" cy="44" r="8" fill="#496a65"/></svg></div><p>${esc(e.text)}</p><div class="actions choices">${e.options.map((o) => button(o.label + " · " + (o.account === "personal" ? "개인 " : o.account === "public" ? "국고 " : o.account === "business" ? "사업 " : "") + (o.cost ? money(o.cost) : "지출 없음"), "choose", { id: e.id, value: o.value }, false, o.reason)).join("")}</div>${hint(
            e.options
              .map((o) => o.effect)
              .filter(Boolean)
              .join(" · "),
          )}`;
        if (!$("#event").open) $("#event").showModal();
      }
    } else {
      eventId = null;
      $("#event").close();
    }
  }
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("button,[data-site]");
    if (!b) return;
    if (b.hasAttribute("data-close")) {
      $("#sheet").close();
      profile = null;
      return;
    }
    if (b.dataset.tab) {
      tab = b.dataset.tab;
      render();
      if (tab === "people") loadPeople();
      return;
    }
    if (b.dataset.page) {
      peoplePage = Math.max(0, peoplePage + Number(b.dataset.page));
      peopleData = null;
      render();
      loadPeople();
      return;
    }
    if (b.dataset.dialog) {
      show(b.dataset.dialog, b.dataset);
      return;
    }
    if (b.dataset.site !== undefined && !b.dataset.action) {
      selected = Number(b.dataset.site);
      tab = "village";
      render();
      return;
    }
    if (b.id === "import-button") {
      const file = $("#import-file").files[0];
      if (!file) {
        toast("저장 파일을 선택하세요.");
        return;
      }
      try {
        importRaw = await file.text();
        const r = await fetch(API + "/api/migration-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: importRaw,
        });
        const preview = await r.json();
        if (!r.ok || preview.error)
          throw Error(preview.error || "파일을 확인할 수 없습니다.");
        const target = document.createElement("section");
        target.className = "card";
        target.innerHTML = `<h3>${preview.migration ? "새 규칙으로 이전" : "저장 이어하기"}</h3>${hint(preview.description)}${hint(`${preview.population}명 · 원본 ${preview.day}일`)}<button id="import-confirm" class="primary">${preview.migration ? "원본을 보관하고 새 규칙으로 시작" : "이 저장으로 이어하기"}</button>`;
        $("#import-confirm")?.closest("section")?.remove();
        $(".sheet-body").append(target);
        target.scrollIntoView({ block: "nearest" });
      } catch (err) {
        importRaw = null;
        toast(err.message);
      }
      return;
    }
    if (b.id === "import-confirm") {
      if (!importRaw) return;
      try {
        const r = await fetch(API + "/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: importRaw,
        });
        const x = await r.json();
        if (!r.ok || x.error) throw Error(x.error);
        importRaw = null;
        $("#sheet").close();
        etag = "";
        await poll();
        toast("원본을 보존하고 저장을 가져왔습니다.");
      } catch (err) {
        toast(err.message);
      }
      return;
    }
    if (!b.dataset.action || b.disabled) return;
    const c = { ...b.dataset };
    for (const k of ["site", "firm", "person", "id", "days", "district"])
      if (c[k] !== undefined) c[k] = Number(c[k]);
    const value = (id) => $(id)?.value;
    if (c.action === "open") {
      c.good = value("#good");
      c.policy = value("#policy");
    }
    if (c.action === "hire") {
      c.person ||= Number(value("#hire"));
      c.firm ||= Number(value("#person-firm"));
    }
    if (["delegate", "fire"].includes(c.action))
      c.person = Number(value("#manager"));
    if (c.action === "partner") c.person = Number(value("#partner"));
    if (["tax", "wage", "edit:transfer"].includes(c.action))
      c.value = Number(c.value);
    if (c.action === "campaign") c.value = value("#platform");
    if (c.action === "party") c.value = value("#party");
    if (c.action === "coalition") c.value = value("#coalition");
    if (
      c.action === "heir" ||
      c.action === "educate" ||
      c.action === "succession"
    )
      c.value = value("#heir");
    if (c.action === "will") c.value = value("#will");
    if (c.action === "source") c.district = Number(value("#source"));
    if (c.action === "destination") c.district = Number(value("#destination"));
    if (c.action === "bill") {
      c.kind = value("#bill-kind");
      c.value = Number(value("#bill-value"));
    }
    if (c.action === "appoint") {
      c.value ||= value("#office");
      c.person ||= Number(value("#minister"));
    }
    if (c.action === "reform") {
      c.kind = value("#reform-kind");
      c.value = value("#reform-target");
      c.method = value("#reform-method");
    }
    if (c.action === "plan" && profile?.kind === "plan")
      c.person = Number(value("#plan-manager"));
    if (c.action === "edit:district") {
      c.district = Number(value("#edit-district"));
      c.key = value("#edit-key");
      c.value = Number(value("#edit-value"));
    }
    if (c.action === "edit:government") {
      c.key = value("#edit-government-key");
      c.value = Number(value("#edit-government-value"));
    }
    if (c.action === "edit:person") {
      c.person = Number(value("#edit-person"));
      c.key = value("#edit-person-key");
      c.value = Number(value("#edit-person-value"));
    }
    await send(c);
  });
  document.addEventListener("keydown", (e) => {
    const t = e.target.closest("[data-site]");
    if (t && ["Enter", " "].includes(e.key)) {
      e.preventDefault();
      selected = Number(t.dataset.site);
      render();
    }
  });
  document.addEventListener("change", (e) => {
    if (e.target.id === "layer") {
      layer = e.target.value;
      render();
    }
    if (e.target.id === "goal") send({ action: "goal", value: e.target.value });
    if (e.target.id === "people-filter") {
      peopleFilter = e.target.value;
      peoplePage = 0;
      peopleData = null;
      render();
      loadPeople();
    }
    if (e.target.id === "bill-kind")
      $("#bill-value").outerHTML = select(
        "bill-value",
        e.target.value === "tax"
          ? [
              [0.04, "4%"],
              [0.08, "8%"],
              [0.12, "12%"],
            ]
          : e.target.value === "wage"
            ? [
                [5, "5원"],
                [7, "7원"],
                [9, "9원"],
              ]
            : [
                [0, "미시행"],
                [1, "1원 구호"],
                [2, "2원 구호"],
              ],
      );
    if (e.target.id === "reform-kind")
      $("#reform-target").outerHTML = select(
        "reform-target",
        Object.entries(e.target.value === "economy" ? V.economies : V.regimes),
      );
  });
  $("#event").addEventListener("cancel", (e) => e.preventDefault());
  $("#sheet").addEventListener("close", () => (profile = null));
  const session = makeId();
  async function heartbeat() {
    try {
      await fetch(API + "/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: session, active: !document.hidden }),
        keepalive: true,
      });
    } catch {}
  }
  document.addEventListener("visibilitychange", heartbeat);
  window.addEventListener("pagehide", () =>
    navigator.sendBeacon(
      API + "/api/session",
      JSON.stringify({ id: session, active: false }),
    ),
  );
  heartbeat();
  poll();
  setInterval(() => {
    if (!document.hidden && !busy) poll();
  }, 2000);
  setInterval(heartbeat, 15000);
})();
