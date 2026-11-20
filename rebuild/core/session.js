'use strict';

// canonical 실행 경계. /rebuild의 HTTP는 play-worker.js를 통해 호출한다. engine.js의 모듈 전역 지형 때문에
// 이 모듈을 사용하는 Worker에서는 다른 createWorld 호출을 금지한다.
const { createWorld, YEAR } = require('../../engine');
const { randomUUID } = require('node:crypto');
const { createCommands } = require('./commands');
const { reconcile } = require('./contracts');
const { createPresenter } = require('./presenter');
const FORMAT = 'free-village.canonical';
const VERSION = 2;
let occupied = false;
const copy = value => structuredClone(value);
const collections = Object.freeze({
  firm: 'firms', house: 'houses', building: 'bldgs', shop: 'shops',
  bank: 'banks', fund: 'funds', cooperative: 'coops', group: 'groups', faith: 'faiths', district: 'dist',
  borough: 'gu', loan: 'loans', corporateLoan: 'corpLoans', design: 'designs',
});

function validateEngine(state) {
  if (!state || state.v !== 1 || !Number.isInteger(state.rng) ||
      !state.S || !Number.isInteger(state.S.day) || state.S.day < 0 ||
      !Array.isArray(state.S.agents) || !Array.isArray(state.dead)) {
    throw new Error('UNSUPPORTED_ENGINE_SNAPSHOT');
  }
  const agents = new Map(), deadIds = new Set();
  for (const person of state.S.agents) {
    if (!Number.isSafeInteger(person.id) || person.id <= 0 || agents.has(person.id)) throw new Error('INVALID_PERSON_ID');
    agents.set(person.id,person);
  }
  for (const person of state.dead) {
    // 엔진은 일별 정리 전의 사망자를 agents(전체 자료)와 dead(참조용 최소 자료)에 함께 내보낸다.
    if (!Number.isSafeInteger(person.id) || person.id <= 0 || deadIds.has(person.id) ||
        person.alive !== false || agents.has(person.id) && agents.get(person.id).alive !== false) throw new Error('INVALID_PERSON_ID');
    deadIds.add(person.id);
  }
  for (const person of state.S.agents) {
    if (!person.g || !person.q) throw new Error('MISSING_LEARNING_STATE');
  }
}

