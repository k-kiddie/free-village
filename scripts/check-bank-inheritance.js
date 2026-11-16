'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const filename=path.resolve(__dirname,'../engine.js'),m=new Module(filename);m.filename=filename;m.paths=module.paths;m._compile(fs.readFileSync(filename,'utf8').replace('return{rulingN,','return{die,rulingN,'),filename);
const w=m.exports.createWorld(31,100),ad=w.S.agents.filter(w.isAdult),parent=ad[0],heirs=ad.slice(1,4);parent.kids=heirs.map(a=>a.id);heirs.forEach(a=>a.sex='M');
w.S.banks=[{id:1,own:parent.id,alive:true,name:'상속은행'}];const firm={id:1,name:'상속회사',ceo:parent.id,sh:{B1:7000,[parent.id]:3000},shareVersion:74,totalShares:10000,price:.1,cash:0,bld:[],hist:[],lines:['mfg'],divE:0,born:0};w.S.firms.push(firm);
w.die(parent,'검증');assert.equal(w.S.banks[0].own,heirs[0].id);assert.equal(w.S.banks[0].alive,true);assert.equal(firm.sh.B1,7000);assert.equal(Object.values(firm.sh).reduce((n,q)=>n+q,0),10000);assert(Object.values(firm.sh).every(Number.isInteger));console.log('은행 상속 시 기관과 보유 주식 유지 OK');
