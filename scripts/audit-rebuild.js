"use strict";
// 1단계 조사 도구. 게임/서버 파일은 수정하지 않는다. 출력은 조사 자료이며 완료 판정이 아니다.
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");
const hash = (s) => crypto.createHash("sha256").update(s).digest("hex");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
function head() {
  try {
    const value = read(".git/HEAD").trim();
    return value.startsWith("ref: ")
      ? read(".git/" + value.slice(5)).trim()
      : value;
  } catch {
    return "unknown";
  }
}
function files(dir = "") {
  return fs
    .readdirSync(path.join(root, dir), { withFileTypes: true })
    .flatMap((e) => {
      if (
        [".git", "node_modules", "save", "scene-art", "audit"].includes(e.name)
      )
        return [];
      const name = path.posix.join(dir, e.name);
      return e.isDirectory()
        ? files(name)
        : /\.(js|html)$/.test(name)
          ? [name]
          : [];
    })
    .sort();
}
function entries(source, re) {
  return [...source.matchAll(re)].map((m) => ({
    name: m[1],
    line: source.slice(0, m.index).split("\n").length,
  }));
}
const sourceFiles = files().map((file) => {
  const source = read(file),
    generated = file === "index.html";
  return {
    file,
    bytes: Buffer.byteLength(source),
    lines: source.split("\n").length,
    sha256: hash(source),
    generated,
    requires: generated
      ? []
      : entries(source, /\brequire\(["']([^"']+)["']\)/g),
    functions: generated
      ? []
      : entries(source, /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g),
    switchCases: generated
      ? []
      : entries(source, /\bcase\s+["']([^"']+)["']\s*:/g),
  };
});
const { createGame } = require("../rebuild/game"),
  { createWorld } = require("../engine"),
  { migrateLegacy } = require("../rebuild/migration");
const game = createGame(17),
  initial = game.view();
const w = createWorld(17, 40),
  legacy = { seed: 17, population: 40, state: w.exportState() },
  converted = migrateLegacy(legacy),
  S = converted.state;
const queryA = createGame(17),
  queryB = createGame(17);
queryA.command({ action: "goal", value: "지역 선거 도전" });
queryA.command({ action: "advance", days: 1 });
queryB.command({ action: "advance", days: 1 });
const goalStateA = queryA.export().state,
  goalStateB = queryB.export().state;
const traitsA = createGame(17).export(),
  traitsB = structuredClone(traitsA);
for (const p of traitsA.state.people) {
  p.g = { boss: 0, equal: 0 };
  p.q = [-999, -999, -999];
}
for (const p of traitsB.state.people) {
  p.g = { boss: 1, equal: 1 };
  p.q = [999, 999, 999];
}
const ta = createGame(17, traitsA),
  tb = createGame(17, traitsB);
