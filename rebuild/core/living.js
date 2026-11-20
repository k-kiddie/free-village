'use strict';
// 생활·지역 경제: 엔진의 주민/재고/현금/주거/학습을 사용한다. 별도 인구·지갑·하루 계산은 없다.
const { YEAR, ACT } = require('../../engine');
const copy = x => structuredClone(x), clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const reject = message => { throw new Error(message); };
const food = a => (a.inv?.grain || 0) + (a.inv?.meal || 0)*1.5;
const skills = new Set([0,1,2,3,9,10,11,12]);
function geography(world) {
  const S=world.S, houses=new Map(S.houses.map(h=>[h.id,h])), districts=new Map((S.dist||[]).map(d=>[d.id,d]));
  const atLot=id=>{
    const p=S.geo.lots[id]; if(!p)return null;
    const d=districts.get(S.tileD?.[id]);
    if(d)return {id:'district:'+d.id,name:d.name+' 생활권'};
    const x=Math.floor(p.x/64),y=Math.floor(p.y/64),ew=p.x<(S.mapBig?248:176)?'서':'동',ns=p.y<(S.mapBig?192:136)?'북':'남';
    return {id:`area:${x}:${y}`,name:`${ns}${ew} 생활권 ${x+1}·${y+1}`};
  };
  const location=a=>{const h=houses.get(a.home),p=h&&S.geo.lots[h.lot];return p?{x:p.x+5,y:p.y+5}:{x:S.geo.camp.x+20,y:S.geo.camp.y+15};};
  const region=a=>{if(!a||a.id<1)return null;const h=houses.get(a.home);if(h)return atLot(h.lot);const p=location(a);return {id:`camp:${Math.floor(p.x/64)}:${Math.floor(p.y/64)}`,name:'공터 주변 생활권',position:p};};
  return {houses,atLot,location,region};
}
function pressure(a,house) {
  const reasons=[];if(a.hunger>=60)reasons.push('식량 부족');if(!a.home)reasons.push('주거 없음');
  const rent=house?.tenantRent||0;if(rent>0&&a.cash<rent)reasons.push('다음 임대료 부족');
  if(a.health<60)reasons.push('건강 악화');if(a.fat>=80)reasons.push('피로 누적');
  const score=clamp(a.hunger/100*.4+(!a.home ? .25 : 0)+(rent>0&&a.cash<rent?.2:0)+(100-a.health)/100*.15,0,1);
  return {score,reasons};
}
function collect(world,strategy) {
  const S=world.S,geo=geography(world),regions=new Map(),index={};
  const get=r=>{if(!regions.has(r.id))regions.set(r.id,{...r,population:0,children:0,food:0,cash:0,income:0,hungry:0,homeless:0,wageWorkers:0,restingAdults:0,students:0,teachers:0,pressure:0,rentSum:0,rentedHomes:0,vacancies:0,homes:0});return regions.get(r.id);};
  for(const a of S.agents){if(!a.alive)continue;const r=geo.region(a),row=get(r),h=geo.houses.get(a.home);
    row.population++;row.children+=a.age<14*YEAR?1:0;row.food+=food(a);row.cash+=a.cash;row.income+=a.incToday||0;
    row.hungry+=a.hunger>=60?1:0;row.homeless+=!a.home?1:0;row.wageWorkers+=a.emp?1:0;
    row.restingAdults+=a.age>=14*YEAR&&a.act===6&&!a.study?1:0;row.students+=a.study||a.dynBasicUntil>S.day?1:0;
    row.teachers+=(a.edu||0)>=1&&a.lastTeach>=S.day-30?1:0;row.pressure+=pressure(a,h).score;
    index[a.id]={region:r.id,home:a.home||null};
  }
  for(const h of S.houses){const r=geo.atLot(h.lot);if(!r)continue;const row=get(r);row.homes++;if(!h.occ&&h.rent>0&&(h.cond??1)>.25)row.vacancies++;if(h.occ&&h.tenantRent>0){row.rentedHomes++;row.rentSum+=h.tenantRent;}}
  const state=strategy.living;
  for(const row of regions.values()){
    row.foodPerCapita=row.population?row.food/row.population:null;row.meanIncome=row.population?row.income/row.population:null;
    row.pressure=row.population?row.pressure/row.population:0;row.meanRent=row.rentedHomes?row.rentSum/row.rentedHomes:null;
    const trades=state?.tradeDay===S.day?state.trades?.[row.id]:null;
    row.foodPrices={grain:trades?.grain?.quantity?trades.grain.value/trades.grain.quantity:null,meal:trades?.meal?.quantity?trades.meal.value/trades.meal.quantity:null};
    row.foodTradeQuantity=(trades?.grain?.quantity||0)+(trades?.meal?.quantity||0);
  }
  return {regions:[...regions.values()],index,geo};
}
function init(world,strategy){
  if(!strategy.living){const baseline=collect(world,strategy);strategy.living={version:1,lastDay:world.S.day,index:baseline.index,hours:{},teaching:{},tradeDay:world.S.day,trades:{},history:[],actions:[]};}
  if(strategy.living.version!==1)reject('지원하지 않는 생활 저장 형식입니다.');
  return strategy.living;
}
function observe(world,strategy){
  const state=init(world,strategy),S=world.S;if(state.lastDay===S.day)return;
  const current=collect(world,strategy),movement={};
  const flow=id=>movement[id] ||= {arrivals:0,departures:0,births:0,deaths:0,movedIn:0,movedOut:0,reclassified:0};
  for(const [id,now] of Object.entries(current.index)){
    const old=state.index[id],a=S.byId.get(Number(id));
    if(!old){flow(now.region)[a?.born===S.day?'births':'arrivals']++;continue;}
    if(old.region!==now.region){if(old.home===now.home){flow(now.region).reclassified++;}else{flow(now.region).movedIn++;flow(old.region).movedOut++;}}
  }
  for(const [id,old]of Object.entries(state.index))if(!current.index[id])flow(old.region)[S.byId.get(Number(id))?.alive===false?'deaths':'departures']++;
  state.history.push({day:S.day,movement:copy(movement),regions:current.regions.map(row=>({...row,movement:flow(row.id)}))});
  state.history=state.history.slice(-30);state.index=current.index;state.lastDay=S.day;state.hours={};state.teaching={};
}
function marketFactor(row){if(!row||!row.population)return 1;const stock=row.foodPerCapita||0;return clamp(1+(4-stock)/30+row.hungry/row.population*.12,.85,1.25);}
function record(world,strategy,{good,buyer,seller,quantity,price}){
  if(!['grain','meal'].includes(good))return;const state=init(world,strategy);if(state.tradeDay!==world.S.day){state.tradeDay=world.S.day;state.trades={};}
  const region=geography(world).region(buyer);if(!region)return;
  const row=state.trades[region.id] ||= {};const item=row[good] ||= {quantity:0,value:0,imports:0};item.quantity+=quantity;item.value+=quantity*price;if(seller.id<1)item.imports+=quantity;
}
function connect(world,strategy){
  init(world,strategy);let geo,reachGeo,reachDay=-1,reachHouses,reachLength=-1;
  const canTeach=(teacher,student)=>{
    if(!teacher?.alive||!student?.alive||teacher.hunger>=90||student.hunger>=85||teacher.health<25||student.health<25)return false;
    if(reachDay!==world.S.day||reachHouses!==world.S.houses||reachLength!==world.S.houses.length){reachGeo=geography(world);reachDay=world.S.day;reachHouses=world.S.houses;reachLength=world.S.houses.length;}
    const a=reachGeo.location(teacher),b=reachGeo.location(student);return Math.hypot(a.x-b.x,a.y-b.y)<=96;
  };
  world.setLivingHooks({
    canTeach,
    canStudyBasic:(teacher,student)=>canTeach(teacher,student)&&(teacher.lastTeach>=world.S.day-1||strategy.living.teaching[teacher.id]?.day===world.S.day),
    prepare(books){const stats=collect(world,strategy);geo=stats.geo;const rows=new Map(stats.regions.map(r=>[r.id,r]));
      for(const good of ['grain','meal'])for(const side of ['a','b'])for(const order of books[good][side]){
        const region=geo.region(order.a);if(!region)continue;const factor=marketFactor(rows.get(region.id));
        order.p*=side==='a'?factor:clamp(1+(factor-1)*.6,.9,1.15);
      }
    },
    trade(event){
      // 대량 거래마다 집/구역 인덱스를 다시 만들지 않는다.
      if(!['grain','meal'].includes(event.good))return;const state=strategy.living;
      if(state.tradeDay!==world.S.day){state.tradeDay=world.S.day;state.trades={};}
      const region=geo.region(event.buyer);if(!region)return;
      const row=state.trades[region.id] ||= {};const item=row[event.good] ||= {quantity:0,value:0,imports:0};
      item.quantity+=event.quantity;item.value+=event.quantity*event.price;if(event.seller.id<1)item.imports+=event.quantity;
    }
  });
}
function used(state,id,day){const row=state.hours[id];return row?.day===day?row.used:0;}
function available(world,strategy,a){return Math.max(0,4-used(strategy.living,a.id,world.S.day));}
function consume(world,strategy,a,hours,effort=true){const state=strategy.living;if(available(world,strategy,a)+1e-9<hours)reject('오늘의 여유 시간이 모자랍니다. 하루를 진행한 뒤 다시 계획해 주세요.');state.hours[a.id]={day:world.S.day,used:used(state,a.id,world.S.day)+hours};if(effort){a.fat=clamp(a.fat+hours*2,0,100);a.hunger=clamp(a.hunger+hours*.5,0,100);}}
function relatives(world,me){return [...new Set([me.partner,...me.parents,...me.kids,...world.S.agents.filter(a=>a.parents?.includes(me.id)).map(a=>a.id)])].map(id=>world.S.byId.get(id)).filter(a=>a?.alive);}
function quote(world,strategy,action,args){
  const S=world.S,me=S.byId.get(strategy.playerId),state=strategy.living,geo=geography(world),stats=collect(world,strategy),here=geo.region(me);
  if(!me?.alive)reject('행동할 수 있는 인물이 아닙니다.');if(me.jailUntil>S.day||me.abroadUntil>S.day||me.dynTravelUntil>S.day||me.armyUntil>S.day)reject('구금·복무·여행 중에는 이 생활 활동을 할 수 없습니다.');
  let cost=0,hours=0,label='',details={},target;
  if(action==='living.buyFood'){
    target=S.byId.get(args.supplierId);if(!target?.alive||target===me||geo.region(target)?.id!==here.id)reject('같은 생활권의 실제 판매자를 선택해 주세요.');
    const stock=Math.max(0,(target.inv.grain||0)-Math.max(2,target.g.keepG||6));if(stock+1e-9<args.quantity)reject('판매자의 여유 곡식 재고가 모자랍니다.');
    const price=S.price.grain*marketFactor(stats.regions.find(r=>r.id===here.id));cost=price*args.quantity;hours=.5;label='생활권 곡식 구매';details={supplierId:target.id,quantity:args.quantity,price};
  }else if(action==='living.rest'){
    hours=args.hours;label='쉬면서 회복';details={fatigueReduction:Math.min(me.fat,hours*5),hungerIncrease:hours};
  }else if(action==='living.lesson'){
    target=S.byId.get(args.teacherId);if(!target?.alive||target.age<14*YEAR||target===me||geo.region(target)?.id!==here.id||!skills.has(args.skill))reject('같은 생활권의 기술 교사를 선택해 주세요.');
    if((target.skill[args.skill]||0)<(me.skill[args.skill]||0)+.1)reject('이 기술을 가르칠 만큼의 숙련 차이가 없습니다.');
    if((state.teaching[target.id]?.day===S.day?state.teaching[target.id].used:0)+args.hours>2)reject('교사의 오늘 수업 시간이 모두 찼습니다.');
    if(available(world,strategy,target)<args.hours)reject('교사의 여유 시간이 모자랍니다.');
    if(target.health<25||target.hunger>=90||target.jailUntil>S.day||target.study||target.armyUntil>S.day||target.abroadUntil>S.day||target.dynTravelUntil>S.day)reject('교사가 지금 수업할 수 없습니다.');
    hours=args.hours;cost=Math.max(.5,S.wageAvg||1)*1.25*hours;
    const nutrition=clamp(1-me.hunger/120,.15,1),health=clamp(me.health/100,.2,1),gap=target.skill[args.skill]-me.skill[args.skill];
    label=ACT[args.skill]+' 기술 배우기';details={teacherId:target.id,skill:args.skill,gain:gap*.025*hours*nutrition*health,nutrition,health};
  }else if(action==='living.support'){
    target=relatives(world,me).find(a=>a.id===args.personId);if(!target)reject('실제로 연결된 가족을 선택해 주세요.');if((me.inv.grain||0)<args.quantity)reject('나눠 줄 곡식이 모자랍니다.');
    hours=.5;label='가족에게 곡식 나누기';details={personId:target.id,quantity:args.quantity};
  }else if(action==='living.rent'){
    if(me.age<14*YEAR)reject('임대 계약을 맺을 수 있는 성년이어야 합니다.');
    const h=geo.houses.get(args.houseId),owner=h&&S.byId.get(h.owner);if(!h||h.occ||!(h.rent>0)||(h.deposit||0)>0||(h.cond??1)<=.25||h.owner===me.id)reject('지금 입주할 수 있는 실제 임대 매물이 아닙니다.');
    if(!owner?.alive&&!(h.pub&&S.gov))reject('임대료를 받을 권한 있는 주체가 없습니다.');
    const p=S.geo.lots[h.lot],from=geo.location(me),distance=Math.hypot(p.x+5-from.x,p.y+5-from.y);if(distance>160)reject('한 번에 옮기기에는 먼 집입니다. 가까운 생활권부터 살펴보세요.');
    hours=2+distance/160;cost=h.rent*((Math.floor(S.day/10)+1)*10-S.day)/10;label='임대 계약과 입주';details={houseId:h.id,rent:h.rent,nextDueDay:(Math.floor(S.day/10)+1)*10,fromRegion:here.id,toRegion:geo.atLot(h.lot).id};
  }else reject('지원하지 않는 생활 행동입니다.');
  if(available(world,strategy,me)+1e-9<hours)reject('오늘의 여유 시간이 모자랍니다.');if(me.cash+1e-9<cost)reject('개인 자금이 모자랍니다. 공공 예산을 대신 사용할 수 없습니다.');
  return {label,cost,hours,details,hint:`개인 자금 사용 · 여유 시간 ${hours.toFixed(1)}시간`,target};
}
function transferGrain(from,to,quantity){const before=to.inv.grain||0;to.gq=(before*(to.gq??1)+quantity*(from.gq??1))/(before+quantity);from.inv.grain-=quantity;to.inv.grain=before+quantity;}
function perform(world,strategy,action,args){
  const q=quote(world,strategy,action,args),S=world.S,me=S.byId.get(strategy.playerId),state=strategy.living;
  consume(world,strategy,me,q.hours,action!=='living.rest');
  if(action==='living.buyFood'){world.livingPay(me,q.target,q.cost,'farm','food');transferGrain(q.target,me,args.quantity);record(world,strategy,{good:'grain',buyer:me,seller:q.target,quantity:args.quantity,price:q.details.price});}
  if(action==='living.support')transferGrain(me,q.target,args.quantity);
  if(action==='living.rest'){me.fat=Math.max(0,me.fat-q.details.fatigueReduction);me.hunger=clamp(me.hunger+args.hours,0,100);}
  if(action==='living.lesson'){
    consume(world,strategy,q.target,args.hours);world.livingPay(me,q.target,q.cost,'biz','edu');me.skill[args.skill]+=q.details.gain;
    state.teaching[q.target.id]={day:S.day,used:(state.teaching[q.target.id]?.day===S.day?state.teaching[q.target.id].used:0)+args.hours};
  }
  if(action==='living.rent')world.livingRent(me,args.houseId,q.cost);
  const result={text:q.label+' 완료',cost:q.cost,hours:q.hours,...q.details};
  state.actions.push({day:S.day,actor:me.id,action,label:q.label,region:geography(world).region(me).id,cost:q.cost,hours:q.hours,...q.details});state.actions=state.actions.slice(-30);
  S.events.push({d:S.day,type:'living',text:world.nm(me)+' · '+result.text,ids:[me.id,...(q.target?[q.target.id]:[])]});if(S.events.length>300)S.events.shift();
  return result;
}
function view(world,strategy){
  const S=world.S,me=S.byId.get(strategy.playerId),state=strategy.living,stats=collect(world,strategy),here=stats.geo.region(me),home=stats.geo.houses.get(me.home),family=relatives(world,me);
  const descriptor=(action,args,label)=>({command:{action,args},label});
  const offers={sellers:[],teachers:[],homes:[]};
  for(const a of S.agents){if(!a.alive||a.id===me.id||stats.geo.region(a)?.id!==here.id)continue;
    const stock=Math.max(0,(a.inv.grain||0)-Math.max(2,a.g.keepG||6));if(stock>=1&&offers.sellers.length<6)offers.sellers.push({...descriptor('living.buyFood',{supplierId:a.id,quantity:Math.min(4,Math.floor(stock))},world.nm(a)+'에게 곡식 사기'),id:a.id,name:world.nm(a),stock,price:S.price.grain*marketFactor(stats.regions.find(r=>r.id===here.id))});
    for(const skill of [0,1,2,3,9,10,11,12])if((a.skill[skill]||0)>=(me.skill[skill]||0)+.1)offers.teachers.push({...descriptor('living.lesson',{teacherId:a.id,skill,hours:1},world.nm(a)+'에게 '+ACT[skill]+' 배우기'),id:a.id,skill,level:a.skill[skill],cost:Math.max(.5,S.wageAvg||1)*1.25});
  }
  const perSkill=new Map();offers.teachers=offers.teachers.sort((a,b)=>a.skill-b.skill||b.level-a.level).filter(row=>{const n=perSkill.get(row.skill)||0;perSkill.set(row.skill,n+1);return n<2;});
  for(const h of S.houses.filter(h=>!h.occ&&h.rent>0&&!h.deposit&&(h.cond??1)>.25).sort((a,b)=>a.rent-b.rent)){
    const p=S.geo.lots[h.lot],from=stats.geo.location(me);if(!p||Math.hypot(p.x+5-from.x,p.y+5-from.y)>160)continue;
    offers.homes.push({...descriptor('living.rent',{houseId:h.id},'주택 '+h.id+' 임대 계약'),id:h.id,rent:h.rent,region:stats.geo.atLot(h.lot),position:{x:p.x+5,y:p.y+5}});if(offers.homes.length>=8)break;
  }
  return {worldId:strategy.worldId,revision:strategy.revision,day:S.day,region:here,regions:stats.regions,
    me:{food:food(me),fatigue:me.fat,health:me.health,hunger:me.hunger,freeHours:available(world,strategy,me),cash:me.cash,
      rent:home?.tenantRent||0,nextRentDay:(Math.floor(S.day/10)+1)*10,nextBudgetDay:(Math.floor(S.day/5)+1)*5,
      education:me.edu||0,study:copy(me.study||(S.dyn.social?.basic?.pid===me.id?S.dyn.social.basic:null)),pressure:pressure(me,home),skills:me.skill.map((level,id)=>({id,name:ACT[id],level})).filter(s=>skills.has(s.id))},
    family:family.map(a=>({id:a.id,relation:a.id===me.partner?'partner':me.kids.includes(a.id)||a.parents?.includes(me.id)?'child':'parent',name:world.nm(a),age:a.age/YEAR,hunger:a.hunger,food:food(a),education:a.edu||0,home:a.home,needs:pressure(a,stats.geo.houses.get(a.home)).reasons,
      support:descriptor('living.support',{personId:a.id,quantity:2},world.nm(a)+'에게 곡식 2 나누기')})),
    offers,history:copy(state.history),actions:copy(state.actions)};
}
module.exports={connect,observe,view,quote,perform,collect,geography};
