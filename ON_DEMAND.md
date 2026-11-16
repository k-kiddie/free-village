# 접속할 때만 EC2 실행

대상은 시드니 `i-0ceabbb81f8eba6da` 하나다. EC2가 꺼져 있을 때에도 열리는 Lambda Function URL에서 접속 키를 확인한 뒤 인스턴스를 시작하고, 준비되면 현재 퍼블릭 IP의 마을로 연결한다. 접속 주소는 북마크한다. 마을 HTTP 연결은 기존 방식이며 HTTPS 도메인 구성은 포함하지 않는다.

폰의 보이는 화면이 15초마다 접속을 갱신한다. 마지막 창을 닫거나 백그라운드로 보내면 30초 유예 후 전체 저장을 완료하고 Lambda의 `StopInstances`를 호출한다. 종료 신호가 누락되면 접속 TTL 45초 후 같은 유예를 적용한다. 다른 창/기기의 접속이 남아 있으면 중지하지 않는다. 부팅 후 한 번도 접속하지 않은 경우 3분 뒤 중지를 시도한다.

저장 중 재접속하면 중지를 취소한다. 저장 실패, EC2 신원 불일치, 진입점 통신 실패 시 인스턴스를 중지하지 않고 오류를 남긴다. `/health`는 저장이 완료됐을 때에만 `stopReady=true`를 반환하며 Lambda는 이 신호를 확인하고 중지한다. 회사 Windows PC/일반 로컬 서버에서는 기본적으로 비활성화된다. 전체 저장은 EBS의 기존 `save/village.json.gz`에 유지한다.

## 배포

AWS CLI가 인증된 환경에서 저장소 루트의 다음 명령을 실행한다.

```
node scripts/deploy-on-demand.js
```

스크립트는 CloudFormation으로 최소 권한의 Lambda/IAM/Function URL을 배포한다. `save/on-demand/entry-url.txt`에 접속 주소, `install-command.txt`에 EC2 안에서 실행할 설정 명령을 기록한다. 이 파일의 키는 공개하거나 Git에 올리지 않는다. 해당 명령은 EC2 Instance Connect 등으로 **대상 EC2 안에서** 한 번 실행한다. 현재 main을 내려받은 `/opt/free-village`에서만 설치하며 서비스 재시작 시 전체 저장을 기다린다. 인스턴스의 시작/중지 권한 외에 종료(terminate) 권한은 부여하지 않는다.

템플릿만 생성: `node scripts/deploy-on-demand.js --prepare`. 실제 검증: `node scripts/check-lifecycle.js`. 로컬 모형 검사에서는 실제 AWS 중지 대신 주입한 API를 사용한다.

## 현재 적용 상태

코드·배포 템플릿·모형 검증 완료. 회사 PC에는 AWS CLI와 인증 설정이 없어 **AWS 스택 배포, EC2 서비스 설정, 실제 시작/중지 확인은 미완료**다. GitHub 업로드만으로 이 기능이 활성화되지는 않는다. 기존 EC2 서비스는 시작/재시작할 때 main을 받으며, 실행 중인 서비스가 push만으로 자동 갱신되지는 않는다.

EC2를 중지해도 EBS 저장소 등 비용은 남는다. Lambda 진입점은 요청이 있을 때 실행된다.
