'use strict';
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const assert=require('node:assert/strict');const zlib=require('node:zlib');const {Worker}=require('node:worker_threads');
const root=path.resolve(__dirname,'..');const directory=path.join(root,'save','client-'+Date.now());fs.mkdirSync(directory,{recursive:true});
const world=require('../engine').createWorld(42,500);for(let i=0;i<600;i++)world.step();fs.writeFileSync(path.join(directory,'village.json'),JSON.stringify({seed:42,pop:500,state:world.exportState()}));
async function main(){
  const worker=new Worker(path.join(root,'sim-worker.js'),{workerData:{seed:42,population:100},env:{...process.env,VILLAGE_SAVE_DIR:directory}});
  let view,readyResolve,sequence=0;const ready=new Promise(r=>readyResolve=r);const waiting=new Map();
  worker.on('message',m=>{if(m.type==='view'){view=JSON.parse(zlib.gunzipSync(m.body));readyResolve()}if(m.type==='reply'){const p=waiting.get(m.id);if(p){waiting.delete(m.id);m.replyType==='error'?p.reject(Error(m.value)):p.resolve(m.value)}}});
  worker.on('error',e=>{throw e});const rpc=(type,data={})=>new Promise((resolve,reject)=>{const id=++sequence;waiting.set(id,{resolve,reject});worker.postMessage({type,id,idRequest:id,...data})});
  try{
    await ready;
    const nodes=new Map(),noop=()=>{};const paint=new Proxy({measureText:t=>({width:String(t).length*8})},{get:(o,k)=>k in o?o[k]:noop,set:(o,k,v)=>(o[k]=v,true)});
    const node=()=>({innerHTML:'',textContent:'',className:'',style:{},dataset:{},hidden:false,width:400,height:272,children:[],classList:{add:noop,remove:noop,toggle:noop,contains:()=>false},querySelectorAll:()=>[],querySelector:()=>null,prepend:noop,append:noop,getContext:()=>paint,getBoundingClientRect:()=>({width:400,height:272,left:0,top:0}),addEventListener:noop});
    const get=k=>{if(!nodes.has(k))nodes.set(k,node());return nodes.get(k)};
    const document={querySelector:get,querySelectorAll:()=>[],getElementById:id=>get('#'+id),createElement:node,body:node(),addEventListener:noop};
    const ctx=vm.createContext({console,document,window:{REMOTE:true,devicePixelRatio:1,addEventListener:noop},performance,ResizeObserver:class{observe(){}},requestAnimationFrame:noop,setInterval:noop,setTimeout,clearTimeout,URLSearchParams,Blob,Response,CompressionStream,DecompressionStream,localStorage:{getItem:()=>null},fetch:async url=>{
      const u=new URL(url,'http://localhost');if(u.pathname==='/api/view')return new Response(JSON.stringify(view),{headers:{etag:'"test"'}});
      if(u.pathname==='/api/panel')return new Response(zlib.gunzipSync(await rpc('panel',{tab:u.searchParams.get('tab'),filter:'all'})));
      if(u.pathname.startsWith('/api/resident/'))return new Response(zlib.gunzipSync(await rpc('resident',{id:+u.pathname.split('/').at(-1)})));
      throw Error('unexpected fetch '+url);
    }});
    const built=fs.readFileSync(path.join(root,'index.html'),'utf8');const inline=[...built.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
    vm.runInContext(inline[0],ctx);
    vm.runInContext("createWorld=()=>{throw Error('phone must not create a world')}",ctx);
    const script=inline[1].replace('if(window.REMOTE)initRemote();else{start();requestAnimationFrame(frame);initStore();}','globalThis.ready=initRemote();');
    vm.runInContext(script,ctx);await ctx.ready;await new Promise(r=>setTimeout(r,100));
    for(const tab of ['sum','rich','log','evo','mkt','job','firm','fin','trade','land','gov','parl','adm','pol','opn','dist','fam','sex','edu','med','soc','fun','crime','gang','mil','infra']){
      await vm.runInContext(`tab='${tab}';renderPanel()`,ctx);assert(!get('#panel').innerHTML.includes('문제가 생겼다'),tab);
    }
    const id=view.map.agents.find(a=>a.alive)?.id||1;await vm.runInContext(`sel=${id};renderCard()`,ctx);vm.runInContext('render();zoomAt(1.5,100,100);render()',ctx);
    assert(!get('#saveDot').className.includes('err'),get('#saveTxt').textContent);assert(get('#card').innerHTML.includes('배운 하루 벌이'));
    console.log(JSON.stringify({day:view.day,population:view.population,mapResidents:view.map.agents.length,panels:26,card:true,map:true,zoom:true,phoneSimulation:false}));
  }finally{await worker.terminate()}
}
main().catch(e=>{console.error(e);process.exitCode=1});
