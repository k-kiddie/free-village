"use strict";
const assert = require("node:assert/strict");
const { createGame } = require("../rebuild/game");
const { migrateLegacy } = require("../rebuild/migration");
const { createWorld } = require("../engine");
const passed = [];
function test(name, run) {
  run();
  passed.push(name);
}
function days(g, n) {
  for (let i = 0; i < n; i++) {
    for (const e of [...g.view().events]) {
      const opts = e.options.filter((o) => o.available);
      const o =
        opts.find((o) => o.value === "decline") ||
        opts.find((o) => o.value === "disclose") ||
        opts.find((o) => o.value === "refuse") ||
        opts[0];
      if (o) g.command({ action: "choose", id: e.id, value: o.value });
    }
    g.command({ action: "advance", days: 1 });
  }
}
function fixture(change) {
  const saved = createGame(21).export();
  change(saved.state);
  return createGame(21, saved);
}
function open(g, good = "food", site = 3) {
  g.command({ action: "open", site, good, policy: "volume" });
  days(g, 3);
  return g.view().firms.find((f) => f.owner === "player" && f.site === site).id;
}

test("실제 원료·상품 운송과 공급자 전환", () => {
  const g = createGame(22),
    id = open(g, "food", 4),
    initial = g.money();
  g.command({ action: "source", firm: id, district: 0 });
  days(g, 1);
  assert(
    g
      .view()
      .shipments.some(
        (s) => s.kind === "raw" && s.firm === id && s.status === "transit",
      ),
  );
  days(g, 4);
  assert(g.view().firms.find((f) => f.id === id).materials >= 0);
  g.command({ action: "destination", firm: id, district: 2 });
  days(g, 5);
  assert(g.view().shipments.some((s) => s.kind === "goods" && s.firm === id));
  assert(
    Math.abs(g.money() - initial) < 1e-6,
    "운송·고용·세금·주거에도 화폐 보존",
  );
});
test("계획 예약 예산·우선순위·취소 반환", () => {
  const g = createGame(),
    before = g.money();
  g.command({ action: "open", site: 3, good: "tools", policy: "quality" });
  const p = g.view().plans[0];
  assert.equal(p.cash, p.cost);
  assert.equal(g.money(), before);
  days(g, 1);
  const progress = g.view().plans[0];
  assert(progress.cash < p.cash);
  const personal = g.view().player.cash;
  g.command({ action: "plan", id: p.id, value: "cancel" });
  assert.equal(g.view().player.cash, personal + progress.cash);
  assert(Math.abs(g.money() - before) < 1e-6);
});
test("개인·국고·사업 권한과 편집실 분리", () => {
  const g = createGame(),
    b = g.export();
  assert.throws(
    () =>
      g.command({
        action: "edit:district",
        district: 0,
        key: "homes",
        value: 30,
      }),
    /편집/,
  );
  assert.deepEqual(g.export(), b);
  assert.throws(() => g.command({ action: "housing", district: 0 }), /권한/);
  assert.deepEqual(g.export(), b);
  const e = createGame(21, undefined, { editor: true });
  e.command({ action: "edit:district", district: 0, key: "homes", value: 30 });
  assert.equal(e.view().districts[0].homes, 30);
  assert.equal(g.view().districts[0].homes, 7);
});
test("집단별 생활 원인·주민 투표·낙선 후 활동", () => {
  const g = createGame();
  g.command({ action: "party", value: "civic" });
  g.command({ action: "campaign", value: "food" });
  days(g, 30);
  const v = g.view(),
    h = v.history[0];
  assert(h.byGroup.workers && h.byGroup.farmers);
  assert(h.turnout.player + h.turnout.rival + h.turnout.abstain === 60);
  assert(v.districts[0].groups.workers.reason.includes("일급"));
  assert.equal(v.government.council.length, 9);
  g.command({ action: "oversight" });
  days(g, 1);
  g.command({ action: "campaign", value: "jobs" });
  assert(g.view().player.candidate);
});
test("의회 가결·공공 집행·실각 시 중단", () => {
  const g = fixture((S) => {
    S.player.office = true;
    S.player.party = "civic";
    S.election = 90;
    S.government.council = Array.from({ length: 9 }, (_, i) => ({
      district: i % 3,
      party: i < 7 ? "civic" : "trade",
      person: i + 1,
    }));
  });
  const personal = g.view().player.cash,
    tre = g.view().treasury;
  g.command({ action: "housing", district: 0 });
  assert.equal(g.view().treasury, tre - 160);
  assert.equal(g.view().player.cash, personal);
  g.command({ action: "bill", kind: "tax", value: 0.04 });
  days(g, 10);
  assert.equal(g.view().tax, 0.04);
  assert.equal(g.view().districts[0].homes, 10);
  const saved = g.export();
  saved.state.player.office = false;
  const opposition = createGame(1, saved);
  assert.throws(
    () => opposition.command({ action: "appoint", person: 10, value: "army" }),
    /권한/,
  );
});
test("개헌은 준비·권한·의회·민심·새 선거를 요구", () => {
  const g = fixture((S) => {
    S.player.office = true;
    S.player.party = "civic";
    S.player.trust = 100;
    S.player.organization = 4;
    S.election = 90;
    S.government.legitimacy = 90;
    S.government.administration = 80;
    S.government.army = 80;
    S.government.council = Array.from({ length: 9 }, (_, i) => ({
      party: "civic",
      district: i % 3,
      person: i + 1,
    }));
    for (const p of S.people) {
      p.relation = 100;
      p.support = 90;
    }
  });
  g.command({
    action: "reform",
    kind: "constitution",
    value: "council",
    method: "legal",
  });
  assert.equal(g.view().government.regime, "republic");
  days(g, 15);
  assert.equal(g.view().government.regime, "council");
  assert(!g.view().player.office);
  assert.equal(g.view().election, g.view().day + 10);
  const bad = fixture((S) => {
    S.player.office = true;
    S.election = 90;
  });
  bad.command({
    action: "reform",
    kind: "economy",
    value: "public",
    method: "legal",
  });
  days(bad, 15);
  assert.equal(bad.view().government.economy, "market");
  assert(bad.view().plans.some((p) => p.status === "failed"));
});
test("직원 대화·인물 기억·임명·겸직 차단", () => {
  const g = createGame();
  const id = open(g);
  g.command({ action: "hire", firm: id, person: 10 });
  days(g, 1);
  g.command({ action: "talk", person: 10, value: "listen" });
  g.command({ action: "talk", person: 10, value: "train" });
  const p = g.view().people.find((p) => p.id === 10);
  assert(p.memory.length >= 2 && p.relation > 5);
  const snapshot = g.export();
  snapshot.state.player.office = true;
  const gov = createGame(1, snapshot);
  assert.throws(
    () =>
      gov.command({ action: "appoint", person: 10, value: "administration" }),
    /겸직/,
  );
});
test("후원→당선→이해충돌→후속 기억", () => {
  const g = fixture((S) => {
    S.player.office = true;
    S.election = 90;
    S.promises.push({
      id: S.next++,
      kind: "exclusive",
      person: 2,
      firm: 1,
      due: 60,
      status: "active",
    });
  });
  days(g, 1);
  const e = g.view().events.find((e) => e.kind === "procurement");
  assert(e);
  const cash = g.view().player.cash,
    tre = g.view().treasury;
  g.command({ action: "choose", id: e.id, value: "recuse" });
  assert.equal(g.view().player.cash, cash - 30);
  assert.equal(g.view().treasury, tre);
  assert.equal(g.view().promises[0].status, "settled");
  assert(
    g
      .view()
      .people.find((p) => p.id === 2)
      .memory.some((m) => m.text.includes("합의")),
  );
});
test("과거 직업 사건의 표시·실행 자격 재검사", () => {
  const g = fixture((S) => {
    S.events = [
      {
        id: 999,
        kind: "crafted",
        firm: 1,
        person: 2,
        title: "맞춤 주문",
        text: "제작직",
      },
    ];
    S.player.office = true;
  });
  assert.equal(g.view().events.length, 0);
  const before = g.export();
  assert.throws(
    () => g.command({ action: "choose", id: 999, value: "accept" }),
    /역할|제안/,
  );
  assert.deepEqual(g.export(), before);
});
test("가문 교육·혼인·분배·분쟁·재기", () => {
  const g = fixture((S) => {
    S.people.find((p) => p.id === 10).relation = 20;
  });
  g.command({ action: "marry", person: 10 });
  g.command({ action: "will", value: "primogeniture" });
  days(g, 120);
  const money = g.money();
  g.command({ action: "succession" });
  assert.equal(g.view().player.generation, 2);
  assert(g.view().events.some((e) => e.kind === "inheritance"));
  const e = g.view().events[0];
  g.command({ action: "choose", id: e.id, value: "mediate" });
  assert(!g.view().family.dispute);
  assert(Math.abs(g.money() - money) < 1e-6);
  days(g, 1);
  g.command({ action: "work" });
  assert(g.view().notes.some((n) => n.title === "하루 품삯"));
});
test("기존 전체 저장 g/q·사건·계약 원본 보존과 새 뷰 분리", () => {
  const w = createWorld(17, 30),
    legacy = { seed: 17, population: 30, state: w.exportState() },
    m = migrateLegacy(legacy),
    g = createGame(1, m);
  assert.deepEqual(g.export().state.legacy, legacy);
  assert(!("legacy" in g.view()));
  assert(!g.view().people.some((p) => p.g || p.q));
  assert.deepEqual(
    g.export().state.people[0].q,
    legacy.state.S.agents.find((a) => a.id === g.export().state.people[0].id).q,
  );
  days(g, 2);
  const restored = createGame(1, g.export());
  assert.deepEqual(restored.export(), g.export());
  assert.throws(() => createGame(1, { version: 999, state: {} }));
});
test("실제 주민 플레이로 낙선 뒤 조직·토론·재출마 당선", () => {
  const g = createGame();
  g.command({ action: "party", value: "civic" });
  for (let day = 0; day < 90 && !g.view().player.office; day++) {
    const v = g.view();
    if (day % 30 === 26 && !v.player.candidate)
      g.command({ action: "campaign", value: "education" });
    const d = v.districts.find(
      (d) =>
        !v.plans.some(
          (p) =>
            p.type === "organize" && p.target === d.id && p.status === "active",
        ),
    );
    if (v.player.cash < 45) g.command({ action: "work" });
    else if (
      d &&
      v.plans.filter((p) => p.status === "active").length < 3 &&
      v.player.organization < 12
    )
      g.command({ action: "organize", district: d.id });
    else g.command({ action: "debate" });
    days(g, 1);
  }
  assert(g.view().history.some((h) => !h.won));
  assert(g.view().player.office, "상태 주입 없이 선거 당선");
});
test("소유 개편이 회사 권리·배당·공공 청산 권한을 변경", () => {
  const g = fixture((S) => {
    S.player.office = true;
    S.player.party = "civic";
    S.player.trust = 100;
    S.player.organization = 10;
    S.election = 90;
    S.government.legitimacy = 90;
    S.government.administration = 80;
    S.government.army = 80;
    S.government.council = Array.from({ length: 9 }, (_, i) => ({
      party: "civic",
      district: i % 3,
      person: i + 1,
    }));
    for (const p of S.people) {
      p.relation = 100;
      p.support = 90;
    }
    S.firms[0].owner = "player";
  });
  const initial = g.money();
  g.command({
    action: "reform",
    kind: "economy",
    value: "public",
    method: "legal",
  });
  days(g, 15);
  assert.equal(g.view().government.economy, "public");
  assert(g.view().firms.every((f) => f.owner === "public"));
  const before = g.export();
  assert.throws(
    () => g.command({ action: "close", firm: g.view().firms[0].id }),
    /공공/,
  );
  assert.deepEqual(g.export(), before);
  assert(Math.abs(g.money() - initial) < 1e-6, "소유 개편도 통화량 보존");
});
test("동업 지분 청산과 연체 후 신용 회복", () => {
  const g = fixture((S) => {
    S.people.find((p) => p.id === 10).relation = 20;
    S.people.find((p) => p.id === 10).cash = 100;
  });
  const id = open(g);
  g.command({ action: "partner", firm: id, person: 10 });
  const v = g.view(),
    f = v.firms.find((f) => f.id === id),
    p = v.people.find((p) => p.id === 10);
  g.command({ action: "close", firm: id });
  assert.equal(
    g.view().people.find((x) => x.id === 10).cash,
    p.cash + f.cash * 0.3,
    "동업자의 지분을 정산",
  );
  const debt = fixture((S) => {
    S.player.cash = 0;
  });
  debt.command({ action: "loan" });
  debt.command({ action: "organize", district: 0 });
  debt.command({ action: "educate" });
  days(debt, 30);
  assert(debt.view().loans.some((l) => l.status === "default"));
  assert.throws(() => debt.command({ action: "loan" }), /상환/);
  for (let i = 0; i < 12; i++) {
    debt.command({ action: "work" });
    days(debt, 1);
  }
  const l = debt.view().loans[0];
  debt.command({ action: "repay", id: l.id });
  assert.equal(debt.view().loans[0].status, "paid");
  debt.command({ action: "loan" });
});
console.log("확장 시스템 검사 통과: " + passed.join(" / "));
