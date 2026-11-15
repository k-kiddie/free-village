# 자유방임 마을 (free-village) — 작업 안내

이 파일은 Claude Code가 이 저장소에서 작업할 때 먼저 읽는 안내서다. claude.ai의 "Ai프로젝트"에서 하던 작업을 여기로 옮겨 왔다.

## 작업 규칙
- 답변과 보고는 항상 **한국어**로 한다. 영어로 쓰면 안 된다.
- 코드 작업은 이 GitHub 저장소(`k-kiddie/free-village`) **main 기준**으로 한다.
- 실행은 AWS 서버에서 하고, 결과는 동현이 **폰 브라우저**로 본다.
- 서버는 24시간 켜 두지 않는다. 동현이 플레이할 때만 켜고 끈다.
- 동현 PC에서 파일·폴더를 지우거나 옮길 때는 먼저 물어보고 확인받는다.
- 스크린샷을 보면서 화면을 직접 조작하는 방식은 느리고 사용량이 많아서 피한다. 명령어·API·스크립트를 쓴다.
- 보고는 짧게 한다. 단계가 바뀔 때나 문제를 발견했을 때 위주로 한다.

## 마을의 원칙
- 규칙을 코드로 정해 두지 않는다. 주민이 진화·학습해서 경제, 범죄, 사기, 전세, 대출, 세력, 선거, 국회가 스스로 생겨나게 한다.
- 마을 규모는 **5,000명**이 기준이다(ui2.html의 `START_N=5000`).

## 파일 구조
- `engine.js`: 시뮬레이션 엔진. `createWorld(seed, N)`이 `{S, step, exportState, importState, ...}`를 돌려준다. node에서도 돌아간다(`module.exports`).
- `ui2.html`: 화면 코드. `/*ENGINE*/` 자리에 engine.js가 들어간다.
- `index.html`: 합본 실행 파일. 아래 명령으로 다시 만든다.
  ```
  python3 -c "s=open('ui2.html').read();e=open('engine.js').read();open('index.html','w').write(s.replace('/*ENGINE*/',e))"
  ```
- 정책은 `S.gov.policy` 객체 한 곳에 모여 있다. 이름표는 `POL_LABEL`에 있다. 정부가 생기기 전에는 `S.gov`가 null이다.
- 저장: 화면은 `exportState()` 결과를 gzip으로 압축해 브라우저(localStorage/IndexedDB)나 claude.ai 계정 db에 저장한다. 2,000명 마을이 2~3MB쯤 된다.
- 속도: 2코어 기준으로 2,000명 마을의 하루 계산에 0.4~0.5초 걸린다. 5,000명이면 그보다 훨씬 느리고, 저장 크기도 커진다. t3.micro(1GB)로는 부족할 수 있으니 server.js를 만들 때 5,000명 기준으로 속도·메모리를 재고, 모자라면 서버 사양을 올리자고 동현에게 제안한다.

## claude.ai 아티팩트 버전과의 관계
- 예전에는 claude.ai 아티팩트(`https://claude.ai/artifact/M3WFL116Cht7riJbKt3DDv`, town.html)에 직접 배포했다. 이 저장소에는 v73까지 올라와 있다.
- 2026-11-17 14:01에 claude.ai 대화 '마을 AI 시뮬레이션 설계'에서 아래 기능 작업이 예약돼 있다. 결과는 아티팩트에 배포된다.
  1. 회사 건물을 묶어 보여주기, 업종별 건물 이름
  2. 사업 분야 수 줄이기
  3. 짬뽕 건물 정리, 건물 수 상한과 합치기
  4. 주식 1만 주로 쪼개기, 기관·외국인 투자자
  5. 가족 칸과 가계도, 왕위 계승
- 이 작업이 끝나면 아티팩트 최신본을 engine.js / ui2.html로 나눠서 이 저장소에 반영해야 한다. 앞으로는 이 저장소가 기준이다.