ta.command({ action: "advance", days: 1 });
tb.command({ action: "advance", days: 1 });
const dynasty = createWorld(19, 120);
dynasty.dynStart();
dynasty.dynChoose(dynasty.S.dyn.pending[0].id, "go");
const actionPrefixes = {};
for (const a of dynasty.dynActions()) {
  const key = a.k.split(":")[0];
  actionPrefixes[key] = (actionPrefixes[key] || 0) + 1;
}
const childFixture = structuredClone(legacy);
childFixture.state.S.agents[1].age = 6 * 60;
childFixture.state.S.day = 123;
const childConverted = migrateLegacy(childFixture);
const probes = {
  scope:
    "고정 시드의 메모리 내 관찰. 모든 조합·모바일·실서버 검증을 뜻하지 않는다.",
  newGame: {
    people: initial.population,
    districts: initial.districts.length,
    sites: initial.sites.length,
    routes: initial.routes.length,
    firms: initial.firms.length,
    parties: initial.parties.length,
    regimes: Object.keys(initial.regimes),
    goods: Object.keys(initial.goods),
    policies: Object.keys(initial.policies),
  },
  goalChange: {
    compared: "목표 변경 후 하루 진행 vs 기본 목표로 하루 진행",
    peopleEqual:
      JSON.stringify(goalStateA.people) === JSON.stringify(goalStateB.people),
    firmsEqual:
      JSON.stringify(goalStateA.firms) === JSON.stringify(goalStateB.firms),
    plansEqual:
      JSON.stringify(goalStateA.plans) === JSON.stringify(goalStateB.plans),
  },
  learning: {
    compared: "동일 상태에 서로 다른 g/q를 넣어 하루 진행한 뒤 뷰 비교",
    viewsEqual: JSON.stringify(ta.view()) === JSON.stringify(tb.view()),
    interpretation:
      "이 표본에서는 g/q 변경이 새 게임 결과에 반영되지 않는다. 소스의 읽기 경로도 별도로 확인해야 한다.",
  },
  migration: {
    oldPopulation: legacy.state.S.agents.length,
    newPeople: S.people.length,
    playerSeparate: true,
    oldDay: legacy.state.S.day,
    newDay: S.day,
    oldUnder18: legacy.state.S.agents.filter((a) => a.age < 18 * 60).length,
    newUnder18: S.people.filter((p) => p.age < 18).length,
    oldFirms: legacy.state.S.firms.length,
    newFirms: S.firms.length,
    oldHouses: legacy.state.S.houses.length,
    newHouseObjects: Array.isArray(S.houses),
    newFamilyMembers: S.family.members.map((m) => ({
      id: m.id,
      age: m.age,
      kind: m.kind,
    })),
    archivedSourceEqual: JSON.stringify(S.legacy) === JSON.stringify(legacy),
    limitation:
      "원본 보관 일치와 원래 권리·계약을 이어가는 마이그레이션은 서로 다르다.",
  },
  migrationControlledFixture: {
    description: "기존 저장에 미성년 주민과 진행 날짜가 있는 경우의 변환 관찰",
    sourceAge: 6,
    targetAge: childConverted.state.people.find(
      (p) => p.id === childFixture.state.S.agents[1].id,
    ).age,
    sourceDay: 123,
    targetDay: childConverted.state.day,
  },
  legacySurface: {
    seed: 19,
    population: 120,
    rank: dynasty.dynRank(),
    listedActionCount: dynasty.dynActions().length,
    executableActionCount: dynasty.dynActions().filter((a) => a.ok).length,
    actionPrefixes,
    storyDefinitions: Object.keys(dynasty._story.SE).length,
    limitation:
      "이 시작 인물의 목록이며 모든 직위·상황에서의 전체 행동 수가 아니다.",
  },
};
const result = {
  schemaVersion: 1,
  auditedCodeCommit: head(),
  sourceFiles,
  probes,
  limitations: [
    "정규식 목록은 명시적 함수·문자열 require·case만 추출한다.",
    "HTML 삽입·VM 실행·콜백·동적 행동 키는 수동 추적이 필요하다.",
    "함수/테스트/파일의 존재를 기능 완료로 판정하지 않는다.",
  ],
};
function renderRequirements() {
  const file = path.join(root, "rebuild/audit/requirements.json");
  if (!fs.existsSync(file)) return 0;
  const data = JSON.parse(fs.readFileSync(file, "utf8")),
    ids = new Set();
  const list = data.requirements;
  const lines = [
    "# 리빌드 요구사항 대조표",
    "",
    `조사 기준 코드: \`${data.auditedCodeCommit}\`. ${list.length}개 조사 항목.`,
    "",
    "**부분 구현**은 해당 코드 경로를 찾았다는 뜻이다. 설계 요구 충족이나 게임 완성을 뜻하지 않는다. 다음 단계는 새 14단계 실행 계획의 번호다. 표의 검증 시나리오는 앞으로 통과해야 할 기준이며 이번 조사에서 통과했다고 주장하지 않는다.",
    "",
    "원본: [REBUILD_PLAN.md](../../REBUILD_PLAN.md) · [새 실행 계획](../../REBUILD_EXECUTION_PLAN.md) · [조사 결론](README.md) · [검사 범위](TEST_SCOPE.md)",
  ];
  const clean = (s) => String(s).replaceAll("|", "\\|").replaceAll("\n", " ");
  for (const area of new Set(list.map((q) => q.area))) {
    lines.push(
      "",
      "## " + area,
      "",
      "| ID·요구 | 현재 코드에서 확인 | 부족·미구현 | 처리·다음 단계·완료 시나리오 |",
      "| --- | --- | --- | --- |",
    );
    for (const q of list.filter((q) => q.area === area)) {
      if (
        ids.has(q.id) ||
        !q.gap ||
        !q.acceptance ||
        q.nextPhase < 2 ||
        q.nextPhase > 14
      )
        throw Error("조사 항목이 올바르지 않습니다: " + q.id);
      ids.add(q.id);
      const refs = q.evidence.map((e) => {
        const src = read(e.file),
          at = src.indexOf(e.anchor);
        if (at < 0) throw Error("코드 근거를 찾을 수 없습니다: " + q.id);
        const line = src.slice(0, at).split("\n").length;
        if (e.line !== line)
          throw Error("코드 근거의 줄이 바뀌었습니다: " + q.id);
        return `[${e.file}:${line}](../../${e.file}#L${line})`;
      });
      lines.push(
        `| **${q.id}** ${clean(q.requirement)} | ${clean(q.current)}<br>${refs.join(", ")} | ${clean(q.gap)} | ${clean(q.disposition)} · ${q.nextPhase}단계<br>${clean(q.acceptance)} |`,
      );
    }
  }
  fs.writeFileSync(
    path.join(root, "rebuild/audit/REQUIREMENTS.md"),
    lines.join("\n") + "\n",
  );
  return list.length;
}
if (process.argv.includes("--write")) {
  const out = path.join(root, "rebuild/audit");
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(
    path.join(out, "source-inventory.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  const requirements = renderRequirements();
  console.log(
    JSON.stringify(
      {
        auditedCodeCommit: result.auditedCodeCommit,
        files: sourceFiles.length,
        requirements,
        output: "rebuild/audit/source-inventory.json",
        probes,
      },
      null,
      2,
    ),
  );
} else console.log(JSON.stringify(result, null, 2));
