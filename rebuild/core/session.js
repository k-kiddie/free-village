'use strict';

// 2단계 경계 검증용. 서버에 연결하지 않는다. engine.js의 모듈 전역 지형 때문에
// 이 모듈을 사용하는 Worker에서는 다른 createWorld 호출을 금지한다.
const { createWorld, YEAR } = require('../../engine');
const FORMAT = 'free-village.canonical';
const VERSION = 1;
let occupied = false;
const copy = value => structuredClone(value);
const collections = Object.freeze({
  firm: 'firms', house: 'houses', building: 'bldgs', shop: 'shops',
  bank: 'banks', group: 'groups', faith: 'faiths', district: 'dist',
  borough: 'gu', loan: 'loans', corporateLoan: 'corpLoans', design: 'designs',
});

function validateEngine(state) {
  if (!state || state.v !== 1 || !Number.isInteger(state.rng) ||
      !state.S || !Number.isInteger(state.S.day) || state.S.day < 0 ||
      !Array.isArray(state.S.agents) || !Array.isArray(state.dead)) {
    throw new Error('UNSUPPORTED_ENGINE_SNAPSHOT');
  }
  const ids = new Set();
  for (const person of [...state.S.agents, ...state.dead]) {
    if (!Number.isSafeInteger(person.id) || person.id <= 0 || ids.has(person.id)) {
      throw new Error('INVALID_PERSON_ID');
    }
    ids.add(person.id);
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
    if (!checkpoint || checkpoint.format !== FORMAT || checkpoint.version !== VERSION ||
        !checkpoint.strategy || !Number.isSafeInteger(checkpoint.strategy.revision) ||
        checkpoint.strategy.revision < 0) throw new Error('UNSUPPORTED_CHECKPOINT');
    source = checkpoint.engine;
    strategy = copy(checkpoint.strategy);
  } else {
    source = legacy;
    strategy = { revision: 0, playerId: options.playerId ?? null };
  }
  if (hasCheckpoint || hasLegacy) validateEngine(source);
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
    if (strategy.playerId !== null && !world.S.byId.has(strategy.playerId)) {
      throw new Error('PLAYER_NOT_FOUND');
    }
  } catch (error) {
    occupied = false;
    throw error;
  }
  let closed = false;
  const active = () => { if (closed) throw new Error('SESSION_CLOSED'); };
  function read(ref) {
    active();
    if (!ref || !Number.isSafeInteger(ref.id)) throw new Error('INVALID_REFERENCE');
    let value;
    if (ref.kind === 'person') value = world.S.byId.get(ref.id);
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
    return { revision: strategy.revision, day: world.S.day, yearDays: YEAR,
      population: world.S.agents.length, playerId: strategy.playerId,
      pendingDecision: (world.S.dyn?.pending?.length ?? 0) > 0 };
  }
  return Object.freeze({
    summary,
    read,
    // 경계 검증 전용. 실사용 명령·시간 루프 통합은 3단계 이후에 한다.
    advance() {
      active();
      if (world.S.dyn?.pending?.length > 0) throw new Error('DECISION_PENDING');
      if (strategy.revision === Number.MAX_SAFE_INTEGER) throw new Error('REVISION_OVERFLOW');
      world.step();
      strategy.revision++;
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
      return { format: FORMAT, version: VERSION, engine, strategy: copy(strategy) };
    },
    close() { if (!closed) { closed = true; occupied = false; world = null; } },
  });
}

module.exports = { FORMAT, VERSION, createSession };
