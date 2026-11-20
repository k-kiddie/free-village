"use strict";
// 서버 전용 전략 시뮬레이션. 모든 명령은 비용·권한·대상을 검사한 뒤 실행한다.
const { VERSION, upgrade, validate } = require("./schema");
const GOODS = { food: "식량", tools: "공구", cloth: "의복" };
const POLICIES = {
  volume: { name: "저가 대량", price: 4, output: 5 },
  quality: { name: "고품질 소량", price: 8, output: 3 },
  training: { name: "숙련 투자", price: 6, output: 3 },
};
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
function createGame(seed = 20261120, saved, options = {}) {
  let S;
  function random() {
    S.rng = (Math.imul(S.rng, 1664525) + 1013904223) >>> 0;
    return S.rng / 4294967296;
  }
  if (saved) {
    if (
      ![1, VERSION].includes(saved.version) ||
      !saved.state?.people ||
      !saved.state?.districts
    )
      throw Error("지원하지 않는 리빌드 저장입니다. 기존 파일을 보존했습니다.");
    S = structuredClone(saved.state);
  } else {
    S = {
      rng: seed >>> 0,
      seed,
      day: 0,
      revision: 0,
      people: [],
      districts: [],
      sites: [],
      firms: [],
      plans: [],
      notes: [],
      promises: [],
      events: [],
      treasury: 600,
      market: 5000,
      player: {
        cash: 420,
        energy: 3,
        skill: 1,
        trust: 35,
        office: false,
        candidate: false,
        platform: "jobs",
        organization: 0,
        generation: 1,
        heirSkill: 1,
      },
      next: 1,
      election: 30,
      tax: 0.08,
      goal: "사업 기반 만들기",
      history: [],
    };
    ["들녘", "시장거리", "강변"].forEach((name, id) =>
      S.districts.push({
        id,
        name,
        road: id === 1 ? 2 : 0,
        school: 0,
        support: 30,
        food: 0,
        jobs: 0,
        needs: { food: 20, tools: 5, cloth: 5 },
      }),
    );
    const names = [
      "서윤",
      "도현",
      "하린",
      "지후",
      "수빈",
      "민준",
      "지안",
      "유진",
      "시우",
      "다은",
    ];
    for (let i = 0; i < 60; i++)
      S.people.push({
        id: i + 1,
        name: names[i % 10] + (Math.floor(i / 10) + 1),
        district: i % 3,
        cash: 70 + Math.floor(random() * 60),
        skill: 1 + Math.floor(random() * 4),
        ambition: random(),
        loyalty: 40,
        job: null,
        relation: 0,
        age: 18 + Math.floor(random() * 35),
      });
    for (let i = 0; i < 9; i++)
      S.sites.push({
        id: i,
        district: i % 3,
        name:
          ["옛 방앗간", "골목 공방", "나루 창고"][i % 3] +
          " " +
          (Math.floor(i / 3) + 1),
        rent: 2 + (i % 3),
        setup: 75 + i * 5,
        owner: null,
      });
    for (let i = 0; i < 3; i++) {
      const f = {
        id: S.next++,
        site: i,
        owner: "rival",
        name: ["들녘 상회", "진수 공방", "나루 직물"][i],
        good: Object.keys(GOODS)[i],
        policy: "volume",
        cash: 240,
        stock: 12,
        level: 1,
        workers: [],
        supplier: "local",
        wage: 5,
        profit: 0,
        sold: 0,
        manager: null,
      };
      S.firms.push(f);
      S.sites[i].owner = f.id;
      const a = S.people[i];
      a.job = f.id;
      f.workers.push(a.id);
    }
    note(
      "새 출발",
      "빈 점포와 지역 수요를 살펴보세요. 입지·상품·운영 방침에 따라 다른 사업을 만들 수 있습니다.",
    );
  }
  function note(title, text) {
    S.notes.unshift({ day: S.day, title, text });
    S.notes = S.notes.slice(0, 50);
  }
  function person(id) {
    const p = S.people.find((p) => p.id === id);
    if (!p) throw Error("대상 주민이 없습니다");
    return p;
  }
  function site(id) {
    const s = S.sites.find((s) => s.id === id);
    if (!s) throw Error("대상 입지가 없습니다");
    return s;
  }
  function firm(id) {
    const f = S.firms.find((f) => f.id === id);
    if (
      !f ||
      (f.owner !== "player" && !(f.operator === "player" && S.player.office))
    )
      throw Error("내 사업에만 지시할 수 있습니다");
    return f;
  }
  function district(id) {
    const d = S.districts.find((d) => d.id === id);
    if (!d) throw Error("대상 지역이 없습니다");
    return d;
  }
  function pay(from, to, amount) {
    if (!Number.isFinite(amount) || amount < -1e-8 || from.cash + 1e-8 < amount)
      throw Error("자금이 부족합니다");
    amount = Math.max(0, Math.min(amount, Math.max(0, from.cash)));
    from.cash = Math.max(0, from.cash - amount);
    to.cash += amount;
  }
  const market = () => ({
    get cash() {
      return S.market;
    },
    set cash(n) {
      S.market = n;
    },
  });
  const treasury = () => ({
    get cash() {
      return S.treasury;
    },
    set cash(n) {
      S.treasury = n;
    },
  });
  function energy(n = 1) {
    if (S.player.energy < n)
      throw Error("오늘의 시간이 부족합니다. 하루를 진행하세요.");
    S.player.energy -= n;
  }
  function funds(n, account = S.player) {
    if (account.cash < n) throw Error("자금이 부족합니다");
  }
  function ownPlan(type, target) {
    return S.plans.some(
      (p) => p.type === type && p.target === target && p.status === "active",
    );
  }
  const PUBLIC_PLANS = new Set(["road", "school", "housing", "transport"]);
  function plan(type, target, cost, duration, title) {
    if (ownPlan(type, target)) throw Error("이미 진행 중인 계획입니다");
    if (S.plans.filter((p) => p.status === "active").length >= 4)
      throw Error("동시에 진행할 수 있는 계획은 4개입니다");
    const publicPlan =
        PUBLIC_PLANS.has(type) ||
        (type === "expand" &&
          S.firms.find((f) => f.id === target)?.owner === "public"),
      account = publicPlan ? treasury() : S.player;
    if (publicPlan && !S.player.office)
      throw Error("공공 예산 집행 권한이 없습니다");
    funds(cost, account);
    energy();
    const p = {
      id: S.next++,
      type,
      target,
      cost,
      duration,
      progress: 0,
      status: "active",
      title,
      paused: false,
      reason: "",
      started: S.day,
      cash: 0,
      legacyFunding: false,
      priority: 1,
      manager: null,
      payer: publicPlan ? "public" : "personal",
      risk: "",
    };
    pay(account, p, cost);
    S.plans.push(p);
    note("계획 시작", `${title} · ${duration}일 · ${cost}원 예약`);
  }

  const context = {
    get S() {
      return S;
    },
    get systems() {
      return this._systems;
    },
    set systems(x) {
      this._systems = x;
    },
    editor: options.editor === true,
    person,
    site,
    firm,
    district,
    pay,
    market,
    treasury,
    energy,
    note,
    plan,
    ownPlan,
    random,
    GOODS,
  };
  const systems = require("./systems")(context);
  function eligibility(e) {
    const f = S.firms.find((f) => f.id === e.firm && f.owner === "player");
    return e.kind === "contract"
      ? !!f && f.good === e.good && !S.player.office && !S.player.candidate
      : systems.eligible(e);
  }
  function command(c) {
    if (!c || typeof c.action !== "string")
      throw Error("명령이 올바르지 않습니다");
    // 실패 명령은 시간·자금·난수까지 되돌려 원자적으로 처리한다.
    const before = structuredClone(S);
    try {
      const P = S.player;
      if (!systems.command(c))
        switch (c.action) {
          case "advance": {
            if (!Number.isInteger(c.days) || c.days < 1 || c.days > 30)
              throw Error("1~30일만 진행할 수 있습니다");
            for (let i = 0; i < c.days; i++) {
              if (S.events.some(eligibility)) break;
              tick();
            }
            break;
          }
          case "goal":
            if (
              !["사업 기반 만들기", "지역 선거 도전", "가문 이어가기"].includes(
                c.value,
              )
            )
              throw Error("알 수 없는 목표");
            S.goal = c.value;
            break;
          case "open": {
            const s = site(c.site);
            if (c.mode && !["lease", "buy"].includes(c.mode))
              throw Error("임대 또는 매입을 선택하세요");
            if (c.mode === "buy" && s.landOwner !== "player") {
              pay(P, market(), s.purchase);
              s.landOwner = "player";
            }
            if (s.owner || ownPlan("open", s.id))
              throw Error("이미 사용 중인 점포입니다");
            if (
              !Object.hasOwn(GOODS, c.good) ||
              !Object.hasOwn(
                { ...POLICIES, ...systems.economy.RULES },
                c.policy,
              )
            )
              throw Error("상품과 방침을 선택하세요");
            plan(
              "open",
              s.id,
              s.setup + 60,
              3,
              `${s.name} ${GOODS[c.good]} 사업`,
            );
            Object.assign(S.plans.at(-1), { good: c.good, policy: c.policy });
            break;
          }
          case "fund": {
            const f = firm(c.firm);
            energy();
            pay(P, f, 50);
            break;
          }
          case "policy": {
            const f = firm(c.firm);
            if (!POLICIES[c.value]) throw Error("알 수 없는 방침");
            energy();
            f.policy = c.value;
            note("운영 방침 변경", `${f.name}: ${POLICIES[c.value].name}`);
            break;
          }
          case "supplier": {
            const f = firm(c.firm);
            if (!["local", "import"].includes(c.value))
              throw Error("공급자를 선택하세요");
            energy();
            f.supplier = c.value;
            break;
          }
          case "hire": {
            const f = firm(c.firm),
              p = person(c.person);
            if (
              !p.alive ||
              p.job ||
              p.position ||
              f.workers.length >= f.level * 3
            )
              throw Error("고용 가능한 주민이나 빈자리가 없습니다");
            if (f.cash < f.wage * 3)
              throw Error("사업 자금으로 최소 3일 임금을 확보하세요");
            energy();
            p.job = f.id;
            f.workers.push(p.id);
            p.relation += 5;
            note("고용 계약", `${p.name} · 하루 ${f.wage}원 · ${f.name}`);
            break;
          }
          case "wage": {
            const f = firm(c.firm);
            if (![5, 7, 9].includes(c.value))
              throw Error("임금이 올바르지 않습니다");
            energy();
            f.wage = c.value;
            break;
          }
          case "delegate": {
            const f = firm(c.firm),
              p = person(c.person);
            if (p.job !== f.id)
              throw Error("사업의 직원에게만 위임할 수 있습니다");
            energy();
            f.manager = p.id;
            note(
              "경영 위임",
              `${p.name}에게 운영을 맡겼습니다. 숙련은 생산에, 관계는 이직에 영향을 줍니다.`,
            );
            break;
          }
          case "expand": {
            const f = firm(c.firm);
            if (f.level >= 3) throw Error("최대 규모입니다");
            plan("expand", f.id, 100 * f.level, 6, `${f.name} 확장`);
            break;
          }
          case "close": {
            const f = firm(c.firm);
            if (f.owner !== "player")
              throw Error("공공 소유 사업을 개인 재산으로 청산할 수 없습니다");
            if (
              ownPlan("craft", f.id) ||
              ownPlan("expand", f.id) ||
              S.promises.some((p) => p.firm === f.id && p.status === "active")
            )
              throw Error("진행 중인 확장·납품 약속을 먼저 마무리하세요");
            energy();
            for (const id of f.workers) person(id).job = null;
            if (f.partner)
              pay(f, person(f.partner.id), f.cash * f.partner.share);
            pay(f, P, f.cash);
            site(f.site).owner = null;
            S.firms = S.firms.filter((x) => x !== f);
            S.shipments = S.shipments.filter((x) => x.firm !== f.id);
            note(
              "사업 정리",
              "현금은 회수했습니다. 기술과 인맥을 가지고 다시 시작할 수 있습니다.",
            );
            break;
          }
          case "work": {
            if (P.office) throw Error("공직 중에는 공공사업에 집중하세요");
            energy(2);
            const income = Math.min(S.market, 12 + P.skill * 2);
            pay(market(), P, income);
            P.skill += 0.05;
            note(
              "하루 품삯",
              `노동 소득 ${income.toFixed(0)}원. 재기를 위한 생계 활동입니다.`,
            );
            break;
          }
          case "visit": {
            const d = district(c.district);
            energy(2);
            P.trust = clamp(P.trust + 1, 0, 100);
            d.support = clamp(d.support + 2 + P.organization * 0.1, 0, 100);
            note(
              "현장 면담",
              `${d.name}: 식량 충족 ${Math.round(d.food * 100)}%, 고용 ${Math.round(d.jobs * 100)}%. 생활 개선 약속이 실제 성과로 이어져야 지지가 유지됩니다.`,
            );
            break;
          }
          case "organize":
            district(c.district);
            plan("organize", c.district, 35, 5, "지역 주민 조직");
            break;
          case "campaign": {
            if (P.candidate) throw Error("이미 출마했습니다");
            if (!["jobs", "food", "education"].includes(c.value))
              throw Error("공약을 선택하세요");
            energy();
            P.candidate = true;
            P.platform = c.value;
            note(
              "출마 선언",
              `${S.election}일 선거 · 생활 성과, 신뢰, 조직이 득표에 반영됩니다.`,
            );
            break;
          }
          case "road":
          case "school": {
            const d = district(c.district);
            if (!P.office) throw Error("공공 예산 집행 권한이 없습니다");
            if (d[c.action] >= 2) throw Error("이미 충분히 확충했습니다");
            plan(
              c.action,
              d.id,
              c.action === "road" ? 140 : 180,
              8,
              `${d.name} ${c.action === "road" ? "도로" : "학교"} 건설`,
            );
            break;
          }
          case "tax":
            if (!P.office) throw Error("조세 정책 권한이 없습니다");
            if (![0.04, 0.08, 0.12].includes(c.value))
              throw Error("허용된 세율이 아닙니다");
            if (S.government.council.length) {
              systems.politics.command({
                action: "bill",
                kind: "tax",
                value: c.value,
              });
            } else throw Error("의회 구성 후 정책안을 발의하세요");
            break;
          case "educate":
            plan("educate", 0, 45, 12, "후계자 실무 교육");
            break;
          case "succession":
            if (
              P.office ||
              P.candidate ||
              S.plans.some((p) => p.status === "active")
            )
              throw Error("공직·출마·진행 계획을 마친 뒤 계승할 수 있습니다");
            if (S.day < 120 * P.generation)
              throw Error("한 세대는 최소 120일입니다");
            energy();
            P.generation++;
            P.skill = P.heirSkill;
            P.trust *= 0.7;
            P.organization = Math.floor(P.organization * 0.7);
            for (const p of S.people) p.relation *= 0.6;
            note(
              "가문 계승",
              `${P.generation}대가 재산·사업·인맥을 이어받았습니다. 개인 신뢰 일부는 새로 쌓아야 합니다.`,
            );
            break;
          case "plan": {
            const p = S.plans.find(
              (p) => p.id === c.id && p.status === "active",
            );
            if (!p) throw Error("진행 중인 계획이 없습니다");
            if (c.value === "cancel") {
              pay(p, p.payer === "public" ? treasury() : P, p.cash);
              p.status = "cancelled";
              p.reason = "미사용 예산 반환";
            } else if (c.value === "priority") {
              p.priority = p.priority === 1 ? 2 : 1;
            } else if (c.person) {
              const manager = person(c.person);
              if (manager.relation < 5)
                throw Error("관계 5 이상의 담당자가 필요합니다");
              p.manager = manager.id;
            } else p.paused = !p.paused;
            break;
          }
          case "choose": {
            const e = S.events.find((e) => e.id === c.id);
            if (!e || !eligibility(e))
              throw Error("현재 역할과 맞지 않는 제안입니다");
            if (e.kind !== "contract") {
              if (!systems.choose(e, c.value))
                throw Error("선택 처리기를 찾을 수 없습니다");
              S.events = S.events.filter((x) => x !== e);
              break;
            }
            if (!["accept", "counter", "decline"].includes(c.value))
              throw Error("선택이 올바르지 않습니다");
            const f = firm(e.firm);
            if (c.value !== "decline") {
              const quantity = c.value === "counter" ? 12 : 20;
              S.promises.push({
                id: S.next++,
                firm: f.id,
                person: e.person,
                quantity,
                price: c.value === "counter" ? 5 : 7,
                due: S.day + 8,
                status: "active",
              });
              note(
                "납품 약속",
                `${person(e.person).name}: 8일 안에 ${quantity}개, 개당 ${c.value === "counter" ? 5 : 7}원. 미달 시 신뢰가 하락합니다.`,
              );
            }
            S.events = S.events.filter((x) => x !== e);
            break;
          }
          case "save":
          case "suspend":
            break;
          default:
            throw Error("지원하지 않는 명령입니다");
        }
      S.events = S.events.filter(eligibility);
      if (!["save", "suspend", "goal"].includes(c.action)) S.started = true;
      S.revision++;
      upgrade(S);
      validate(S);
      return view();
    } catch (e) {
      S = before;
      throw e;
    }
  }
  function tick() {
    S.day++;
    const P = S.player;
    P.dayEnergy = P.energy;
    P.energy = 3;
    systems.beforeTick();
    // 농사·외부 판매 소득도 외부 시장 계정에서 실제 이동한다.
    for (const p of S.people) {
      if (!p.job && !p.position && p.alive)
        pay(market(), p, Math.min(S.market, 3));
      if (S.day % 12 === 0)
        p.skill = Math.min(10, p.skill + district(p.district).school * 0.03);
      if (p.job && p.ambition > 0.65 && p.loyalty < 35 && S.day % 15 === 0) {
        const current = S.firms.find((f) => f.id === p.job),
          offer = S.firms.find(
            (f) =>
              f.id !== p.job &&
              f.wage > (current?.wage || 0) &&
              f.workers.length < f.level * 3 &&
              f.cash > f.wage * 5,
          );
        if (offer && current) {
          current.workers = current.workers.filter((id) => id !== p.id);
          if (current.manager === p.id) current.manager = null;
          p.job = offer.id;
          offer.workers.push(p.id);
          p.loyalty = 55;
          note(
            "직원 이직",
            `${p.name}이 더 나은 임금을 제시한 ${offer.name}으로 옮겼습니다.`,
          );
        }
      }
    }
    systems.economy.tick();
    for (const p of S.plans.filter((p) => p.status === "active")) {
      p.reason = "";
      if (p.paused) {
        p.reason = "직접 일시정지";
        continue;
      }
      if (
        (p.payer === "public" ||
          (p.type === "reform" && p.method === "legal")) &&
        !P.office
      ) {
        p.reason = "공직 권한을 잃어 중단";
        continue;
      }
      if (
        p.type === "expand" &&
        !S.firms.some((f) => f.id === p.target && f.workers.length)
      ) {
        p.reason = "직원이 있어야 확장 가능";
        continue;
      }
      if (
        p.type === "craft" &&
        (P.office ||
          P.candidate ||
          !S.firms.some(
            (f) =>
              f.id === p.target && f.owner === "player" && f.good === "tools",
          ))
      ) {
        p.status = "cancelled";
        p.reason = "현재 역할·제작 권한 변경";
        if (p.cash) pay(p, P, p.cash);
        note("제작 계획 중단", p.reason);
        continue;
      }
      if (
        p.manager &&
        !S.people.some((a) => a.id === p.manager && a.alive && a.relation >= 0)
      ) {
        p.reason = "담당자 이탈·관계 악화";
        continue;
      }
      if (
        p.priority === 1 &&
        S.plans.filter((x) => x.status === "active" && x.priority === 2)
          .length >= 2 &&
        S.day % 2
      ) {
        p.reason = "우선 계획에 인력 배정";
        continue;
      }
      const progressStep = Math.min(
        p.duration - p.progress,
        1 +
          (p.manager && person(p.manager).skill >= 5 && S.day % 2 === 0
            ? 1
            : 0),
      );
      const spend = p.legacyFunding
        ? 0
        : Math.min(
            p.cash,
            ((p.cost - (p.type === "open" ? 60 : 0)) * progressStep) /
              p.duration,
          );
      pay(p, market(), spend);
      p.progress += progressStep;
      if (p.progress < p.duration) continue;
      if (p.type === "open") {
        const s = site(p.target);
        const f = {
          id: S.next++,
          site: s.id,
          name: s.name,
          owner: "player",
          cash: 0,
          stock: 0,
          good: p.good,
          policy: p.policy,
          level: 1,
          workers: [],
          supplier: "local",
          wage: 5,
          profit: 0,
          sold: 0,
          manager: null,
        };
        pay(p.legacyFunding ? market() : p, f, 60);
        S.firms.push(f);
        s.owner = f.id;
      }
      if (p.type === "expand") firm(p.target).level++;
      if (p.type === "road" || p.type === "school")
        district(p.target)[p.type]++;
      if (p.type === "organize") {
        P.organization++;
        district(p.target).organization++;
        district(p.target).support += 4;
      }
      systems.complete(p);
      if (p.status === "active") p.status = "done";
      if (p.cash > 0) pay(p, p.payer === "public" ? treasury() : P, p.cash);
      note(
        p.status === "done" ? "계획 완료" : "계획 중단",
        p.title + (p.reason ? " · " + p.reason : ""),
      );
    }
    for (const promise of S.promises.filter(
      (p) => !p.kind && p.status === "active",
    )) {
      const f = S.firms.find((f) => f.id === promise.firm),
        buyer = person(promise.person);
      if (
        f &&
        f.stock >= promise.quantity &&
        buyer.cash >= promise.quantity * promise.price
      ) {
        pay(buyer, f, promise.quantity * promise.price);
        f.stock -= promise.quantity;
        promise.status = "kept";
        buyer.relation += 15;
        P.trust = Math.min(100, P.trust + 3);
        note(
          "약속 이행",
          `${buyer.name}에게 ${promise.quantity}개 납품. 다음 거래의 신뢰로 남습니다.`,
        );
      } else if (S.day >= promise.due) {
        promise.status = "broken";
        buyer.relation -= 15;
        P.trust = Math.max(0, P.trust - 6);
        note("납품 실패", "기한을 넘겼습니다. 관계와 신뢰가 하락했습니다.");
      }
    }
    if (S.day % 17 === 0 && !P.office) {
      const f = S.firms.find((f) => f.owner === "player");
      const buyer = S.people.filter((p) => p.cash >= 100 && p.alive)[0];
      if (
        f &&
        buyer &&
        !S.promises.some((p) => p.firm === f.id && p.status === "active")
      )
        S.events.push({
          id: S.next++,
          kind: "contract",
          firm: f.id,
          good: f.good,
          person: buyer.id,
          title: `${buyer.name}의 납품 제안`,
          text: `${GOODS[f.good]} 20개를 8일 안에 개당 7원에 납품해 주세요. 작은 계약으로 역제안할 수도 있습니다.`,
        });
    }
    systems.afterTick();
    S.events = S.events.filter(eligibility);
    S.plans = S.plans.filter(
      (p) => p.status === "active" || S.day - p.started < 90,
    );
    S.history = S.history.slice(-20);
  }
  function queryPeople(page = 0, filter = "all") {
    if (
      !Number.isInteger(page) ||
      page < 0 ||
      !["all", "staff", "contacts", "free"].includes(filter)
    )
      throw Error("인물 조회 범위가 올바르지 않습니다");
    const list = S.people.filter(
      (p) =>
        filter === "all" ||
        (filter === "staff" &&
          S.firms.some((f) => f.owner === "player" && f.id === p.job)) ||
        (filter === "contacts" && p.relation > 0) ||
        (filter === "free" && !p.job && !p.position),
    );
    return {
      total: list.length,
      page,
      pages: Math.max(1, Math.ceil(list.length / 8)),
      people: structuredClone(
        list.slice(page * 8, page * 8 + 8).map(({ g, q, bought, ...p }) => p),
      ),
    };
  }
  function view() {
    return systems.decorate(
      structuredClone({
        ...S,
        legacy: undefined,
        people: S.people.map(({ g, q, bought, ...p }) => p),
        version: VERSION,
        goods: GOODS,
        policies: POLICIES,
        events: S.events.filter(eligibility),
        role: S.player.office
          ? "지역 집행자"
          : S.player.candidate
            ? "지역 후보"
            : S.firms.some((f) => f.owner === "player")
              ? "사업가"
              : "주민",
      }),
    );
  }
  return {
    command,
    view,
    people: queryPeople,
    resident: (id) =>
      structuredClone(S.people.find((p) => p.id === id) || null),
    export: () => ({ version: VERSION, state: structuredClone(S) }),
    money: () =>
      S.market +
      S.treasury +
      S.player.cash +
      S.people.reduce((n, p) => n + p.cash, 0) +
      S.firms.reduce((n, f) => n + f.cash, 0) +
      S.plans.reduce((n, p) => n + p.cash, 0) +
      S.family.members.reduce((n, p) => n + (p.cash || 0), 0),
  };
}
module.exports = { createGame, VERSION };
