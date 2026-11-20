"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  zlib = require("node:zlib"),
  crypto = require("node:crypto"),
  { performance } = require("node:perf_hooks");
const { createGame } = require("../rebuild/game"),
  { createWorld } = require("../engine"),
  { migrateLegacy } = require("../rebuild/migration"),
  { writeSnapshot } = require("../server-storage");
const hash = (text) => crypto.createHash("sha256").update(text).digest("hex");
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rebuild-perf-")),
    original = path.join(dir, "origin.json.gz");
  async function prepare() {
    const old = createWorld(400, 5000),
      legacy = { seed: 400, population: 5000, state: old.exportState() },
      checksum = hash(JSON.stringify(legacy));
    const start = performance.now(),
      next = migrateLegacy(legacy);
    await writeSnapshot(original, next.state.legacy);
    next.state.importInfo.archive = "origin.json.gz";
    delete next.state.legacy;
    for (const p of next.state.people) {
      delete p.g;
      delete p.q;
    }
    return {
      saved: next,
      checksum,
      importMs: Math.round(performance.now() - start),
    };
  }
  const prepared = await prepare();
  global.gc?.();
  const g = createGame(400, prepared.saved),
    initial = g.money(),
    times = [];
  for (let i = 0; i < 10; i++) {
    const at = performance.now();
    g.command({ action: "advance", days: 1 });
    times.push(performance.now() - at);
  }
  assert(Math.abs(g.money() - initial) < 1e-5);
  const view = g.view(),
    viewBytes = zlib.gzipSync(JSON.stringify(view)).length;
  assert.equal(view.population, 4999);
  assert(view.people.length <= 150);
  assert(viewBytes < 100000, "전체 주민·학습 자료 반복 전송 없음");
  const file = path.join(dir, "snapshot.json.gz"),
    at = performance.now(),
    bytes = await writeSnapshot(file, g.export()),
    saveMs = performance.now() - at;
  const restored = createGame(
    1,
    JSON.parse(zlib.gunzipSync(fs.readFileSync(file))),
  );
  assert.equal(
    hash(zlib.gunzipSync(fs.readFileSync(original))),
    prepared.checksum,
    "기존 5000명 전체 원본과 g/q 손실 없는 보관",
  );
  g.command({ action: "advance", days: 1 });
  restored.command({ action: "advance", days: 1 });
  assert.equal(
    JSON.stringify(restored.export()),
    JSON.stringify(g.export()),
    "대규모 저장 복원 후 동일 진행",
  );
  global.gc?.();
  const result = {
    population: 5000,
    importMs: prepared.importMs,
    tenDayMs: times.map((n) => Math.round(n)),
    viewGzipBytes: viewBytes,
    snapshotGzipBytes: bytes,
    originalArchiveGzipBytes: fs.statSync(original).size,
    saveMs: Math.round(saveMs),
    rssBytes: process.memoryUsage().rss,
  };
  assert(bytes < 500000, "원본 보관본을 매 명령 저장에 중복 직렬화하지 않음");
  fs.mkdirSync("/workspace/artifacts", { recursive: true });
  fs.writeFileSync(
    "/workspace/artifacts/rebuild-performance.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
