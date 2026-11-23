'use strict';
// 기존 집터 사이의 통행 간격을 도로로 사용한다. 건물 중심 사이 직선은 도로가 아니다.
// topology는 geo에서 재구성하고 폐쇄/용량/당일 통과량은 canonical 저장에 보존한다.
const cache=new WeakMap(),copy=x=>structuredClone(x),SPEED=80,CAPACITY=40;
function network(world){
 const geo=world.S.geo;if(cache.has(geo))return cache.get(geo);
 const xs=[...new Set(geo.lots.map(l=>l.x-1))].sort((a,b)=>a-b),ys=[...new Set(geo.lots.map(l=>l.y-1))].sort((a,b)=>a-b),nodes=[],edges=[],adj=[];
 const add=(a,b)=>{const A=nodes[a],B=nodes[b],id=`${A.x},${A.y}:${B.x},${B.y}`,e={id,a,b,length:Math.hypot(A.x-B.x,A.y-B.y)};edges.push(e);adj[a].push(e);adj[b].push(e);};
 for(const y of ys)for(const x of xs){nodes.push({x,y});adj.push([]);}
 for(let j=0;j<ys.length;j++)for(let i=0;i<xs.length;i++){const n=j*xs.length+i;if(i)add(n-1,n);if(j)add(n-xs.length,n);}
 const byId=new Map(edges.map(e=>[e.id,e])),g={xs,ys,nodes,edges,adj,byId};cache.set(geo,g);return g;
}
function state(world){const b=world.S.business;return b.roads ||= {version:1,closures:{},capacities:{},traffic:{day:world.S.day,used:{}}};}
function closed(world,e){return (world.S.business?.roads?.closures[e.id]?.until??-1)>world.S.day;}
function capacity(world,e){return world.S.business?.roads?.capacities[e.id]??CAPACITY;}
function nearest(values,n){let best=0;for(let i=1;i<values.length;i++)if(Math.abs(values[i]-n)<Math.abs(values[best]-n))best=i;return best;}
function anchor(g,p){const i=nearest(g.xs,p.x),j=nearest(g.ys,p.y);return j*g.xs.length+i;}
class Heap{constructor(){this.q=[];}push(n,d){const q=this.q;let i=q.length;q.push({n,d});while(i){const p=(i-1)>>1;if(q[p].d<=d)break;q[i]=q[p];i=p;}q[i]={n,d};}pop(){const q=this.q,out=q[0],last=q.pop();if(q.length){let i=0;while(i*2+1<q.length){let c=i*2+1;if(c+1<q.length&&q[c+1].d<q[c].d)c++;if(q[c].d>=last.d)break;q[i]=q[c];i=c;}q[i]=last;}return out;}get length(){return this.q.length;}}
function path(world,from,to,quantity=0,reverse=false){
 const g=network(world),start=anchor(g,from),end=anchor(g,to),r=world.S.business?.roads,stamp=JSON.stringify([world.S.day,r?.closures,r?.capacities]);
 if(g.stamp!==stamp){g.stamp=stamp;g.trees=new Map();}
 const startKey=start+':'+quantity,endKey=end+':'+quantity,key=reverse?endKey:startKey;
 let tree=g.trees.get(key);
 if(!tree){const root=Number(key.split(':')[0]),dist=new Float64Array(g.nodes.length).fill(Infinity),prev=new Int32Array(g.nodes.length).fill(-1),via=[],heap=new Heap();dist[root]=0;heap.push(root,0);
  while(heap.length){const {n,d}=heap.pop();if(d!==dist[n])continue;for(const e of g.adj[n]){if(closed(world,e)||capacity(world,e)<quantity)continue;const next=e.a===n?e.b:e.a,nd=d+e.length;if(nd<dist[next]){dist[next]=nd;prev[next]=n;via[next]=e;heap.push(next,nd);}}}
  tree={root,dist,prev,via};if(g.trees.size>=128)g.trees.delete(g.trees.keys().next().value);g.trees.set(key,tree);
 }
 const {root,dist,prev,via}=tree,target=root===start?end:start;
 if(!Number.isFinite(dist[target]))throw Error('통행 가능한 도로 경로가 없습니다. 도로 복구나 다른 입고지를 확인해 주세요.');
 const ids=[];for(let n=target;n!==root;n=prev[n])ids.push(n);ids.push(root);if(root===start)ids.reverse();
 const chain=ids.slice(1).map((n,i)=>({point:copy(g.nodes[n]),edgeId:(root===start?via[n]:via[ids[i]]).id}));
 // 출입로는 같은 부지의 문→가장 가까운 통행로다. 지도에도 동일한 접속선을 보낸다.
 const points=[{point:copy(from)}, {point:{x:g.nodes[start].x,y:from.y}}, {point:copy(g.nodes[start])},...chain,{point:{x:to.x,y:g.nodes[end].y}},{point:copy(to)}];
 return points.filter((p,i)=>!i||p.point.x!==points[i-1].point.x||p.point.y!==points[i-1].point.y);
}
function length(p){let n=0;for(let i=1;i<p.length;i++)n+=Math.hypot(p[i].point.x-p[i-1].point.x,p[i].point.y-p[i-1].point.y);return n;}
function travelDays(paths,speed){let day=1,budget=speed;for(const p of paths)for(let i=1;i<p.length;i++){let d=Math.hypot(p[i].point.x-p[i-1].point.x,p[i].point.y-p[i-1].point.y);if(p[i].edgeId&&d>budget+1e-8){day++;budget=speed;}while(d>budget+1e-8){d-=budget;day++;budget=speed;}budget-=d;}return day;}
function speed(world){return SPEED*(1+Math.min(1,Math.max(0,(world.S.paved||0)/4000))*.4);}
function quote(world,courier,origin,destination,quantity){
 const pickup=path(world,courier,origin),loaded=path(world,origin,destination,quantity,true),back=path(world,destination,courier),s=speed(world),days=travelDays([pickup,loaded],s),backDays=travelDays([back],s);
 return {origin:copy(origin),destination:copy(destination),courier:copy(courier),distance:length(pickup)+length(loaded),days,backDays,freight:Math.max(.5,world.S.wageAvg||1)*(days+backDays)*(1+quantity/20),roadTrip:{version:1,phase:'pickup',pickup,loaded,back,index:0,offset:0,position:copy(courier),cargoPosition:copy(origin)}};
}
function current(world,o){return copy(o.roadTrip?.cargoPosition||o.position||o.origin);}
function reserve(world,e,quantity){const r=state(world);if(r.traffic.day!==world.S.day)r.traffic={day:world.S.day,used:{}};const used=r.traffic.used[e.id]||0;if(used+quantity>capacity(world,e)+1e-8)return false;r.traffic.used[e.id]=used+quantity;return true;}
function move(world,o){
 const t=o.roadTrip;if(!t)return null;if(t.lastDay===world.S.day)return {arrived:t.phase==='done'};t.lastDay=world.S.day;
 let budget=speed(world);t.reason=null;
 while(budget>1e-8&&t.phase!=='done'){
  let p=t[t.phase];
  if(t.index>=p.length-1){if(t.phase==='pickup'){t.phase='loaded';t.index=0;t.offset=0;t.position=copy(p.at(-1).point);continue;}t.phase='done';break;}
  const next=p[t.index+1],g=network(world),e=next.edgeId&&g.byId.get(next.edgeId),cargo=t.phase==='loaded'?(o.inv[o.good]||0):0;
  if(e&&(closed(world,e)||capacity(world,e)<cargo)){
   // 폐쇄 시 교차점에서 다시 경로를 찾는다. 통행 중인 구간에서 다른 길로 뛰지 않는다.
   if(t.offset>0){t.reason='통행 중 구간 폐쇄';break;}
   try{p=path(world,t.position,p.at(-1).point,cargo);t[t.phase]=p;t.index=0;continue;}catch(err){t.reason=err.message;break;}
  }
  if(e&&e.length>budget+1e-8)break;
  if(e&&t.offset===0&&!reserve(world,e,cargo)){t.reason='도로 구간의 당일 화물 용량 대기';break;}
  const a=p[t.index].point,b=next.point,d=Math.hypot(b.x-a.x,b.y-a.y),left=d-t.offset,step=Math.min(budget,left);t.offset+=step;budget-=step;const f=d?t.offset/d:1;t.position={x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f};if(t.phase==='loaded')t.cargoPosition=copy(t.position);
  if(t.offset>=d-1e-8){t.index++;t.offset=0;}
 }
 if(t.phase!=='done'&&t.index>=t[t.phase].length-1){if(t.phase==='loaded'||t.phase==='back')t.phase='done';}
 return {arrived:t.phase==='done',reason:t.reason};
}
function returning(o){const t=o.roadTrip;t.phase='back';t.index=0;t.offset=0;t.position=copy(o.destination);delete t.lastDay;}
function map(world,inside){const g=network(world),r=world.S.business?.roads;return g.edges.filter(e=>inside(g.nodes[e.a])||inside(g.nodes[e.b])).map(e=>({id:e.id,path:[g.nodes[e.a],g.nodes[e.b]],closed:closed(world,e),capacity:capacity(world,e),used:r?.traffic.day===world.S.day?(r.traffic.used[e.id]||0):0}));}
function validate(world){
 const r=world.S.business?.roads,orders=world.S.business?.orders||[];if(!r){if(orders.some(o=>o.roadTrip))throw Error('화물의 도로 저장이 없습니다.');return;}
 if(r.version!==1||!r.closures||!r.capacities||!r.traffic||!Number.isSafeInteger(r.traffic.day)||!r.traffic.used)throw Error('손상된 도로 저장입니다.');const g=network(world);
 for(const [id,c]of Object.entries(r.closures))if(!g.byId.has(id)||!Number.isSafeInteger(c.until))throw Error('손상된 도로 폐쇄입니다.');
 for(const dict of [r.capacities,r.traffic.used])for(const [id,n]of Object.entries(dict))if(!g.byId.has(id)||!Number.isFinite(n)||n<0)throw Error('손상된 도로 용량/통과량입니다.');
 const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y),same=(a,b)=>a.x===b.x&&a.y===b.y;
 for(const o of orders){const t=o.roadTrip;if(!t)continue;
  if(t.version!==1||!['pickup','loaded','back','done'].includes(t.phase)||!Number.isSafeInteger(t.index)||t.index<0||!Number.isFinite(t.offset)||t.offset<0||!point(t.position)||!point(t.cargoPosition))throw Error('손상된 화물 도로 진행값입니다.');
  for(const key of ['pickup','loaded','back']){const p=t[key];if(!Array.isArray(p)||!p.length||p.length>g.nodes.length+5||p.some(n=>!point(n.point)))throw Error('손상된 화물 경로입니다.');for(let i=1;i<p.length;i++)if(p[i].edgeId){const e=g.byId.get(p[i].edgeId),a=e&&g.nodes[e.a],b=e&&g.nodes[e.b];if(!e||!(same(p[i-1].point,a)&&same(p[i].point,b)||same(p[i-1].point,b)&&same(p[i].point,a)))throw Error('화물 경로가 실제 도로와 다릅니다.');}}
  if(t.phase!=='done'&&t.index>=t[t.phase].length)throw Error('화물 경로의 진행 범위를 초과했습니다.');
 }
}
module.exports={network,quote,move,current,returning,map,validate,state,path};
