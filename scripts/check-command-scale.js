'use strict';
const assert = require('node:assert/strict');
const { createSession } = require('../rebuild/core/session');
let session = createSession({ mode: 'strategy', seed: 42, population: 5000, worldId: 'scale' });
let seq = 0;
function apply(action, args) {
  const state = session.summary();
  const command = { worldId: state.worldId, commandId: `scale:${++seq}`, expectedRevision: state.revision,
    actor: { kind: 'person', id: state.playerId }, action, args };
  const before = session.checkpoint();
  const preview = session.preview(command);
  assert.deepEqual(session.checkpoint(), before);
  assert(preview.allowed, JSON.stringify(preview));
  const result = session.execute({ ...command, previewToken: preview.previewToken });
  assert(result.allowed, JSON.stringify(result));
  return { command: { ...command, previewToken: preview.previewToken }, result };
}
const learning = session.checkpoint().engine.S.agents.map(a => ({ id: a.id, g: a.g, q: a.q }));
const start = session.catalog().decisions[0];
apply('choose', { id: start.id, key: 'go' });
const vault = apply('vault', { dir: 'in', frac: .5 });
assert.deepEqual(session.checkpoint().engine.S.agents.map(a => ({ id: a.id, g: a.g, q: a.q })), learning);
const saved = JSON.parse(JSON.stringify(session.checkpoint()));
assert.equal(saved.engine.S.agents.length, 5000);
session.close();
session = createSession({ checkpoint: saved });
assert.equal(session.execute(vault.command).replayed, true);
assert.equal(session.summary().population, 5000);
session.close();
console.log('5,000명: 공통 시작/금고 명령·미리보기 불변·g/q 보존·JSON 복원·중복 집행 방지 통과');
