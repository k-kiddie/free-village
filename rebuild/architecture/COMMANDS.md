# 3단계 — 공통 권한·회계·자격 실행 경계

이 문서는 3단계 시점의 기록이다. 이후 `/rebuild`의 UI·HTTP·하루 명령·저장 연결은 [4단계 기록](UI.md)을 따른다.

구현 범위: **canonical 세션과 독립 Worker의 공통 명령·미리보기·재검사·회계 차이·계약 신원·복구·중복 방지**. 4단계 UI와 HTTP 주소 연결은 아직 하지 않았다. 기존 `/play`는 60명 시제품이고 `/god`는 기존 Worker 경로다. 이 문서의 동작은 `rebuild/core/worker.js`와 세션 API에서 검증했다.

## 구현과 호출

| 모듈 | 역할 |
| --- | --- |
| `rebuild/core/session.js` | 단일 기준 세계, 제어 신원, revision, 저장 v1→v2, 조회·명령·하루 경계 |
| `rebuild/core/commands.js` | 같은 검증/핸들러로 미리보기와 실행, actor/world/revision/입력 검사, 재전송 기록 |
| `rebuild/core/accounts.js` | 개인·은행 준비금·회사·가문·국가·연금·지역·단체·재단·협동조합·외국 자본·미청구 유산 계정과 재고 차이 |
| `rebuild/core/contracts.js` | 기존 계약 객체 및 내장 관계의 영속 신원·현재 참조·종료 이력 |
| `rebuild/core/worker.js` | 명령·조회·전진·체크포인트를 실제 Worker의 한 큐에서 직렬 처리 |
| `engine.js:commandTransaction` | 기존 거래 복구를 성공 후 되돌리는 미리보기에도 사용. 객체 참조·Map/Set·난수·지형 배열·주주 인덱스 순서를 복구 |

`createSession({mode:'strategy',seed,population})`는 기존 엔진의 `dynStart`로 시작한다. `mode`를 생략한 관찰 세션은 2단계처럼 원본 계산만 사용한다. 기존 가문 저장을 전략 세션으로 열 때 제어 ID는 `S.dyn.pid`와 같아야 한다. 시작 설정·사망 선택으로 제어 인물이 바뀌면 엔진과 sidecar의 ID를 함께 바꾼다. 임의의 다른 주민으로 갈아타는 명령은 없다.

지원하는 명령 종류는 기존 `act`, `choose`, `budget`, `vault`, `rename`, `configureStart`, `story` 전부다. `act`에는 기존 공적 업무·대상 행동·사업·정치 등의 동적 키가 들어가고, `choose`에는 실제 대기 결정 ID와 선택 키가 들어간다. 조건을 단순화한 별도 비용 계산기나 축약 경제는 추가하지 않았다. 아직 개발하지 않은 5~12단계의 새 행동은 해당 단계에서 같은 등록부에 연결해야 한다.

```js
const state = session.summary();
const request = {
  worldId: state.worldId,
  commandId: 'phone:1', // 클라이언트별 1부터 증가하는 순번
  expectedRevision: state.revision,
  actor: { kind: 'person', id: state.playerId },
  action: 'vault',
  args: { dir: 'in', frac: 0.5 }
};
const preview = session.preview(request);
if (preview.allowed && !preview.alreadyExecuted) {
  const result = session.execute({ ...request, previewToken: preview.previewToken });
}
```

Worker 메시지는 `{id,method,args:[...]}`이고 응답은 `{id,result}` 또는 `{id,error}`다. summary/catalog/preview/execute/advance/checkpoint/contracts만 허용한다. 이 인터페이스를 인터넷에 직접 노출하는 서버는 이번 단계에서 만들지 않았다. HTTP 세션·제어권 연결은 4단계에서 Worker 외부의 책임으로 붙인다.

## 공통 판정과 원자성

