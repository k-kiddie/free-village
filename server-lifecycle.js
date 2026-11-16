'use strict';

// 접속 종료 신호가 누락되어도 TTL 뒤에 만료된다. health/bot 요청은 접속으로 세지 않는다.
class Sessions {
  constructor({now=Date.now,ttl=45000,grace=30000,bootGrace=180000}={}) {
    this.now=now;this.ttl=ttl;this.grace=grace;this.started=now();this.bootGrace=bootGrace;
    this.clients=new Map();this.emptyAt=this.started;this.seen=false;
  }
  update(id,active) {
    if(typeof id!=='string'||!/^[-\w]{16,80}$/.test(id))throw Error('접속 식별자가 올바르지 않습니다');
    this.prune();
    if(active){this.clients.set(id,this.now());this.seen=true;this.emptyAt=null}
    else {this.clients.delete(id);if(!this.clients.size&&this.emptyAt===null)this.emptyAt=this.now()}
  }
  prune() {
    const now=this.now();let lastExpiry=this.emptyAt;
    for(const [id,time] of this.clients)if(now-time>=this.ttl){this.clients.delete(id);lastExpiry=Math.max(lastExpiry||0,time+this.ttl)}
    if(!this.clients.size&&this.emptyAt===null)this.emptyAt=lastExpiry??now;
  }
  get count(){this.prune();return this.clients.size}
  due(){return this.count===0&&this.now()-(this.emptyAt??this.now())>=this.grace&&(this.seen||this.now()-this.started>=this.bootGrace)}
}

async function verifyEc2(expected,{platform=process.platform,uid=process.getuid?.(),fetchImpl=fetch}={}) {
  if(platform!=='linux'||uid!==0||!/^i-[a-f0-9]{8,17}$/.test(expected||''))throw Error('EC2 자동 중지 실행 환경이 아닙니다');
  const base='http://169.254.169.254/latest/';
  const tokenResponse=await fetchImpl(base+'api/token',{method:'PUT',headers:{'X-aws-ec2-metadata-token-ttl-seconds':'60'},signal:AbortSignal.timeout(1500)});
  if(!tokenResponse.ok)throw Error('EC2 메타데이터 인증 실패');
  const token=await tokenResponse.text();
  const response=await fetchImpl(base+'meta-data/instance-id',{headers:{'X-aws-ec2-metadata-token':token},signal:AbortSignal.timeout(1500)});
  if(!response.ok||(await response.text()).trim()!==expected)throw Error('허용된 EC2 인스턴스와 다릅니다');
}

async function stopViaGate(env){
  const url=env.VILLAGE_GATE_URL||'';
  if(!/^https:\/\/[a-z0-9]+\.lambda-url\.ap-southeast-2\.on\.aws\/?$/.test(url)||!/^[-\w]{32,128}$/.test(env.VILLAGE_GATE_KEY||''))throw Error('중지용 진입점 설정을 확인해주세요');
  const response=await fetch(url.replace(/\/$/,'')+'/stop',{method:'POST',headers:{authorization:'Bearer '+env.VILLAGE_GATE_KEY},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('EC2 중지 API 실패: '+response.status);
}
function createLifecycle({save,log=console.error,env=process.env,sessions=new Sessions(),verify=verifyEc2,poweroff=()=>stopViaGate(env)}) {
  const enabled=env.VILLAGE_EC2_STOP==='1';let busy=false,stopping=false,stopReady=false,retryAt=0;
  async function tick(){
    if(!enabled||busy||stopping||Date.now()<retryAt||!sessions.due())return;
    busy=true;
    try {
      await verify(env.VILLAGE_EXPECTED_INSTANCE);
      if(!sessions.due())return;
      stopping=true;
      await save(); // 완료 응답은 스트리밍 gzip fsync와 원자적 교체 뒤에만 온다.
      if(!sessions.due()){stopping=false;return}
      stopReady=true;
      await poweroff();
      log('마지막 접속 종료: 전체 저장 완료 후 EC2 중지 요청');
    }catch(e){stopping=false;stopReady=false;retryAt=Date.now()+60000;log('EC2 중지 보류: '+e.message)}
    finally{busy=false}
  }
  return {sessions,enabled,tick,get stopping(){return stopping},get stopReady(){return stopReady&&sessions.due()}};
}
module.exports={Sessions,verifyEc2,createLifecycle,stopViaGate};
