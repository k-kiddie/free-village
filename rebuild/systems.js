"use strict";
const { upgrade, validate } = require("./schema");
module.exports = function systems(C) {
  upgrade(C.S);
  validate(C.S);
  const modules = {};
  C.systems = modules;
  modules.society = require("./society")(C);
  modules.politics = require("./politics")(C);
  modules.economy = require("./economy")(C);
  modules.family = require("./family")(C);
  modules.story = require("./story")(C);
  modules.editor = require("./editor")(C);
  const command = (c) => Object.values(modules).some((m) => m.command?.(c));
  function beforeTick() {
    modules.society.beforeTick();
    for (const p of C.S.people) if (p.alive && C.S.day % 30 === 0) p.age++;
  }
  function afterTick() {
    modules.society.support();
    modules.politics.tick();
    modules.family.tick();
    modules.story.tick();
    const S = C.S;
    const add = (id, label) => {
      if (!S.achievements.some((a) => a.id === id)) {
        S.achievements.push({ id, label, day: S.day });
        C.note("독립 목표 달성", label);
      }
    };
    if (
      S.firms.filter(
        (f) => f.owner === "player" && f.level >= 2 && f.workers.length >= 2,
      ).length >= 2
    )
      add("enterprise", "지속 가능한 지역 사업망: 확장 사업 2곳·직원 각 2명");
    if (S.family.legacy >= 2) add("lineage", "세 세대가 이어가는 가문");
    if (
      S.player.office &&
      S.districts.every((d) => d.food > 0.7 && d.housing > 0.9)
    )
      add("public", "모든 지역의 식량·주거 안정");
    for (const p of S.people) p.memory = p.memory.slice(-12);
  }
  function complete(p) {
    for (const m of Object.values(modules)) if (m.complete?.(p)) return true;
    return false;
  }
  return {
    ...modules,
    command,
    beforeTick,
    afterTick,
    complete,
    eligible: modules.story.eligible,
    choose: modules.story.choose,
    decorate(v) {
      v.regimes = modules.politics.REGIMES;
      v.economies = modules.politics.ECONOMIES;
      v.readiness = modules.politics.readiness();
      v.policies = modules.economy.RULES;
      v.events = v.events.map((e) => ({
        ...e,
        options: modules.story.options(e),
      }));
      v.family = structuredClone(C.S.family);
      v.editor = C.editor;
      v.canImport = !C.S.started;
      for (const p of v.people) {
        delete p.g;
        delete p.q;
        delete p.bought;
        p.memory = p.memory.slice(-4);
      }
      if (v.people.length > 150)
        v.people = v.people
          .filter(
            (p) =>
              p.relation > 0 ||
              p.position ||
              v.firms.some(
                (f) => f.owner === "player" && f.workers.includes(p.id),
              ),
          )
          .concat(v.people.filter((p) => !p.job).slice(0, 80))
          .filter((p, i, a) => a.findIndex((x) => x.id === p.id) === i)
          .slice(0, 150);
      v.population = C.S.people.length;
      delete v.legacy;
      delete v.ledger;
      return v;
    },
  };
};
