'use strict';
const { createHash } = require('node:crypto');
const { accounts, changes, resources } = require('./accounts');
const { reconcile } = require('./contracts');
const living = require('./living');
const business = require('./business');
const clone = value => structuredClone(value);
const stable = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v) ?
  Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
const digest = value => createHash('sha256').update(stable(value)).digest('hex');
const messages = { UNKNOWN_ACTION: '알 수 없는 행동입니다.', INVALID_ARGUMENT: '입력값을 확인해 주세요.',
  WRONG_WORLD: '다른 세계의 요청입니다.', INVALID_REVISION: '화면의 상태 번호를 확인해 주세요.',
  INVALID_COMMAND_ID: '요청 번호가 올바르지 않습니다.', ACTOR_UNAVAILABLE: '지금은 이 인물이 행동할 수 없습니다.',
  GAME_OVER: '가문이 종료되었습니다.', DECISION_PENDING: '대기 중인 결정을 먼저 처리해 주세요.',
  COMMAND_ID_CONFLICT: '같은 요청 번호에 다른 내용을 사용할 수 없습니다.',
  COMMAND_SEQUENCE_GAP: '앞선 요청의 처리 결과를 먼저 확인해 주세요.',
  PREVIEW_REQUIRED: '실행 전에 현재 조건과 비용을 확인해 주세요.', REVISION_OVERFLOW: '상태 번호의 저장 범위를 초과했습니다.' };
