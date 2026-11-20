'use strict';
const assert = require('node:assert/strict');
const { Worker } = require('node:worker_threads');
const path = require('node:path');
const { createWorld } = require('../engine');
const { createSession } = require('../rebuild/core/session');
const { createCommands } = require('../rebuild/core/commands');
const clone = x => structuredClone(x);
let s, seq;
const open = options => { s = createSession({ mode: 'strategy', ...options }); seq = 0; };
function request(action, args, client = 'test', number = seq + 1) {
  const state = s.summary();
  return { worldId: state.worldId, commandId: `${client}:${number}`, expectedRevision: state.revision,
    actor: { kind: 'person', id: state.playerId }, action, args };
}
function apply(action, args) {
  const r = request(action, args), before = s.checkpoint();
  const p = s.preview(r);
  assert.deepEqual(s.checkpoint(), before, '미리보기는 엔진·난수·전략 상태를 바꾸지 않음');
  assert(p.allowed, JSON.stringify(p));
  const out = s.execute({ ...r, previewToken: p.previewToken });
  assert(out.allowed, JSON.stringify(out));
  seq++;
  if (!p.uncertainty) assert.deepEqual(out.ledger, p.accounts, '표시 원장과 실제 차감 일치');
  return { r: { ...r, previewToken: p.previewToken }, p, out };
}
function denied(r, code, execute = false) {
  const before = s.checkpoint(), out = execute ? s.execute(r) : s.preview(r);
  assert.equal(out.allowed, false);
  assert.equal(out.reasons[0].code, code, JSON.stringify(out));
  assert.deepEqual(s.checkpoint(), before, '거절은 원자적으로 상태 불변');
}
function start() { const p = s.catalog().decisions.find(p => p.kind === 'start'); apply('choose', { id: p.id, key: 'go' }); }
open({ seed: 7, population: 100, worldId: 'stage3-test' });
const originalStart = s.catalog().decisions[0];
const configured = apply('configureStart', { character: { age: 25, wealth: 'modest', sex: 'M' } });
assert.deepEqual(s.execute(configured.r), { ...configured.out, replayed: true }, '제어 인물이 변경되어도 재전송은 재집행하지 않음');
start();
apply('rename', { sur: '홍', given: '길동' });
apply('budget', { budget: { life: 0, edu: 1, save: .2 } });
apply('story', { freq: 0 });
const saved = apply('vault', { dir: 'in', frac: .5 });
assert.equal(saved.out.ledger.length, 2);
assert(Math.abs(saved.out.ledger.reduce((n, r) => n + r.amount, 0)) < 1e-9, '금고 이동은 새 돈을 만들지 않음');
const after = s.checkpoint();
assert.deepEqual(s.execute(saved.r), { ...saved.out, replayed: true });
assert.deepEqual(s.checkpoint(), after);
denied({ ...saved.r, args: { dir: 'out', frac: .5 } }, 'COMMAND_ID_CONFLICT', true);
denied(request('vault', { dir: 'out', frac: Infinity }), 'INVALID_ARGUMENT');
denied({ ...request('vault', { dir: 'out', frac: .5 }), worldId: 'other' }, 'WRONG_WORLD');
denied({ ...request('vault', { dir: 'out', frac: .5 }), actor: { kind: 'person', id: 999 } }, 'NOT_CONTROLLED');
denied(request('vault', { dir: 'out', frac: .5 }), 'PREVIEW_REQUIRED', true);
denied(request('__proto__', {}), 'UNKNOWN_ACTION');
denied(request('act', { key: 'missing-action' }), 'RULE_REJECTED');
const stale = request('vault', { dir: 'out', frac: .5 });
const stalePreview = s.preview(stale);
s.advance();
denied({ ...stale, previewToken: stalePreview.previewToken }, 'STALE_REVISION', true);
const checkpoint = JSON.parse(JSON.stringify(s.checkpoint()));
s.close();
s = createSession({ checkpoint });
assert.equal(s.execute(saved.r).replayed, true, 'JSON 복원 뒤에도 재전송 중복 집행 방지');
s.close();

// 명령 이력을 줄여도 오래된 요청은 재집행하지 않는다. 특수한 클라이언트 키도 데이터로 저장한다.
open({ seed: 19, population: 20 });
const oldest = apply('choose', { id: s.catalog().decisions[0].id, key: 'go' });
for (let i = 0; i < 129; i++) apply('story', { freq: 0 });
denied(oldest.r, 'RESULT_EXPIRED', true);
denied(request('story', { freq: 0 }, 'gap', 2), 'COMMAND_SEQUENCE_GAP');
const special = request('story', { freq: 0 }, '__proto__', 1);
const specialPreview = s.preview(special);
const specialCommand = { ...special, previewToken: specialPreview.previewToken };
assert.equal(s.execute(specialCommand).allowed, true);
assert.equal(s.execute(specialCommand).replayed, true);
assert.equal(s.preview(specialCommand).alreadyExecuted, true);
const specialSave = JSON.parse(JSON.stringify(s.checkpoint()));
s.close(); s = createSession({ checkpoint: specialSave });
assert.equal(s.execute(specialCommand).replayed, true);
s.close();

