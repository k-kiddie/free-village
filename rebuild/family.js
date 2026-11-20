"use strict";
module.exports = function family(C) {
  const { energy, pay, market, note, person } = C;
  function eligible(e) {
    const S = C.S;
    return e.kind === "inheritance"
      ? !!S.family.dispute
      : e.kind === "death"
        ? S.family.members.some((m) => m.kind === "head" && !m.alive)
        : false;
  }
  function command(c) {
    const S = C.S,
      F = S.family,
      P = S.player;
    switch (c.action) {
      case "marry": {
        const p = person(c.person),
          head = F.members.find((m) => m.kind === "head");
        if (F.spouse || !p.alive || p.age < 18 || head.age < 18)
          throw Error("혼인 가능한 성인이 아닙니다");
        if (p.relation < 15)
          throw Error("관계 15 이상이어야 혼인에 동의합니다");
        energy();
        pay(P, market(), 30);
        F.spouse = p.id;
        head.spouse = p.id;
        F.members.push({
          id: "spouse-" + p.id,
          name: p.name,
          age: p.age,
          skill: p.skill,
          alive: true,
          kind: "spouse",
          relation: p.relation,
          cash: 0,
        });
        p.memory.push({ day: S.day, text: "혼인으로 가문 동맹 체결" });
        note(
          "가문 혼인",
          `${p.name}과 혼인했습니다. 서로의 관계와 약속이 세대 간 의무로 남습니다.`,
        );
        return true;
      }
      case "child": {
        if (!F.spouse) throw Error("혼인 후 자녀 계획을 세울 수 있습니다");
        if (F.members.filter((m) => m.kind === "child" && m.alive).length >= 4)
          throw Error("자녀 양육 여력이 부족합니다");
        C.plan("child", F.spouse, 40, 12, "출산·양육 준비");
        return true;
      }
      case "adopt": {
        energy();
        pay(P, market(), 40);
        F.members.push({
          id: "relative-" + S.next++,
          name: "입양 후계자",
          parents: [F.members.find((m) => m.kind === "head").id],
          kind: "child",
          age: 14,
          skill: 1,
          alive: true,
          relation: 65,
          cash: 0,
        });
        note(
          "후계자 입양",
          "새 가족이 생겼습니다. 성년까지 교육과 생활을 돌봐야 합니다.",
        );
        return true;
      }
      case "heir": {
        const m = F.members.find(
          (m) => m.id === c.value && m.alive && m.kind === "child",
        );
        if (!m) throw Error("살아 있는 자녀 중에서 후계자를 선택하세요");
        energy();
        F.heir = m.id;
        for (const child of F.members.filter(
          (m) => m.kind === "child" && m.id !== c.value,
        ))
          child.relation -= 2;
        note(
          "후계자 지정",
          `${m.name}을 후계자로 정했습니다. 유언의 분배 방식에 따라 다른 자녀가 반발할 수 있습니다.`,
        );
        return true;
      }
      case "will": {
        if (!["equal", "primogeniture"].includes(c.value))
          throw Error("균등 분배 또는 장자 우선만 가능합니다");
        energy();
        F.will = c.value;
        return true;
      }
      case "educate": {
        const m = F.members.find(
          (m) => m.id === (c.value || F.heir) && m.alive,
        );
        if (!m || m.kind !== "child") throw Error("교육할 자녀가 없습니다");
        C.plan("educate", m.id, 45, 12, `${m.name} 후계자 교육`);
        return true;
      }
      case "succession": {
        if (P.office || P.candidate)
          throw Error("공직과 출마를 마치고 계승하세요");
        if (S.plans.some((p) => p.status === "active"))
          throw Error("진행 계획을 마무리하거나 취소하세요");
        if (S.day - F.lastSuccession < 120)
          throw Error("한 세대는 최소 120일입니다");
        energy();
        succeed(c.value);
        return true;
      }
      default:
        return false;
    }
  }
  function succeed(id, death = false) {
    const S = C.S,
      F = S.family,
      P = S.player;
    const heir = F.members.find(
      (m) => m.id === (id || F.heir) && m.alive && m.kind === "child",
    );
    if (!heir || heir.age < 18)
      throw Error("성년인 후계자를 지정하거나 입양·교육하세요");
    const children = F.members.filter((m) => m.kind === "child" && m.alive),
      head = F.members.find((m) => m.kind === "head");
    const estate = P.cash,
      share =
        F.will === "equal"
          ? 1 / children.length
          : 0.15 / Math.max(1, children.length - 1);
    for (const m of children) if (m !== heir) pay(P, m, estate * share);
    head.kind = "ancestor";
    head.alive = !death && head.alive;
    heir.kind = "head";
    pay(heir, P, heir.cash || 0);
    for (const m of children) if (m !== heir) m.kind = "relative";
    for (const m of F.members) if (m.kind === "spouse") m.kind = "ancestor";
    F.spouse = heir.spouse || null;
    P.generation++;
    P.skill = heir.skill;
    P.trust *= 0.7;
    P.organization = Math.floor(P.organization * 0.7);
    P.housing = Math.max(1, P.housing);
    F.lastSuccession = S.day;
    F.legacy++;
    for (const p of S.people) {
      p.relation *= 0.6;
      p.memory.push({ day: S.day, text: `${heir.name}에게 가문 계승` });
    }
    const other = children.find((m) => m !== heir);
    F.heir =
      F.members.find(
        (m) => m.kind === "child" && m.alive && m.parents?.includes(heir.id),
      )?.id || null;
    if (F.will === "primogeniture" && other) {
      F.dispute = {
        claimant: other.id,
        amount: Math.min(P.cash * 0.2, 50),
        created: S.day,
      };
      S.events.push({
        id: S.next++,
        kind: "inheritance",
        title: "상속 분쟁",
        person: other.id,
        text: `${other.name}이 불균등한 분배에 이의를 제기했습니다. 가족 관계와 재산을 어떻게 조정할까요?`,
      });
    }
    note(
      "가문 계승",
      `${P.generation}대 ${heir.name}. 사업·주거·권리·약속은 이어지고 개인 신뢰는 일부 새로 쌓습니다.`,
    );
  }
  function choose(e, value) {
    const S = C.S,
      F = S.family,
      P = S.player;
    if (e.kind === "inheritance") {
      const claimant = F.members.find((m) => m.id === F.dispute.claimant);
      if (value === "settle") {
        pay(P, claimant, F.dispute.amount);
        claimant.relation += 15;
        note(
          "상속 합의",
          `${claimant.name}에게 ${F.dispute.amount.toFixed(0)}원을 지급해 권리 포기에 합의했습니다.`,
        );
      } else if (value === "mediate") {
        pay(P, market(), 20);
        claimant.relation += 5;
        F.legacy = Math.max(0, F.legacy - 1);
        note(
          "가문 조정",
          "중재 비용 20원을 지급했습니다. 명성 일부를 양보하고 분쟁을 끝냈습니다.",
        );
      } else if (value === "refuse") {
        claimant.relation -= 30;
        P.trust = Math.max(0, P.trust - 5);
        note(
          "가문 불화",
          "상속 요구를 거부했습니다. 가족의 신뢰와 대외 평판이 하락했습니다.",
        );
      } else throw Error("상속 선택이 올바르지 않습니다");
      F.dispute = null;
      return true;
    }
    if (e.kind === "death") {
      if (value === "adopt" || value === "guardian") {
        if (value === "adopt") pay(P, market(), 40);
        else F.legacy = Math.max(0, F.legacy - 1);
        F.members.push({
          id: "relative-" + S.next++,
          name: "가문 대표",
          parents: [F.members.find((m) => m.kind === "head").id],
          kind: "child",
          age: 18,
          skill: 1,
          alive: true,
          relation: 50,
          cash: 0,
        });
        F.heir = F.members.at(-1).id;
        succeed(null, true);
      } else {
        const id = value.startsWith("heir:") ? value.slice(5) : F.heir;
        succeed(id, true);
      }
      return true;
    }
    return false;
  }
  function tick() {
    const S = C.S,
      F = S.family,
      P = S.player;
    for (const m of F.members) {
      m.cash ??= 0;
      if (m.alive && S.day % 30 === 0) m.age++;
    }
    for (const m of F.members.filter((m) => m.kind === "child" && m.alive)) {
      const cost = Math.min(P.cash, 0.15);
      pay(P, market(), cost);
      if (cost < 0.15) m.relation = Math.max(0, m.relation - 0.2);
    }
    const head = F.members.find((m) => m.kind === "head");
    if (head?.alive && head.age >= 70) {
      head.alive = false;
      P.office = false;
      P.candidate = false;
      S.events.push({
        id: S.next++,
        kind: "death",
        title: "가장의 죽음",
        text: `${head.name}이 세상을 떠났습니다. 성년 후계자를 정해 가문을 이어가세요. 준비된 후계자가 없으면 친족을 대표로 맞을 수 있습니다.`,
      });
    }
    if (F.spouse && S.day % 30 === 0) {
      const p = person(F.spouse);
      if (p.relation < 0) F.legacy = Math.max(0, F.legacy - 1);
    }
    P.heirSkill = F.members.find((m) => m.id === F.heir)?.skill || 1;
  }
  function complete(p) {
    const S = C.S,
      F = S.family;
    if (p.type === "educate") {
      const m = F.members.find((m) => m.id === p.target && m.alive);
      if (m) {
        m.skill += 1;
        m.relation += 4;
        S.player.heirSkill = m.skill;
      } else {
        p.status = "failed";
        p.reason = "교육 대상이 없습니다";
      }
      return true;
    }
    if (p.type === "child") {
      F.members.push({
        id: "child-" + S.next++,
        name:
          "자녀 " + (F.members.filter((m) => m.kind === "child").length + 1),
        age: 0,
        parents: [
          F.members.find((m) => m.kind === "head").id,
          "spouse-" + F.spouse,
        ],
        kind: "child",
        skill: 1,
        alive: true,
        relation: 70,
        cash: 0,
      });
      F.heir ||= F.members.at(-1).id;
      return true;
    }
    return false;
  }
  return { command, eligible, choose, tick, complete, succeed };
};
