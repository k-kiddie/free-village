'use strict';
// 가문 모드 건물별 행동: 건물 종류마다 다른 행동이 나오고 오류 없이 효과가 난다
const assert=require('node:assert/strict');
const src=require('fs').readFileSync(__dirname+'/check-story-fuzz.js','utf8');const {createWorld}=require('../engine.js');const rich=eval('('+src.match(/function rich[\s\S]*?\n}\n/)[0]+')');
const {w,S,D,me}=rich(1401);
const kinds=['pub','b1','shelter','heal','gather','store','guard','fac','arena','stage','lab','vault','office','press'];let id=900000;
for(const fx of kinds)S.bldgs.push({big:false,pname:fx==='press'?'시험신문':null,pk:fx==='press'?'watch':null,faith:null,id:++id,lot:0,owner:me.id,firm:null,spec:null,pub:false,weak:false,fx:[fx],fee:1,cond:1,built:S.day,builder:me.id,rev:0,revE:0,users:0,stud:0});
const A=b=>w.dynActions().find(a=>a.k==='bld:'+b.id);const seen=new Set();
for(const b of S.bldgs.filter(b=>b.id>900000)){const a=A(b);assert(a,b.fx[0]+' 행동 목록');for(const [v] of a.opts){D.cool['actbld'+b.id]=0;me.cash=1e6;me.inv.grain=500;me.jailUntil=0;
  if(v==='release')for(const x of S.agents.slice(0,10))x.hunger=80;
  try{const r=w.dynAct(`bld:${b.id}:${v}`);seen.add(v)}catch(e){if(!/없습니다|모자랍니다/.test(e.message))throw new Error(b.fx[0]+':'+v+' '+e.message)}}}
for(const v of ['feast','banquet','refuge','free','school','meet','release','hoard','patrol','extort','push','show','labA','labM','labW','hide','tenant','praise','scoop','tabloid','close','feeUp','feeDn'])assert(seen.has(v),v+' 실행됨');
assert(new Set(kinds.map(k=>JSON.stringify(A(S.bldgs.find(b=>b.fx[0]===k&&b.id>900000))?.opts?.map(o=>o[0])||[]))).size>=10,'건물마다 행동이 다름');
console.log(JSON.stringify({ok:true,ops:seen.size}));
