"use strict";
module.exports = function story(C) {
  const { person, energy, pay, market, note } = C;
  const remember = (p, text) => {
    p.memory.push({ day: C.S.day, text });
    p.memory = p.memory.slice(-12);
  };
  function eligible(e) {
    const S = C.S,
      P = S.player,
      p = S.people.find((p) => p.id === e.person);
    if (e.kind === "patron")
      return (
        !P.office &&
        p?.alive &&
        S.firms.some(
          (f) => f.id === e.firm && f.owner === "player" && f.level >= 2,
        )
      );
    if (e.kind === "procurement")
      return (
        P.office &&
        p?.alive &&
        S.promises.some(
          (x) =>
            x.kind === "exclusive" &&
            x.person === p.id &&
            x.status === "active",
        )
      );
    if (e.kind === "worker")
      return (
        p?.alive &&
        p.job === e.firm &&
        S.firms.some((f) => f.id === e.firm && f.owner === "player")
      );
    if (e.kind === "appointment")
      return P.office && p?.alive && !p.job && !p.position;
    if (e.kind === "crafted")
      return (
        !P.office &&
        !P.candidate &&
        p?.alive &&
        S.firms.some(
          (f) => f.id === e.firm && f.owner === "player" && f.good === "tools",
        )
      );
    return C.systems.family.eligible(e);
  }
  function command(c) {
    const S = C.S,
      P = S.player;
    switch (c.action) {
      case "talk": {
        const p = person(c.person);
        if (!p.alive) throw Error("대화할 인물이 없습니다");
        energy();
        const own = S.firms.find((f) => f.id === p.job && f.owner === "player");
        const topic = c.value || "listen";
        if (topic === "listen") {
          p.relation += 4;
          remember(p, `면담: ${p.goal}을 존중`);
          note(
            `${p.name}과 대화`,
            `${p.goal}. ${p.job ? "고용 안정과 약속을 중요하게 여깁니다." : "일자리·주거 기회를 찾고 있습니다."} 야심 ${Math.round(p.ambition * 100)}, 숙련 ${p.skill.toFixed(1)}.`,
          );
        } else if (topic === "train") {
          if (!own) throw Error("직원에게만 교육을 제공할 수 있습니다");
          pay(own, market(), 15);
          p.skill = Math.min(10, p.skill + 0.5);
          p.relation += 4;
          remember(p, "고용주의 숙련 교육 약속 이행");
        } else if (topic === "sponsor") {
          pay(P, p, 20);
          p.relation += 3;
          remember(p, "개인 후원 20원 수령");
          note(
            "개인 후원",
            "상대의 생계를 지원했습니다. 정치 지지율은 돈으로 직접 올리지 않습니다.",
          );
        } else throw Error("대화 주제를 선택하세요");
        return true;
      }
      default:
        return false;
    }
  }
  function choose(e, value) {
    const S = C.S,
      P = S.player,
      p = S.people.find((p) => p.id === e.person);
    if (C.systems.family.choose(e, value)) return true;
    if (!eligible(e))
      throw Error("역할·권한·관계가 바뀌어 제안이 유효하지 않습니다");
    if (e.kind === "patron") {
      if (value === "accept") {
        S.promises.push({
          id: S.next++,
          kind: "exclusive",
          person: p.id,
          firm: e.firm,
          due: S.day + 60,
          status: "active",
        });
        P.organization++;
        p.relation += 10;
        remember(p, "선거 지원과 독점 납품을 서로 약속");
      } else if (value === "counter") {
        pay(P, market(), 20);
        P.organization += 0.5;
        p.relation += 3;
        remember(p, "독점 없는 공개 후원으로 역제안 수락");
      } else if (value !== "decline") throw Error("선택이 올바르지 않습니다");
      return true;
    }
    if (e.kind === "procurement") {
      const promise = S.promises.find(
        (x) =>
          x.kind === "exclusive" && x.person === p.id && x.status === "active",
      );
      if (value === "disclose") {
        promise.status = "broken";
        p.relation -= 10;
        P.trust = Math.min(100, P.trust + 4);
        remember(p, "당선 후 이해충돌 공개 및 독점 약속 철회");
        note(
          "공개 조달",
          "독점 약속을 공개하고 계약에서 제외했습니다. 후원자의 관계는 나빠졌지만 공공 신뢰를 지켰습니다.",
        );
      } else if (value === "recuse") {
        pay(P, p, 30);
        promise.status = "settled";
        p.relation += 3;
        remember(p, "개인 자금 30원으로 계약 포기 합의");
        note(
          "이해충돌 해소",
          "개인 자금으로 후원 약속을 정리하고 공공 조달에서 물러났습니다. 국고는 사용하지 않았습니다.",
        );
      } else if (value === "favor") {
        if (S.treasury < 40) throw Error("국고가 부족합니다");
        pay(C.treasury(), p, 40);
        promise.status = "kept";
        S.government.legitimacy = Math.max(0, S.government.legitimacy - 15);
        P.trust = Math.max(0, P.trust - 12);
        S.government.opposition = Math.min(100, S.government.opposition + 15);
        remember(p, "특혜 조달로 약속 이행, 반대 세력의 조사 시작");
        note(
          "특혜의 대가",
          "국고 40원이 후원자에게 지급됐습니다. 공공 신뢰와 정당성이 하락하고 다음 선거의 반발로 남습니다.",
        );
      } else throw Error("선택이 올바르지 않습니다");
      return true;
    }
    if (e.kind === "worker") {
      const f = C.firm(e.firm);
      if (value === "raise") {
        f.wage = Math.max(f.wage, 7);
        p.loyalty = Math.min(100, p.loyalty + 10);
        remember(p, "임금 인상에 합의");
      } else if (value === "training") {
        pay(f, market(), 15);
        p.skill += 0.5;
        p.loyalty += 5;
        remember(p, "임금 대신 교육으로 역제안 수락");
      } else if (value === "decline") {
        p.loyalty -= 8;
        remember(p, "임금 협상 거절");
      } else throw Error("선택이 올바르지 않습니다");
      return true;
    }
    if (e.kind === "appointment") {
      if (value === "accept") {
        S.government.ministers.administration = p.id;
        p.position = "administration";
        p.salary = 3;
        remember(p, "행정 책임자 제안 수락");
      } else if (value === "counter") {
        if (p.relation < 10)
          throw Error("무보수 협상에는 관계 10이 필요합니다");
        S.government.ministers.administration = p.id;
        p.position = "administration";
        p.salary = 0;
        remember(p, "무보수 봉사로 역제안 합의");
      } else if (value !== "decline") throw Error("선택이 올바르지 않습니다");
      return true;
    }
    if (e.kind === "crafted") {
      const f = C.firm(e.firm);
      if (value === "accept") {
        C.plan("craft", f.id, 20, 6, "맞춤 공구 제작");
        Object.assign(S.plans.at(-1), {
          buyer: p.id,
          price: 60,
          risk: "완료 시 구매자 자금이 부족하면 납품 실패",
        });
      } else if (value !== "decline") throw Error("선택이 올바르지 않습니다");
      return true;
    }
    return false;
  }
  function tick() {
    const S = C.S,
      P = S.player;
    for (const p of S.people) {
      p.memory = p.memory.slice(-12);
    }
    if (S.day % 10 === 0) {
      const f = S.firms.find(
          (f) => f.owner === "player" && f.level >= 2 && !f.patronAsked,
        ),
        p = S.people.find((p) => p.group === "merchants" && p.cash >= 40);
      if (f && p && !P.office) {
        f.patronAsked = true;
        S.events.push({
          id: S.next++,
          kind: "patron",
          person: p.id,
          firm: f.id,
          title: "지역 출마를 돕겠다는 상인",
          text: `${p.name}: 고용을 늘린 당신을 돕겠습니다. 대신 당선되면 독점 납품을 약속해 주세요. 수락은 조직 +1, 역제안은 개인 20원·조직 +0.5, 거절은 비용 없음.`,
        });
      }
    }
    for (const x of S.promises.filter(
      (x) => x.kind === "exclusive" && x.status === "active",
    )) {
      if (P.office && !x.asked) {
        x.asked = true;
        S.events.push({
          id: S.next++,
          kind: "procurement",
          person: x.person,
          firm: x.firm,
          title: "후원 약속과 공공 조달",
          text: "당선 전 독점 납품 약속이 돌아왔습니다. 공개 철회는 관계 −10·신뢰 +4, 개인 합의는 개인 30원, 특혜 집행은 국고 40원·신뢰 −12·정당성 −15입니다.",
        });
      } else if (S.day > x.due && !P.office) {
        x.status = "expired";
        person(x.person).relation -= 3;
      }
    }
    if (S.day % 23 === 0) {
      const f = S.firms.find(
        (f) =>
          f.owner === "player" &&
          f.workers.some((id) => person(id).loyalty < 45),
      );
      if (f) {
        const p = person(f.workers.find((id) => person(id).loyalty < 45));
        S.events.push({
          id: S.next++,
          kind: "worker",
          firm: f.id,
          person: p.id,
          title: "직원의 임금 협상",
          text: `${p.name}: 더 안정적인 대우를 원합니다. 임금 7원 이상으로 인상하거나 사업 자금 15원으로 교육을 제안할 수 있습니다. 거절하면 충성도가 8 내려갑니다.`,
        });
      }
    }
    if (
      P.office &&
      !S.government.ministers.administration &&
      S.day % 13 === 0
    ) {
      const p = S.people.find((p) => !p.job && !p.position && p.relation >= 5);
      if (p)
        S.events.push({
          id: S.next++,
          kind: "appointment",
          person: p.id,
          title: "행정 책임자 제안",
          text: `${p.name}: 행정을 맡겠습니다. 수락 시 국고에서 일급 3원, 관계 10 이상이면 무보수로 역제안할 수 있습니다.`,
        });
    }
    if (!P.office && !P.candidate && S.day % 29 === 0) {
      const f = S.firms.find((f) => f.owner === "player" && f.good === "tools"),
        p = S.people.find((p) => p.cash >= 60);
      if (f && p)
        S.events.push({
          id: S.next++,
          kind: "crafted",
          firm: f.id,
          person: p.id,
          title: "맞춤 공구 의뢰",
          text: "직접 제작 사업을 하는 사람에게만 온 의뢰입니다. 개인 준비비 20원·6일. 구매자가 대금 60원을 유지하면 완료 후 지급됩니다.",
        });
    }
    S.events = S.events
      .filter((e, i, a) => eligible(e) || e.kind === "contract")
      .filter(
        (e, i, a) =>
          a.findIndex((x) => x.kind === e.kind && x.person === e.person) === i,
      );
  }
  function complete(p) {
    if (p.type !== "craft") return false;
    const S = C.S,
      f = S.firms.find((f) => f.id === p.target && f.owner === "player");
    const buyer = S.people.find((x) => x.id === p.buyer);
    if (
      !f ||
      S.player.office ||
      S.player.candidate ||
      f.good !== "tools" ||
      !buyer ||
      buyer.cash < p.price
    ) {
      p.status = "failed";
      p.reason = "역할·사업·구매자 자금 조건이 바뀌었습니다";
      return true;
    }
    pay(buyer, f, p.price);
    buyer.relation += 8;
    remember(buyer, "맞춤 공구 의뢰 이행");
    return true;
  }
  function options(e) {
    const S = C.S,
      P = S.player;
    const opt = (
      value,
      label,
      cost = 0,
      account = "none",
      reason = "",
      effect = "",
    ) => ({ value, label, cost, account, reason, effect, available: !reason });
    if (e.kind === "contract")
      return [
        opt(
          "accept",
          "20개 계약",
          0,
          "none",
          "",
          "8일 내 20개 × 7원, 미이행 신뢰 −6",
        ),
        opt("counter", "12개로 역제안", 0, "none", "", "8일 내 12개 × 5원"),
        opt("decline", "거절"),
      ];
    if (e.kind === "inheritance") {
      const amount = S.family.dispute.amount;
      return [
        opt(
          "settle",
          "요구를 수용",
          amount,
          "personal",
          P.cash < amount ? "개인 자금 부족" : "",
        ),
        opt(
          "mediate",
          "중재",
          20,
          "personal",
          P.cash < 20 ? "개인 자금 부족" : "",
        ),
        opt("refuse", "거절", 0, "none", "", "관계 −30, 신뢰 −5"),
      ];
    }
    if (e.kind === "death")
      return [
        ...S.family.members
          .filter((m) => m.kind === "child" && m.alive && m.age >= 18)
          .map((m) => opt("heir:" + m.id, m.name + "에게 계승")),
        opt("guardian", "친족에게 섭정 위임", 0, "none", "", "가문 명성 −1"),
        opt(
          "adopt",
          "친족 대표 영입",
          40,
          "personal",
          P.cash < 40 ? "개인 자금 부족" : "",
        ),
      ];
    if (e.kind === "procurement")
      return [
        opt("disclose", "공개 철회"),
        opt(
          "recuse",
          "개인 합의",
          30,
          "personal",
          P.cash < 30 ? "개인 자금 부족" : "",
        ),
        opt(
          "favor",
          "특혜 조달",
          40,
          "public",
          S.treasury < 40 ? "국고 부족" : "",
          "신뢰 −12, 정당성 −15",
        ),
      ];
    if (e.kind === "patron")
      return [
        opt("accept", "독점 약속 수락"),
        opt(
          "counter",
          "공개 후원 역제안",
          20,
          "personal",
          P.cash < 20 ? "개인 자금 부족" : "",
        ),
        opt("decline", "거절"),
      ];
    if (e.kind === "worker") {
      const f = S.firms.find((f) => f.id === e.firm);
      return [
        opt("raise", "일급 7원 이상 약속"),
        opt(
          "training",
          "교육 역제안",
          15,
          "business",
          f?.cash < 15 ? "사업 자금 부족" : "",
        ),
        opt("decline", "거절"),
      ];
    }
    if (e.kind === "appointment")
      return [
        opt("accept", "임명 · 국고 일급 3원"),
        opt(
          "counter",
          "무보수 역제안",
          0,
          "none",
          person(e.person).relation < 10 ? "관계 10 필요" : "",
        ),
        opt("decline", "사양"),
      ];
    if (e.kind === "crafted")
      return [
        opt(
          "accept",
          "6일 제작",
          20,
          "personal",
          P.cash < 20 ? "개인 자금 부족" : "",
        ),
        opt("decline", "사양"),
      ];
    return [];
  }
  return { command, eligible, choose, tick, complete, options };
};
