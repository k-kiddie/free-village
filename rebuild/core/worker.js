'use strict';
// canonical 명령의 독립 실행 Worker. 기존 서버 주소는 아직 이 Worker를 사용하지 않는다.
const { parentPort, workerData } = require('node:worker_threads');
const { createSession } = require('./session');
const session = createSession(workerData?.options || { mode: 'strategy' });
const methods = new Set(['summary', 'catalog', 'preview', 'execute', 'advance', 'checkpoint', 'contracts']);
let queue = Promise.resolve();
parentPort.on('message', message => {
  queue = queue.then(() => {
    const { id, method, args = [] } = message;
    try {
      if (!methods.has(method) || !Array.isArray(args)) throw new Error('UNKNOWN_METHOD');
      parentPort.postMessage({ id, result: session[method](...args) });
    } catch (error) { parentPort.postMessage({ id, error: error.message }); }
  });
});
parentPort.postMessage({ ready: session.summary() });
