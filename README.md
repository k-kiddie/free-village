# 자유방임 마을

주민이 진화하고 학습하는 마을 시뮬레이션. 서버 실행 시 계산과 저장은 서버에서 하고, 폰은 지도와 열린 탭을 표시한다.

- `index.html` — 실행 파일 (엔진+화면 합본, 브라우저로 바로 열면 됨)
- `engine.js` — 시뮬레이션 엔진 (`createWorld(seed, N)`)
- `ui2.html` — 화면 코드 (`/*ENGINE*/` 자리에 engine.js가 들어감)
- `server.js` — HTTP 서버 및 최신 압축 화면 캐시
- `sim-worker.js` — 전체 시뮬레이션, 화면 집계, 저장·복원
- `server-storage.js` — 전체 상태의 스트리밍 gzip 저장
- `server-presenter.js` — 기존 화면 함수를 재사용하는 탭·카드 집계
- `remote-client.js` — 폰의 화면 갱신 및 서버 명령 연결

빌드:
```
node scripts/build.js
```

서버 실행 (Node.js 22 이상, 외부 패키지 없음):

```
node server.js
```

기본 포트는 80이며 `PORT`, 초기 `SEED`, `POPULATION`, 저장 경로 `VILLAGE_SAVE_DIR` 환경변수를 지원한다. 폰에서 서버 주소를 열면 서버 모드로 실행된다. 로컬 `index.html`은 기존 브라우저 단독 모드로도 실행할 수 있다. 1GB 서버를 고려해 Worker의 V8 old heap은 기본 512MB, young heap은 32MB로 제한한다(`VILLAGE_HEAP_MB`로 old heap 조절). 이는 전체 RSS 제한이 아니며 마을 성장에 따른 실제 메모리 여유는 `/health`의 `rssBytes`로 확인한다.

저장은 `save/village.json.gz`에 전체 `exportState()`를 숫자 반올림 없이 보존한다. 60초마다 변경된 마을을 저장하고 정상 종료 때도 저장 완료를 기다린다. 쓰기 도중에는 이전 파일을 유지하고, 새 파일 기록·동기화 후 교체한다. 기존 `save/village.json`도 읽는다. 손상된 저장을 새 마을로 덮어쓰지 않는다. 저장 스트리밍 동안 시뮬레이션의 상태 변경은 잠시 대기하며 HTTP 서버는 캐시된 화면을 응답한다.

화면 요청이 60초 동안 없으면 계산을 멈춘다. `/api/view`는 지도용 정보와 상단 지표만 보내고, 같은 버전이면 ETag/304로 본문 전송을 생략한다. `/api/panel?tab=...`은 열린 탭의 표시 결과만, `/api/resident/:id`는 선택한 주민의 전체 정보와 카드 표시 결과를 보낸다. 전체 학습·유전자 배열은 일반 화면 갱신에 포함하지 않는다. 최초 서버 마을이 비어 있을 때만 폰의 기존 IndexedDB/계정 저장을 한 번 가져올 수 있다.

확인 명령:

```
node scripts/check-server.js
node scripts/check-client.js
node scripts/check-migration.js
node scripts/check-http.js
```

서버 확인은 5,000명 저장의 전체 JSON 일치, g/q 복원, 26개 탭과 카드를 검사한다. 클라이언트 확인은 DOM/캔버스 모형에서 서버 응답을 연결해 지도·확대·탭·카드가 시뮬레이션 생성 없이 동작하는지 검사한다. 실제 휴대폰 화면과 AWS 서버 성능은 별도로 확인해야 한다. 확인용 저장 파일은 Git에서 제외된 `save/` 아래에 격리한다.