const fail = (code, message = messages[code] || code) => { const e = new Error(message); e.code = code; throw e; };
const operations = Object.freeze({
  ...Object.fromEntries(['living.buyFood','living.rest','living.lesson','living.rent','living.support'].map(action=>[action,(w,a,s)=>living.perform(w,s,action,a)])),
  advance: w => { w.step(); return { text: '하루가 지났습니다.', deliveries: business.tick(w) }; },
  ...Object.fromEntries(['business.fund','business.order','business.transfer','business.policy','business.recover','business.supply','business.payArrears','business.hire'].map(action=>[action,(w,a,s)=>business.perform(w,s,action,a)])),
  act: (w, a) => {business.guardAction(w,a.key);return w.dynAct(a.key);},
  choose: (w, a) => w.dynChoose(a.id, a.key),
  budget: (w, a) => w.dynSetBudget(a.budget),
  vault: (w, a) => w.dynVault(a.dir, a.frac),
  rename: (w, a) => w.dynRename(a.sur, a.given),
  configureStart: (w, a) => w.dynConfigureStart(a.character),
  story: (w, a) => w.dynSetStory(a.freq),
});
const fields = {
  'living.buyFood':['supplierId','quantity'],'living.rest':['hours'],'living.lesson':['teacherId','skill','hours'],'living.rent':['houseId'],'living.support':['personId','quantity'],
  'business.transfer':['firmId','fromBuildingId','toBuildingId','carrierId','good','quantity'],'business.fund':['firmId','amount'],'business.order':['firmId','supplierId','carrierId','good','quantity','buildingId'],
  'business.policy':['firmId','recipe','mode','limit','markup','enabled','buildingId'],'business.recover':['firmId','orderId','carrierId','buildingId'],'business.supply':['firmId','supplierId','carrierId','good','quantity','minimum','maxCost','enabled','buildingId'],'business.payArrears':['firmId'],'business.hire':['firmId','personId','wage'],
  advance: [], act: ['key'], choose: ['id', 'key'], budget: ['budget'], vault: ['dir', 'frac'],
  rename: ['sur', 'given'], configureStart: ['character'], story: ['freq'],
};
function validateArgs(action, args) {
  if (typeof action !== 'string' || !Object.hasOwn(operations, action)) fail('UNKNOWN_ACTION');
  if (!args || typeof args !== 'object' || Array.isArray(args) ||
      Object.keys(args).some(k => !fields[action].includes(k))) fail('INVALID_ARGUMENT');
  const number = n => typeof n === 'number' && Number.isFinite(n);
  if(action.startsWith('business.')){
    if(!Number.isSafeInteger(args.firmId)||args.firmId<1)fail('INVALID_ARGUMENT');
    if(args.buildingId!==undefined&&(!Number.isSafeInteger(args.buildingId)||args.buildingId<1))fail('INVALID_ARGUMENT');
    if(action==='business.fund'&&(!number(args.amount)||args.amount<=0||args.amount>1e9))fail('INVALID_ARGUMENT');
    if(action==='business.hire'&&(!Number.isSafeInteger(args.personId)||args.personId<1||!number(args.wage)||args.wage<=0||args.wage>1e9))fail('INVALID_ARGUMENT');
    if(action==='business.recover'&&(!Number.isSafeInteger(args.orderId)||args.orderId<1||!Number.isSafeInteger(args.carrierId)||args.carrierId<1))fail('INVALID_ARGUMENT');
    if(action==='business.transfer'&&(!Number.isSafeInteger(args.fromBuildingId)||args.fromBuildingId<1||!Number.isSafeInteger(args.toBuildingId)||args.toBuildingId<1||!Number.isSafeInteger(args.carrierId)||args.carrierId<1||!business.GOODS.includes(args.good)||!number(args.quantity)||args.quantity<1||args.quantity>20))fail('INVALID_ARGUMENT');
    if(action==='business.order'&&(!Number.isSafeInteger(args.supplierId)||args.supplierId<1||!Number.isSafeInteger(args.carrierId)||args.carrierId<1||!business.GOODS.includes(args.good)||!number(args.quantity)||args.quantity<1||args.quantity>20))fail('INVALID_ARGUMENT');
  }
  if (action.startsWith('living.')) {
    const id = action === 'living.buyFood' ? args.supplierId : action === 'living.lesson' ? args.teacherId : action === 'living.rent' ? args.houseId : action === 'living.support' ? args.personId : null;
    if (id !== null && (!Number.isSafeInteger(id)||id<1)) fail('INVALID_ARGUMENT');
    if (['living.buyFood','living.support'].includes(action) && (!number(args.quantity)||args.quantity<.5||args.quantity>20)) fail('INVALID_ARGUMENT');
    if (['living.rest','living.lesson'].includes(action) && (!Number.isInteger(args.hours)||args.hours<1||args.hours>(action==='living.rest'?4:2))) fail('INVALID_ARGUMENT');
    if(action==='living.lesson'&&!Number.isInteger(args.skill))fail('INVALID_ARGUMENT');
  }
  if (action === 'act' || action === 'choose') {
    if (typeof args.key !== 'string' || args.key.length < 1 || args.key.length > 500) fail('INVALID_ARGUMENT');
    if (action === 'choose' && (!Number.isSafeInteger(args.id) || args.id < 1)) fail('INVALID_ARGUMENT');
  }
  if (action === 'vault' && (!['in', 'out'].includes(args.dir) || !number(args.frac) || args.frac < .1 || args.frac > 1)) fail('INVALID_ARGUMENT');
  if (action === 'story' && ![0, 1, 2, 3].includes(args.freq)) fail('INVALID_ARGUMENT');
  if (action === 'rename' && (typeof args.sur !== 'string' || typeof args.given !== 'string')) fail('INVALID_ARGUMENT');
  if (action === 'budget' && (!args.budget || typeof args.budget !== 'object' || Array.isArray(args.budget) ||
      Object.entries(args.budget).some(([k, v]) => !['job', 'job2', 'job3', 'duty', 'life', 'edu', 'save', 'give', 'debt'].includes(k) || !number(v)))) fail('INVALID_ARGUMENT');
  if (action === 'configureStart' && (!args.character || typeof args.character !== 'object' || Array.isArray(args.character))) fail('INVALID_ARGUMENT');
}

