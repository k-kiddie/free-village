'use strict';
const engine = require('../../engine');
const living = require('./living');
const logistics = require('./logistics');
const copy = x => structuredClone(x);
function createPresenter(world, strategy) {
  const meta = () => ({ worldId: strategy.worldId, revision: strategy.revision, day: world.S.day });
  const named = id => { const a = world.S.byId.get(id); return a ? { kind: 'person', id, name: world.nm(a) } : null; };
  const center = r => r ? { x: r.x + (r.w || 10) / 2, y: r.y + (r.h || 10) / 2 } : null;
  const lot = id => center(world.S.geo.lots[id]);
  function position(a, depth = 0) {
    const S = world.S, t = a.actT || {};
    if (t.jail) { const jail=S.bldgs.find(b=>b.fx.includes('jail')); return jail ? lot(jail.lot) : center(S.geo.camp); }
    const shipment=(S.business?.orders||[]).find(o=>o.carrierId===a.id&&['transit','returning'].includes(o.status)&&o.roadTrip);if(shipment)return copy(shipment.roadTrip.position);
    if (t.slot != null) return center(S.geo.shop[t.slot]);
    if (t.lot != null) return lot(t.lot);
    if (t.plot != null) return center(engine.PLOTS[t.plot]);
    if (t.home) return lot(S.houses.find(h => h.id === t.home)?.lot);
    if (t.forest) return center(S.geo.forest);
    if (t.quarry) return center(S.geo.quarry);
    if (t.market) return center(S.geo.mkt);
    if (t.victim && depth < 1) { const victim=S.byId.get(t.victim); if(victim) return position(victim,depth+1); }
    if (t.work) {
      if(t.spec===engine.FARM){const id=S.plots.findIndex(p=>p.owner===t.work);if(id>=0)return center(engine.PLOTS[id]);}
      if(t.spec===engine.CHOP)return center(S.geo.forest);
      if(t.spec===engine.MINE)return center(S.geo.quarry);
      if(t.spec===engine.COOK)return center(S.geo.mkt);
      const boss=S.byId.get(t.work);
      if(t.spec===engine.BUILD&&boss?.site){const site=S.sites.find(s=>s.id===boss.site);if(site)return lot(site.lot??site.lots?.[0]);}
      if(t.spec===engine.CRAFT){const shop=S.shops.find(s=>s.owner===t.work);return shop?center(S.geo.shop[shop.slot]):center(S.geo.mkt);}
      if(depth<1&&boss)return position(boss,depth+1);
    }
    if (a.home) { const p = lot(S.houses.find(h => h.id === a.home)?.lot); if (p) return p; }
    return center(S.geo.camp);
  }
  function person(a, detail = false) {
    if (!a) return null;
    const known = a.id === strategy.playerId || world.dynCanSee(a.id);
    return { ref: { kind: 'person', id: a.id }, name: world.nm(a), position: a.alive ? position(a) : null, known,
      alive: a.alive, ...(known ? { age: a.age / engine.YEAR, cash: a.cash, health: a.health, hunger: a.hunger,
        job: !a.alive ? '사망' : a.id===strategy.playerId && world.S.dyn?.today?.kind==='duty' ? '공무' : engine.ACT[a.act] || a.occ || '생활 중', home: a.home ? { kind: 'house', id: a.home } : null,
        employer: named(a.emp), partner: named(a.partner), goods: copy(a.inv),
        skills: { 농사: a.skill?.[0], 건축: a.skill?.[3], 제조: a.skill?.[9], 장사: a.skill?.[12] },
        ...(detail ? { resident: copy(a) } : {}) } : {}) };
  }
  function view() {
    const S = world.S, D = S.dyn;
    const receipts = Object.values(strategy.commands?.clients || {}).flatMap(c => c.receipts).map(r => r.response)
      .sort((a, b) => b.revision - a.revision).slice(0, 12);
    return { ...meta(), population: S.agents.filter(a=>a.alive).length, currencyUnit: world.currencyUnit(), yearDays: engine.YEAR,
      season: ['봄', '여름', '가을', '겨울'][world.season()], me: person(S.byId.get(strategy.playerId)),
      vault: D.vault || 0, budget: copy(D.budget), today: copy(D.today || null),
      prices: copy(S.price), wage: S.wageAvg || null,
      pending: D.pending.map(p => ({ id: p.id, kind: p.kind, text: p.text, title: p.ctx?.title || '결정할 일', opts: copy(p.opts) })),
      activity: receipts, news: S.events.filter(e => e.ids?.includes(strategy.playerId)).slice(-12).reverse().map(e => ({ text: e.text, day: e.d ?? e.day ?? S.day })),
      projects: S.sites.filter(s => s.dynOwner === strategy.playerId).map(s => ({ id: s.id, kind: s.kind, lot: s.lot, progress: s.prog, need: s.need })),
      firms: S.firms.filter(f => f.ceo === strategy.playerId).map(f => ({ ref: { kind: 'firm', id: f.id }, name: f.name, cash: f.cash })),
    };
  }
  function map(options = {}) {
    const S = world.S, geography = strategy.enabled ? living.geography(world) : null;
    const width = S.mapBig ? 496 : 352, height = S.mapBig ? 384 : 272;
    const v = options.bounds || { x: 0, y: 0, w: width, h: height };
    if (!['x','y','w','h'].every(k => Number.isFinite(v[k])) || v.w <= 0 || v.h <= 0) throw Error('지도 범위가 올바르지 않습니다');
    const inside = p => p && p.x >= v.x - 12 && p.x <= v.x + v.w + 12 && p.y >= v.y - 12 && p.y <= v.y + v.h + 12;
    const entities = [];
    for (const [kind, rows] of [['house', S.houses], ['building', S.bldgs], ['shop', S.shops], ['site', S.sites]]) for (const row of rows) {
      const p = kind === 'shop' ? center(S.geo.shop[row.slot]) : lot(row.lot);
      if (inside(p)) entities.push({ ref: { kind, id: row.id }, ...p, owner: row.owner, mine: (row.dynOwner || row.owner) === strategy.playerId,
        name: kind === 'site' ? '공사 중 · ' + ((row.fx || []).map(f => engine.FXN[f]).join('·') || row.kind) : kind === 'house' ? '주택 ' + row.id : kind === 'shop' ? '공방 ' + row.id : world.bName(row) });
    }
    S.plots.forEach((row, id) => { const p = center(engine.PLOTS[id]); if (!row.gone && inside(p)) entities.push({ ref: { kind: 'plot', id }, ...p, owner: row.owner, mine: (row.dynOwner || row.owner) === strategy.playerId, name: '농지 ' + (id + 1) }); });
    let residentCount = 0; const residents = [];
    // 주민이 겹치는 장소도 가짜 위치로 흩뜨리지 않는다. 같은 좌표는 화면에서 군집으로 선택한다.
    for (const a of S.agents) { if(!a.alive)continue; const p = position(a); if (!inside(p)) continue; residentCount++; if (residents.length < 300 || a.id === strategy.playerId) residents.push({ ref: { kind: 'person', id: a.id }, ...p, name: world.nm(a), mine: a.id === strategy.playerId }); }
    const roadSegments=logistics.map(world,inside);
    return { ...meta(), width, height, bounds: v, paved: S.paved || 0,
      terrain: S.geo.lots.flatMap((r, id) => inside(center(r)) ? [{ id, x:r.x, y:r.y, type:S.terr[id]?.t || 'g', region:geography?.atLot(id)?.id || null, owner:S.lotOwn[id] || null }] : []),
      roads: roadSegments.map(e=>e.path), roadSegments, shipments:(S.business?.orders||[]).filter(o=>o.managerId===strategy.playerId&&['transit','blocked','returning'].includes(o.status)).slice(-40).map(o=>({id:o.id,position:logistics.current(world,o),route:o.roadTrip?.loaded.map(p=>p.point)||[],status:o.status})), market: S.geo.mkt, entities, residents, residentCount,
      residentsLimited: residentCount > residents.length };
  }
  function people(options = {}) {
    const page = Number(options.page || 0), query = String(options.query || '').slice(0,40);
    if (!Number.isSafeInteger(page) || page < 0) throw Error('주민 목록 페이지를 확인해 주세요');
    const list = world.S.agents.filter(a => a.alive && world.nm(a).includes(query));
    return { ...meta(), page, total: list.length, people: list.slice(page*40,page*40+40).map(a => ({ref:{kind:'person',id:a.id},name:world.nm(a),position:position(a)})) };
  }
  function detail(ref) {
    const S = world.S;
    if (!ref || !Number.isSafeInteger(ref.id)) throw Error('대상을 확인해 주세요');
    if (ref.kind === 'person') { const a = S.byId.get(ref.id); return a ? { ...meta(), ...person(a, true) } : null; }
    const keys = { site:'sites', house:'houses', building:'bldgs', shop:'shops', firm:'firms', plot:'plots', lot:'lotOwn' };
    const key = Object.hasOwn(keys,ref.kind) ? keys[ref.kind] : null;
    if (!key) throw Error('선택할 수 없는 대상입니다');
    const a = ref.kind === 'plot' ? S.plots[ref.id] : ref.kind === 'lot' ? S.geo.lots[ref.id] && { owner:S.lotOwn[ref.id] } : S[key].find(a => a.id === ref.id);
    if (!a) return null;
    const name = ref.kind === 'site' ? '공사 중 · ' + ((a.fx || []).map(f => engine.FXN[f]).join('·') || a.kind) : ref.kind === 'house' ? '주택 ' + a.id : ref.kind === 'building' ? world.bName(a) : ref.kind === 'firm' ? a.name : ref.kind === 'shop' ? '공방 ' + a.id : (ref.kind === 'lot' ? '집터 ' : '농지 ') + (ref.id + 1);
    const primaryLot=ref.kind==='firm'?S.bldgs.find(b=>b.id===a.bld?.[0])?.lot:a.lot??(ref.kind==='lot'?ref.id:null);
    return { ...meta(), ref, name, manager:named(a.ceo), region:primaryLot!=null?living.geography(world).atLot(primaryLot):null, owner: named(a.dynOwner || a.owner), progress: a.prog, need: a.need, occupant: named(a.occ),
      condition: a.cond, sale: a.sale ?? null, rent: a.tenantRent ?? a.rent ?? null, deposit: a.deposit || 0,
      position: ref.kind === 'plot' ? center(engine.PLOTS[ref.id]) : ref.kind === 'shop' ? center(S.geo.shop[a.slot]) : primaryLot!=null ? lot(primaryLot) : null,
      functions: (a.fx || []).map(x => engine.FXN[x] || x),
      ...(a.owner === strategy.playerId || a.ceo === strategy.playerId ? { cash:a.cash, debt:a.debt } : {}),
      related: [...new Set([a.owner, a.occ, a.ceo])].filter(Boolean).map(named).filter(Boolean),
    };
  }
  return { view, map, detail, people };
}
module.exports = { createPresenter };
