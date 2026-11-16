'use strict';
const fs=require('node:fs');
const {Readable}=require('node:stream');
const {pipeline}=require('node:stream/promises');
const {createGzip}=require('node:zlib');
// 전체 JSON 문자열과 압축 전 Buffer를 동시에 만들지 않는다.
function* pieces(value,depth=0){
  if(Array.isArray(value)){
    yield '[';for(let i=0;i<value.length;i++){if(i)yield ',';yield JSON.stringify(value[i])??'null'}yield ']';
  }else if(value&&typeof value==='object'&&depth<3){
    yield '{';let first=true;for(const key of Object.keys(value)){if(value[key]===undefined)continue;if(!first)yield ',';first=false;yield JSON.stringify(key)+':';yield*pieces(value[key],depth+1)}yield '}';
  }else yield JSON.stringify(value);
}
async function* chunks(value){let batch='',n=0;for(const s of pieces(value)){batch+=s;if(batch.length>=65536){yield batch;batch='';if(++n%8===0)await new Promise(setImmediate)}}if(batch)yield batch}
async function writeSnapshot(file,value){
  const temporary=file+'.tmp';
  await pipeline(Readable.from(chunks(value)),createGzip({level:1}),fs.createWriteStream(temporary));
  const fd=await fs.promises.open(temporary,'r+');try{await fd.sync()}finally{await fd.close()}
  await fs.promises.rename(temporary,file);
  return (await fs.promises.stat(file)).size;
}
module.exports={writeSnapshot};
