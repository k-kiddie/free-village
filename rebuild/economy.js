"use strict";
module.exports = function economy(C) {
  const { person, site, district, pay, market, treasury, energy, note } = C;
  const RULES = {
    volume: { name: "저가 대량", price: 4, output: 5 },
    quality: { name: "고품질 소량", price: 8, output: 3 },
    training: { name: "숙련 투자", price: 6, output: 3 },
    contract: { name: "안정 납품", price: 5, output: 4 },
    reserve: { name: "현금 보유", price: 6, output: 2 },
  };
  function owned(id) {
    const f = C.S.firms.find(
      (f) =>
        f.id === id &&
        (f.owner === "player" ||
          (f.operator === "player" && C.S.player.office)),
    );
    if (!f) throw Error("사업 소유·운영 권한이 없습니다");
    return f;
  }
  function command(c) {
    const S = C.S,
      P = S.player;
    switch (c.action) {
      case "policy": {
        const f = owned(c.firm);
        if (!Object.hasOwn(RULES, c.value)) throw Error("알 수 없는 방침");
        energy();
        f.policy = c.value;
        return true;
      }
      case "destination": {
        const f = owned(c.firm);
        district(c.district);
        energy();
        f.marketDistrict = c.district;
        return true;
      }
      case "source": {
        const f = owned(c.firm);
        district(c.district);
        energy();
        f.supplierDistrict = c.district;
        f.supplier = "local";
        return true;
      }
      case "acquire": {
        const s = site(c.site);
        if (s.landOwner === "player") throw Error("이미 소유한 부지입니다");
        energy();
        pay(P, market(), s.purchase);
        s.landOwner = "player";
        note(
          "부지 매입",
          `${s.name}: ${s.purchase}원에 매입해 임대료가 없어졌습니다.`,
        );
        return true;
      }
      case "partner": {
        const f = owned(c.firm),
          p = person(c.person);
        if (f.partner) throw Error("이미 동업자가 있습니다");
        if (p.relation < 10 || p.cash < 60)
          throw Error("관계 10·현금 60원 이상인 주민과 동업할 수 있습니다");
        energy();
        pay(p, f, 60);
        f.partner = { id: p.id, share: 0.3, investment: 60 };
        p.memory.push({ day: S.day, text: `${f.name} 지분 30%에 60원 투자` });
        note(
          "동업 계약",
          "동업자가 운영자금 60원을 투자했습니다. 순이익 배당의 30%가 동업자에게 지급됩니다.",
        );
        return true;
      }
      case "fire": {
        const f = owned(c.firm),
          p = person(c.person);
        if (p.job !== f.id) throw Error("이 사업의 직원이 아닙니다");
        energy();
        pay(f, p, Math.min(f.cash, f.wage * 2));
        p.job = null;
        p.relation -= 5;
        f.workers = f.workers.filter((id) => id !== p.id);
        if (f.manager === p.id) f.manager = null;
        return true;
      }
      default:
        return false;
    }
  }
  function tick() {
    const S = C.S,
      P = S.player,
      used = new Map();
    // 운송은 발주 시 자금·원료를 이동하고 도착 시에만 재고가 된다.
    for (const shipment of S.shipments.filter(
      (s) => s.status === "transit" && s.arrives <= S.day,
    )) {
      const f = S.firms.find((f) => f.id === shipment.firm);
      if (f) {
        if (shipment.kind === "raw")
          f.materials = (f.materials || 0) + shipment.quantity;
        else {
          f.remoteStock ||= {};
          f.remoteStock[shipment.to] =
            (f.remoteStock[shipment.to] || 0) + shipment.quantity;
        }
      }
      shipment.status = "delivered";
    }
    S.shipments = S.shipments.filter(
      (s) => s.status === "transit" || S.day - s.arrives < 12,
    );
    for (const d of S.districts) {
      const n = S.people.filter((p) => p.alive && p.district === d.id).length;
      d.needs = {
        food: n,
        tools: Math.max(3, n * 0.2),
        cloth: Math.max(3, n * 0.2),
      };
      d.sold = { food: 0, tools: 0, cloth: 0 };
      d.revenue = { food: 0, tools: 0, cloth: 0 };
    }
    for (const p of S.people) {
      p.bought = { food: 0, tools: 0, cloth: 0 };
    }
    const ordered = [...S.firms].sort(
      (a, b) => ((a.id + S.day) % S.next) - ((b.id + S.day) % S.next),
    );
    for (const f of ordered) {
      const d = district(site(f.site).district),
        rule = RULES[f.policy] || RULES.volume;
      f.expenses = 0;
      f.revenue = 0;
      f.sold = 0;
      f.materials ||= 0;
      f.remoteStock ||= {};
      const source = district(
        f.supplierDistrict ??
          (f.good === "food" ? 0 : f.good === "tools" ? 1 : 2),
      );
      const route = C.systems.society.path(source.id, d.id),
        cost = f.supplier === "import" ? 2.3 : 1.2 + route.distance * 0.1;
      const routeKey = route.edges.join(","),
        remaining = Math.max(0, route.capacity - (used.get(routeKey) || 0));
      const orderedRaw = S.shipments
        .filter(
          (s) => s.firm === f.id && s.kind === "raw" && s.status === "transit",
        )
        .reduce((n, s) => n + s.quantity, 0);
      const reserve = f.policy === "reserve" ? 25 : 0;
      const input = Math.min(
        f.supplier === "import" ? 12 : source.raw,
        f.supplier === "import" ? 12 : remaining,
        Math.max(0, 12 * f.level - f.materials - orderedRaw),
        Math.floor(Math.max(0, f.cash - reserve) / cost),
      );
      if (input > 0) {
        pay(f, market(), input * cost);
        f.expenses += input * cost;
        if (f.supplier !== "import") {
          source.raw -= input;
          used.set(routeKey, (used.get(routeKey) || 0) + input);
        }
        if (f.supplier !== "import" && source.id === d.id) f.materials += input;
        else
          S.shipments.push({
            id: S.next++,
            kind: "raw",
            firm: f.id,
            from: f.supplier === "import" ? -1 : source.id,
            to: d.id,
            quantity: input,
            arrives: S.day + (f.supplier === "import" ? 2 : route.days),
            edges: route.edges,
            status: "transit",
          });
      }
      let output = 0;
      for (const id of [...f.workers]) {
        const p = person(id),
          wage = Math.max(f.wage, S.government.wage || 0);
        if (f.cash - reserve < wage) {
          p.loyalty -= 12;
          p.memory.push({ day: S.day, text: "임금 체불" });
          continue;
        }
        pay(f, p, wage);
        f.expenses += wage;
        p.loyalty = Math.max(
          0,
          Math.min(100, p.loyalty + (wage >= 7 ? 2 : -0.3)),
        );
        output += rule.output * (1 + p.skill * 0.12);
        if (f.policy === "training") p.skill = Math.min(10, p.skill + 0.04);
        if (p.loyalty < 15) {
          p.job = null;
          f.workers = f.workers.filter((x) => x !== id);
          if (f.manager === id) f.manager = null;
          note(
            "직원 퇴사",
            `${p.name}이 체불·낮은 임금으로 ${f.name}을 떠났습니다.`,
          );
        }
      }
      if (f.owner === "player" && !P.office && P.dayEnergy > 0)
        output += rule.output * (1 + P.skill * 0.1);
      if (f.manager) {
        const manager = person(f.manager);
        if (manager.job === f.id) output *= 1 + manager.skill * 0.03;
        else f.manager = null;
      }
      output = Math.min(output, f.materials, 12 * f.level);
      f.materials -= output;
      f.stock += output;
      f.quality = Math.min(
        3,
        (f.quality || 1) + (f.policy === "quality" ? 0.01 : 0),
      );
      // 합의한 계약은 소매 전에 물건을 확보한다. 재고·현금이 없는 납품은 만들어 내지 않는다.
      for (const p of S.promises.filter(
        (p) => !p.kind && p.firm === f.id && p.status === "active",
      )) {
        const buyer = person(p.person),
          quantity = Math.min(
            f.stock,
            p.quantity - (p.delivered || 0),
            Math.floor(buyer.cash / p.price),
          );
        if (quantity > 0) {
          pay(buyer, f, quantity * p.price);
          f.revenue += quantity * p.price;
          f.stock -= quantity;
          p.delivered = (p.delivered || 0) + quantity;
        }
        if (p.delivered >= p.quantity - 0.00001) {
          p.status = "kept";
          buyer.relation += 15;
          buyer.memory.push({
            day: S.day,
            text: `${p.quantity}개 납품 약속 이행`,
          });
          P.trust = Math.min(100, P.trust + 3);
          note("약속 이행", `${buyer.name}에게 ${p.quantity}개 납품했습니다.`);
        }
      }
      if (f.marketDistrict !== d.id) {
        const delivery = C.systems.society.path(d.id, f.marketDistrict),
          quantity = Math.min(f.stock, delivery.capacity);
        if (quantity > 0) {
          f.stock -= quantity;
          S.shipments.push({
            id: S.next++,
            kind: "goods",
            firm: f.id,
            from: d.id,
            to: f.marketDistrict,
            quantity,
            arrives: S.day + delivery.days,
            edges: delivery.edges,
            status: "transit",
          });
        }
      }
    }
    // 주민은 가격·품질을 비교해 같은 상품을 중복 구매하지 않는다.
    for (const d of S.districts) {
      for (const good of Object.keys(C.GOODS)) {
        const sellers = ordered
          .filter((f) => f.good === good)
          .map((f) => ({
            f,
            local: site(f.site).district === d.id,
            quantity:
              site(f.site).district === d.id
                ? f.stock
                : f.remoteStock[d.id] || 0,
            price:
              (RULES[f.policy] || RULES.volume).price *
              (f.policy === "quality" ? f.quality : 1),
          }))
          .filter((x) => x.quantity > 0)
          .sort(
            (a, b) =>
              a.price / (a.f.quality || 1) - b.price / (b.f.quality || 1),
          );
        for (const p of S.people.filter(
          (p) => p.alive && p.district === d.id,
        )) {
          const need = good === "food" ? 1 : 0.2;
          for (const seller of sellers) {
            const f = seller.f,
              available = seller.local ? f.stock : f.remoteStock[d.id] || 0,
              amount = Math.min(
                available,
                need - p.bought[good],
                p.cash / seller.price,
              );
            if (amount <= 0) continue;
            pay(p, f, amount * seller.price);
            f.revenue += amount * seller.price;
            f.sold += amount;
            if (seller.local) f.stock -= amount;
            else f.remoteStock[d.id] -= amount;
            p.bought[good] += amount;
            d.needs[good] = Math.max(0, d.needs[good] - amount);
            d.sold[good] += amount;
            d.revenue[good] += amount * seller.price;
            f.customers = (f.customers || 0) + 1;
          }
        }
        d.prices[good] =
          d.sold[good] > 0 ? d.revenue[good] / d.sold[good] : d.prices[good];
      }
    }
    for (const f of ordered) {
      const s = site(f.site),
        tax = f.revenue * S.tax;
      pay(f, treasury(), tax);
      f.expenses += tax;
      const rent =
        s.landOwner === "player" ? (f.owner === "player" ? 0 : s.rent) : s.rent;
      if (rent) {
        const paid = Math.min(f.cash, rent);
        pay(f, s.landOwner === "player" ? P : market(), paid);
        f.expenses += paid;
      }
      f.profit = f.revenue - f.expenses;
      const dividend = Math.min(
        Math.max(0, f.cash - 100),
        Math.max(0, f.profit) * 0.5,
      );
      if (dividend > 0) {
        if (f.owner === "public") pay(f, treasury(), dividend);
        else if (S.government.economy === "cooperative" && f.workers.length) {
          for (const id of f.workers)
            pay(f, person(id), dividend / f.workers.length);
        } else if (f.owner === "player") {
          if (f.partner)
            pay(f, person(f.partner.id), dividend * f.partner.share);
          pay(f, P, dividend * (1 - (f.partner?.share || 0)));
        }
      }
      if (f.owner === "rival" && S.day % 10 === 0) {
        const d = district(s.district);
        f.policy = d.needs[f.good] > 6 ? "volume" : "quality";
        const vacant = S.sites.find(
          (s) => s.district === d.id && !s.owner && !C.ownPlan("open", s.id),
        );
        if (vacant && f.cash > vacant.setup + 200) {
          pay(f, market(), vacant.setup);
          const nf = {
            ...f,
            id: S.next++,
            site: vacant.id,
            cash: 0,
            stock: 0,
            materials: 0,
            remoteStock: {},
            workers: [],
            manager: null,
            partner: null,
          };
          pay(f, nf, 100);
          S.firms.push(nf);
          vacant.owner = nf.id;
          note("경쟁자 확장", `${f.name}이 ${vacant.name}을 선점했습니다.`);
        }
        const p = S.people
          .filter((p) => !p.job && !p.position && p.alive)
          .sort((a, b) => b.skill - a.skill)[0];
        if (p && f.workers.length < f.level * 3 && f.cash > 40) {
          p.job = f.id;
          f.workers.push(p.id);
        }
      }
    }
  }
  return { command, tick, RULES, owned };
};