function createCommands(world, strategy) {
  const meta = () => ({ worldId: strategy.worldId, revision: strategy.revision, day: world.S.day });
  function validate(request, revision = true, control = true) {
    if (!request || request.worldId !== strategy.worldId) fail('WRONG_WORLD');
    if (Object.keys(request).some(k => !['worldId', 'commandId', 'expectedRevision', 'actor', 'action', 'args', 'previewToken'].includes(k))) fail('INVALID_ARGUMENT');
    if (!Number.isSafeInteger(request.expectedRevision) || request.expectedRevision < 0) fail('INVALID_REVISION');
    if (revision && request.expectedRevision !== strategy.revision) fail('STALE_REVISION', '상황이 바뀌었습니다. 다시 미리보기를 확인하세요.');
    const m = typeof request.commandId === 'string' && /^([A-Za-z0-9_-]{1,64}):([1-9][0-9]*)$/.exec(request.commandId);
    if (!m || !Number.isSafeInteger(Number(m[2]))) fail('INVALID_COMMAND_ID');
    const a = request.actor;
    if (control && (!a || a.kind !== 'person' || a.id !== strategy.playerId || a.id !== world.S.dyn?.pid)) fail('NOT_CONTROLLED', '이 인물을 조작할 권한이 없습니다.');
    const actor = a && world.S.byId.get(a.id);
    const deathChoice = request.action === 'choose' && world.S.dyn?.pending.some(p => p.id === request.args?.id && p.kind === 'death');
    if (control && (!actor || (!actor.alive && !deathChoice))) fail('ACTOR_UNAVAILABLE');
    validateArgs(request.action, request.args);
    if (control && world.S.dyn?.over && !deathChoice) fail('GAME_OVER');
    if (control && (['act', 'advance'].includes(request.action)||request.action.startsWith('living.')||request.action.startsWith('business.')) && world.S.dyn.pending.length) fail('DECISION_PENDING');
    return { client: m[1], seq: Number(m[2]) };
  }
  const identity = r => ({ worldId: r.worldId, commandId: r.commandId, expectedRevision: r.expectedRevision,
    actor: r.actor, action: r.action, args: r.args });
  const token = r => digest(identity(r));
  function run(request, preview) {
    const saved = clone(strategy);
    try {
      return world.commandTransaction(() => {
        const dayBefore = world.S.day;
        const before = accounts(world), stockBefore = resources(world), randomBefore = stable(world.commandRandomState());
        const cooldowns = clone(world.S.dyn.cool || {});
        const previousContracts = new Map((strategy.contracts?.entries || []).map(row => [row.id, stable(row)]));
        const publicAccounts = ['adm', 'welf', 'pub', 'def', 'pol', 'edu', 'health'].map(cat => {
          const account = world.commandPublicAccount(world.S.byId.get(strategy.playerId), cat);
          return account && { category: cat, label: account.label, available: account.available, scope: account.kind };
        }).filter(Boolean);
        const quote = request.action.startsWith('business.') ? business.quote(world,strategy,request.action,request.args) : request.action.startsWith('living.') ? (()=>{const {target,...value}=living.quote(world,strategy,request.action,request.args);return value;})() : ['act','choose'].includes(request.action) ? world.commandTransaction(() => {
        let quote = null;
        if (request.action === 'choose') {
          const decision = world.S.dyn.pending.find(p => p.id === request.args.id);
          if (decision) { world.commandRecheck(decision); quote = clone(decision.opts.find(o => o.k === request.args.key) || null); }
        } else if (request.action === 'act') {
          const candidates = [...world.dynActions(), ...world.dynTargetActions(Number(request.args.key.split(':').at(-1)))];
          const action = candidates.filter(row => request.args.key === row.k || request.args.key.startsWith(row.k + ':'))
            .sort((a, b) => b.k.length - a.k.length)[0];
          if (action) {const described=business.describeAction(world,action);const selected=described.opts?.find(([value])=>request.args.key===action.k+':'+value);quote = { label: described.label, hint: described.hint+(selected?' · '+selected[1]:''), preliminaryReason: described.why };}
        }
        return quote;
        }, true) : null;
        const result = operations[request.action](world, request.args, strategy);
        let ledger = changes(before, accounts(world), request.action === 'advance');
        let inventory = changes(stockBefore, resources(world), request.action === 'advance');
        if (request.action === 'advance') {
          const firms = new Set(world.S.firms.filter(f => f.ceo === strategy.playerId).map(f => f.id));
          const visible = row => row.id.startsWith('person:'+strategy.playerId+':') || row.id === 'family:vault' ||
            row.id.startsWith('firm:') && firms.has(Number(row.id.split(':')[1])) || row.firmId && firms.has(row.firmId);
          ledger = ledger.filter(visible); inventory = inventory.filter(visible);
        }
        strategy.playerId = world.S.dyn.pid;
        if (strategy.revision >= Number.MAX_SAFE_INTEGER) fail('REVISION_OVERFLOW');
        strategy.revision++;
        reconcile(world, strategy);
        if(request.action==='advance')living.observe(world,strategy);
        const uncertain = randomBefore !== stable(world.commandRandomState());
        return clone({ ...meta(), actor: request.actor, controlledPersonId: strategy.playerId,
          result, ledger, inventory, publicAccounts, quote,
          contractChanges: strategy.contracts.entries.filter(row => previousContracts.get(row.id) !== stable(row) &&
            (request.action !== 'advance' || Object.entries(row.parties).some(([role,id]) => !['firm','cooperative'].includes(role) && id === strategy.playerId))),
          duration: { advancedDays: world.S.day - dayBefore, cooldowns: Object.entries(world.S.dyn.cool || {}).filter(([key, until]) =>
            until !== cooldowns[key]).map(([key, untilDay]) => ({ key, untilDay, remainingDays: Math.max(0, untilDay - world.S.day) })), basis: '명령은 즉시 처리; 계약 기한과 하루 지침은 별도' },
          uncertainty: uncertain ? 'random-outcome' : null });
      }, preview);
    } catch (e) {
      for (const k of Object.keys(strategy)) delete strategy[k];
      Object.assign(strategy, saved);
      throw e;
    } finally {
      if (preview) { for (const k of Object.keys(strategy)) delete strategy[k]; Object.assign(strategy, saved); }
    }
  }
  function historyFor(request, client, seq) {
    const history = Object.hasOwn(strategy.commands?.clients || {}, client) ? strategy.commands.clients[client] : { highWater: 0, receipts: [] };
    const fingerprint = digest(identity(request));
    if (seq <= history.highWater) {
      const old = history.receipts.find(x => x.seq === seq);
      if (!old) fail('RESULT_EXPIRED', '이미 처리된 오래된 명령입니다. 재집행하지 않습니다.');
      if (old.fingerprint !== fingerprint) fail('COMMAND_ID_CONFLICT');
      return { replay: clone({ ...old.response, replayed: true }) };
    }
    if (seq !== history.highWater + 1) fail('COMMAND_SEQUENCE_GAP');
    return { history, fingerprint };
  }
  function error(e) { return { ...meta(), allowed: false, reasons: [{ code: e.code || 'RULE_REJECTED', message: e.message, ...(e.accountId ? { accountId: e.accountId } : {}) }] }; }
  return {
    catalog(targetId) {
      return world.commandTransaction(() => {
        const D = world.S.dyn;
        if (!D) return { ...meta(), actions: [], decisions: [] };
        for (const p of D.pending) world.commandRecheck(p);
        return clone({ ...meta(), actions: [...world.dynActions(), ...(targetId === undefined ? [] : world.dynTargetActions(targetId))]
          .map(row=>business.describeAction(world,row)).map(({ ok, why, ...row }) => ({ ...row, allowed: null, preliminaryReason: why, requiresPreview: true })),
          decisions: D.pending.map(p => ({ ...p, opts: p.opts.map(o => ({ ...o, requiresPreview: true })) })) });
      }, true);
    },
    preview(request) {
      try {
        const { client, seq } = validate(request, false, false);
        const prior = historyFor(request, client, seq);
        if (prior.replay) return { ...meta(), allowed: true, alreadyExecuted: true, result: prior.replay, reasons: [] };
        validate(request);
        const outcome = run(request, true);
        // 난수 결과를 미래의 확정 사실로 노출하지 않는다. 실행 후 실제 원장만 반환한다.
        return { ...meta(), allowed: true, reasons: [], previewToken: token(request),
          quote: outcome.quote,
          accounts: outcome.uncertainty ? [] : outcome.ledger,
          inventory: outcome.uncertainty ? null : outcome.inventory,
          costs: outcome.uncertainty ? null : outcome.ledger.filter(row => row.amount < 0),
          publicAccounts: outcome.publicAccounts,
          contractChanges: outcome.uncertainty ? null : outcome.contractChanges,
          duration: outcome.duration, uncertainty: outcome.uncertainty,
          effects: outcome.uncertainty ? null : outcome.result,
          requirements: { actor: request.actor, action: request.action, revision: strategy.revision } };
      } catch (e) { return error(e); }
    },
    execute(request) {
      try {
        const { client, seq } = validate(request, false, false);
        const { history, fingerprint, replay } = historyFor(request, client, seq);
        if (replay) return replay;
        validate(request);
        if (request.previewToken !== token(request)) fail('PREVIEW_REQUIRED');
        const result = run(request, false);
        const response = { ...result, allowed: true, reasons: [], commandId: request.commandId, replayed: false };
        // 명령 성공 시에만 중복 방지 기록을 확정한다.
        const freshLog = strategy.commands ||= { clients: {} };
        Object.defineProperty(freshLog.clients, client, { configurable: true, enumerable: true, writable: true,
          value: { highWater: seq, receipts: [...history.receipts, { seq, fingerprint, response: clone(response) }].slice(-128) } });
        return response;
      } catch (e) { return error(e); }
    },
  };
}
module.exports = { createCommands, operations };
