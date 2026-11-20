"use strict";
const { createGame } = require("./game");
const { upgrade, validate, VERSION } = require("./schema");
function migrateLegacy(raw) {
  const legacy = typeof raw === "string" ? JSON.parse(raw) : raw;
  const old = legacy.state?.S;
  if (
    !old ||
    !Array.isArray(old.agents) ||
    !old.agents.length ||
    !Array.isArray(legacy.state.dead)
  )
    throw Error("기존 전체 저장 형식이 아닙니다");
  if (old.agents.some((a) => !a.g || !Array.isArray(a.q)))
    throw Error("주민 유전자·학습 값이 없는 파일입니다");
  const seed = Number(legacy.seed) || 20261120,
    base = createGame(seed).export(),
    S = base.state;
  // 원본 전체를 보존한다. 새 뷰 응답에는 포함하지 않으며 내보내기로 언제든 회수할 수 있다.
  S.legacy = legacy;
  const oldId = old.dyn?.pid,
    head =
      old.agents.find((p) => p.id === oldId) ||
      old.agents.find((p) => p.alive !== false);
  S.people = old.agents
    .filter((p) => p.alive !== false && p.id !== head.id)
    .map((p, i) => ({
      id: p.id,
      name:
        [p.sur, p.given].filter(Boolean).join("") || p.name || "주민 " + p.id,
      district: i % 3,
      cash: Math.max(0, Number(p.cash) || 0),
      skill: 1,
      ambition: Number(p.g.boss) || 0.5,
      loyalty: 40,
      job: null,
      relation: 0,
      age: Math.max(18, (p.age || 1200) / 60),
      g: p.g,
      q: p.q,
    }));
  if (!S.people.length) throw Error("이전할 주민이 부족합니다");
  S.firms = [];
  S.sites.forEach((s) => (s.owner = null));
  S.player.cash = Math.max(0, Number(head.cash) || 0);
  S.player.skill = Math.max(1, Number(head.edu) || 1);
  S.treasury = Math.max(0, Number(old.gov?.tre) || 0);
  S.importInfo = {
    source: "village-v1",
    population: old.agents.length,
    day: old.day,
    head: head.id,
    notes:
      "새 규칙의 첫날부터 시작합니다. 종전 직위·부동산·계약·사건·g/q 원본은 전체 보관본에 보존하며 자동 실행하지 않습니다.",
  };
  S.family.members[0].name =
    [head.sur, head.given].filter(Boolean).join("") || "이전한 가장";
  S.family.members[0].skill = S.player.skill;
  for (const d of S.districts)
    d.homes = Math.max(
      7,
      Math.ceil(S.people.filter((p) => p.district === d.id).length / 3),
    );
  upgrade(S);
  validate(S);
  return { version: VERSION, state: S };
}
module.exports = { migrateLegacy };
