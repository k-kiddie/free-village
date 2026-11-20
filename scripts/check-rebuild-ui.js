"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  zlib = require("node:zlib"),
  { spawn } = require("node:child_process");
const { chromium } = require("playwright");
const { createGame } = require("../rebuild/game");
const root = path.resolve(__dirname, ".."),
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "rebuild-ui-")),
  port = 19623,
  base = `http://127.0.0.1:${port}`,
  art = process.env.UI_ARTIFACT_DIR || "/workspace/artifacts";
fs.mkdirSync(art, { recursive: true });
let logs = "";
let server;
function start() {
  server = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      POPULATION: "20",
      WORLD_SWITCH_MIN_MS: "0",
      VILLAGE_SAVE_DIR: dir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (x) => (logs += x));
  server.stderr.on("data", (x) => (logs += x));
  return server;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function ready() {
  for (let i = 0; i < 200; i++) {
    try {
      if ((await fetch(base + "/health")).ok) return;
    } catch {}
    if (server.exitCode !== null) throw Error(logs);
    await wait(50);
  }
  throw Error("서버 시작 시간 초과: " + logs);
}
async function stop() {
  server.kill("SIGTERM");
  if (server.exitCode === null)
    await new Promise((r) => server.once("exit", r));
}
async function view(route = "/play") {
  for (let i = 0; i < 100; i++) {
    const r = await fetch(base + route + "/api/view");
    if (r.ok) return r.json();
    await wait(50);
  }
  throw Error("뷰 준비 실패");
}
async function cmd(c, route = "/play") {
  const r = await fetch(base + route + "/api/cmd", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(c),
  });
  return { status: r.status, value: await r.json() };
}
(async () => {
  let browser;
  start();
  try {
    await ready();
    browser = await chromium.launch({
      headless: true,
      executablePath: "/usr/bin/chromium",
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    for (const width of [360, 390, 820]) {
      const context = await browser.newContext({
          viewport: { width, height: 844 },
        }),
        page = await context.newPage(),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base + "/play");
      await page.waitForSelector('[data-action="open"]');
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "가로 넘침 없음",
      );
      const open = await page.locator('[data-action="open"]').boundingBox(),
        nav = await page.locator("nav").boundingBox();
      assert(
        open.y + open.height <= nav.y,
        "개업 행동이 스크롤 없이 첫 화면에 있음",
      );
      await page.screenshot({ path: path.join(art, `rebuild-${width}.png`) });
      await page.locator('.map-site[data-site="4"]').click();
      await page.waitForFunction(() =>
        document.querySelector(".target-panel h2").textContent.includes("골목"),
      );
      await page.locator('[data-tab="activity"]').click();
      await page.waitForSelector("#goal");
      for (const kind of [
        "politics",
        "government",
        "family",
        "life",
        "storage",
      ]) {
        await page.locator(`[data-dialog="${kind}"]`).click();
        assert(await page.locator("#sheet").isVisible());
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        await page.locator("[data-close]").click();
      }
      await page.locator('[data-tab="people"]').click();
      assert((await page.locator(".person").count()) > 0);
      await page.locator(".person").first().click();
      await page.locator('[data-action="talk"][data-value="listen"]').click();
      await page.waitForFunction(() => !document.querySelector("#sheet").open);
      await page.locator('[data-tab="village"]').click();
      assert(
        (await page
          .locator('.map-site[data-site="4"]')
          .getAttribute("aria-pressed")) === "true",
        "선택 장소 복귀",
      );
      assert.equal(errors.length, 0, errors.join("\n"));
      await context.close();
    }
    // Reset only this test's temporary world through a full server restart, preserving production files.
    await stop();
    const initial = createGame(20261120).export();
    fs.writeFileSync(
      path.join(dir, "rebuild.json.gz"),
      zlib.gzipSync(JSON.stringify(initial)),
    );
    start();
    await ready();
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    await page.goto(base + "/play");
    await page.waitForSelector('[data-action="open"]');
    await page.locator('[data-action="open"]').click();
    await page.waitForFunction(() =>
      document.body.textContent.includes("예약 예산"),
    );
    for (let i = 0; i < 3; i++) {
      await page.locator('[data-action="advance"][data-days="1"]').click();
      await page.waitForFunction(
        (d) => document.querySelector("#hud").textContent.includes(d + "일"),
        i + 1,
      );
    }
    await page.locator('[data-dialog="firm"]').click();
    await page.locator('[data-action="hire"]').click();
    await page.waitForFunction(() => !document.querySelector("#sheet").open);
    await page.waitForFunction(() =>
      document.body.textContent.includes("직원 1/3"),
    );
    await page.locator('[data-action="advance"][data-days="7"]').click();
    await page.waitForFunction(() =>
      document.querySelector("#hud").textContent.includes("10일"),
    );
    const v = await view();
    assert(v.firms.some((f) => f.owner === "player" && f.workers.length === 1));
    assert(fs.existsSync(path.join(dir, "rebuild.json.gz")));
    const exported = await (await fetch(base + "/play/api/export")).json();
    assert.equal(exported.state.day, v.day);
    assert(
      JSON.stringify(v).length < 100000,
      "일반 화면에 원본 저장·학습 자료를 보내지 않음",
    );
    const tag = (await fetch(base + "/play/api/view")).headers.get("etag");
    assert.equal(
      (
        await fetch(base + "/play/api/view", {
          headers: { "if-none-match": tag },
        })
      ).status,
      304,
    );
    assert.equal(
      (
        await fetch(base + "/play/api/import", {
          method: "POST",
          body: JSON.stringify(initial),
        })
      ).status,
      500,
      "진행 중인 마을 덮어쓰기 거부",
    );
    const forbidden = await cmd({
      action: "edit:district",
      district: 0,
      key: "homes",
      value: 99,
    });
    assert.equal(forbidden.status, 500);
    const before = v.day;
    await page.close();
    await view("/editor");
    assert.equal(
      (
        await cmd(
          { action: "edit:district", district: 0, key: "homes", value: 99 },
          "/editor",
        )
      ).status,
      200,
    );
    assert.equal((await view("/editor")).districts[0].homes, 99);
    const restored = await view("/play");
    assert.equal(restored.day, before);
    assert.notEqual(restored.districts[0].homes, 99);
    await stop();
    start();
    await ready();
    const again = await view("/play");
    assert.equal(again.day, before, "HTTP 서버 재시작 후 저장 복원");
    assert.deepEqual(again.firms, v.firms);
    assert.equal((await fetch(base + "/")).status, 200);
    assert.equal((await fetch(base + "/god")).status, 200);
    const roster = await (
      await fetch(base + "/play/api/people?page=1&filter=all")
    ).json();
    assert.equal(roster.people.length, 8);
    assert.equal(roster.total, 60);
    const failBefore = await view("/play");
    fs.chmodSync(dir, 0o555);
    try {
      assert.equal(
        (await cmd({ action: "visit", district: 0 })).status,
        500,
        "저장 실패는 명령 실패",
      );
    } finally {
      fs.chmodSync(dir, 0o755);
    }
    assert.equal((await cmd({ action: "save" })).status, 200);
    const failAfter = await view("/play");
    assert.equal(
      failAfter.player.energy,
      failBefore.player.energy,
      "저장 실패 시 시간도 복원",
    );
    assert.equal(
      failAfter.player.trust,
      failBefore.player.trust,
      "저장 실패 시 신뢰도 복원",
    );
    const old = require("../engine").createWorld(61, 30),
      original = { seed: 61, population: 30, state: old.exportState() };
    await view("/editor");
    const importResponse = await fetch(base + "/editor/api/import", {
      method: "POST",
      body: JSON.stringify(original),
    });
    assert.equal(importResponse.status, 200, await importResponse.text());
    const imported = await (await fetch(base + "/editor/api/export")).json();
    assert.deepEqual(
      imported.state.legacy,
      original,
      "HTTP 가져오기·내보내기에서 전체 g/q 원본 보존",
    );
    const stored = JSON.parse(
      zlib.gunzipSync(
        fs.readFileSync(path.join(dir, "rebuild-editor.json.gz")),
      ),
    );
    assert(
      !stored.state.legacy && stored.state.importInfo.archive,
      "일상 저장은 원본 보관본을 중복 저장하지 않음",
    );
    assert(fs.existsSync(path.join(dir, stored.state.importInfo.archive)));
    const corrupt = await fetch(base + "/editor/api/import", {
      method: "POST",
      body: JSON.stringify({ version: 999, state: { people: [] } }),
    });
    assert.equal(corrupt.status, 500);
    assert.equal(
      (await view("/editor")).population,
      29,
      "미지원 저장은 진행 상태를 바꾸지 않음",
    );
    console.log(
      "리빌드 HTTP·UI 통과: 360/390/820px 첫 화면 행동·대상 복귀·전체 메뉴·개업→고용→운영·내보내기·덮어쓰기 거부·편집 권한·세계 격리·서버 재시작 복원",
    );
  } finally {
    if (browser) await browser.close();
    await stop();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
