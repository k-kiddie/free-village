'use strict';
const {createWorld,YEAR}=require('../../engine');
const clone=x=>structuredClone(x);
// 생활 인과 검사용 조건: 실제 일반 플레이의 초기 자금·교사·공실과 구분한다.
function fixture({hunger=20,far=false,foodPoor=false}={}){
 const w=createWorld(42,120);w.dynStart();w.dynChoose(w.S.dyn.pending[0].id,'go');w.dynSetStory(0);
 const S=w.S,me=S.byId.get(S.dyn.pid),others=S.agents.filter(a=>a!==me),teacher=others[0],seller=others[1],child=others[2];
 const lots=S.geo.lots.map((p,id)=>({id,...p})).filter(p=>S.terr[p.id]?.t==='g');
 const left=lots.reduce((a,b)=>a.x+a.y<b.x+b.y?a:b),right=lots.reduce((a,b)=>a.x+a.y>b.x+b.y?a:b);
 function house(a,p){const old=S.houses.find(h=>h.id===a.home);if(old?.occ===a.id)old.occ=null;const h={id:S.nextHouse++,lot:p.id,owner:a.id,occ:a.id,cond:1,sale:null,rent:null,jeon:null,deposit:0,built:0};S.houses.push(h);a.home=h.id;S.lotUsed[p.id]=1;return h;}
 for(const a of S.agents){a.edu=0;a.study=null;a.hunger=foodPoor?75:20;a.health=100;a.cash=100;a.inv.grain=foodPoor?0:40;a.inv.meal=0;}
 const mine=house(me,left),remote=house(teacher,far?right:left);house(seller,left);
 // 검사 세계에서는 수요가 있는 쪽으로 주민을 배치한다. 실제 게임 생성을 바꾸지 않는다.
 for(const a of others.slice(3))a.home=foodPoor?mine.id:remote.id;
 Object.assign(me,{cash:500,hunger,health:100,fat:30,partner:null,parents:[],kids:[child.id],edu:0});me.inv.grain=10;me.skill[3]=.1;
 Object.assign(teacher,{edu:2,lastTeach:0,age:30*YEAR,emp:null});teacher.skill[3]=.8;teacher.q[0][11]=teacher.q[1][11]=100;teacher.inv.grain=40;
 seller.g.keepG=6;seller.inv.grain=30;
 Object.assign(child,{age:6*YEAR,parents:[me.id],family:me.family,home:mine.id,hunger:80,edu:0});child.inv.grain=0;
 return {state:clone(w.exportState()),me:me.id,teacher:teacher.id,seller:seller.id,child:child.id,left,right,mine:mine.id,remote:remote.id};
}
module.exports={fixture};