// 같은 예금주·은행의 복수 계약, 지급 부족, 부분 지급, 소멸·신규 식별.
const w = createWorld(1818, 100); w.dynStart(); w.dynChoose(w.S.dyn.pending[0].id, 'go');
const me = w.S.byId.get(w.S.dyn.pid), banker = w.S.agents.find(a => a.id !== me.id);
me.cash = 0; banker.cash = 3; banker.dres = 0;
w.S.deps = [{ bank: banker.id, s: me.id, amt: 100, rate: 0, day: w.S.day },
  { bank: banker.id, s: me.id, amt: 5, rate: .01, day: w.S.day }];
open({ legacy: clone(w.exportState()), playerId: me.id });
const deposits = s.contracts().filter(c => c.kind === 'deposit');
assert.equal(deposits.length, 2); assert.notEqual(deposits[0].id, deposits[1].id);
const paid = apply('act', { key: 'dep:out' });
assert.equal(s.read({ kind: 'person', id: me.id }).cash, 3);
assert.equal(s.checkpoint().engine.S.deps.reduce((n, d) => n + d.amt, 0), 102);
assert.deepEqual(s.contracts().filter(c => c.kind === 'deposit').map(c => c.id), deposits.map(c => c.id));
assert(paid.out.ledger.some(r => r.id === `person:${banker.id}:cash` && r.amount === -3));
s.close();

// 개인 돈과 공금을 분리하고 현직·부처·관할 자격을 다시 검사한다.
const publicWorld = createWorld(42, 100); publicWorld.dynStart();
publicWorld.dynConfigureStart({ age: 40, status: 'king', family: 'children', edu: 0 });
publicWorld.dynChoose(publicWorld.S.dyn.pending[0].id, 'go');
const official = publicWorld.S.byId.get(publicWorld.S.dyn.pid);
const recipient = publicWorld.S.agents.find(a => a.id !== official.id);
for (const a of publicWorld.S.agents) { a.hunger = 0; a.inv.grain = 50; }
recipient.hunger = 100; official.cash = 0;
publicWorld.S.gov.tre = 1000;
publicWorld.S.gov.bud = { d: 0, total: 7000, spent: {},
  lines: Object.fromEntries(['adm', 'welf', 'pub', 'def', 'pol', 'edu', 'health'].map(k => [k, 1000])) };
const unauthorized = clone(publicWorld.exportState());
unauthorized.S.gov.chief = recipient.id; unauthorized.S.gov.king = recipient.id;
unauthorized.S.gov.min = { edu: { k: 'edu', mn: official.id, name: '교육부', tier: 0 } };
open({ legacy: clone(publicWorld.exportState()), playerId: official.id });
const relief = apply('act', { key: 'public:relief' });
assert.equal(s.read({ kind: 'person', id: official.id }).cash, 0, '공적 구휼은 사비를 쓰지 않음');
assert(relief.out.ledger.some(row => row.id === 'government:treasury' && row.amount < 0));
assert(relief.p.publicAccounts.some(row => row.category === 'welf'));
assert(s.read({ kind: 'person', id: recipient.id }).hunger < 100);
assert(relief.out.duration.cooldowns.some(row => row.remainingDays > 0));
s.close();
open({ legacy: unauthorized, playerId: official.id });
denied(request('act', { key: 'public:relief' }), 'RULE_REJECTED');
s.close();

// 사후조건/등록 실패도 엔진·난수·참조까지 복구한다. 내부 핸들러 고장을 주입한다.
const faultWorld = createWorld(91, 100); faultWorld.dynStart(); faultWorld.dynChoose(faultWorld.S.dyn.pending[0].id, 'go');
const actor = faultWorld.S.byId.get(faultWorld.S.dyn.pid);
const strategy = { worldId: 'fault', playerId: actor.id, revision: 0 };
const api = createCommands(faultWorld, strategy), beforeFault = clone(faultWorld.exportState());
const realVault = faultWorld.dynVault;
faultWorld.dynVault = () => { actor.cash -= 10; actor.q[0][0] = 999; faultWorld.step(); throw new Error('injected'); };
const faultRequest = { worldId: 'fault', commandId: 'fault:1', expectedRevision: 0,
  actor: { kind: 'person', id: actor.id }, action: 'vault', args: { dir: 'in', frac: .5 } };
