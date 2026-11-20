'use strict';
// 기존의 동적 행동 목록에서 실제로 제시되는 키를 공통 실행기로 검사한다.
const assert = require('node:assert/strict');
const { createWorld } = require('../engine');
const { createCommands } = require('../rebuild/core/commands');
const { reconcile } = require('../rebuild/core/contracts');
const clone = x => structuredClone(x);
for (const role of ['common', 'king', 'tycoon']) {
  const world = createWorld(42, 100);
  world.dynStart(); world.dynConfigureStart({ age: 35, status: role, family: 'children', wealth: 'wealthy', edu: 2 });
  world.dynChoose(world.S.dyn.pending[0].id, 'go'); world.dynSetStory(0);
  const strategy = { worldId: role, revision: 0, playerId: world.S.dyn.pid };
  reconcile(world, strategy);
  const api = createCommands(world, strategy);
  const other = world.S.agents.find(a => a.id !== strategy.playerId && a.alive);
  const catalogBefore = clone(world.exportState());
  const catalog = api.catalog(other.id);
  assert.deepEqual(world.exportState(), catalogBefore, '목록 조회의 난수·상태 불변');
  const keys = [...new Set(catalog.actions.flatMap(row => row.opts?.length ? row.opts.map(o => `${row.k}:${o[0]}`) : [row.k]))];
  let permitted = 0, rejected = 0;
  for (const key of keys) {
    const request = { worldId: role, commandId: 'catalog:1', expectedRevision: 0,
      actor: { kind: 'person', id: strategy.playerId }, action: 'act', args: { key } };
    const before = clone(world.exportState()), sidecar = clone(strategy);
    const preview = api.preview(request);
    assert.deepEqual(world.exportState(), before, key + ': 미리보기 상태 불변');
    assert.deepEqual(strategy, sidecar, key + ': 미리보기 전략 상태 불변');
    if (!preview.allowed) { assert(preview.reasons[0].message); rejected++; continue; }
    const result = world.commandTransaction(() => api.execute({ ...request, previewToken: preview.previewToken }), true);
    for (const k of Object.keys(strategy)) delete strategy[k]; Object.assign(strategy, sidecar);
    assert(result.allowed, key + ': 미리보기 허용 뒤 실제 실행 거부: ' + JSON.stringify(result.reasons));
    if (!preview.uncertainty) {
      assert.deepEqual(result.ledger, preview.accounts, key + ': 표시 금액 일치');
      assert.deepEqual(result.inventory, preview.inventory, key + ': 표시 물량 일치');
    }
    assert.deepEqual(world.exportState(), before, key + ': 외부 거래 복구');
    permitted++;
  }
  assert(permitted > 0);
  console.log(`${role}: 동적 키 ${keys.length}개 — 실행 일치 ${permitted}, 조건/인자 부족 거절 ${rejected}`);
}
