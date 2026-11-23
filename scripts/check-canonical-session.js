'use strict';
const assert = require('node:assert/strict');
const { createWorld } = require('../engine');
const { createSession } = require('../rebuild/core/session');
const clone = value => structuredClone(value);
let checks = 0;

for (const [seed, population, days] of [[7, 100, 60], [19, 100, 60], [42, 5000, 2]]) {
  // 엔진의 모듈 전역 지형을 공유하므로 동시에 두 세계를 실행하지 않는다.
  const original = createWorld(seed, population);
  const start = clone(original.exportState());
  for (let day = 0; day < days; day++) original.step();
  const expected = clone(original.exportState());
  const session = createSession({ seed, population });
  assert.deepEqual(session.checkpoint().engine, start);
  for (let day = 0; day < days; day++) session.advance();
  assert.deepEqual(session.checkpoint().engine, expected);
  assert.equal(session.summary().revision, days);
  session.close();
  checks++;
  console.log(`seed=${seed}, population=${population}, days=${days}: 원본과 전체 저장·난수 동일`);
}

const world = createWorld(91, 100);
for (let i = 0; i < 30; i++) world.step();
const source = clone(world.exportState());
const playerId = source.S.agents[0].id;
// 아직 자연 발생하지 않은 권리·의무도 축약하거나 버리지 않는지 확인하는 저장 fixture.
source.S.contractFixture = { owner: playerId, amount: 12.345678901234, due: 77,
  share: { person: playerId, units: 731 }, extension: ['unknown-field'] };
const untouched = clone(source);
const baseline = createWorld(source.S.seed, source.S.agents.length);
baseline.importState(clone(source));
const normalized = clone(baseline.exportState());
baseline.step();
const next = clone(baseline.exportState());
let session = createSession({ legacy: source, playerId });
assert.deepEqual(source, untouched, '호출자 저장을 변형하지 않음');
assert.deepEqual(session.checkpoint().engine, normalized, '기존 import의 정규화 외 변경 없음');
assert.throws(() => createSession(), /ONE_WORLD_PER_WORKER/);
const person = session.read({ kind: 'person', id: playerId });
person.cash = -999;
person.g.changed = true;
assert.notEqual(session.read({ kind: 'person', id: playerId }).cash, -999);
assert.equal(session.read({ kind: 'person', id: playerId }).g.changed, undefined);
assert.throws(() => session.read({ kind: 'deposit', id: 0 }), /UNSUPPORTED_REFERENCE/);
assert.equal(session.read({ kind: 'person', id: 99999999 }), null);
assert.deepEqual(session.read({ kind: 'plot', id: 0 }), normalized.S.plots[0]);
assert.equal(session.summary().yearDays, 60);
const checkpoint = session.checkpoint();
session.close();
assert.throws(() => session.summary(), /SESSION_CLOSED/);
session = createSession({ checkpoint });
session.advance();
assert.deepEqual(session.checkpoint().engine, next, '저장/복원 뒤 다음 하루도 원본과 동일');
session.close();
assert.equal(checkpoint.strategy.revision, 0);
assert.equal(checkpoint.strategy.playerId, playerId);
checks++;

assert.throws(() => createSession({ checkpoint: { ...checkpoint, version: 999 } }), /UNSUPPORTED_CHECKPOINT/);
assert.throws(() => createSession({ legacy: source, playerId: 99999999 }), /PLAYER_NOT_FOUND/);
const broken = clone(source);
delete broken.S.agents[0].q;
assert.throws(() => createSession({ legacy: broken }), /MISSING_LEARNING_STATE/);
const duplicate = clone(source);
duplicate.S.agents.push(clone(duplicate.S.agents[0]));
assert.throws(() => createSession({ legacy: duplicate }), /INVALID_PERSON_ID/);
// 사망 신원을 새 주민으로 바꾸지 않고 sidecar의 참조를 계속 보존한다.
const dead = clone(source);
const lost = dead.S.agents.shift();
lost.alive = false;
dead.dead.push(lost);
session = createSession({ legacy: dead, playerId: lost.id });
const deadCheckpoint = session.checkpoint();
assert.equal(session.read({ kind: 'person', id: lost.id }).alive, false);
assert(deadCheckpoint.engine.dead.some(x => x.id === lost.id));
session.close();
session = createSession({ checkpoint: deadCheckpoint });
assert.equal(session.summary().playerId, lost.id);
assert.equal(session.read({ kind: 'person', id: lost.id }).alive, false);
session.close();
checks++;
console.log(`${checks}개 기본 검사군 통과: 계산 동일성, 5,000명 g/q, 비파괴 입력, 복원 연속성, 신원·참조 경계`);

