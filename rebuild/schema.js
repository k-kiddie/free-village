"use strict";
const VERSION = 2;
const GROUPS = {
  farmers: "농민",
  workers: "노동자",
  merchants: "상인",
  residents: "지역 주민",
};
function upgrade(S) {
  S.started ??=
    S.day > 0 ||
    S.plans.length > 0 ||
    S.firms.some((f) => f.owner === "player") ||
    S.player.energy < 3 ||
    S.people.some((p) => p.relation > 0);
  S.routes ||= [
    { id: 0, from: 0, to: 1, length: 3, level: 1 },
    { id: 1, from: 1, to: 2, length: 2, level: 1 },
    { id: 2, from: 0, to: 2, length: 5, level: 0 },
  ];
  S.shipments ||= [];
  S.offers ||= [];
  S.loans ||= [];
  S.archive ||= [];
  S.ledger ||= [];
  S.achievements ||= [];
  S.importInfo ||= null;
  S.government ||= {
    regime: "republic",
    economy: "market",
    legitimacy: 55,
    administration: 45,
    army: 45,
    council: [],
    ministers: {},
    bills: [],
    opposition: 30,
    constitution: 1,
  };
  S.parties ||= [
    {
      id: "civic",
      name: "주민 연대",
      platform: "food",
      members: [],
      power: 35,
    },
    {
      id: "trade",
      name: "상공 연합",
      platform: "jobs",
      members: [],
      power: 45,
    },
    {
      id: "labor",
      name: "노동 모임",
      platform: "education",
      members: [],
      power: 30,
    },
  ];
  S.family ||= {
    members: [
      {
        id: "founder",
        name: "초대 가장",
        age: 30,
        skill: S.player.skill,
        alive: true,
        kind: "head",
        relation: 70,
      },
      {
        id: "heir",
        name: "첫째",
        age: 16,
        skill: S.player.heirSkill,
        alive: true,
        kind: "child",
        relation: 65,
      },
      {
        id: "sibling",
        name: "둘째",
        age: 14,
        skill: 1,
        alive: true,
        kind: "child",
        relation: 55,
      },
    ],
    heir: "heir",
    will: "equal",
    spouse: null,
    dispute: null,
    legacy: 0,
    lastSuccession: 0,
  };
  Object.assign(S.player, {
    housing: 0,
    district: 0,
    party: null,
    coalition: null,
    speech: 0,
    contacts: [],
    ...S.player,
  });
  for (const d of S.districts) {
    d.raw ??= 40;
    d.resource ??= d.id === 0 ? "grain" : d.id === 1 ? "timber" : "fiber";
    d.homes ??= 7;
    d.rent ??= 1;
    d.housing ??= 1;
    d.prices ||= { food: 4, tools: 6, cloth: 6 };
    d.groups ||= {};
    d.organization ??= 0;
    d.festivalUntil ??= 0;
  }
  for (const s of S.sites) {
    s.x ??= 18 + Math.floor(s.id / 3) * 30;
    s.y ??= 20 + s.district * 28;
    s.landOwner ??= "market";
    s.purchase ??= s.setup * 3;
  }
  for (const m of S.family.members) {
    m.cash ??= 0;
    if (m.kind === "child")
      m.parents ||= [S.family.members.find((m) => m.kind === "head").id];
  }
  for (const p of S.people) {
    p.group ||= Object.keys(GROUPS)[p.id % 4];
    p.trust ??= S.player.trust;
    p.support ??= 30;
    p.values ??= (p.id % 5) / 4;
    p.housed ??= true;
    p.food ??= 0.5;
    p.voteReason ||= "";
    p.goal ||= p.ambition > 0.65 ? "出世" : "安定";
    p.goal =
      p.goal === "出世"
        ? "권한과 성장"
        : p.goal === "安定"
          ? "안정된 생계"
          : p.goal;
    p.promises ||= [];
    p.memory ||= [];
    p.party ??= S.parties[Math.floor(p.id / 3) % 3].id;
    p.position ??= null;
    p.alive ??= true;
    p.salary ??= 0;
    p.participant ??= false;
  }
  for (const f of S.firms) {
    f.marketDistrict ??= S.sites.find((s) => s.id === f.site)?.district || 0;
    f.quality ??= 1;
    f.customers ??= 0;
    f.partner ??= null;
    f.contractOnly ??= false;
    f.reserve ??= false;
    f.credit ??= 0;
  }
  for (const p of S.plans) {
    p.priority ??= 1;
    p.manager ??= null;
    p.risk ||= "";
    p.cash ??= 0;
    p.legacyFunding ??= true;
  }
  for (const p of S.promises) {
    p.delivered ??= 0;
    p.reserved ??= 0;
  }
  for (const party of S.parties)
    party.members = S.people
      .filter((p) => p.party === party.id)
      .map((p) => p.id);
  return S;
}
function validate(S) {
  if (
    !S ||
    !Array.isArray(S.people) ||
    !S.people.length ||
    !Array.isArray(S.firms) ||
    !Array.isArray(S.districts) ||
    S.districts.length !== 3 ||
    !Array.isArray(S.sites) ||
    S.sites.length !== 9 ||
    !S.player ||
    !Array.isArray(S.plans) ||
    !Array.isArray(S.events) ||
    !Array.isArray(S.promises)
  )
    throw Error("저장 구조가 올바르지 않습니다");
  const ids = new Set();
  for (const p of S.people) {
    if (!Number.isInteger(p.id) || ids.has(p.id))
      throw Error("중복되거나 잘못된 주민 ID");
    ids.add(p.id);
  }
  for (const key of ["day", "revision", "next", "rng", "election"])
    if (!Number.isFinite(S[key]) || S[key] < 0)
      throw Error("저장의 시간·난수 상태가 올바르지 않습니다");
  for (const a of [S.player, ...S.people, ...S.firms, ...S.plans])
    if (!Number.isFinite(a.cash) || a.cash < -0.000001)
      throw Error("저장의 자금 값이 올바르지 않습니다");
  for (const key of ["market", "treasury"])
    if (!Number.isFinite(S[key]) || S[key] < 0)
      throw Error("저장의 공공·시장 자금이 올바르지 않습니다");
  const firms = new Map(S.firms.map((f) => [f.id, f]));
  if (firms.size !== S.firms.length) throw Error("중복 사업 ID");
  for (const f of S.firms) {
    if (
      !["volume", "quality", "training", "contract", "reserve"].includes(
        f.policy,
      ) ||
      !Number.isFinite(f.wage) ||
      f.wage < 0 ||
      !Number.isInteger(f.level) ||
      f.level < 1 ||
      f.level > 3 ||
      !["food", "tools", "cloth"].includes(f.good) ||
      !Number.isFinite(f.stock) ||
      f.stock < -0.000001 ||
      !S.sites.some((s) => s.id === f.site && s.owner === f.id)
    )
      throw Error("사업 재고·입지 연결이 올바르지 않습니다");
    for (const id of f.workers)
      if (!ids.has(id) || S.people.find((p) => p.id === id).job !== f.id)
        throw Error("고용 연결이 올바르지 않습니다");
  }
  for (const p of S.people)
    if (
      p.job != null &&
      (!firms.has(p.job) || !firms.get(p.job).workers.includes(p.id))
    )
      throw Error("주민의 고용 연결이 올바르지 않습니다");
  if (
    !["republic", "council", "monarchy"].includes(S.government.regime) ||
    !["market", "cooperative", "public"].includes(S.government.economy)
  )
    throw Error("저장의 제도 값이 올바르지 않습니다");
  return true;
}
module.exports = { VERSION, GROUPS, upgrade, validate };
