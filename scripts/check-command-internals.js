'use strict';
const assert = require('node:assert/strict');
const { createWorld } = require('../engine');
const { reconcile } = require('../rebuild/core/contracts');
const clone = x => structuredClone(x);

function stockRun(preview) {
  const world = createWorld(612, 100), [a, b, c, d] = world.S.agents;
  const f = { id: 1, name: '검사상사', pre: '검사', suf: '상사', ceo: a.id, founder: a.id,
    sh: { [a.id]: 100, [b.id]: 100, [c.id]: 9800 }, totalShares: 10000, shareVersion: 74,
    price: .01, p30: .01, born: 0, bld: [], cash: 100, debt: 0 };
  world.S.firms.push(f); world.S.nextFirm = 2;
  // 삭제 시 swap으로 만든 비정렬 내부 주주 인덱스 순서를 보존해야 한다.
  world.tradeStock(f, a.id, d.id, 100, .01);
  if (preview) {
    const before = clone(world.exportState());
    world.commandTransaction(() => world.tradeStock(f, b.id, a.id, 100, .01), true);
    assert.deepEqual(world.exportState(), before);
  }
  for (let i = 0; i < 10; i++) world.step();
  return clone(world.exportState());
}
assert.deepEqual(stockRun(true), stockRun(false), '미리보기가 비공개 주주 캐시 순서·후속 계산을 바꾸지 않음');

const world = createWorld(42, 100), S = world.S, [employee, boss, heir] = S.agents;
const strategy = { revision: 0 };
employee.emp = boss.id; employee.ct = { t: 'tmp', e: boss.id, w: 4.25, d: 0, until: 60 };
S.deps = [{ s: employee.id, bank: boss.id, amt: 100, rate: .01, day: 0 },
  { s: employee.id, bank: boss.id, amt: 200, rate: .02, day: 0 }];
S.loans = [{ id: 9, l: boss.id, b: employee.id, bal: 50, next: 10, rate: .02, coll: { house: 1 } }];
const house = S.houses[0];
house.owner = boss.id; house.occ = null; house.depTenant = employee.id; house.deposit = 70; house.depEnd = 120;
reconcile(world, strategy);
const idFor = kind => strategy.contracts.entries.find(c => c.kind === kind && c.status === 'active').id;
const employed = idFor('employment'), loan = idFor('loan'), deposit = idFor('housingDeposit');
assert.equal(strategy.contracts.entries.filter(c => c.kind === 'deposit').length, 2);
assert.equal(strategy.contracts.entries.find(c => c.id === employed).terms.w, 4.25);
assert.equal(strategy.contracts.entries.find(c => c.id === employed).terms.until, 60);
S.deps.reverse();
S.loans[0].l = heir.id;
house.owner = heir.id;
employee.ct = { t: 'reg', e: boss.id, w: 5, d: 1 };
strategy.revision++;
reconcile(world, strategy);
assert.notEqual(idFor('employment'), employed, '같은 고용주라도 새 계약 객체는 새 신원');
assert.equal(strategy.contracts.entries.find(c => c.id === employed).status, 'ended');
assert.equal(idFor('loan'), loan, '채권 양도는 계약 ID 유지');
assert.equal(strategy.contracts.entries.find(c => c.id === loan).parties.lender, heir.id);
assert.equal(idFor('housingDeposit'), deposit, '집주인이 바뀌어도 미반환 보증금 채무 유지');
assert.equal(strategy.contracts.entries.find(c => c.id === deposit).parties.owner, heir.id);
S.deps.splice(0, 1); employee.emp = null; employee.ct = null;
reconcile(world, strategy);
assert.equal(strategy.contracts.entries.filter(c => c.kind === 'deposit' && c.status === 'active').length, 1);
assert.equal(strategy.contracts.entries.filter(c => c.kind === 'employment' && c.status === 'active').length, 0);
assert.equal(strategy.contracts.entries.filter(c => c.kind === 'housingDeposit' && c.status === 'active').length, 1);
console.log('비공개 주주 캐시·후속 계산 동일, 복수 예금·고용 갱신·채권 양도·미반환 보증금 신원 검사 통과');
