'use strict';
// CloudFormation의 인라인 Lambda 코드. EC2가 꺼져 있어도 이 주소는 살아 있다.
const {EC2Client,DescribeInstancesCommand,StartInstancesCommand,StopInstancesCommand}=require('@aws-sdk/client-ec2');
const crypto=require('node:crypto');
const ec2=new EC2Client({});
const page=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>자유방임 마을</title><style>body{background:#11152a;color:#eee;font:18px system-ui;text-align:center;padding:15vh 20px}button,input{font:inherit;padding:12px;margin:6px;max-width:85%}button{background:#f3c843;border:0}#status{color:#bfc7df}</style><h1>자유방임 마을</h1><input id="key" type="password" placeholder="접속 키" autocomplete="current-password"><button id="go">마을 접속</button><p id="status"></p><script>
const key=document.getElementById('key'),go=document.getElementById('go'),label=document.getElementById('status');let token=location.hash.slice(1);try{token=token||localStorage.getItem('village-key')||''}catch{}history.replaceState(null,'',location.pathname);key.value=token;
async function api(path){const r=await fetch(path,{method:'POST',headers:{authorization:'Bearer '+token}});const o=await r.json();if(!r.ok)throw Error(o.error||'접속 실패');return o}
go.onclick=async()=>{token=key.value.trim();try{localStorage.setItem('village-key',token)}catch{}go.disabled=true;try{await api('/start');for(let i=0;i<120;i++){label.textContent='마을 준비 중…';const o=await api('/status');if(o.url){location.replace(o.url);return}if(o.state==='stopped')await api('/start');await new Promise(r=>setTimeout(r,3000))}throw Error('준비 시간이 길어지고 있습니다. 잠시 뒤 다시 접속해주세요.')}catch(e){label.textContent=e.message;go.disabled=false}};if(token)go.click();
</script></html>`;
function response(code,body,type='application/json'){return {statusCode:code,headers:{'content-type':type+'; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'},body:type==='text/html'?body:JSON.stringify(body)}}
exports.makeHandler=({send=command=>ec2.send(command),probe=async ip=>{try{return await (await fetch('http://'+ip+'/health',{signal:AbortSignal.timeout(2000)})).json()}catch{return {}}},env=process.env}={})=>async event=>{
  const method=event.requestContext?.http?.method,path=event.rawPath||'/';
  if(method==='GET'&&path==='/')return response(200,page,'text/html');
  if(method!=='POST'||!['/start','/status','/stop'].includes(path))return response(404,{error:'경로를 찾을 수 없습니다'});
  const actual=Buffer.from(event.headers?.authorization||''),expected=Buffer.from('Bearer '+(env.ACCESS_TOKEN||''));
  if(!env.ACCESS_TOKEN||actual.length!==expected.length||!crypto.timingSafeEqual(actual,expected))return response(403,{error:'접속 키를 확인해주세요'});
  try{
    const data=await send(new DescribeInstancesCommand({InstanceIds:[env.INSTANCE_ID]}));
    const instance=data.Reservations?.[0]?.Instances?.[0];if(!instance)throw Error('인스턴스를 찾을 수 없습니다');
    const state=instance.State.Name;
    if(path==='/start'){
      if(state==='stopped')await send(new StartInstancesCommand({InstanceIds:[env.INSTANCE_ID]}));
      return response(200,{state:state==='stopped'?'pending':state});
    }
    const ip=instance.PublicIpAddress;
    const health=state==='running'&&/^\d{1,3}(\.\d{1,3}){3}$/.test(ip||'')?await probe(ip):{};
    if(path==='/stop'){
      if(state==='running'){
        if(health.stopReady!==true)return response(409,{error:'서버의 저장 완료 중지 요청을 기다립니다'});
        await send(new StopInstancesCommand({InstanceIds:[env.INSTANCE_ID]}));
      }
      return response(200,{state:'stopping'});
    }
    const ready=health.ready===true;
    return response(200,{state,url:ready?'http://'+ip+'/':null});
  }catch(e){console.error(e);return response(503,{error:'서버 준비 요청에 실패했습니다. 잠시 뒤 다시 시도해주세요.'})}
};
exports.handler=exports.makeHandler();
