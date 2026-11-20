"use strict";
const REGIMES = {
  republic: "주민 공화정",
  council: "의회 내각제",
  monarchy: "입헌 군주정",
};
const ECONOMIES = {
  market: "시장 경제",
  cooperative: "협동 경제",
  public: "공공 소유 경제",
};
const clamp = (n) => Math.max(0, Math.min(100, n));
module.exports = function politics(C) {
  const { person, district, energy, pay, market, treasury, note, plan } = C;
  const average = (key) =>
    C.S.districts.reduce((n, d) => n + d[key], 0) / C.S.districts.length;
  function councilSupport() {
    const S = C.S;
    return (
      S.government.council.filter(
        (x) => x.party === S.player.party || x.party === S.player.coalition,
      ).length / Math.max(1, S.government.council.length)
    );
  }
  function readiness() {
    const G = C.S.government;
    return {
      people: average("support"),
      council: councilSupport() * 100,
      administration: G.administration,
      army: G.army,
      legitimacy: G.legitimacy,
      organization: C.S.player.organization * 10,
    };
  }
  function propose(kind, target, method = "legal") {
    const S = C.S,
      P = S.player,
      G = S.government;
    if (
      !["constitution", "economy"].includes(kind) ||
      (kind === "constitution" && !Object.hasOwn(REGIMES, target)) ||
      (kind === "economy" && !Object.hasOwn(ECONOMIES, target))
    )
      throw Error("존재하지 않는 제도입니다");
    if (!["legal", "movement"].includes(method))
      throw Error("의회 협상 또는 사회운동으로 진행하세요");
    if (method === "legal" && !P.office)
      throw Error("정부의 개헌 제안 권한이 없습니다");
    if (method === "movement" && P.organization < 2)
      throw Error("사회운동에 최소 두 곳의 조직이 필요합니다");
    if (target === (kind === "constitution" ? G.regime : G.economy))
      throw Error("이미 시행 중인 제도입니다");
    const title =
      kind === "constitution"
        ? `${REGIMES[target]} 개헌`
        : `${ECONOMIES[target]} 소유 개혁`;
    plan("reform", kind, method === "legal" ? 90 : 60, 15, title);
    Object.assign(S.plans.at(-1), {
      reformKind: kind,
      reformTarget: target,
      method,
      threshold: method === "legal" ? 60 : 65,
      risk: "의회·주민 지지가 모자라면 부결되며 준비 비용은 반환되지 않습니다.",
    });
    note(
      "제도 개편 준비",
      `${title}: 15일간 의회 협상·조직·행정 지지를 확보해야 합니다. 즉시 지도자가 되지 않습니다.`,
    );
  }
  function command(c) {
    const S = C.S,
      P = S.player,
      G = S.government;
    switch (c.action) {
      case "party": {
        const party = S.parties.find((p) => p.id === c.value);
        if (!party) throw Error("존재하지 않는 정당입니다");
        energy();
        P.party = party.id;
        note(
          "정당 활동",
          `${party.name}과 함께 ${party.platform === "food" ? "식량" : party.platform === "jobs" ? "일자리" : "교육"} 의제를 추진합니다.`,
        );
        return true;
      }
      case "recruit": {
        const p = person(c.person);
        if (p.position || p.relation < 10)
          throw Error("관계 10 이상인 공직 없는 인물을 영입할 수 있습니다");
        if (!P.party) throw Error("먼저 정당에 가입하세요");
        energy();
        p.party = P.party;
        p.memory.push({ day: S.day, text: "지역 조직 영입에 동의" });
        P.contacts = [...new Set([...P.contacts, p.id])];
        P.organization += 0.2;
        return true;
      }
      case "debate": {
        if (!P.candidate && !P.party)
          throw Error("정당 활동이나 출마 후 토론할 수 있습니다");
        energy(2);
        P.speech = clamp(P.speech + 2 + P.skill);
        for (const p of S.people)
          if (p.group === "residents" || p.values > 0.5)
            p.support = clamp(p.support + P.skill * 0.5);
        note(
          "공개 토론",
          "공약의 실행 가능성을 설명했습니다. 말의 효과는 생활 성과 평가와 함께 감소합니다.",
        );
        return true;
      }
      case "rally": {
        district(c.district);
        energy(2);
        if (!P.party) throw Error("정당 조직이 필요합니다");
        pay(P, market(), 15);
        for (const p of S.people.filter(
          (p) => p.district === c.district && p.party === P.party,
        ))
          p.participant = true;
        note(
          "지역 연설",
          "행사 비용 15원은 장소 운영비입니다. 같은 정당 주민의 투표 참여가 높아집니다.",
        );
        return true;
      }
      case "coalition": {
        const party = S.parties.find((p) => p.id === c.value);
        if (!P.party || !party || party.id === P.party)
          throw Error("다른 정당과 협상하세요");
        if (G.council.length === 0)
          throw Error("첫 선거 이후 연대할 수 있습니다");
        energy();
        const relation =
          S.people
            .filter((p) => p.party === party.id)
            .reduce((n, p) => n + p.relation, 0) /
          Math.max(1, S.people.filter((p) => p.party === party.id).length);
        const match = party.platform === P.platform;
        if (!match && relation < 5)
          throw Error("공약이 다르면 해당 정당 인물들과 관계를 먼저 쌓으세요");
        P.coalition = party.id;
        S.promises.push({
          id: S.next++,
          kind: "coalition",
          party: party.id,
          platform: party.platform,
          due: S.election,
          status: "active",
        });
        note(
          "정당 연대",
          `${party.name}이 의회 협력에 합의했습니다. 다음 선거까지 공약 성과를 요구합니다.`,
        );
        return true;
      }
      case "appoint": {
        if (!P.office) throw Error("임명 권한이 없습니다");
        if (!["administration", "army"].includes(c.value))
          throw Error("행정·치안 담당자를 고르세요");
        const p = person(c.person);
        if (p.job || p.position)
          throw Error("겸직 중인 인물은 임명할 수 없습니다");
        if (p.relation < 5) throw Error("면담을 통해 관계를 쌓으세요");
        energy();
        const old = G.ministers[c.value];
        if (old) {
          person(old).position = null;
          person(old).salary = 0;
        }
        G.ministers[c.value] = p.id;
        p.position = c.value;
        p.salary = 3;
        p.memory.push({
          day: S.day,
          text: `${c.value === "army" ? "치안" : "행정"} 책임자 임명`,
        });
        return true;
      }
      case "bill": {
        if (!P.party) throw Error("정당에서 정책안을 발의하세요");
        if (!["tax", "welfare", "wage"].includes(c.kind))
          throw Error("세금·구호·최저임금만 발의 가능합니다");
        const values = {
          tax: [0.04, 0.08, 0.12],
          welfare: [0, 1, 2],
          wage: [5, 7, 9],
        };
        if (!values[c.kind].includes(c.value))
          throw Error("정책 값이 올바르지 않습니다");
        if (G.bills.some((b) => b.status === "debate" && b.kind === c.kind))
          throw Error("같은 정책을 심의 중입니다");
        energy();
        G.bills.push({
          id: S.next++,
          kind: c.kind,
          value: c.value,
          due: S.day + 5,
          status: "debate",
          sponsor: P.party,
        });
        note("의회 심의", "5일 뒤 표결. 연대와 집단별 이해가 표에 반영됩니다.");
        return true;
      }
      case "reform":
        propose(c.kind, c.value, c.method);
        return true;
      case "oversight": {
        energy(2);
        const bad = G.bills.filter(
          (b) =>
            b.status === "passed" && b.kind === "welfare" && S.treasury < 20,
        ).length;
        if (bad) {
          P.trust = clamp(P.trust + 3);
          G.legitimacy = clamp(G.legitimacy - 3);
        } else P.trust = clamp(P.trust + 1);
        note(
          "정책 감시",
          bad
            ? "구호 재정 부족을 공개했습니다."
            : "예산 집행 자료를 공개했습니다. 기록과 생활 성과로 다음 선거를 준비합니다.",
        );
        return true;
      }
      default:
        return false;
    }
  }
  function elect() {
    const S = C.S,
      P = S.player,
      G = S.government;
    const turnout = { player: 0, rival: 0, abstain: 0 },
      byGroup = {};
    const partyPower = Object.fromEntries(
      S.parties.map((p) => [p.id, p.power]),
    );
    for (const p of S.people.filter((p) => p.alive)) {
      const d = district(p.district);
      let support = p.support;
      if (P.platform === "jobs") support += p.job ? 5 : -3;
      if (P.platform === "food") support += (d.food - 0.5) * 12;
      if (P.platform === "education") support += d.school * 3;
      if (p.party === P.party) support += 6;
      if (p.party === P.coalition) support += 3;
      const rival =
        42 + (partyPower[p.party] || 30) * 0.15 + (p.values > 0.6 ? 3 : 0);
      const participating =
        p.participant || C.random() < 0.6 + (p.cash < 10 ? -0.12 : 0.12);
      const vote = !participating
        ? "abstain"
        : P.candidate && support > rival
          ? "player"
          : "rival";
      turnout[vote]++;
      byGroup[p.group] ||= { player: 0, rival: 0, abstain: 0 };
      byGroup[p.group][vote]++;
    }
    let won = P.candidate && turnout.player > turnout.rival;
    P.speech *= 0.5;
    G.council = [];
    for (const d of S.districts) {
      const residents = S.people.filter((p) => p.district === d.id && p.alive);
      const sorted = S.parties
        .map((party) => ({
          party: party.id,
          weight:
            residents.filter((p) => p.party === party.id).length +
            (party.id === P.party && P.candidate ? turnout.player * 0.1 : 0),
        }))
        .sort((a, b) => b.weight - a.weight);
      for (let seat = 0; seat < 3; seat++) {
        const party = sorted[seat === 0 ? 0 : seat === 1 ? 1 : 0].party;
        const delegate = residents.find(
          (p) => p.party === party && !G.council.some((x) => x.person === p.id),
        );
        G.council.push({ district: d.id, party, person: delegate?.id || null });
      }
    }
    if (G.regime !== "republic")
      won =
        P.candidate &&
        G.council.filter((m) => m.party === P.party || m.party === P.coalition)
          .length >
          G.council.length / 2;
    P.office = won;
    P.candidate = false;
    if (G.regime === "monarchy")
      G.crown ||= {
        name: "주민이 승인한 왕실",
        powers: "상징·헌법 수호",
        executive: false,
      };
    else delete G.crown;
    const votes = turnout.player + turnout.rival;
    S.history.push({
      day: S.day,
      score: votes ? (turnout.player / votes) * 100 : 0,
      rival: votes ? (turnout.rival / votes) * 100 : 0,
      won,
      turnout,
      byGroup,
    });
    S.history = S.history.slice(-20);
    S.election += 30;
    note(
      won ? "지역 선거 당선" : "지역 선거 결과",
      `찬성 ${turnout.player} · 경쟁 후보 ${turnout.rival} · 기권 ${turnout.abstain}. ${won ? "의회 협력과 예산으로 정책을 집행합니다." : "조직·의회·감시·생활 개선을 이어갈 수 있습니다."}`,
    );
    for (const party of S.parties)
      party.power = clamp(
        party.power + (party.platform === P.platform && won ? 3 : 1),
      );
    for (const promise of S.promises.filter(
      (p) => p.kind === "coalition" && p.status === "active",
    )) {
      const result =
        promise.platform === "food"
          ? average("food") > 0.55
          : promise.platform === "education"
            ? average("school") >= 1
            : average("jobs") > 0.25;
      promise.status = result ? "kept" : "broken";
      if (!result) {
        P.coalition = null;
        P.trust = clamp(P.trust - 5);
        note(
          "연대 해체",
          "약속한 생활 성과를 내지 못해 협력 정당이 연대를 철회했습니다.",
        );
      }
    }
  }
  function tick() {
    const S = C.S,
      P = S.player,
      G = S.government;
    if (P.office) pay(treasury(), P, Math.min(S.treasury, 3));
    for (const key of ["administration", "army"]) {
      const p = S.people.find((p) => p.id === G.ministers[key] && p.alive);
      if (p) {
        const salary = Math.min(S.treasury, p.salary);
        pay(treasury(), p, salary);
        const score = p.skill * 12 + p.relation * 0.25 - p.ambition * 12;
        G[key] = clamp(G[key] + (score - G[key]) * 0.05);
        if (p.ambition > 0.8 && p.relation < 0 && S.day % 20 === 0) {
          G[key] = clamp(G[key] - 10);
          note(
            "관료의 비협조",
            `${p.name}이 약속 불이행에 반발해 행정을 지연하고 있습니다.`,
          );
        }
      }
    }
    for (const b of G.bills.filter(
      (b) => b.status === "debate" && S.day >= b.due,
    )) {
      let yes = 0;
      for (const m of G.council) {
        const party = S.parties.find((p) => p.id === m.party);
        if (
          m.party === b.sponsor ||
          m.party === P.coalition ||
          (b.kind === "welfare" && party?.id === "labor") ||
          (b.kind === "tax" && b.value === 0.04 && party?.id === "trade")
        )
          yes++;
      }
      b.votes = { yes, no: G.council.length - yes };
      b.status =
        G.council.length > 0 && yes > G.council.length / 2
          ? "passed"
          : "rejected";
      if (b.status === "passed") {
        if (b.kind === "tax") S.tax = b.value;
        else G[b.kind] = b.value;
        note(
          "정책안 가결",
          `${b.kind === "tax" ? "세율" : b.kind === "wage" ? "최저임금" : "구호"} ${b.value} · 찬성 ${yes}/${G.council.length}`,
        );
      } else
        note(
          "정책안 부결",
          `찬성 ${yes}/${G.council.length}. 연대·선거로 의회 구성을 바꿀 수 있습니다.`,
        );
    }
    G.bills = G.bills.slice(-20);
    if (G.welfare > 0) {
      const vulnerable = S.people.filter((p) => p.cash < 15);
      for (const p of vulnerable) {
        const amount = Math.min(S.treasury, G.welfare);
        if (amount) pay(treasury(), p, amount);
      }
    }
    if (S.day === S.election) elect();
  }
  function complete(p) {
    if (p.type !== "reform") return false;
    const S = C.S,
      P = S.player,
      G = S.government,
      R = readiness();
    const legal = p.method === "legal",
      passed =
        R.people >= p.threshold &&
        R.legitimacy >= 40 &&
        R.administration >= 30 &&
        (legal
          ? R.council >= (2 / 3) * 100
          : R.organization >= 20 && R.army >= 35);
    if (!passed) {
      p.status = "failed";
      p.reason = "의회·주민·행정 지지 부족";
      G.opposition = clamp(G.opposition + 5);
      note(
        "제도 개편 부결",
        `${p.title}: 주민 ${R.people.toFixed(0)}%, 의회 ${R.council.toFixed(0)}%, 행정 ${R.administration.toFixed(0)}. 조직·정당·생활 성과를 확보한 뒤 다시 시도할 수 있습니다.`,
      );
      return true;
    }
    if (p.reformKind === "constitution") {
      G.regime = p.reformTarget;
      G.constitution++;
      P.office = false;
      P.candidate = false;
      S.election = S.day + 10;
      G.council = [];
      note(
        "헌법 시행",
        `${REGIMES[G.regime]} 시행. 새 권력 배분에 따라 10일 뒤 선거를 실시합니다. 개편을 이끌었다고 자동 집권하지 않습니다.`,
      );
    } else {
      G.economy = p.reformTarget;
      for (const f of S.firms) {
        f.ownership =
          p.reformTarget === "market"
            ? "private"
            : p.reformTarget === "cooperative"
              ? "workers"
              : "public";
        if (p.reformTarget === "public" && f.owner !== "public") {
          f.previousOwner = f.owner;
          f.operator = f.owner;
          f.owner = "public";
        } else if (p.reformTarget !== "public" && f.owner === "public") {
          f.owner = f.previousOwner || "rival";
          f.previousOwner = null;
          f.operator = null;
        }
      }
      note(
        "소유 개혁 시행",
        `${ECONOMIES[G.economy]}: 공공 소유의 이익은 국고, 협동 경제의 배당은 직원, 시장 경제의 이익은 소유자에게 귀속됩니다.`,
      );
    }
    G.legitimacy = clamp(G.legitimacy - 8);
    G.opposition = clamp(G.opposition + 12);
    return true;
  }
  return {
    command,
    tick,
    elect,
    complete,
    readiness,
    councilSupport,
    REGIMES,
    ECONOMIES,
  };
};