- 조회 목록은 `requiresPreview:true`, `allowed:null`을 반환한다. 목록의 예비 이유만으로 실행 가능 표시를 확정하지 않는다. 실제 대상·물량·선택 키를 넣은 `preview()`의 허용 여부가 기준이다. 예비 목록에서 빠진 행동을 임의로 보내도 엔진의 실제 자격 검사에서 거부한다.
- worldId, 제어 주민, 생존/가문 종료, 대기 결정, 입력 종류·범위, revision을 확인한다. 사망 후의 실제 사망 선택만 사망한 제어 인물에게 허용한다. 기존 관직·관할·가족·소유·영업 조건은 같은 엔진 핸들러가 미리보기와 실행에서 각각 재검사한다.
- 미리보기는 엔진의 원자적 거래에서 **실제 핸들러를 실행한 뒤 되돌린다**. 전략 상태도 되돌린다. 내보내기/가져오기로 복구하지 않으므로 원본 객체 참조와 캐시 순서가 유지된다. 목록·견적 조회 자체도 같은 복구 경계에 둔다.
- 확정 가능한 경우 돈과 물량의 before/after, 비용 계정, 공공 예산 자격·가용액, 계약 변화, 재사용 대기 종료일을 반환한다. 숫자는 엔진 장부 단위다. UI가 화폐 배율로 표시하더라도 장부를 다시 쓰지 않는다.
- 난수를 사용한 결과는 `uncertainty:'random-outcome'`으로 표시한다. 미리보기의 표본 결과·표본 원장·표본 계약을 확정 효과로 노출하지 않는다. 기존 행동의 설명/선택지 비용은 `quote`로 제공한다. 이것은 새로 작성한 모든 확률·비용 모델이라는 뜻이 아니며, 새 시스템은 고정 비용과 불확실 효과를 분리한 견적을 등록해야 한다.
- 명령 자체는 날짜를 진행시키지 않는다. `duration.advancedDays=0`, cooldown 목록과 계약 terms의 기한을 구분한다. 생활·일 지침은 이후 기존 하루 계산에서 적용된다. 결정 대기 중 `advance`는 거부한다.
- 핸들러 오류, 새 음수 잔액/재고, 비정상 숫자, 계약 ID 충돌, 전략 등록 실패는 전체 거래를 복구한다. 기존에 음수인 계정도 더 악화시키는 사용자 명령을 허용하지 않는다. 일반 생활 시뮬레이션의 규칙을 새 회계 경계가 대신 계산하지 않는다.
- 개인·회사·공공 계정은 서로 다른 원장이다. 은행/보험업은 기존 개인 지갑을 운영 계정으로 쓰므로 이를 다시 은행/보험 잔액으로 중복 계상하지 않는다. 예금 준비금은 별도다. 기존에 명시적으로 구현된 범죄 행동을 합법적 공금 집행 권한으로 취급하지 않는다. 원장 차이는 관측 기록이며 복식부기 재설계나 새 통화 정책 구현을 뜻하지 않는다.

원자성 구현 중 주주 WeakMap을 단순 초기화하면 내부 순서가 바뀌어 이후 거래/배당 결과가 달라질 수 있음을 확인했다. 거래 전 존재하던 인덱스 객체와 순서를 복구하도록 처리했다. 지형 PLOTS/EXPL도 참조 배열만 되돌리지 않고 내부 객체까지 복구한다.

## 재전송·경합·저장

`commandId`는 `client:sequence` 형식이다. 클라이언트마다 1부터 연속 증가한다. 성공한 명령만 순번을 소비한다. 순번 공백과 같은 ID의 다른 내용은 거부한다. 미리보기도 같은 순번 검사를 사용한다.

동일 요청을 재전송하면 저장된 영수증을 반환한다. 시작 설정/계승으로 현재 제어 인물이 달라졌거나 revision이 진행돼도 이미 집행한 동일 요청을 다시 집행하지 않는다. 미리보기 재요청에는 `alreadyExecuted:true`를 돌려준다. 미리보기 토큰은 요청 내용과 revision의 일치 표식이며 인증 수단이 아니다. 실행 때 권한·잔액을 다시 확인한다.

클라이언트별 최근 128개의 영수증을 보관하고 처리한 최대 순번은 계속 저장한다. 영수증 범위를 벗어난 오래된 명령은 `RESULT_EXPIRED`로 거부해 이중 집행을 막는다. 이 기록은 envelope v2의 sidecar와 함께 JSON 저장한다. v1은 새 worldId·빈 명령 이력으로 읽을 수 있다. 같은 revision의 경합 요청은 Worker 큐에서 먼저 성공한 요청만 상태를 바꾸고 뒤의 요청은 `STALE_REVISION`을 받는다.

