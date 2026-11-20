"use strict";
const { parentPort, workerData } = require("node:worker_threads");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const { createGame } = require("./game");
const { migrateLegacy } = require("./migration");
const { writeSnapshot } = require("../server-storage");
const dir = process.env.VILLAGE_SAVE_DIR || path.join(__dirname, "../save");
const editor = workerData.name === "editor",
  options = { editor };
const file = path.join(
  dir,
  editor ? "rebuild-editor.json.gz" : "rebuild.json.gz",
);
let game,
  revision = 0,
  dirty = false;
try {
  game = createGame(
    workerData.seed,
    JSON.parse(zlib.gunzipSync(fs.readFileSync(file))),
    options,
  );
} catch (e) {
  if (e.code !== "ENOENT") throw e;
  game = createGame(workerData.seed, undefined, options);
  dirty = true;
}
const compressed = (value) => zlib.gzipSync(JSON.stringify(value));
function view() {
  const value = game.view();
  parentPort.postMessage({
    type: "view",
    day: value.day,
    revision: ++revision,
    body: compressed(value),
  });
}
async function save() {
  if (!dirty) return;
  fs.mkdirSync(dir, { recursive: true });
  const bytes = await writeSnapshot(file, game.export());
  dirty = false;
  parentPort.postMessage({ type: "saved", day: game.view().day, bytes });
}
let chain = Promise.resolve();
parentPort.on("message", (msg) => {
  if (msg.type === "heartbeat") return;
  chain = chain.then(async () => {
    if (["people", "resident", "export"].includes(msg.type)) {
      try {
        const value =
          msg.type === "people"
            ? game.people(msg.page, msg.filter)
            : msg.type === "resident"
              ? game.resident(Number(msg.id))
              : game.export();
        if (msg.type === "export" && value.state.importInfo?.archive) {
          const name = value.state.importInfo.archive;
          if (!/^rebuild-(?:editor-)?origin-[0-9]+\.json\.gz$/.test(name))
            throw Error("원본 보관 경로가 올바르지 않습니다");
          value.state.legacy = JSON.parse(
            zlib.gunzipSync(fs.readFileSync(path.join(dir, name))),
          );
        }
        parentPort.postMessage({
          type: "reply",
          id: msg.idRequest ?? msg.id,
          replyType: msg.type,
          value: value == null ? null : compressed(value),
        });
      } catch (e) {
        parentPort.postMessage({
          type: "reply",
          id: msg.idRequest ?? msg.id,
          replyType: "error",
          value: e.message,
        });
      }
      return;
    }
    if (msg.type === "preview") {
      try {
        const input = JSON.parse(msg.raw),
          legacy = input.state?.S;
        const result = legacy
          ? {
              migration: true,
              population: legacy.agents?.length || 0,
              day: legacy.day || 0,
              description:
                "주민과 개인 현금을 새 규칙으로 옮깁니다. 종전 직위·부동산·회사 지분·계약·사건은 자동 실행하지 않으며 전체 원본 보관본과 함께 내보낼 수 있습니다. 새 규칙의 첫날부터 시작합니다.",
            }
          : {
              migration: false,
              population: input.state?.people?.length || 0,
              day: input.state?.day || 0,
              description:
                "새 게임의 계획·약속·관계·가문 상태를 그대로 이어갑니다.",
            };
        if (!input.state || !result.population)
          throw Error("지원하지 않는 저장입니다");
        parentPort.postMessage({
          type: "reply",
          id: msg.idRequest ?? msg.id,
          replyType: "preview",
          value: result,
        });
      } catch (e) {
        parentPort.postMessage({
          type: "reply",
          id: msg.idRequest ?? msg.id,
          replyType: "error",
          value: e.message,
        });
      }
      return;
    }
    const previous = game.export();
    try {
      if (msg.type === "export") {
        parentPort.postMessage({
          type: "reply",
          id: msg.id,
          replyType: "export",
          value: compressed(game.export()),
        });
        return;
      }
      if (msg.type === "import") {
        if (!editor && !game.view().canImport)
          throw Error(
            "진행 중인 저장이 있습니다. 실험실에서 먼저 가져오기를 확인하세요.",
          );
        const input = JSON.parse(msg.raw),
          next = input.state?.people ? input : migrateLegacy(input);
        if (next.state.legacy) {
          fs.mkdirSync(dir, { recursive: true });
          const archive =
            "rebuild-" +
            (editor ? "editor-" : "") +
            "origin-" +
            Date.now() +
            ".json.gz";
          await writeSnapshot(path.join(dir, archive), next.state.legacy);
          next.state.importInfo.archive = archive;
          delete next.state.legacy;
          for (const p of next.state.people) {
            delete p.g;
            delete p.q;
          }
        }
        game = createGame(workerData.seed, next, options);
        dirty = true;
        await save();
        view();
        parentPort.postMessage({
          type: "reply",
          id: msg.id,
          replyType: "import",
          value: { ok: true, day: game.view().day },
        });
        return;
      }
      if (msg.type !== "command") throw Error("지원하지 않는 요청");
      // 명령 직후 저장의 원자 교체까지 성공해야 새 뷰와 성공 응답을 보낸다.
      game.command(msg.command);
      dirty = true;
      await save();
      view();
      parentPort.postMessage({
        type: "reply",
        id: msg.id,
        replyType: "command",
        value: { ok: true, day: game.view().day },
      });
    } catch (e) {
      game = createGame(workerData.seed, previous, options);
      parentPort.postMessage({
        type: "reply",
        id: msg.id,
        replyType: "error",
        value: e.message,
      });
    }
  });
});
view();
