'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'ui2.html'),'utf8');
const result=source.replace('/*ENGINE*/',()=>fs.readFileSync(path.join(root,'engine.js'),'utf8')).replace('/*REMOTE_CLIENT*/',()=>fs.readFileSync(path.join(root,'remote-client.js'),'utf8'));
fs.writeFileSync(path.join(root,'index.html'),result);
console.log('index.html 생성 완료');
