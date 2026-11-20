"use strict";
const assert = require("node:assert/strict");
const { createGame } = require("../rebuild/game");
for (const seed of [7, 19, 91]) {
  const g = createGame(seed),
    initial = g.money();
  g.command({
    action: "open",
    site: 3,
    good: "food",
    policy: seed === 7 ? "volume" : "quality",
  });
  for (let day = 0; day < 1800; day++) {
    let guard = 0;
    while (g.view().events.length) {
      assert(++guard < 20, "선택지 반복");
      const e = g.view().events[0],
        available = e.options.filter((o) => o.available);
      assert(available.length, "돈이 없어도 결단 가능");
      const o =
        available.find((o) => o.value === "decline") ||
        available.find((o) => o.value === "guardian") ||
        available.find((o) => o.value === "disclose") ||
        available.find((o) => o.value === "refuse") ||
        available[0];
      g.command({ action: "choose", id: e.id, value: o.value });
    }
    const v = g.view(),
      f = v.firms.find((f) => f.owner === "player");
    if (day === 3 && f) {
      const person = v.people.find((p) => !p.job && !p.position);
      if (person) g.command({ action: "hire", firm: f.id, person: person.id });
    }
    if (day % 30 === 1 && !v.player.office && v.player.energy >= 2)
      g.command({ action: "work" });
    if (day === 10) g.command({ action: "party", value: "civic" });
    if (day % 30 === 20 && !v.player.candidate)
      g.command({ action: "campaign", value: "food" });
    if (
      day % 90 === 40 &&
      v.player.cash >= 45 &&
      !v.plans.some((p) => p.type === "educate" && p.status === "active") &&
      v.family.heir
    )
      g.command({ action: "educate" });
    if (day % 100 === 0) {
      const saved = g.export(),
        copy = createGame(seed, saved);
      assert.deepEqual(copy.export(), saved, "장기 약속·계획·가문 상태 복원");
    }
    g.command({ action: "advance", days: 1 });
    assert(Math.abs(g.money() - initial) < 1e-5, "장기 회계 보존");
  }
  assert(g.view().history.length > 0);
  assert(g.view().player.generation >= 2, "자연사 뒤 가문이 이어짐");
  console.log(
    JSON.stringify({
      seed,
      day: g.view().day,
      generation: g.view().player.generation,
      promises: g.view().promises.length,
      treasury: Math.round(g.view().treasury),
    }),
  );
}
console.log("3개 시드·각 1800일 장기 플레이 통과");
