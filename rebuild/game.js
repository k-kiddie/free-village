'use strict';
// 서버 전용 전략 시뮬레이션. 모든 명령은 비용·권한·대상을 검사한 뒤 실행한다.
const VERSION=1;
const GOODS={food:'식량',tools:'공구',cloth:'의복'};
const POLICIES={volume:{name:'저가 대량',price:4,output:5},quality:{name:'고품질 소량',price:8,output:3},training:{name:'숙련 투자',price:6,output:3}};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function createGame(seed=20261120,saved){
 let S;
 function random(){S.rng=(Math.imul(S.rng,1664525)+1013904223)>>>0;return S.rng/4294967296}
 if(saved){if(saved.version!==VERSION||!saved.state?.people||!saved.state?.districts)throw Error('지원하지 않는 리빌드 저장입니다. 기존 파일을 보존했습니다.');S=structuredClone(saved.state)}
 else {
  S={rng:seed>>>0,seed,day:0,revision:0,people:[],districts:[],sites:[],firms:[],plans:[],notes:[],promises:[],events:[],treasury:600,market:5000,player:{cash:420,energy:3,skill:1,trust:35,office:false,candidate:false,platform:'jobs',organization:0,generation:1,heirSkill:1},next:1,election:30,tax:.08,goal:'사업 기반 만들기',history:[]};
  ['들녘','시장거리','강변'].forEach((name,id)=>S.districts.push({id,name,road:id===1?2:0,school:0,support:30,food:0,jobs:0,needs:{food:20,tools:5,cloth:5}}));
  const names=['서윤','도현','하린','지후','수빈','민준','지안','유진','시우','다은'];
  for(let i=0;i<60;i++)S.people.push({id:i+1,name:names[i%10]+(Math.floor(i/10)+1),district:i%3,cash:70+Math.floor(random()*60),skill:1+Math.floor(random()*4),ambition:random(),loyalty:40,job:null,relation:0,age:18+Math.floor(random()*35)});
  for(let i=0;i<9;i++)S.sites.push({id:i,district:i%3,name:['옛 방앗간','골목 공방','나루 창고'][i%3]+' '+(Math.floor(i/3)+1),rent:2+i%3,setup:75+i*5,owner:null});
  for(let i=0;i<3;i++){const f={id:S.next++,site:i,owner:'rival',name:['들녘 상회','진수 공방','나루 직물'][i],good:Object.keys(GOODS)[i],policy:'volume',cash:240,stock:12,level:1,workers:[],supplier:'local',wage:5,profit:0,sold:0,manager:null};S.firms.push(f);S.sites[i].owner=f.id;const a=S.people[i];a.job=f.id;f.workers.push(a.id)}
  note('새 출발','빈 점포와 지역 수요를 살펴보세요. 입지·상품·운영 방침에 따라 다른 사업을 만들 수 있습니다.');
 }
 function note(title,text){S.notes.unshift({day:S.day,title,text});S.notes=S.notes.slice(0,50)}
 function person(id){const p=S.people.find(p=>p.id===id);if(!p)throw Error('대상 주민이 없습니다');return p}
 function site(id){const s=S.sites.find(s=>s.id===id);if(!s)throw Error('대상 입지가 없습니다');return s}
 function firm(id){const f=S.firms.find(f=>f.id===id);if(!f||f.owner!=='player')throw Error('내 사업에만 지시할 수 있습니다');return f}
 function district(id){const d=S.districts.find(d=>d.id===id);if(!d)throw Error('대상 지역이 없습니다');return d}
 function pay(from,to,amount){if(!Number.isFinite(amount)||amount<0||from.cash+1e-8<amount)throw Error('자금이 부족합니다');from.cash-=amount;to.cash+=amount}
 const market=()=>({get cash(){return S.market},set cash(n){S.market=n}});
 const treasury=()=>({get cash(){return S.treasury},set cash(n){S.treasury=n}});
 function energy(n=1){if(S.player.energy<n)throw Error('오늘의 시간이 부족합니다. 하루를 진행하세요.');S.player.energy-=n}
 function funds(n,account=S.player){if(account.cash<n)throw Error('자금이 부족합니다')}
 function ownPlan(type,target){return S.plans.some(p=>p.type===type&&p.target===target&&p.status==='active')}
 function plan(type,target,cost,duration,title){if(ownPlan(type,target))throw Error('이미 진행 중인 계획입니다');funds(cost,type==='road'||type==='school'?treasury():S.player);energy();pay(type==='road'||type==='school'?treasury():S.player,market(),cost);S.plans.push({id:S.next++,type,target,cost,duration,progress:0,status:'active',title,paused:false,reason:'',started:S.day});note('계획 시작',`${title} · ${duration}일 · ${cost}원 집행`)}
 function eligibility(e){const f=S.firms.find(f=>f.id===e.firm&&f.owner==='player');return e.kind==='contract'?!!f&&f.good===e.good&&!S.player.office:false}
 function command(c){
  if(!c||typeof c.action!=='string')throw Error('명령이 올바르지 않습니다');
  // 실패 명령은 시간·자금·난수까지 되돌려 원자적으로 처리한다.
  const before=structuredClone(S);
  try{
   const P=S.player;
   switch(c.action){
    case 'advance': {if(!Number.isInteger(c.days)||c.days<1||c.days>30)throw Error('1~30일만 진행할 수 있습니다');for(let i=0;i<c.days;i++){if(S.events.some(eligibility))break;tick()}break}
    case 'goal': if(!['사업 기반 만들기','지역 선거 도전','가문 이어가기'].includes(c.value))throw Error('알 수 없는 목표');S.goal=c.value;break;
    case 'open': {const s=site(c.site);if(s.owner||ownPlan('open',s.id))throw Error('이미 사용 중인 점포입니다');if(!GOODS[c.good]||!POLICIES[c.policy])throw Error('상품과 방침을 선택하세요');plan('open',s.id,s.setup+60,3,`${s.name} ${GOODS[c.good]} 사업`);Object.assign(S.plans.at(-1),{good:c.good,policy:c.policy});break}
    case 'fund': {const f=firm(c.firm);energy();pay(P,f,50);break}
    case 'policy': {const f=firm(c.firm);if(!POLICIES[c.value])throw Error('알 수 없는 방침');energy();f.policy=c.value;note('운영 방침 변경',`${f.name}: ${POLICIES[c.value].name}`);break}
    case 'supplier': {const f=firm(c.firm);if(!['local','import'].includes(c.value))throw Error('공급자를 선택하세요');energy();f.supplier=c.value;break}
    case 'hire': {const f=firm(c.firm),p=person(c.person);if(p.job||f.workers.length>=f.level*3)throw Error('고용 가능한 주민이나 빈자리가 없습니다');if(f.cash<f.wage*3)throw Error('사업 자금으로 최소 3일 임금을 확보하세요');energy();p.job=f.id;f.workers.push(p.id);p.relation+=5;note('고용 계약',`${p.name} · 하루 ${f.wage}원 · ${f.name}`);break}
    case 'wage': {const f=firm(c.firm);if(![5,7,9].includes(c.value))throw Error('임금이 올바르지 않습니다');energy();f.wage=c.value;break}
    case 'delegate': {const f=firm(c.firm),p=person(c.person);if(p.job!==f.id)throw Error('사업의 직원에게만 위임할 수 있습니다');energy();f.manager=p.id;note('경영 위임',`${p.name}에게 운영을 맡겼습니다. 숙련은 생산에, 관계는 이직에 영향을 줍니다.`);break}
    case 'expand': {const f=firm(c.firm);if(f.level>=3)throw Error('최대 규모입니다');plan('expand',f.id,100*f.level,6,`${f.name} 확장`);break}
    case 'close': {const f=firm(c.firm);if(ownPlan('expand',f.id)||S.promises.some(p=>p.firm===f.id&&p.status==='active'))throw Error('진행 중인 확장·납품 약속을 먼저 마무리하세요');energy();for(const id of f.workers)person(id).job=null;pay(f,P,f.cash);site(f.site).owner=null;S.firms=S.firms.filter(x=>x!==f);note('사업 정리','현금은 회수했습니다. 기술과 인맥을 가지고 다시 시작할 수 있습니다.');break}
    case 'work': {if(P.office)throw Error('공직 중에는 공공사업에 집중하세요');energy(2);const income=Math.min(S.market,12+P.skill*2);pay(market(),P,income);P.skill+=.05;note('하루 품삯',`노동 소득 ${income.toFixed(0)}원. 재기를 위한 생계 활동입니다.`);break}
    case 'visit': {const d=district(c.district);energy(2);P.trust=clamp(P.trust+1,0,100);d.support=clamp(d.support+2+P.organization*.1,0,100);note('현장 면담',`${d.name}: 식량 충족 ${Math.round(d.food*100)}%, 고용 ${Math.round(d.jobs*100)}%. 생활 개선 약속이 실제 성과로 이어져야 지지가 유지됩니다.`);break}
    case 'organize': district(c.district);plan('organize',c.district,35,5,'지역 주민 조직');break;
    case 'campaign': {if(P.office||P.candidate)throw Error('이미 출마했거나 집행 중입니다');if(!['jobs','food','education'].includes(c.value))throw Error('공약을 선택하세요');energy();P.candidate=true;P.platform=c.value;note('출마 선언',`${S.election}일 선거 · 생활 성과, 신뢰, 조직이 득표에 반영됩니다.`);break}
    case 'road':case 'school': {const d=district(c.district);if(!P.office)throw Error('공공 예산 집행 권한이 없습니다');if(d[c.action]>=2)throw Error('이미 충분히 확충했습니다');plan(c.action,d.id,c.action==='road'?140:180,8,`${d.name} ${c.action==='road'?'도로':'학교'} 건설`);break}
    case 'tax': if(!P.office)throw Error('조세 정책 권한이 없습니다');if(![.04,.08,.12].includes(c.value))throw Error('허용된 세율이 아닙니다');energy();S.tax=c.value;note('세율 변경',`사업 매출의 ${Math.round(c.value*100)}%. 국고 수입과 사업 현금에 영향을 줍니다.`);break;
    case 'educate': plan('educate',0,45,12,'후계자 실무 교육');break;
    case 'succession': if(P.office||P.candidate||S.plans.some(p=>p.status==='active'))throw Error('공직·출마·진행 계획을 마친 뒤 계승할 수 있습니다');if(S.day<120*P.generation)throw Error('한 세대는 최소 120일입니다');energy();P.generation++;P.skill=P.heirSkill;P.trust*=.7;P.organization=Math.floor(P.organization*.7);for(const p of S.people)p.relation*=.6;note('가문 계승',`${P.generation}대가 재산·사업·인맥을 이어받았습니다. 개인 신뢰 일부는 새로 쌓아야 합니다.`);break;
    case 'plan': {const p=S.plans.find(p=>p.id===c.id&&p.status==='active');if(!p)throw Error('진행 중인 계획이 없습니다');p.paused=!p.paused;break}
    case 'choose': {const e=S.events.find(e=>e.id===c.id);if(!e||!eligibility(e))throw Error('현재 역할과 맞지 않는 제안입니다');if(!['accept','counter','decline'].includes(c.value))throw Error('선택이 올바르지 않습니다');const f=firm(e.firm);if(c.value!=='decline'){const quantity=c.value==='counter'?12:20;S.promises.push({id:S.next++,firm:f.id,person:e.person,quantity,price:c.value==='counter'?5:7,due:S.day+8,status:'active'});note('납품 약속',`${person(e.person).name}: 8일 안에 ${quantity}개, 개당 ${c.value==='counter'?5:7}원. 미달 시 신뢰가 하락합니다.`)}S.events=S.events.filter(x=>x!==e);break}
    case 'save':case 'suspend':break;
    default:throw Error('지원하지 않는 명령입니다');
   }
   S.events=S.events.filter(eligibility);S.revision++;return view();
  }catch(e){S=before;throw e}
 }
 function tick(){
  S.day++;const P=S.player;P.energy=3;
  // 농사·외부 판매 소득도 외부 시장 계정에서 실제 이동한다.
  for(const p of S.people){if(!p.job)pay(market(),p,Math.min(S.market,3));if(S.day%12===0)p.skill=Math.min(10,p.skill+district(p.district).school*.03);if(p.job&&p.ambition>.65&&p.loyalty<35&&S.day%15===0){const current=S.firms.find(f=>f.id===p.job),offer=S.firms.find(f=>f.id!==p.job&&f.wage>(current?.wage||0)&&f.workers.length<f.level*3&&f.cash>f.wage*5);if(offer&&current){current.workers=current.workers.filter(id=>id!==p.id);if(current.manager===p.id)current.manager=null;p.job=offer.id;offer.workers.push(p.id);p.loyalty=55;note('직원 이직',`${p.name}이 더 나은 임금을 제시한 ${offer.name}으로 옮겼습니다.`)}}}
  for(const d of S.districts){d.needs={food:20,tools:5,cloth:5};d.satisfied=0;d.jobs=S.people.filter(p=>p.district===d.id&&p.job).length/20}
  const shuffled=[...S.firms].sort((a,b)=>((a.id+S.day)%S.next)-((b.id+S.day)%S.next));
  for(const f of shuffled){
   const d=district(site(f.site).district),rule=POLICIES[f.policy];let spent=0,revenue=0;
   const cost=f.supplier==='local'?1.5:2.3,capacity=f.supplier==='local'?4+d.road*2:12;
   let output=0;
   for(const id of [...f.workers]){const p=person(id);if(f.cash<f.wage){p.loyalty-=12;continue}pay(f,p,f.wage);spent+=f.wage;p.loyalty=clamp(p.loyalty+(f.wage>=7?2:-.4),0,100);if(p.loyalty<15){p.job=null;f.workers=f.workers.filter(x=>x!==id);if(f.manager===id)f.manager=null;note('직원 퇴사',`${p.name}: 임금·체불로 ${f.name}을 떠났습니다.`);continue}output+=rule.output*(1+p.skill*.12);if(f.policy==='training')p.skill=Math.min(10,p.skill+.04)}
   if(f.owner==='player'&&P.energy>0&&!P.office)output+=rule.output*(1+P.skill*.1);
   if(f.manager)output*=1+person(f.manager).skill*.03;
   output=Math.min(capacity*f.level,output,Math.floor(f.cash/cost));if(output>0){pay(f,market(),output*cost);spent+=output*cost;f.stock+=output}
   const price=rule.price*(1+f.level*.03),residents=S.people.filter(p=>p.district===d.id);
   let remaining=Math.min(f.stock,d.needs[f.good]*(f.policy==='quality'?.65:1));
   for(const p of residents){const n=Math.min(remaining,p.cash/price,f.good==='food'?1.5:.5);if(n<=0)continue;pay(p,f,n*price);remaining-=n;f.stock-=n;d.needs[f.good]=Math.max(0,d.needs[f.good]-n);revenue+=n*price}
   const tax=revenue*S.tax;pay(f,treasury(),tax);spent+=tax;
   const rent=Math.min(f.cash,site(f.site).rent);pay(f,market(),rent);spent+=rent;
   f.profit=revenue-spent;f.sold=revenue/price;
   if(f.owner==='player'&&f.cash>100){const dividend=Math.min(f.cash-100,Math.max(0,f.profit)*.5);pay(f,P,dividend)}
   // 경쟁자의 확장과 가격 반응은 자금·수요에서 발생한다.
   if(f.owner==='rival'&&S.day%10===0){f.policy=d.needs[f.good]>8?'volume':'quality';const vacant=S.sites.find(s=>s.district===d.id&&!s.owner&&!ownPlan('open',s.id));if(vacant&&f.cash>350){pay(f,market(),vacant.setup);const nf={...f,id:S.next++,site:vacant.id,cash:0,stock:0,workers:[],manager:null};pay(f,nf,100);nf.cash=100;S.firms.push(nf);vacant.owner=nf.id;note('경쟁자 확장',`${f.name}이 ${vacant.name}에 새 점포를 열었습니다.`)}const candidate=S.people.find(p=>!p.job&&p.skill>=2);if(candidate&&f.workers.length<3&&f.cash>40){candidate.job=f.id;f.workers.push(candidate.id)}}
  }
  for(const d of S.districts){d.food=clamp(1-d.needs.food/20,0,1);const satisfaction=d.food*35+d.jobs*30+d.road*4+d.school*5;const target=20+satisfaction+P.trust*.12+P.organization*.6;d.support=clamp(d.support+(target-d.support)*.04-(P.office&&d.food<.4? .3:0),0,100)}
  for(const p of S.plans.filter(p=>p.status==='active')){p.reason='';if(p.paused){p.reason='직접 일시정지';continue}if(['road','school'].includes(p.type)&&!P.office){p.reason='공직 권한을 잃어 중단';continue}if(p.type==='expand'&&!S.firms.some(f=>f.id===p.target&&f.workers.length)){p.reason='직원이 있어야 확장 가능';continue}p.progress++;if(p.progress<p.duration)continue;
   if(p.type==='open'){const s=site(p.target);const f={id:S.next++,site:s.id,name:s.name,owner:'player',cash:0,stock:0,good:p.good,policy:p.policy,level:1,workers:[],supplier:'local',wage:5,profit:0,sold:0,manager:null};pay(market(),f,60);f.cash=60;S.firms.push(f);s.owner=f.id}
   if(p.type==='expand')firm(p.target).level++;
   if(p.type==='road'||p.type==='school')district(p.target)[p.type]++;
   if(p.type==='organize'){P.organization++;district(p.target).support+=4}
   if(p.type==='educate')P.heirSkill+=1;
   p.status='done';note('계획 완료',p.title);
  }
  for(const promise of S.promises.filter(p=>p.status==='active')){const f=S.firms.find(f=>f.id===promise.firm),buyer=person(promise.person);if(f&&f.stock>=promise.quantity&&buyer.cash>=promise.quantity*promise.price){pay(buyer,f,promise.quantity*promise.price);f.stock-=promise.quantity;promise.status='kept';buyer.relation+=15;P.trust=Math.min(100,P.trust+3);note('약속 이행',`${buyer.name}에게 ${promise.quantity}개 납품. 다음 거래의 신뢰로 남습니다.`)}else if(S.day>=promise.due){promise.status='broken';buyer.relation-=15;P.trust=Math.max(0,P.trust-6);note('납품 실패','기한을 넘겼습니다. 관계와 신뢰가 하락했습니다.')}}
  if(S.day%17===0&&!P.office){const f=S.firms.find(f=>f.owner==='player');const buyer=S.people.filter(p=>p.cash>=140&&!p.job)[0];if(f&&buyer&&!S.promises.some(p=>p.firm===f.id&&p.status==='active'))S.events.push({id:S.next++,kind:'contract',firm:f.id,good:f.good,person:buyer.id,title:`${buyer.name}의 납품 제안`,text:`${GOODS[f.good]} 20개를 8일 안에 개당 7원에 납품해 주세요. 작은 계약으로 역제안할 수도 있습니다.`})}
  if(S.day===S.election){const performance=S.districts.reduce((n,d)=>n+(P.platform==='food'?d.food*8:P.platform==='education'?d.school*4:d.jobs*8),0)/3;const score=S.districts.reduce((n,d)=>n+d.support,0)/3+P.organization*1.5+performance;const rival=46+Math.sin(S.day*.1)*7;const won=P.candidate&&score>rival;P.office=won;P.candidate=false;S.election+=30;note(won?'지역 선거 당선':'지역 선거 결과',`내 기반 ${score.toFixed(1)} · 경쟁 후보 ${rival.toFixed(1)}. ${won?'공공 예산으로 도로·학교를 집행할 수 있습니다.':'지역 활동과 조직을 이어가며 재출마할 수 있습니다.'}`);S.history.push({day:S.day,score,rival,won})}
  S.events=S.events.filter(eligibility);S.plans=S.plans.filter(p=>p.status==='active'||S.day-p.started<90);S.history=S.history.slice(-20);
 }
 function view(){return structuredClone({...S,version:VERSION,goods:GOODS,policies:POLICIES,events:S.events.filter(eligibility),role:S.player.office?'지역 집행자':S.player.candidate?'지역 후보':S.firms.some(f=>f.owner==='player')?'사업가':'주민'})}
 return {command,view,export:()=>({version:VERSION,state:structuredClone(S)}),money:()=>S.market+S.treasury+S.player.cash+S.people.reduce((n,p)=>n+p.cash,0)+S.firms.reduce((n,f)=>n+f.cash,0)};
}
module.exports={createGame,VERSION};
