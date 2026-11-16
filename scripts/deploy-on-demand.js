'use strict';
// AWS CLI가 인증된 컴퓨터에서 실행. 임의의 인스턴스가 아닌 지정한 마을 인스턴스만 제어한다.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'save','on-demand');fs.mkdirSync(out,{recursive:true});
const region='ap-southeast-2',instance='i-0ceabbb81f8eba6da',stack='free-village-on-demand';
const secretFile=path.join(out,'access-key.txt');
const token=fs.existsSync(secretFile)?fs.readFileSync(secretFile,'utf8').trim():crypto.randomBytes(24).toString('hex');
fs.writeFileSync(secretFile,token,{mode:0o600});
const template={AWSTemplateFormatVersion:'2010-09-09',Description:'free-village EC2 start gate',Parameters:{AccessToken:{Type:'String',NoEcho:true,MinLength:32}},Resources:{
  Role:{Type:'AWS::IAM::Role',Properties:{AssumeRolePolicyDocument:{Version:'2012-10-17',Statement:[{Effect:'Allow',Principal:{Service:'lambda.amazonaws.com'},Action:'sts:AssumeRole'}]},ManagedPolicyArns:[{'Fn::Sub':'arn:${AWS::Partition}:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'}],Policies:[{PolicyName:'VillageStartOnly',PolicyDocument:{Version:'2012-10-17',Statement:[{Effect:'Allow',Action:['ec2:DescribeInstances'],Resource:'*'},{Effect:'Allow',Action:['ec2:StartInstances','ec2:StopInstances'],Resource:{'Fn::Sub':'arn:${AWS::Partition}:ec2:${AWS::Region}:${AWS::AccountId}:instance/'+instance}}]}}]}},
  Gate:{Type:'AWS::Lambda::Function',Properties:{Runtime:'nodejs22.x',Handler:'index.handler',Role:{'Fn::GetAtt':['Role','Arn']},Timeout:10,MemorySize:128,ReservedConcurrentExecutions:2,Environment:{Variables:{INSTANCE_ID:instance,ACCESS_TOKEN:{Ref:'AccessToken'}}},Code:{ZipFile:fs.readFileSync(path.join(root,'infra/start-gate.js'),'utf8')}}},
  Url:{Type:'AWS::Lambda::Url',Properties:{TargetFunctionArn:{'Fn::GetAtt':['Gate','Arn']},AuthType:'NONE'}},
  UrlPermission:{Type:'AWS::Lambda::Permission',Properties:{Action:'lambda:InvokeFunctionUrl',FunctionName:{Ref:'Gate'},Principal:'*',FunctionUrlAuthType:'NONE'}},
  InvokePermission:{Type:'AWS::Lambda::Permission',Properties:{Action:'lambda:InvokeFunction',FunctionName:{Ref:'Gate'},Principal:'*',InvokedViaFunctionUrl:true}}
},Outputs:{EntryUrl:{Value:{'Fn::GetAtt':['Url','FunctionUrl']}}}};
const file=path.join(out,'cloudformation.json');fs.writeFileSync(file,JSON.stringify(template,null,2));
if(process.argv.includes('--prepare')){console.log('배포 템플릿 준비: '+file);process.exit(0)}
function aws(args){const r=spawnSync('aws',[...args,'--region',region],{encoding:'utf8',windowsHide:true});if(r.error)throw Error('AWS CLI 또는 인증 설정이 필요합니다: '+r.error.message);if(r.status!==0)throw Error(r.stderr||'AWS 명령 실패');return r.stdout.trim()}
try{
  aws(['sts','get-caller-identity']);
  aws(['cloudformation','deploy','--stack-name',stack,'--template-file',file,'--capabilities','CAPABILITY_IAM','--parameter-overrides','AccessToken='+token]);
  const url=aws(['cloudformation','describe-stacks','--stack-name',stack,'--query',"Stacks[0].Outputs[?OutputKey=='EntryUrl'].OutputValue | [0]",'--output','text']);
  fs.writeFileSync(path.join(out,'entry-url.txt'),url+'#'+token,{mode:0o600});
  console.log('접속 주소 저장: save/on-demand/entry-url.txt');
  fs.writeFileSync(path.join(out,'install-command.txt'),'sudo bash /opt/free-village/scripts/install-on-demand.sh '+url+' '+token,{mode:0o600});
  console.log('EC2에서 실행할 설정 명령 저장: save/on-demand/install-command.txt');
}catch(e){console.error(e.message);process.exitCode=1}
