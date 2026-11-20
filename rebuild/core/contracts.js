'use strict';
const clone = value => structuredClone(value);

// 계약 원본은 엔진에 둔다. 이 등록부는 신원·참조·관측 이력만 소유한다.
function reconcile(world, strategy) {
  const S = world.S;
  const registry = strategy.contracts ||= { nextId: 1, entries: [] };
  const sources = [...(S.loans || []), ...(S.corpLoans || []), ...(S.deps || []), ...(S.policies || []),
    ...S.agents.map(a => a.ct).filter(Boolean), ...(S.firms || []).map(f => f.merc?.contract).filter(Boolean),
    ...(S.dyn?.economy?.coopDebt || []),...(S.business?.orders||[]),...(S.business?.arrears||[]),...(S.business?.orders||[]).flatMap(o=>o.recoveries||[])];
  for (const row of [...sources, ...registry.entries.map(row => ({ canonicalContractId: row.id }))]) {
    if (Number.isSafeInteger(row.canonicalContractId) && row.canonicalContractId > 0) {
      registry.nextId = Math.max(registry.nextId, row.canonicalContractId + 1);
    }
  }
  const existing = new Map(registry.entries.map(row => [row.id, row]));
  const seen = new Set();
  const inlineKey = (kind, locator, parties) => JSON.stringify([kind, locator,
    kind === 'housing' ? parties.occupant : kind === 'housingDeposit' ? parties.tenant :
      Object.fromEntries(Object.keys(parties).sort().map(key => [key, parties[key]]))]);
  const inlineEntries = new Map(registry.entries.filter(row => row.status === 'active')
    .map(row => [inlineKey(row.kind, row.locator, row.parties), row.id]));
  const visit = (kind, source, locator, parties, terms, active = true, inline = false) => {
    if (!active) return;
    let id = inline ? inlineEntries.get(inlineKey(kind, locator, parties)) : source.canonicalContractId;
    if (id === undefined) id = registry.nextId++;
    if (!Number.isSafeInteger(id) || id < 1 || seen.has(id)) throw Object.assign(new Error('계약 신원이 중복되었거나 올바르지 않습니다.'), { code: 'INVALID_CONTRACT_ID' });
    registry.nextId = Math.max(registry.nextId, id + 1);
    if (!inline) source.canonicalContractId = id;
    seen.add(id);
    let row = existing.get(id);
    if (row && (row.kind !== kind || row.locator !== locator || row.status !== 'active')) throw Object.assign(new Error('종료되었거나 다른 대상의 계약 신원을 사용할 수 없습니다.'), { code: 'CONTRACT_ID_REUSED' });
    if (!row) {
      row = { id, kind, locator, parties, observedDay: S.day, observedRevision: strategy.revision };
      registry.entries.push(row);
      existing.set(id, row);
    }
    Object.assign(row, { status: 'active', parties: clone(parties), terms: clone(terms), lastSeenDay: S.day });
  };
  for (const [key, kind] of [['loans', 'loan'], ['corpLoans', 'corporateLoan'], ['deps', 'deposit'], ['policies', 'insurance']]) {
    for (const row of S[key] || []) {
      // ID 없는 예금/보험은 부여한 신원을 위치로 쓴다. 배열 위치·은행/예금주 조합은 키가 아니다.
      const location = row.id !== undefined ? `${key}:${row.id}` : `${key}:registered:${row.canonicalContractId ?? registry.nextId}`;
      const parties = kind === 'deposit' ? { saver: row.s, banker: row.bank } : kind === 'insurance' ?
        { holder: row.holder, insurer: row.ins } : { lender: row.l, borrower: row.b ?? null, firm: row.firm ?? null };
      const { canonicalContractId, ...terms } = row;
      visit(kind, row, location, parties, terms, !['repaid', 'paid', 'closed', 'default', 'forgiven'].includes(row.status));
    }
  }
  for (const row of S.dyn?.economy?.coopDebt || []) visit('cooperativeLoan', row,
    `coopDebt:${row.canonicalContractId ?? registry.nextId}`,
    { borrower: row.borrower, cooperative: row.coop ?? null }, row, row.balance > 0);
  for(const o of S.business?.orders||[]){visit('supply',o,`business:order:${o.id}`,
    {firm:o.firmId,buyer:o.managerId,supplier:o.supplierId,carrier:o.originalCarrierId??o.carrierId},
    {good:o.good,quantity:o.quantity,goodsCost:o.goodsCost,freight:o.freight,arrivalDay:o.arrivalDay,status:o.status,reason:o.reason||null},['transit','blocked'].includes(o.status));
    for(const [i,r]of(o.recoveries||[]).entries())visit('freight',r,`business:order:${o.id}:recovery:${i}`,{firm:o.firmId,carrier:r.carrierId},{orderId:o.id,freight:r.freight,day:r.day,arrivalDay:o.arrivalDay},i===o.recoveries.length-1&&['transit','blocked'].includes(o.status));
  }
  for(const c of S.business?.arrears||[])visit('businessWage',c,`business:wage:${c.id}`,{firm:c.firmId,employee:c.workerId},{amount:c.amount,createdDay:c.createdDay},c.amount>1e-8);
  for (const a of S.agents) if (a.alive && a.emp) {
    if (a.ct && a.ct.e === a.emp) {
      const { canonicalContractId, ...terms } = a.ct;
      visit('employment', a.ct, `person:${a.id}:employment:${canonicalContractId ?? registry.nextId}`,
        { employee: a.id, employer: a.ct.e, firm: a.ct.company ?? null }, terms);
    } else visit('employmentRelation', a, `person:${a.id}:dailyEmployment`,
      { employee: a.id, employer: a.emp }, { wage: S.byId.get(a.emp)?.lastWage ?? null }, true, true);
  }
  for (const h of S.houses) {
    if (h.occ && h.owner !== h.occ && (h.tenantRent || h.pub)) visit('housing', h, `house:${h.id}:occupancy`,
      { owner: h.owner ?? null, occupant: h.occ },
      { rent: h.tenantRent ?? null, periodDays: 10, arrears: h.miss ?? 0, public: !!h.pub }, true, true);
    if (h.deposit > 0 && h.depTenant) visit('housingDeposit', h, `house:${h.id}:deposit`,
      { owner: h.owner ?? null, tenant: h.depTenant },
      { deposit: h.deposit, dueDay: h.depEnd ?? null }, true, true);
  }
  for (const f of S.firms || []) if (f.merc?.contract) {
    const c = f.merc.contract;
    visit('mercenary', c, `firm:${f.id}:mercenary:${c.canonicalContractId ?? registry.nextId}`,
      { firm: f.id, employer: c.employer ?? c.country ?? null }, c, c.status === 'active');
  }
  for (const row of registry.entries) if (row.status === 'active' && !seen.has(row.id)) {
    row.status = 'ended'; row.endedDay = S.day; row.endedRevision = strategy.revision;
  }
  return registry;
}
module.exports = { reconcile };
