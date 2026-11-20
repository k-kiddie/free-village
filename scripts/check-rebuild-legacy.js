"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  Module = require("node:module");
const file = path.resolve(__dirname, "../engine.js"),
  m = new Module(file);
m.filename = file;
m.paths = module.paths;
m._compile(
  fs
    .readFileSync(file, "utf8")
    .replace(
      "return{dynSetStory,",
      "return{regTick,revoltRun,dynStoryFinance,dynSetStory,",
    ),
  file,
);
const w = m.exports.createWorld(92, 120);
w.dynStart();
w.dynConfigureStart({ age: 35, status: "king", family: "children" });
w.dynChoose(w.S.dyn.pending[0].id, "go");
const S = w.S,
  me = S.byId.get(S.dyn.pid),
  G = S.gov;
me.occ = "mfg";
assert.equal(
  w._story.dynStoryEligible(w._story.SE.ocMfgMaster, me),
  false,
  "최고 직위의 제작직 사건 차단",
);
w._story.dynStoryPush(w._story.SE.ocMfgMaster, { sid: "ocMfgMaster" }, me);
w.dynView();
const pending = S.dyn.pending.find((p) => p.ctx?.sid === "ocMfgMaster");
assert(pending);
assert(
  pending.opts
    .filter((o) => !o.k.startsWith("__"))
    .every((o) => o.available === false),
  "대기 사건 재검사",
);
assert.throws(() => w.dynChoose(pending.id, "best"), /실행|상황/);
w.dynChoose(pending.id, "__defer");
const before = G.regime,
  chief = G.chief;
G.approval = 0.01;
S.day = 30;
w.regTick();
assert.equal(G.regime, before);
assert.equal(G.chief, chief, "낮은 승인도만으로 자동 정변 없음");
const result = w.revoltRun(
  S.agents.filter((a) => a.alive),
  me,
  S.agents.filter((a) => a !== me),
  1,
  { com: true },
);
assert(result.preparing);
assert.equal(G.regime, before);
assert.equal(G.chief, chief);
assert(S.dyn.revoltPlan.until > S.day, "이야기 혁명도 준비 경로");
G.bud = { lines: { welf: 0 }, spent: {}, total: 0, d: S.day };
G.tre = 1000;
for (const a of S.agents.slice(0, 6)) a.hunger = 80;
const event = w._story.SE.electedFoodPetition,
  c = w._story.sCtx(me, {}),
  finance = w.dynStoryFinance(event, c, "relief");
assert.equal(finance.funding, "public");
assert(finance.cost > 0);
assert.equal(
  finance.available,
  false,
  "국고 총액이 있어도 해당 복지 예산 부족이면 실행 차단",
);
console.log(
  "기존 문제 회귀 통과: 최고 직위 직업 사건·대기 사건·즉시 혁명·자동 체제 변경·국고/복지 예산 구분",
);
