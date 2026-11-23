'use strict';

// 표시 환산 전의 엔진 장부 단위. 동일 지갑을 은행/보험/개인 계정으로 중복 계상하지 않는다.
function accounts(world) {
  const S = world.S, rows = new Map();
  const add = (id, record, field, scope, owner) => {
    if (!record || record[field] === undefined) return;
    const balance = record[field];
    if (!Number.isFinite(balance)) throw Object.assign(new Error('계정의 잔액을 확인할 수 없습니다.'), { code: 'INVALID_ACCOUNT', accountId: id });
    rows.set(id, { id, scope, owner, balance });
  };
  for (const a of S.byId.values()) {
    add(`person:${a.id}:cash`, a, 'cash', 'personal', a.id);
    add(`person:${a.id}:reserve`, a, 'dres', 'bankReserve', a.id);
  }
  for (const [list, kind, field, scope] of [
    ['firms', 'firm', 'cash', 'corporate'], ['groups', 'group', 'tre', 'organization'],
    ['faiths', 'faith', 'tre', 'organization'], ['dist', 'district', 'tre', 'public'],
    ['gu', 'borough', 'tre', 'public'], ['funds', 'fund', 'cash', 'foundation'],
    ['coops', 'coop', 'fund', 'cooperative'],
  ]) for (const row of S[list] || []) add(`${kind}:${row.id}:${field}`, row, field, scope, row.id);
  add('government:treasury', S.gov, 'tre', 'public', null);
  add('government:pension', S.gov, 'pen', 'pension', null);
  add('family:vault', S.dyn, 'vault', 'family', S.dyn?.pid);
  add('estate:unclaimed', S, 'unclaimedCash', 'estate', null);
  add('foreign:equity', S.foreignEquity, 'cash', 'foreign', null);
  return rows;
}

function changes(before, after, allowUnderflow = false) {
  const out = [];
  for (const id of new Set([...before.keys(), ...after.keys()])) {
    const a = before.get(id), b = after.get(id), from = a?.balance ?? 0, to = b?.balance ?? 0;
    if (!allowUnderflow && to < Math.min(0, from) - 1e-8) throw Object.assign(new Error('잔액이나 보유 물량이 모자랍니다.'), { code: 'INSUFFICIENT_FUNDS', accountId: id });
    if (from !== to) out.push({ ...(b || a), before: from, after: to, amount: to - from });
  }
  return out;
}
function resources(world) {
  const rows = new Map();
  for (const [kind, list] of [['person', world.S.agents], ['firm', world.S.firms || []]]) {
    for (const entity of list) for (const [good, balance] of Object.entries(entity.inv || {})) {
      if (!Number.isFinite(balance)) throw Object.assign(new Error('보유 물량을 확인할 수 없습니다.'), { code: 'INVALID_RESOURCE' });
      const id = `${kind}:${entity.id}:inventory:${good}`;
      rows.set(id, { id, scope: 'inventory', owner: entity.id, good, balance });
    }
  }
  for(const [kind,list] of [['shipment',world.S.business?.orders||[]],['warehouse',Object.values(world.S.business?.warehouses||{})]])for(const entity of list)for(const [good,balance]of Object.entries(entity.inv||{})){
    if(!Number.isFinite(balance))throw Object.assign(Error('보유 물량을 확인할 수 없습니다.'),{code:'INVALID_RESOURCE'});
    const id=`${kind}:${kind==='shipment'?entity.id:(entity.warehouseId??entity.firmId)}:inventory:${good}`;
    rows.set(id,{id,scope:'inventory',owner:entity.firmId,firmId:entity.firmId,good,balance});
  }
  return rows;
}
module.exports = { accounts, changes, resources };
