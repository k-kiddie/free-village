'use strict';
const {parentPort,workerData}=require('node:worker_threads');
const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const {createGame}=require('./game');
const {writeSnapshot}=require('../server-storage');
const dir=process.env.VILLAGE_SAVE_DIR||path.join(__dirname,'../save');
const file=path.join(dir,'rebuild.json.gz');
let game,revision=0,dirty=false;
try{game=createGame(workerData.seed,JSON.parse(zlib.gunzipSync(fs.readFileSync(file))))}catch(e){if(e.code!=='ENOENT')throw e;game=createGame(workerData.seed);dirty=true}
function view(){parentPort.postMessage({type:'view',day:game.view().day,revision:++revision,body:zlib.gzipSync(JSON.stringify(game.view()))})}
async function save(){if(!dirty)return;fs.mkdirSync(dir,{recursive:true});const bytes=await writeSnapshot(file,game.export());dirty=false;parentPort.postMessage({type:'saved',day:game.view().day,bytes})}
let chain=Promise.resolve();
parentPort.on('message',msg=>{if(msg.type==='heartbeat')return;chain=chain.then(async()=>{const previous=game.export();try{if(msg.type!=='command')throw Error('지원하지 않는 요청');game.command(msg.command);dirty=true;await save();view();parentPort.postMessage({type:'reply',id:msg.id,replyType:'command',value:{ok:true,day:game.view().day}})}catch(e){game=createGame(workerData.seed,previous);parentPort.postMessage({type:'reply',id:msg.id,replyType:'error',value:e.message})}})});
view();
