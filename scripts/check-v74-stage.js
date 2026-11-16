'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createWorld,YEAR}=require('../engine');
const stage=process.argv[2]||'stage',years=Number(process.env.CHECK_YEARS)||30,pop=Number(process.env.CHECK_POP)||2000;
const world=createWorld(42,pop),presenter=require('../server-presenter')();
const tabs=['sum','rich','log','evo','mkt','job','firm','fin','trade','land','gov','parl','adm','pol','opn','dist','fam','sex','edu','med','soc','fun','crime','gang','mil','infra'];
const start=performance.now();let last=0;
for(let day=0;day<YEAR*years;day++){
  world.step();assert(Number.isFinite(world.moneySupply())&&world.moneySupply()>0,'통화량 오류');
  if((day+1)%YEAR===0){for(const tab of tabs)assert(!presenter.panel(world,tab).includes('문제가 생겼다'),tab+' 렌더 오류');
    for(const a of world.S.agents){assert(Number.isFinite(a.cash),'주민 현금 오류');assert(a.g&&a.q,'주민 데이터 오류')}
    for(const f of world.S.firms){assert(Number.isFinite(f.price)&&Number.isFinite(f.cash),'회사 수치 오류');if(f.shareVersion===74){assert.equal(Object.values(f.sh).reduce((n,q)=>n+q,0),f.totalShares,'총 주식 수');assert(Object.values(f.sh).every(q=>Number.isInteger(q)&&q>=0),'정수 주식 수')}}
    if(performance.now()-last>30000){last=performance.now();console.log(JSON.stringify({stage,year:(day+1)/YEAR,pop:world.S.agents.length,money:world.moneySupply()}))}
  }
}
const dir=path.resolve(__dirname,'../save/v74-checks');fs.mkdirSync(dir,{recursive:true});
const report={stage,seed:42,initialPopulation:pop,years,population:world.S.agents.length,moneySupply:world.moneySupply(),ms:performance.now()-start,errors:0,tabs:tabs.length};
fs.writeFileSync(path.join(dir,stage+'.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
