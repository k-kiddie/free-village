'use strict';
const { parentPort, workerData } = require('node:worker_threads');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { createSession } = require('./core/session');
const { writeSnapshot } = require('../server-storage');
const dir = process.env.VILLAGE_SAVE_DIR || path.join(__dirname, '../save');
const file = path.join(dir, 'canonical.json.gz');
fs.mkdirSync(dir, { recursive: true });
let options = { mode:'strategy', seed:workerData.seed, population:workerData.population };
try { options = { checkpoint:JSON.parse(zlib.gunzipSync(fs.readFileSync(file))) }; }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const session = createSession(options);
let savedRevision = options.checkpoint ? session.summary().revision : -1, queue = Promise.resolve(), transportRevision = 0;
const gzip = value => zlib.gzipSync(Buffer.from(JSON.stringify(value)), {level:1});
function publish() { const view = session.view(); view.savedRevision = savedRevision; parentPort.postMessage({ type:'view', day:view.day, revision:++transportRevision, body:gzip(view) }); }
async function save() {
  if (savedRevision === session.summary().revision) return;
  await writeSnapshot(file, session.checkpoint());
  savedRevision = session.summary().revision;
}
parentPort.on('message', msg => {
  if (msg.type === 'heartbeat') return;
  queue = queue.then(async () => {
    try {
      let value;
      if (msg.type === 'canonical') {
        const { method, args = [] } = msg;
        if (!['map','detail','people','catalog','business','living','preview','execute'].includes(method)) throw Error('지원하지 않는 요청입니다');
        value = session[method](...args);
        if (method === 'execute' && value.allowed) { await save(); publish(); }
        if (value !== null && ['map','detail','people','catalog','business','living'].includes(method)) value = gzip(value);
      } else if (msg.type === 'command' && ['suspend','save'].includes(msg.command?.action)) {
        await save(); publish(); value = { ok:true, ...session.summary() };
      } else throw Error('지원하지 않는 요청입니다');
      parentPort.postMessage({ type:'reply', id:msg.id, replyType:'command', value });
    } catch (error) {
      parentPort.postMessage({ type:'reply', id:msg.id, replyType:'error', value:error.message });
    }
  });
});
const timer = setInterval(() => { queue = queue.then(save).catch(error => parentPort.postMessage({type:'save-error',message:error.message})); },60000);
timer.unref();
publish();
