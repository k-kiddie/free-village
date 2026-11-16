'use strict';
// 기존 패널 표시 함수를 재사용한다. 엔진 실행이나 전체 상태 복사는 하지 않는다.
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function fragments(html){
  const out=[];let depth=0,start=0;const voids=new Set(['br','hr','img','input','meta','link','wbr','area','base','col','embed','param','source','track']);
  const re=/<\/?([a-z][\w:-]*)\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi;let m;
  while((m=re.exec(html))){const close=m[0][1]==='/',single=voids.has(m[1].toLowerCase())||/\/>$/.test(m[0]);
    if(!close&&depth===0)start=m.index;
    if(!single)depth+=close?-1:1;
    if(depth===0)out.push(html.slice(start,re.lastIndex));
  }return out;
}
function element(html=''){
  return {innerHTML:html,hidden:false,querySelectorAll:()=>[],
    querySelector(tag){const m=this.innerHTML.match(new RegExp('<'+tag+'[^>]*>([\\s\\S]*?)</'+tag+'>','i'));return m?{textContent:m[1].replace(/<[^>]*>/g,'')}:null},
    get children(){return fragments(this.innerHTML).map(h=>{const el=element(h);el.outerHTML=h;el.classList={contains:c=>(h.match(/^<[^>]*\bclass=["']([^"']*)/)||['',''])[1].split(/\s+/).includes(c)};return el})}
  };
}
module.exports=function createPresenter(){
  const source=fs.readFileSync(path.join(__dirname,'ui2.html'),'utf8');
  const nodes=new Map();const get=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)};
  const ctx=vm.createContext({console,performance,localStorage:{getItem:()=>null},document:{querySelector:get,createElement:()=>element()}});
  const engine=fs.readFileSync(path.join(__dirname,'engine.js'),'utf8');
  const head=source.slice(source.indexOf('const $='),source.indexOf('// ---------- 월드 그리기'));
  const spend=source.slice(source.indexOf('const SPN='),source.indexOf('function tag('));
  const panels=source.slice(source.indexOf('const fmtD='),source.indexOf('// ---------- 조작'));
  const buildingColors=source.slice(source.indexOf('const BXC='),source.indexOf('function drawApt('));
  vm.runInContext(engine+'\n'+head+'\n'+spend+'\n'+buildingColors+'\n'+panels,ctx);
  const bind=(world)=>{ctx.world=world;ctx.geometry=require('./engine.js');vm.runInContext('W0=world;S=world.S;setMap(!!S.mapBig);if(S.geo)restoreGeo(S.geo);PLOTS.length=0;PLOTS.push(...geometry.PLOTS);EXPL.length=0;EXPL.push(...geometry.EXPL);',ctx)};
  return {
    panel(world,key,filter='all',selected=null){bind(world);ctx.key=key;ctx.filter=filter;ctx.selected=selected;
      vm.runInContext("if(!GROUPS.some(g=>g[1].some(t=>t[0]===key)))throw Error('알 수 없는 탭');tab=key;logF=filter;sel=selected;if(tab==='rich'||tab==='log')renderPanel0();else $('#panel').innerHTML=routeHTML(tab);",ctx);
      return world.titled(get('#panel').innerHTML);
    },
    card(world,id){bind(world);ctx.residentId=id;vm.runInContext('sel=residentId;renderCard0()',ctx);return world.titled(get('#card').innerHTML)}
  };
};