## AWS 서버 (2026-11-16 생성)
- EC2 인스턴스 `i-0ceabbb81f8eba6da`, 이름 `free-village`
- 리전: **시드니(ap-southeast-2)**. 이 계정에서는 서울 리전 EC2 화면이 "페이지 제한됨"으로 열리지 않았다.
- 사양: Ubuntu 26.04, t3.micro(프리 티어, 2 vCPU, 1GB RAM), 스왑 2GB, gp3 8GB
- 보안 그룹: HTTP 80 열림, SSH 22 열림. 키 페어는 없고, 접속은 EC2 Instance Connect로 한다.
- 처음 부팅 때 user-data가 해 둔 것:
  - Node.js 22 설치
  - 이 저장소를 `/opt/free-village`에 clone
  - systemd 서비스 `village.service` 등록. 설정 내용:
    - root 권한, `PORT=80`
    - `ExecStartPre=git pull --ff-only`: 켜질 때마다, 그리고 재시작될 때마다 main 최신 코드를 받는다
    - `ExecStart=node /opt/free-village/server.js`
    - `Restart=always`, 15초 간격
- 그래서 main에 `server.js`를 푸시하면 서버가 15초 안에 받아서 실행한다. 서버는 untracked 파일인 `save/`를 유지한다.
- 접속: 인스턴스를 시작한 뒤 EC2 화면에서 퍼블릭 IPv4를 복사해 폰에서 `http://그주소`로 들어간다. 이 주소는 켤 때마다 바뀐다.

## 다음 작업: server.js (아직 없음)
서버가 계산을 맡고, 폰은 화면만 그리는 구조로 바꾼다.
- `server.js`
  - `require('./engine.js').createWorld(seed, N)`로 마을을 만든다. `save/village.json`이 있으면 `importState`로 이어서 연다. `.gitignore`에 `save/`를 추가한다.
  - `POST /cmd`로 받는 명령: 재생/정지, 속도(일/초), +1년, +10년, 새 마을(5,000명), 저장
  - 100ms 타이머로 `step()`을 돌린다. 한 틱은 80ms를 넘기지 않는다.
  - 60초마다, 그리고 SIGTERM(인스턴스 중지)을 받으면 저장한다.
  - 60초 동안 `/state` 요청이 없으면 자동으로 일시정지한다.
  - `GET /`: index.html에 `<script>window.REMOTE=1</script>`를 넣어서 보낸다.
  - `GET /state`: `{seed, pop, running, speed, day, state: exportState()}`를 gzip으로 보낸다. 캐시는 S.day가 바뀌었을 때만 1.5초 간격으로 갱신한다.
- `ui2.html` REMOTE 모드
  - `frame()`에서 `W0.step()`과 `runJump`를 하지 않는다.
  - `#play`, `[data-sp]`, `#ff1`, `#ff10`, `#reset`, `#saveNow` 버튼은 `/cmd`를 호출하게 바꾼다.
  - `initStore` 대신 2초마다 `/state`를 받아서 `W0.importState(o.state); S=W0.S; snap(); bgKey=''; dirty=true`로 갱신한다.
    - 선택한 주민 카드와 줌은 유지한다.
    - seed가 바뀌면 `createWorld`로 새로 만든다.
  - 저장 표시는 '서버에 저장됨 · n년차'로 바꾼다.
- 로컬에서 node로 확인할 것: `/state`와 `/cmd` 동작, 저장과 불러오기, 5,000명 마을의 하루 계산 시간과 메모리 사용량(1GB 서버 기준)

## 그다음 후보: 정책 조종(개입 모드)
- 신 모드: 화면 패널에서 `S.gov.policy[k]`를 직접 바꾼다. 다음 틱부터 반영된다.
- 선거나 혁명 때 촌장 공약(`platform`)이 정책을 덮어쓴다(engine.js의 `policy[k]=pl[k]` 부근). 그래서 "플레이어 고정" 플래그를 두고 덮어쓰는 지점에서 확인하게 해야 한다.
- 촌장 빙의 모드(지지율 떨어지면 낙선·쿠데타)는 투표 로직까지 손봐야 한다.
- 원래 취지(자유방임)를 지키려고 개입 모드는 켜고 끄는 스위치로 넣는다.