function createSession(options = {}) {
  if (occupied) throw new Error('ONE_WORLD_PER_WORKER');
  const { checkpoint, legacy } = options;
  const hasCheckpoint = Object.hasOwn(options, 'checkpoint');
  const hasLegacy = Object.hasOwn(options, 'legacy');
  if (hasCheckpoint && hasLegacy) throw new Error('AMBIGUOUS_SNAPSHOT');
  let source, strategy;
  if (hasCheckpoint) {
    if (!checkpoint || checkpoint.format !== FORMAT || ![1, VERSION].includes(checkpoint.version) ||
        !checkpoint.strategy || !Number.isSafeInteger(checkpoint.strategy.revision) ||
        checkpoint.strategy.revision < 0) throw new Error('UNSUPPORTED_CHECKPOINT');
    source = checkpoint.engine;
    strategy = copy(checkpoint.strategy);
  } else {
    source = legacy;
    strategy = { revision: 0, playerId: options.playerId ?? null };
  }
  if (hasCheckpoint || hasLegacy) validateEngine(source);
  strategy.worldId ||= options.worldId || randomUUID();
  if (typeof strategy.worldId !== 'string' || !strategy.worldId.length || strategy.worldId.length > 100) throw new Error('INVALID_WORLD_ID');
  if (!hasCheckpoint) strategy.enabled = options.mode === 'strategy';
  if (strategy.playerId !== null &&
      (!Number.isSafeInteger(strategy.playerId) || strategy.playerId <= 0)) {
    throw new Error('INVALID_PLAYER');
  }
  const seed = source ? source.S.seed : (options.seed ?? 42);
  const population = source ? Math.max(1, source.S.agents.length) : (options.population ?? 5000);
  if (!Number.isSafeInteger(seed) || !Number.isSafeInteger(population) ||
      population < 1) throw new Error('INVALID_WORLD');
  occupied = true;
  let world;
  try {
    world = createWorld(seed, population);
    if (source) world.importState(copy(source)); // importState mutates its input.
    if (strategy.enabled) {
      if (!world.S.dyn) world.dynStart();
      if (strategy.playerId === null) strategy.playerId = world.S.dyn.pid;
      if (strategy.playerId !== world.S.dyn.pid) throw new Error('CONTROL_MISMATCH');
      reconcile(world, strategy);
    }
    if (strategy.playerId !== null && !world.S.byId.has(strategy.playerId)) {
      throw new Error('PLAYER_NOT_FOUND');
    }
  } catch (error) {
    occupied = false;
    throw error;
  }
  let presenter = createPresenter(world, strategy);
  let commands = strategy.enabled ? createCommands(world, strategy) : null;
  let closed = false;
  const active = () => { if (closed) throw new Error('SESSION_CLOSED'); };
  function read(ref) {
    active();
    if (!ref || !Number.isSafeInteger(ref.id)) throw new Error('INVALID_REFERENCE');
    let value;
    if (ref.kind === 'person') value = world.S.byId.get(ref.id);
    else if (ref.kind === 'contract') value = strategy.contracts?.entries.find(row => row.id === ref.id);
    else if (ref.kind === 'plot' || ref.kind === 'lot') {
      const list = ref.kind === 'plot' ? world.S.plots : world.S.geo?.lots;
      value = ref.id >= 0 ? list?.[ref.id] : undefined;
    } else if (Object.hasOwn(collections, ref.kind)) {
      const matches = (world.S[collections[ref.kind]] || []).filter(x => x.id === ref.id);
      if (matches.length > 1) throw new Error('AMBIGUOUS_REFERENCE');
      value = matches[0];
    } else throw new Error('UNSUPPORTED_REFERENCE');
    return value === undefined ? null : copy(value);
  }
  function summary() {
    active();
    return { worldId: strategy.worldId, revision: strategy.revision, day: world.S.day, yearDays: YEAR,
      population: world.S.agents.filter(a=>a.alive).length, playerId: strategy.playerId,
      pendingDecision: (world.S.dyn?.pending?.length ?? 0) > 0 };
  }
  return Object.freeze({
    summary,
    view() { active(); return presenter.view(); },
    map(options) { active(); return presenter.map(options); },
    people(options) { active(); return presenter.people(options); },
    detail(ref) { active(); return presenter.detail(ref); },
    read,
    catalog(targetId) { active(); if (!commands) throw new Error('STRATEGY_DISABLED'); return commands.catalog(targetId); },
    preview(request) { active(); if (!commands) throw new Error('STRATEGY_DISABLED'); return commands.preview(request); },
    execute(request) { active(); if (!commands) throw new Error('STRATEGY_DISABLED'); return commands.execute(request); },
    contracts() { active(); return copy(strategy.contracts?.entries || []); },
    // 내부 검증용 하루 전진. HTTP는 중복 방지 계약이 있는 공통 advance 명령을 사용한다.
    advance() {
      active();
      if (world.S.dyn?.pending?.length > 0) throw new Error('DECISION_PENDING');
      if (strategy.revision === Number.MAX_SAFE_INTEGER) throw new Error('REVISION_OVERFLOW');
      if (strategy.enabled) {
        const saved = copy(strategy);
        try { world.commandTransaction(() => { world.step(); strategy.playerId = world.S.dyn.pid; strategy.revision++; reconcile(world, strategy); }); }
        catch (error) { for (const k of Object.keys(strategy)) delete strategy[k]; Object.assign(strategy, saved); throw error; }
      } else { world.step(); strategy.revision++; }
      return summary();
    },
    checkpoint() {
      active();
      const engine = copy(world.exportState());
      // 엔진 밖의 제어 신원도 사망 뒤 기록에서 빠지지 않아야 한다.
      const player = strategy.playerId === null ? null : world.S.byId.get(strategy.playerId);
      if (player && !player.alive && !engine.dead.some(x => x.id === player.id)) {
        engine.dead.push(copy(player));
      }
      for (const entry of strategy.contracts?.entries || []) for (const [role, id] of Object.entries(entry.parties)) {
        if (role === 'firm' || role === 'cooperative' || entry.kind === 'mercenary' && role === 'employer') continue;
        const person = world.S.byId.get(id);
        if (person && !person.alive && !engine.dead.some(x => x.id === id)) engine.dead.push(copy(person));
      }
      return { format: FORMAT, version: VERSION, engine, strategy: copy(strategy) };
    },
    close() { if (!closed) { closed = true; occupied = false; commands = null; presenter = null; world = null; } },
  });
}

module.exports = { FORMAT, VERSION, createSession };
