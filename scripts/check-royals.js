'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const filename=path.resolve(__dirname,'../engine.js'),m=new Module(filename);m.filename=filename;m.paths=module.paths;
const code=fs.readFileSync(filename,'utf8').replace('const R=()=>rnd(),rr=','let R=()=>rnd();const rr=').replace('return{dynSetStory,','return{dynSetStory,_setRandom:f=>{R=f},succeed,royalTick,die,');m._compile(code,filename);
function fixture(){const w=m.exports.createWorld(42,100),A=w.S.agents;for(const a of A){a.parents=[];a.kids=[];a.partner=null;a.banned=false}
  const [grand,parent,king,eldest,younger,grandchild,sibling,nephew,cousin,uncle,spouse,guardian]=A;
  [80,60,40,20,18,1,45,22,30,50,35,50].forEach((age,i)=>{A[i].age=age*60;A[i].family=100});
  ['조부','부친','국왕','큰자녀','작은자녀','손주','형제','조카','사촌','백부','배우자','보호자'].forEach((name,i)=>{A[i].sur='검증';A[i].given=name});
  const link=(p,kids)=>{p.kids=kids.map(a=>a.id);for(const child of kids)child.parents=[p.id]};link(grand,[parent,uncle]);link(parent,[king,sibling]);link(king,[eldest,younger]);link(eldest,[grandchild]);link(sibling,[nephew]);link(uncle,[cousin]);king.partner=spouse.id;spouse.partner=king.id;
  w.S.gov={regime:'mon',chief:king.id,king:null,policy:{},tre:0,st:{},founded:0,elected:0,guards:0,council:[],rules:[],debt:[],history:[],term:1};w._setRandom(()=>.99);return{w,A,grand,parent,king,eldest,younger,grandchild,sibling,nephew,cousin,uncle,spouse,guardian,G:w.S.gov};
}
{
  const f=fixture(),{w,G,king,eldest,younger,grandchild,sibling,nephew}=f;const relatives=w.familyOf(king);assert.equal(relatives.grandchildren.length,1);assert.deepEqual(relatives.siblings.map(a=>a.id),[sibling.id]);assert.deepEqual(w.successionOrder(G,king).slice(0,5).map(a=>a.id),[eldest.id,younger.id,grandchild.id,sibling.id,nephew.id]);G.designatedHeir=younger.id;assert.equal(w.successionOrder(G,king)[0].id,younger.id);
}
{
  const {w,G,king,eldest,younger}=fixture();eldest.age=5*60;younger.banned=true;king.alive=false;assert(w.succeed(G,king));assert.equal(G.chief,eldest.id);assert(G.regent);eldest.age=18*60;w.royalTick();assert.equal(G.regent,null);
}
{
  const {w,G,A,king,eldest}=fixture();G.regime='cmon';G.king=king.id;G.chief=A[30].id;G.elected=123;king.alive=false;w.succeed(G,king);assert.equal(G.king,eldest.id);assert.equal(G.chief,A[30].id);assert.equal(G.elected,123);
}
{
  const {w,G,A}=fixture();const loner=A[12];loner.alive=false;G.chief=loner.id;w._setRandom(()=>.1);w.succeed(G,loner);assert(G.interregnum);assert.equal(G.chief,null);w.S.day=15;w.royalTick();assert(G.chief);assert.equal(G.interregnum,null);
}
{
  const {w,G,king,guardian}=fixture();king.age=5*60;G.regent=guardian.id;guardian.g.boss=1;guardian.g.cheat=1;w._setRandom(()=>.001);w.S.day=30;w.royalTick();assert.equal(G.chief,guardian.id);assert(king.banned);assert(w.S.events.some(e=>e.text.includes('찬탈')));
}
{
  const {w,G,king,younger}=fixture();king.g.boss=0;king.g.civic=0;king.cash=0;younger.g.boss=1;younger.g.civic=1;younger.cash=100;G.designatedHeir=younger.id;G.royalRivals=[younger.id];G.nextRoyalDispute=30;w.S.day=30;const sequence=[.01,.9,.01,.9];w._setRandom(()=>sequence.shift()??.9);w.royalTick();assert.equal(G.chief,younger.id);assert.equal(king.alive,false);assert(king.exiled);assert(w.S.events.some(e=>e.text.includes('왕자의 난')));
  const snapshot=JSON.parse(JSON.stringify(w.exportState()));w.importState(snapshot);const presenter=require('../server-presenter')();assert(presenter.card(w,king.id).includes('가족'));assert(presenter.card(w,king.id).includes('가계도'));assert(presenter.panel(w,'gov').includes('왕위 계승'));assert(w.S.byId.has(w.S.byId.get(king.id).parents[0]));
}
console.log('가족 관계·계승 5순위·지명 후계자·섭정·친정·입헌군주·귀족 추대·찬탈·왕자의 난·가계도 저장 복원 OK');