기존 gzip/fsync/rename 저장 기반은 수정하지 않았다. 새 Worker는 체크포인트를 반환하며 실제 저장 파일·자동 저장·HTTP 가져오기 연결과 장애 처리는 13단계 통합 대상이다. 이번 버전 변경을 모든 과거 저장의 전체 이전 완료로 취급하지 않는다.

## 계약 신원과 기준 데이터

직접 계약 객체인 대출·기업 대출·복수 예금·보험·정식 고용 `ct`·용병 계약·협동조합 채무에는 `canonicalContractId`를 붙인다. 원래 id와 금액·기한·담보·당사자는 바꾸지 않는다. 전략 sidecar의 `contracts.nextId/entries`는 신원과 조회용 관측 기록만 소유하며 경제 집행은 원본 계약을 사용한다.

- 같은 예금주·은행의 여러 예금은 각각 다른 신원이다. 배열을 재정렬해도 바뀌지 않는다.
- 정식 고용의 임금·기간·회사·고용주·시작은 실제 `ct`를 읽는다. 같은 고용주라도 새 `ct`는 새 계약이다. 단순 `emp` 연결은 정식 계약과 다른 `employmentRelation`으로 구분한다.
- 임대료는 매물 가격 `rent`가 아니라 실제 `tenantRent`와 징수 주기를 읽는다. 공공 임대를 포함하며, 미반환 전세 보증금은 거주자가 이미 이사해도 `depTenant/deposit/depEnd` 채무로 유지한다.
- 채권 양도·집주인 변경은 기존 대출/보증금 신원에 현재 당사자를 갱신한다. 사라지거나 종료된 계약은 등록부에서 ended로 남긴다. 기록에 참조된 사망자도 저장에 보존한다.
- `session.contracts()` 및 `read({kind:'contract',id})`는 복사본 조회다. 등록부만 수정해 권리·채무를 바꾸는 API는 없다.

등록부는 성공 명령·하루의 확정 경계에서 동기화한다. 하루 내부의 중간 관계 변화를 전부 사건 이력으로 남기는 기능은 아니다. 일반 협상·새 계획/위임 계약과 세대별 의무는 8·11·12단계에서 추가한다.

## 검증

| 검사 | 확인 범위 |
| --- | --- |
| `node scripts/check-common-commands.js` | 시작 설정·선택·이름·예산·이야기·금고·예금 인출의 실제 조작; 표시/실행 금액; 공금/사비; 직위 상실 재검사; 잘못된 입력/대상/세계/토큰; 이중 집행·순번·128개 이력 만료·JSON 복원; 원장 음수·핸들러 고장·계약 등록 실패 복구; 실제 Worker 동시 요청 |
| `node scripts/check-command-catalog.js` | 평민·왕·사업가 fixture의 동적 행동 키 617개. 423개는 미리보기 허용 뒤 실제 실행·금액/물량 일치, 194개는 조건/추가 인자 부족 거절. 조건이 다른 모든 세계의 전체 행동 분기를 검증한 것은 아님 |
| `node scripts/check-command-internals.js` | 미리보기 전후 비공개 주주 인덱스 및 이후 10일 계산 동일; 예금 재정렬·고용 재계약·채권 양도·이사 후 보증금 참조 |
| `node scripts/check-command-scale.js` | 5,000명 전략 세계의 시작·금고 명령, 미리보기 상태 불변, 전체 g/q 보존, JSON 복원·재전송. 장기·전체 기능 성능 검사는 아님 |
| `node scripts/check-canonical-session.js` | 2단계의 전체 export/난수 동일성과 저장/복원 회귀. 관찰 모드의 기준 계산 보존 |
| `node scripts/check-village-invariance.js` | Node 24의 원래 마을 900일 기준 해시 `0404e02cd23c2e5b6e849814c8ec5074ed5b35b3` |
| 기존 `check-review-fixes`, `check-dynasty-finance-integrity`, `check-corporate-loan`, `check-political-eligibility` | 기존 공적/개인 지출·부처/지역 권한·실패 복구·상속·복무·부분 예금·기업 대출·정치 자격 회귀 |

다음은 4단계의 실제 지도·대상 상세·비교·작업·결과 UI와 HTTP/Worker 연결이다. 모바일 조작, 모든 사건의 모든 조건, 모든 과거 저장, 장기 규모, 실제 디스크 장애, AWS 배포는 이번 단계 완료 범위에 포함하지 않는다.