assert.equal(api.preview(faultRequest).allowed, false);
assert.deepEqual(faultWorld.exportState(), beforeFault);
assert.equal(faultWorld.S.byId.get(actor.id), actor, '복구 뒤에도 기존 객체 참조 유지');
assert.deepEqual(strategy, { worldId: 'fault', playerId: actor.id, revision: 0 });
faultWorld.dynVault = realVault;
// 미리보기 뒤 권한이 사라지면 같은 revision이라도 핸들러가 다시 거부한다.
const checkWorld = createWorld(42, 100); checkWorld.importState(clone(unauthorized));
checkWorld.S.gov.min = { welf: { k: 'welf', mn: official.id, name: '복지부', tier: 0 } };
const checkState = { worldId: 'office', playerId: official.id, revision: 0 };
const checkApi = createCommands(checkWorld, checkState);
const checkRequest = { worldId: 'office', commandId: 'office:1', expectedRevision: 0,
  actor: { kind: 'person', id: official.id }, action: 'act', args: { key: 'public:relief' } };
const checkPreview = checkApi.preview(checkRequest);
assert(checkPreview.allowed, JSON.stringify(checkPreview));
checkWorld.S.gov.min = {};
const beforeLoss = clone(checkWorld.exportState());
const lostOffice = checkApi.execute({ ...checkRequest, previewToken: checkPreview.previewToken });
assert.equal(lostOffice.allowed, false);
assert.deepEqual(checkWorld.exportState(), beforeLoss);

// 거래 도중 잔액이 음수가 되면, 핸들러가 성공했다고 해도 전체 거래를 되돌린다.
faultWorld.dynVault = () => { actor.cash = -1; return { text: '잔액 오류' }; };
const underflow = api.preview(faultRequest);
assert.equal(underflow.allowed, false); assert.equal(underflow.reasons[0].code, 'INSUFFICIENT_FUNDS');
assert.deepEqual(faultWorld.exportState(), beforeFault);
faultWorld.dynVault = realVault;

// 계약 ID 충돌 역시 일부 ID·전략 상태를 남기지 않고 거부한다.
faultWorld.S.deps = [{ canonicalContractId: 1, bank: actor.id, s: actor.id, amt: 10 },
  { canonicalContractId: 1, bank: actor.id, s: actor.id, amt: 20 }];
const duplicateBefore = clone(faultWorld.exportState());
assert.equal(api.preview(faultRequest).allowed, false);
assert.deepEqual(faultWorld.exportState(), duplicateBefore);
assert.deepEqual(strategy, { worldId: 'fault', playerId: actor.id, revision: 0 });

console.log('공통 명령: 시작·인물·설정·금고·기존 행동, 표시/실행 일치, 재검사·중복·JSON 복원·부분 지급·실패 복구 통과');

async function workerCheck() {
  const worker = new Worker(path.join(__dirname, '../rebuild/core/worker.js'),
    { workerData: { options: { mode: 'strategy', seed: 19, population: 100, worldId: 'queue' } } });
  let id = 0; const pending = new Map();
  let ready;
  const started = new Promise(resolve => { ready = resolve; });
  worker.on('message', m => { if (m.ready) ready(m.ready); else { const q = pending.get(m.id); pending.delete(m.id); m.error ? q.reject(Error(m.error)) : q.resolve(m.result); } });
  const rpc = (method, ...args) => new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); worker.postMessage({ id: n, method, args }); });
  try {
    const state = await started;
    const decision = (await rpc('catalog')).decisions[0];
    const r = { worldId: state.worldId, commandId: 'phone:1', expectedRevision: state.revision,
      actor: { kind: 'person', id: state.playerId }, action: 'choose', args: { id: decision.id, key: 'go' } };
    const p = await rpc('preview', r);
    const command = { ...r, previewToken: p.previewToken };
    const [a, b] = await Promise.all([rpc('execute', command), rpc('execute', command)]);
    assert(a.allowed && b.allowed); assert.equal(b.replayed, true);
    assert.equal((await rpc('summary')).revision, state.revision + 1);
    const current = await rpc('summary');
    const one = { worldId: current.worldId, commandId: 'one:1', expectedRevision: current.revision,
      actor: { kind: 'person', id: current.playerId }, action: 'vault', args: { dir: 'in', frac: .5 } };
    const two = { ...one, commandId: 'two:1' };
    const previews = await Promise.all([rpc('preview', one), rpc('preview', two)]);
    const result = await Promise.all([rpc('execute', { ...one, previewToken: previews[0].previewToken }),
      rpc('execute', { ...two, previewToken: previews[1].previewToken })]);
    assert.equal(result[0].allowed, true); assert.equal(result[1].reasons[0].code, 'STALE_REVISION');
    console.log('실제 Worker: 동시 중복 요청 1회 집행, 같은 revision 경합은 1회 성공·1회 재검사 거절');
  } finally { await worker.terminate(); }
}
workerCheck().catch(error => { console.error(error.message); process.exitCode = 1; });
