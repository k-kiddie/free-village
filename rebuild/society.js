"use strict";
const { GROUPS } = require("./schema");
const clamp = (n, a = 0, b = 100) => Math.max(a, Math.min(b, n));
module.exports = function society(C) {
  const { person, district, energy, pay, market, treasury, note, plan } = C;
  function path(from, to) {
    if (from === to) return { distance: 0, capacity: 50, days: 0, edges: [] };
    const S = C.S,
      queue = [{ at: from, distance: 0, capacity: 50, edges: [] }],
      seen = new Set();
    while (queue.length) {
      queue.sort((a, b) => a.distance - b.distance);
      const q = queue.shift();
      if (seen.has(q.at)) continue;
      seen.add(q.at);
      if (q.at === to)
        return { ...q, days: Math.max(1, Math.ceil(q.distance / 3)) };
      for (const e of S.routes.filter(
        (e) => e.from === q.at || e.to === q.at,
      )) {
        const next = e.from === q.at ? e.to : e.from;
        queue.push({
          at: next,
          distance: q.distance + e.length / (1 + e.level * 0.5),
          capacity: Math.min(q.capacity, 3 + e.level * 5),
          edges: [...q.edges, e.id],
        });
      }
    }
    return { distance: Infinity, capacity: 0, days: 99, edges: [] };
  }
  function beforeTick() {
    const S = C.S,
      P = S.player;
    for (const d of S.districts) {
      d.raw = Math.min(180, d.raw + (d.id === 0 ? 18 : d.id === 2 ? 12 : 9));
      const residents = S.people.filter((p) => p.alive && p.district === d.id),
        capacity = d.homes * 3;
      d.housing = Math.min(1, capacity / Math.max(1, residents.length));
      residents
        .sort((a, b) => b.cash - a.cash)
        .forEach((p, i) => {
          p.housed = i < capacity;
          if (p.housed) {
            const paid = Math.min(p.cash, d.rent);
            pay(p, market(), paid);
          }
          if (!p.housed && S.day % 10 === 0) {
            const dest = S.districts.find(
              (x) =>
                x.id !== d.id &&
                x.homes * 3 >
                  S.people.filter((p) => p.district === x.id).length,
            );
            if (dest) {
              p.district = dest.id;
              p.memory.push({
                day: S.day,
                text: `주거 부족으로 ${dest.name}으로 이주`,
              });
            }
          }
        });
      d.rent = +(1 + (1 - d.housing) * 2).toFixed(2);
    }
    pay(
      P,
      market(),
      Math.min(
        P.cash,
        P.housing === 0 ? district(P.district).rent : P.housing === 1 ? 0.5 : 0,
      ),
    );
    for (const loan of S.loans.filter((l) => l.status === "active"))
      if (S.day >= loan.due) {
        const payment = Math.min(P.cash, loan.balance);
        pay(P, market(), payment);
        loan.balance -= payment;
        loan.status = loan.balance < 0.01 ? "paid" : "default";
        if (loan.status === "default") {
          P.trust = Math.max(0, P.trust - 10);
          note(
            "상환 미이행",
            "채권자가 손실을 기록했습니다. 기술·관계와 남은 사업으로 재기할 수 있습니다.",
          );
        }
      }
  }
  function support() {
    const S = C.S,
      P = S.player,
      G = S.government;
    for (const d of S.districts) {
      const residents = S.people.filter((p) => p.district === d.id && p.alive),
        foodNeed = residents.length;
      d.food = clamp(1 - d.needs.food / Math.max(1, foodNeed), 0, 1);
      d.jobs =
        residents.filter((p) => p.job).length / Math.max(1, residents.length);
      for (const p of residents) {
        const f = S.firms.find((f) => f.id === p.job),
          income = f?.wage || 3;
        const employment = f ? clamp(income * 5 + (p.loyalty || 0) * 0.4) : 15;
        const reasons = {
          farmers: d.food * 30 + (d.prices.food || 4) * 4 + d.road * 6,
          workers: employment * 0.65 + d.food * 15,
          merchants: d.road * 10 + (1 - S.tax) * 22 + d.food * 10,
          residents: d.housing * 20 + d.food * 25 + d.school * 8,
        };
        const issue = reasons[p.group] || reasons.residents;
        const personal =
          (p.relation || 0) * 0.15 +
          P.trust * 0.18 +
          d.organization * 2 +
          P.speech * 0.2;
        const promise = S.promises
          .filter((x) => x.person === p.id)
          .reduce(
            (n, x) =>
              n + (x.status === "kept" ? 4 : x.status === "broken" ? -7 : 0),
            0,
          );
        const performance = P.office ? issue * 0.9 : issue * 0.25;
        const target = clamp(
          12 +
            performance +
            personal +
            promise +
            (S.parties.find((x) => x.id === P.party)?.platform === P.platform
              ? 3
              : 0),
        );
        p.support = clamp(p.support + (target - p.support) * 0.09);
        p.voteReason = `${GROUPS[p.group]} · ${p.group === "farmers" ? `농산물 ${d.prices.food.toFixed(1)}원·도로 ${d.road}` : p.group === "workers" ? `일급 ${income}원·고용 ${f ? "유지" : "부족"}` : p.group === "merchants" ? `세율 ${Math.round(S.tax * 100)}%·접근 ${d.road}` : `주거 ${Math.round(d.housing * 100)}%·식량 ${Math.round(d.food * 100)}%`} · 신뢰 ${Math.round(P.trust)} · 약속 ${promise >= 0 ? "+" : ""}${promise}`;
        p.food = d.food;
      }
      d.groups = Object.fromEntries(
        Object.keys(GROUPS).map((group) => {
          const ps = residents.filter((p) => p.group === group);
          return [
            group,
            {
              name: GROUPS[group],
              count: ps.length,
              support:
                ps.reduce((n, p) => n + p.support, 0) / Math.max(1, ps.length),
              reason: ps[0]?.voteReason || "해당 주민 없음",
            },
          ];
        }),
      );
      d.support =
        residents.reduce((n, p) => n + p.support, 0) /
        Math.max(1, residents.length);
    }
    G.legitimacy = clamp(
      G.legitimacy +
        ((S.districts.reduce((n, d) => n + d.food + d.housing, 0) / 6) * 100 -
          G.legitimacy) *
          0.02,
    );
    G.opposition = clamp(100 - G.legitimacy + (S.tax > 0.08 ? 8 : 0));
  }
  function command(c) {
    const S = C.S,
      P = S.player;
    switch (c.action) {
      case "home": {
        const d = district(c.district);
        if (!["rent", "buy"].includes(c.value))
          throw Error("임대·매입을 선택하세요");
        if (d.housing < 0.8 && c.value === "rent")
          throw Error("빈집이 부족합니다");
        energy();
        const cost = c.value === "buy" ? 180 : 20;
        pay(P, market(), cost);
        P.housing = c.value === "buy" ? 2 : 1;
        P.district = d.id;
        note(
          "주거 계약",
          `${d.name} ${c.value === "buy" ? "자가" : "임대"} · ${cost}원. 주거 지출이 바뀝니다.`,
        );
        return true;
      }
      case "housing":
        if (!P.office) throw Error("공공 주거 예산 권한이 없습니다");
        district(c.district);
        plan("housing", c.district, 160, 10, "공공 주택 3채");
        return true;
      case "transport": {
        if (!P.office) throw Error("도로망 예산 집행 권한이 없습니다");
        const r = S.routes.find((r) => r.id === c.id);
        if (!r || r.level >= 3) throw Error("확장할 운송 경로가 없습니다");
        plan("transport", r.id, 120, 8, "지역 간 도로 확장");
        return true;
      }
      case "loan": {
        if (S.loans.some((l) => ["active", "default"].includes(l.status)))
          throw Error("기존 대출을 먼저 상환하세요");
        energy();
        pay(market(), P, 100);
        S.loans.push({
          id: S.next++,
          balance: 110,
          principal: 100,
          due: S.day + 30,
          status: "active",
        });
        note(
          "재기 자금 대출",
          "100원을 빌렸습니다. 30일 뒤 110원 상환. 미상환 시 신뢰 하락.",
        );
        return true;
      }
      case "repay": {
        const l = S.loans.find(
          (l) => l.id === c.id && ["active", "default"].includes(l.status),
        );
        if (!l) throw Error("상환할 대출이 없습니다");
        energy();
        pay(P, market(), l.balance);
        l.balance = 0;
        l.status = "paid";
        return true;
      }
      default:
        return false;
    }
  }
  function complete(p) {
    if (p.type === "housing") {
      district(p.target).homes += 3;
      return true;
    }
    if (p.type === "transport") {
      Sroute(p.target).level++;
      return true;
    }
    return false;
  }
  function Sroute(id) {
    return C.S.routes.find((r) => r.id === id);
  }
  return { path, beforeTick, support, command, complete };
};