const dynasty = createWorld(612, 120);
dynasty.dynStart();
const waiting = clone(dynasty.exportState());
session = createSession({ legacy: waiting, playerId: waiting.S.dyn.pid });
assert.equal(session.summary().pendingDecision, true);
const beforeBlocked = session.checkpoint();
assert.throws(() => session.advance(), /DECISION_PENDING/);
assert.deepEqual(session.checkpoint(), beforeBlocked, '대기 중 시간·난수·revision 불변');
session.close();
dynasty.dynChoose(dynasty.S.dyn.pending[0].id, 'go');
const banker = dynasty.S.byId.get(dynasty.S.dyn.pid);
const ceo = dynasty.S.agents.find(a => a.alive && a.id !== banker.id && a.age >= 18 * 60);
banker.cash = 10000;
dynasty.S.cbank = { base: .02 };
dynasty.S.banks = [{ id: 1, name: '가문은행', own: banker.id, alive: true, capital: 10,
  ops: { loanRate: .02, depositRate: .008, reserveRatio: .15 } }];
dynasty.S.firms.push({ id: 1, name: '새빛상사', pre: '새빛', suf: '상사',
  ceo: ceo.id, founder: ceo.id, sh: { [ceo.id]: 10000 }, totalShares: 10000,
  shareVersion: 74, price: 1, p30: 1, born: dynasty.S.day, bld: [], cash: 100, debt: 0 });
dynasty.S.nextFirm = 2;
dynasty.dynAct('corp:offer:1:100:0.02:6:none');
const proposal = dynasty.S.dyn.pending.find(p => p.kind === 'corpNegotiation');
assert(proposal);
dynasty.dynChoose(proposal.id, 'seal');
assert.equal(dynasty.S.corpLoans.length, 1);
const creditSource = clone(dynasty.exportState());
const nativeRestore = createWorld(creditSource.S.seed, creditSource.S.agents.length);
nativeRestore.importState(clone(creditSource));
const creditExpected = clone(nativeRestore.exportState());
nativeRestore.step();
const creditNext = clone(nativeRestore.exportState());
session = createSession({ legacy: creditSource, playerId: banker.id });
assert.equal(session.summary().pendingDecision, false, '비어 있는 선택 큐는 진행 가능');
const serializedCredit = JSON.parse(JSON.stringify(session.checkpoint()));
assert.deepEqual(session.checkpoint().engine, creditExpected);
assert.deepEqual(session.read({ kind: 'firm', id: 1 }).sh, creditExpected.S.firms[0].sh);
assert.deepEqual(session.read({ kind: 'corporateLoan', id: creditSource.S.corpLoans[0].id }),
  creditSource.S.corpLoans[0]);
assert.equal(session.read({ kind: 'bank', id: 1 }).own, banker.id);
session.advance();
assert.deepEqual(session.checkpoint().engine, creditNext, '기업 채권·가문 저장 다음 하루 동일');
session.close();
console.log('추가 검사 통과: 결정 대기/해제, 실제 기업 대출·지분·은행·가문 저장 및 다음 하루 동일');

assert.throws(() => createSession({ checkpoint: { ...checkpoint, engine: undefined } }), /UNSUPPORTED_ENGINE_SNAPSHOT/);
assert.throws(() => createSession({ legacy: null }), /UNSUPPORTED_ENGINE_SNAPSHOT/);
assert.throws(() => createSession({ checkpoint: null }), /UNSUPPORTED_CHECKPOINT/);
console.log('손상 envelope의 새 세계 대체 방지 검사 통과');

const diskNative = createWorld(creditSource.S.seed, creditSource.S.agents.length);
diskNative.importState(JSON.parse(JSON.stringify(creditExpected)));
diskNative.step();
const diskExpected = JSON.parse(JSON.stringify(diskNative.exportState()));
session = createSession({ checkpoint: serializedCredit });
session.advance();
assert.deepEqual(JSON.parse(JSON.stringify(session.checkpoint().engine)), diskExpected,
  '실제 JSON 직렬화/복원 뒤 기업 계약·학습·난수의 다음 하루 동일');
session.close();
const ambiguous = clone(creditSource);
ambiguous.S.banks.push(clone(ambiguous.S.banks[0]));
session = createSession({ legacy: ambiguous });
assert.throws(() => session.read({ kind: 'bank', id: 1 }), /AMBIGUOUS_REFERENCE/);
session.close();
console.log('JSON 저장 복원과 모호한 자산/조직 참조 거부 검사 통과');

// 2단계 envelope v1도 현재 v7로 읽는다. 기존 관찰 세계를 임의로 가문 세계로 바꾸지 않는다.
session = createSession({ checkpoint: { format: 'free-village.canonical', version: 1,
  engine: source, strategy: { revision: 0, playerId } } });
assert.equal(session.checkpoint().version, 7);
assert.deepEqual(session.checkpoint().engine, normalized);
assert.equal(session.summary().playerId, playerId);
assert.throws(() => session.catalog(), /STRATEGY_DISABLED/);
session.close();
console.log('2단계 v1 저장의 v7 비파괴 복원 검사 통과');
