'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {Sessions,verifyEc2,createLifecycle}=require('../server-lifecycle');
async function main(){
  let time=0;const sessions=new Sessions({now:()=>time,ttl:45,grace:30,bootGrace:180});
  assert(!sessions.due());time=180;assert(sessions.due());
  const a='abcdefghijklmnop',b='qrstuvwxyz012345';sessions.update(a,true);sessions.update(b,true);
  sessions.update(a,false);time+=31;assert(!sessions.due(),'다른 창의 접속 유지');
  sessions.update(b,true);time+=46;assert.equal(sessions.count,0);assert(!sessions.due());time+=30;assert(sessions.due());
  assert.throws(()=>sessions.update('../bad',true));
  await assert.rejects(verifyEc2('i-0ceabbb81f8eba6da',{platform:'win32',uid:0}),/EC2/);
  const meta=async url=>new Response(url.endsWith('token')?'token':'i-00000000000000000');
  await assert.rejects(verifyEc2('i-0ceabbb81f8eba6da',{platform:'linux',uid:0,fetchImpl:meta}),/다릅니다/);
  let saved=0,stopped=0;
  const opts={sessions,env:{VILLAGE_EC2_STOP:'1'},verify:async()=>{},log:()=>{},save:async()=>{saved++},poweroff:async()=>{assert.equal(saved,1);stopped++}};
  const lifecycle=createLifecycle(opts);await lifecycle.tick();assert.equal(stopped,1);assert(lifecycle.stopReady);
  const cancel=createLifecycle({...opts,save:async()=>sessions.update(a,true)});await cancel.tick();assert.equal(stopped,1);assert(!cancel.stopping);
  sessions.update(a,false);time+=31;
  const failure=createLifecycle({...opts,save:async()=>{throw Error('disk full')}});await failure.tick();assert.equal(stopped,1);assert(!failure.stopping);assert(!failure.stopReady);
  const disabled=createLifecycle({...opts,env:{}});await disabled.tick();assert.equal(stopped,1);

  class Command {constructor(input){this.input=input}}
  const sdk={EC2Client:class{},DescribeInstancesCommand:class Describe extends Command{},StartInstancesCommand:class Start extends Command{},StopInstancesCommand:class Stop extends Command{}};
  const context={exports:{},require:n=>n==='@aws-sdk/client-ec2'?sdk:require(n),process:{env:{}},Buffer,console,AbortSignal,fetch};
  vm.runInNewContext(fs.readFileSync(require.resolve('../infra/start-gate'),'utf8'),context);
  let state='stopped',stopReady=false;const commands=[];
  const handler=context.exports.makeHandler({env:{ACCESS_TOKEN:'a'.repeat(48),INSTANCE_ID:'i-0ceabbb81f8eba6da'},probe:async()=>({ready:!stopReady,stopReady}),send:async c=>{commands.push(c);return c.constructor.name==='Describe'?{Reservations:[{Instances:[{State:{Name:state},PublicIpAddress:'1.2.3.4'}]}]}:{}}});
  const event=p=>({rawPath:p,requestContext:{http:{method:'POST'}},headers:{authorization:'Bearer '+'a'.repeat(48)}});
  assert.equal((await handler({...event('/start'),headers:{}})).statusCode,403);
  assert.equal((await handler(event('/start'))).statusCode,200);assert(commands.some(c=>c.constructor.name==='Start'));
  state='running';assert.equal(JSON.parse((await handler(event('/status'))).body).url,'http://1.2.3.4/');
  assert.equal((await handler(event('/stop'))).statusCode,409,'저장 전 중지 금지');stopReady=true;
  assert.equal((await handler(event('/stop'))).statusCode,200);assert(commands.some(c=>c.constructor.name==='Stop'));
  assert(commands.every(c=>(c.input.InstanceIds||[]).every(id=>id==='i-0ceabbb81f8eba6da')));
  console.log('접속 TTL·다중 창·재접속 취소·저장 실패·EC2 신원·진입점 인증·저장 후 실제 StopInstances 호출: 통과');
}
main().catch(e=>{console.error(e);process.exitCode=1});
