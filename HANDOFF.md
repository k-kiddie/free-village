# 인수인계서 — 2026-11-16 오후 ~ 2026-11-17 밤 작업 전체

> **새 세션·다른 AI는 이 문서부터 읽는다.** 그다음 `CLAUDE.md`(작업 규칙), `GOD_MODE.md`(가문 모드 계획·진행 기록 12장)를 본다.
> 작성: 2026-11-17 (Claude). **2026-11-17 밤, 아래 모든 작업을 main에 병합했다(동현 요청).** 작업하던 브랜치는 `claude/modest-volta-zqs2wm`.

---

## 0. 반드시 지킬 규칙 (요약)
- 답변·보고·문서·커밋 메시지는 **한국어**. 보고는 짧게.
- 사용자: **동현**(산소공장 전기 엔지니어). 결과는 **폰 브라우저**로 본다. 회사 PC라 AWS 접속이 어렵다 → AWS 작업은 명령/스크립트로만, 브라우저 접속을 반복하지 않는다.
- **기능을 새로 정하거나 바꿀 때는 먼저 동현과 상의**한다(상의 없이 앞서가는 것을 싫어함). 단, 동현이 "다 해", "당장 시작"처럼 범위를 맡기면 진행하고, 정한 값은 문서에 "Claude 결정"으로 남긴다.
- **원래 마을(`/`)의 결과는 한 글자도 바뀌면 안 된다.** 가문 모드 코드는 모두 `S.dyn`이 있을 때만 동작하고, `S.dyn`이 없으면 기존 코드 경로와 **마을 난수 `R()` 호출 순서**가 같아야 한다. 가문 모드의 새 무작위는 `wr()`(가문 모드 전용 난수)를 쓴다.
- 저장은 손실 없이. `g`(유전자)/`q`(학습값) 등 필드를 줄이거나 버리지 않는다.
- 생성 파일 `index.html`은 직접 고치지 않는다. `node scripts/build.js`로 다시 만든다.
- 커밋은 작업 브랜치에, PR은 동현이 요청할 때만. 커밋 메시지 끝에 저장소 규칙의 Co-Authored-By/Claude-Session 줄.
- 모델 이름을 커밋·코드·문서에 쓰지 않는다.

## 1. 지금 상태 한눈에
| 항목 | 상태 |
|---|---|
| main | **이 문서의 모든 작업(3장 ①~⑫)이 main에 병합됨** — 1차는 PR #1, 1차 이후(③~⑫)는 2026-11-17 밤 PR로 병합(동현 요청). 다음 작업도 main 기준으로 새 브랜치에서 시작한다. |
| AWS 실서버 | EC2를 켜거나 서비스를 재시작할 때 **main**을 `git pull` → 다음에 켤 때 이 문서의 기능이 반영된다(이미 켜져 실행 중이면 서비스 재시작 필요). AWS 인증이 이 환경에 없어 실서버 반영은 직접 확인하지 못했다. |
| 접속 시 EC2 자동 중지(ON_DEMAND) | 코드·모형 검사 완료, **AWS 스택 미배포**(`ON_DEMAND.md`). |
| 폰 실제 확인 | 동현이 1차 화면만 봄. 새 한 화면 UI·2차 기능은 로컬 Playwright(아이폰 13 크기)로만 확인. |

## 2. 파일 구조 (가문 모드 관련)
| 파일 | 역할 |
|---|---|
| `engine.js` | 시뮬레이션 엔진(약 5,600줄). `createWorld(seed,N)`. 가문 모드는 "가문 모드" 구역(`DYN_LIFE` 정의 ~ `dynView` 끝)과 원래 엔진 안의 `S.dyn` 조건 훅(5장). |
| `sim-worker.js` | Worker 하나가 마을 하나를 실행. `workerData.name`='village'|'dynasty'. 저장 `save/village.json.gz` / `save/god.json.gz`. 명령 처리. |
| `server.js` | HTTP. `/`=원래 마을, `/god`=가문 모드 페이지, `/api/*`→village, `/god/api/*`→dynasty. 한 번에 Worker 1개(월드 전환). |
| `server-presenter.js` | 원래 26개 탭·카드 HTML을 서버에서 만듦(재사용). |
| `remote-client.js` | 폰 쪽 원격 클라이언트(뷰 폴링·명령 전송). `window.API_BASE`로 `/god/api` 사용. |
| `god-client.js` | **가문 모드 화면 전부**(`/god`에만 붙음). 원래 `ui2.html` 위에 한 화면 앱 배치를 얹는다. |
| `ui2.html` | 원래 화면(지도 그리기·카드·탭). 가문 모드도 지도/카드 그리기를 재사용. |
| `scripts/build.js` | `index.html` 합본 생성. |
| `scripts/check-*.js` | 검사(7장). |
| `GOD_MODE.md` | 가문 모드 계획서 + 12장 진행 기록(단계별 상세) + 13장 다음 세션 시작점. |

## 3. 시간순 작업 기록 (2026-11-16 오후 ~ 2026-11-17 밤)

### ① 11-16 오후 — v74 5단계 마무리·주식·화폐·EC2 중지 (이전 세션, main 반영)
- v74 1~5단계(회사 건물 이름·사업 분야·건물 용도·1만 주·가족/왕위 계승) 완료. 검증표는 `V74.md`.
- 회사 증자·분할·자사주(`rightsIssue`, `bonusIssue`, `buybackShares`, `cancelTreasury`), 화폐 표시 단위 변경(`S.currency.unit`, `money()`), 커밋 `b163dbe`.
- 접속 종료 시 EC2 자동 중지(Lambda 진입점·`server-lifecycle.js`·`scripts/deploy-on-demand.js`) — 코드만, AWS 미배포.
- 주의: 이 시기 커밋 몇 개는 메시지가 CP949로 깨져 있다(코드 문제 없음).

### ② 11-17 새벽~오전 — 가문 모드 1차(1~3단계) (main 병합됨)
상세는 `GOD_MODE.md` 12장. 요약:
- 1단계: `/god` 별도 마을, 월드 전환(`server.js`), `save/god.json.gz`, 인구 100.
- 2단계: `S.dyn` 골격, 시작 인물=성인 중 정치력 최고(`dynStart`, 점수 `g.boss*.5+g.civic*.4+log10(W+10)*.15+(grp?.2:0)`), 이름 변경, 선택지가 뜨면 멈춤, 정략결혼·사돈 관계(`S.dyn.ties`), 권력 잡는 행동(회의 제안·영주 자처·공산 혁명·패거리·정당·출마), 여성 참정권/재산권 시위·발의, 지출 설정·가문 금고, 경제 행동(집·땅·주식·회사·대출·예금)·일 고르기, 사건 선택지(병·외도·도둑·징병·화재·재판·전쟁·체제 변화 등), 7-1 능동 행동(이혼·입양·상속자 지정·진학·유학·이사·친해지기·동업·조직·뇌물·의사·어두운 길·측근 임명), 지위별 정보 제한.
- 3단계: 넓은 상속 순서(지정→자녀→손주→형제→조카→배우자→먼 친척), 섭정, 가문 단절·새 가문·관전.

### ③ 11-17 낮 — 시작 인물 고정 문제 (브랜치)
- 원인: 가문 마을 시드가 20261117 고정 + "새 마을"이 정해진 순서 → 처음 7개 마을이 모두 여성 시작(공식에 성별 없음, 우연).
- 수정: 가문 마을은 처음 만들 때와 "새 마을" 때 `crypto.randomInt` 무작위 시드(`sim-worker.js` `randomSeed`). `DYNASTY_SEED` 환경변수나 명령의 `seed`를 주면 그 값. 원래 마을 시드 규칙은 그대로. (동현: "1번만 해")

### ④ 2차 4단계 — 세계 지도
- 엔진 `S.dyn.realms[이웃이름]`: 체제·통치자(성·이름·성별·출생일·성향 g: boss/cheat/care/faith/war)·후계자(세습 체제만)·집권일·왕조 교체 수·최근 일. 15일마다 죽음·세습/왕조 교체·선거(4년)·정변. 세계 소식 `S.dyn.wnews`. 함수: `realmInit`, `realmTick`, `realmNewRuler`, `dynWorldTick`, `dynWorldView`.
- 이웃 나라 = 기존 무역 상대 `S.trade.towns` 3곳(너른들·쇠뫼·비단나루). 위치 `REALM_POS`. 무역이 트이기 전에는 우리 마을만.
- 정보 제한(Claude 결정): 이웃 군대 숫자·통치자 성향은 의원·귀족 이상만.
- 화면: 마을↔세계 전환, 영역(인구 가중 거리)·국경·바다·미지의 땅, 나라 누르면 정보 카드.

### ⑤ 2차 5단계 — 외교·전쟁·합병 (동현 결정: 속령 + 인재 일부 이주, 혼인 동맹은 의원·귀족부터, 전쟁·동맹은 최고 권력자만)
- 행동 키 `dip:wed|ally|unally|war|peace:나라[:id]`. 혼인 동맹 상대는 우리 마을 실제 주민으로 생성(`dynForeignSpouse`, `royal`=나라).
- 동맹: 전쟁 때 군사력 +30%(`dynMilAdj`). 배신(동맹국 선전포고) 기록 `D.betray`.
- 사건: `invaded`(맞서기/배상/도움 요청), `conquest`(속령/배상), `claim`(사돈 왕실 단절 시 계승).
- 속령 `R0.prov`: 세금(15일), 병력 30% 합산, 긴장 0·자유무역 고정, 불만 → 독립. 합병 때 인재 10~30명 실제 주민(`from`), 출생 한도 `S.cap0/S.cap`을 그 나라 인구/15만큼↑, 상한 `DYN_POP_CAP=1500`(Claude 결정, 1GB 측정 후 조정 필요).
- 참고: 100명 마을이 300명대에서 멈추는 이유는 출생 한도 `S.cap=max(260,N*1.6)`.

### ⑥ 2차 6·7단계 — 성장 칭호·첩보
- 칭호(`dynTierTick`): 우리+속령 인구 0/600/2,500/6,000 → 마을·읍·성·왕국(군주정 아니면 "나라").
- 첩보: 권력자 1년마다 보고(`dynIntel`, 정보기관 있으면 정확도 85% 없으면 60%) → 잡아들임/감시/회유/무시. 감시·회유는 엔진 쿠데타 두 곳에서 `dynCoupBlock`. 의원·귀족 이상 행동 `spy:rival|realm:나라|coup`. 평민 포섭 제안(`fspy`, `ispy`). 체제별 들킴 결과(민주=스캔들, 강압=원한, 신정=잘 들킴).
- [2] 사건: 이웃의 혼인 동맹 제안(`fwed`), 암살 위협(`assn`).

### ⑦ 2차 9단계 일부 — [2] 행동
- 키 `ext:smear|hit|fix|div|rights|claim`: 소문, 청부 살인, 사건 덮기, 대주주 배당·증자, 공위 시 왕위 계승권 주장. 왕자의 난 선택(`prince`, 엔진 `royalTick`에 `dynPrince`).

### ⑧ 폰 화면 고침 (동현: "내려서 누를 때 화면이 안 보임")
- 원인: 페이지 3,800px, 결과·카드가 위쪽에 뜸. → 알림 하단 고정, 카드 아래 창, 행동 묶음 접기.

### ⑨ 한 화면 앱 배치 (동현: "한 화면에서 다 조작하고 다 보게")
- `god-client.js` `dynAppLayout`: 페이지 스크롤 없음. 위 상태 줄(이름·직책·재산·▶/⏸·속도·⚙) / 둘째 줄(가문·평판·지위·우리 땅·체제·날짜) / 지도(마을↔세계, 크게·보통·접기 `dynFitMap`) / 사건 띠 / 메뉴 창(내부 스크롤 `#dynSheet`) / 아래 메뉴 7개.
- 메뉴(`DYN_TABS`): 👤인물 🏠가문 💰영지 🌍외교 🗡️음모 ⚖️정치 📰소식 (+📊통계는 ⚙ 안). 행동 묶음→메뉴 매핑 `DYN_TAB_G`, `dynTabOfGroup`(묶음 이름이 "법"으로 시작하면 정치).
- ⚙: +1년/+10년, 저장, 원래 마을로, 마을 통계(기존 26개 탭), 이야기 사건 빈도, 새 가문 마을.

### ⑩ 시안 단계 기능 채우기 (동현: "회사 차리고 고용하는 것도 없다, 지금 다 해")
- 가게 짓기 `biz:build:fx`(식당 b1·방앗간 b0·제재소 b2·석공소 b10·주막 pub·여관 shelter·곡식 창고 store). 목수(`dynBuilder`)에게 공사비, 목수가 안 하면 인부가 하루 1씩(`dynSiteTick`), 40일쯤 완공 → 내 건물. 엔진 쪽 `site.dynOwner`.
- 인물 대상 행동 `tgt:hire|fire|gift|wed|bribe|dig|smear|hit|heir|adopt:id` (`dynTargetActions`, 서버 명령 `targets`). 고용은 엔진 정규 계약 `a.ct={t:'reg',e,w,d}`.
- 법안 전체 `law2:정책:on|off|up|down` — 정책 110여 개 중 `polReady`인 것, 6개 분야(`DYN_LAWCAT`). 권력자·의원은 의회 표결(`passPolicies`), 의회 없으면 통치자 결정, 평민은 시위·청원. 지지 예상 = 주민 `platform()`이 제안 쪽에 더 가까운 사람 수.
- 소식 메뉴 "✨ 새로 할 수 있게 된 일"(클라이언트에서 처음 가능해진 행동 기억, localStorage).

### ⑪ 이야기 사건 1차 (동현: "크루세이더 킹즈·문명처럼 선택지가 자주, 이벤트가", 빈도는 Claude에게 맡김)
- 기본 사건 106개 + 후속 17개. 빈도 보통 5~7일(⚙ 끄기·적게 10~14·많이 3~4).

### ⑫ 이야기 사건 2차 (동현: "후속 사건 몇 배는 더")
- 후속 사건 **80개**(4.7배), "선택→후속" 연결 표 **75개**(`FOLLOW`, `F(사건,선택,[[후속,확률,일수,조건]])`). 3단계까지 이어지는 이야기 포함(예: 형제 다툼→묵은 원한→가문 내전→돌아온 탕아, 외도 의심→밀회→숨겨진 아이→앙심, 결투 승리→뒤끝 / 복수→원수의 아들→자객, 장사 대박→확장→문전성시→태업, 사절 냉대→국경 약탈, 조공 미룸→최후통첩→전쟁의 북소리).

## 4. 가문 모드 엔진 상세

### 4-1. `S.dyn` 필드
- 기본: `v, pid(내 캐릭터), house, houseAuto, founder, heir, gen, start, prestige, budget{life,edu,save,give,debt,job}, pending[], cool{}, chron[], peak{w}, adopted[], past[], over, watch, nextP, res, ties{family:{v,name,d,why}}, wed{}, title, run{}, vault, spent, snap, regent, rob, inv, pull, tre, cpiRef`
- 2차: `wr`(가문 모드 난수 상태), `realms{}`, `wnews[]`, `wknown`, `warSeen`, `warDone`, `betray`, `helpUntil`, `tier`, `watched{}`, `bribed{}`, `informant`, `guardUntil`
- 이야기: `story{next, freq(0~3), cd{사건:다음 허용일}, q[{id,at,ctx}](후속 대기열), n}`
- 대기 선택지: `{id, kind, d, text, opts[{k,label,hint}], ctx}` — 이야기 사건은 `kind='story'`, `ctx.sid`=사건 id, `ctx.title`, `ctx.x/y`(등장인물 id), `ctx.t`(나라 이름), `ctx.amt`.

### 4-2. 행동 키 (dynAct)
| 접두어 | 내용 | 처리 함수 |
|---|---|---|
| `council` `lord` `revolt` `gang` `party` `runChief` `runCouncil` | 정부 세우기·조직·출마 | `dynAct` 본문 |
| `pet:` `law:` | 여성 참정권/재산권(1차) | `dynVoteLaw` |
| `law2:정책:방향` | 법안 전체(⑩) | `dynLaw2Actions`/`dynLaw2` |
| `house:` `land:` `stock:` `firm:` `loan:` `dep:` | 경제 | `dynEcoActions`/`dynEco` |
| `fam:` `kin:` `net:` `med:` `dark:` `pow:` | 7-1 행동 | `dynMoreActions`/`dynMore` |
| `dip:` | 외교 | `dynDipActions`/`dynDip` |
| `spy:` | 첩보 | `dynSpyActions`/`dynSpy` |
| `ext:` | [2] 행동 | `dynMore2Actions`/`dynMore2` |
| `biz:` | 가게 짓기 | `dynBizActions`/`dynBiz` |
| `tgt:동작:id` | 인물 대상(카드) | `dynTargetActions`/`dynTarget` (dynAct 맨 앞에서 분기) |
- 행동 목록 항목: `{k, group, label, hint, ok, why, opts?}`. `opts`가 있으면 `k+':'+값`으로 실행(주식 수량, 법안 방향). `dynAct`의 base 계산에 `stock:`과 `law2:`가 있다.

### 4-3. 선택지 처리 `DYN_H[kind](ctx,k,me)` → 결과 문장
- 1차: `start, proposeOut, proposeIn, arrange, kidMatch, notice, death` 외 `dynEvents/dynPeriodic`의 사건들(`GOD_MODE.md` 12장 (6)).
- 2차: `invaded, conquest, claim, dirt, intel, fspy, ispy, fwed, assn, prince`, 이야기 `story`.
- `dynChoose(id,k)`가 호출. 선택 뒤 `dynResnap()`.

### 4-4. 이야기 사건 시스템 (engine.js "이야기 사건" 구역)
- 정의: `E('id',{cat, r(최소 지위 0~4), need(c)=>bool, who(c)=>주민, realm:1, chain:1(후속 전용), cd(재등장 간격, 기본 120일), title:'아이콘 제목', text(c)=>문장, o:[[키,'선택 이름', 힌트문자열|c=>문자열, c=>{효과; return '결과 문장'}], ...]})`.
- 후속 연결: (a) 선택 함수 안에서 `c.chain('후속id', 일수, {추가ctx})` (b) 연결 표 `F('사건','선택',[['후속',확률,일수,조건]])`, 조건은 `sOk(/정규식/)`·`sNok(/…/)`로 결과 문장을 검사.
- `c`(sCtx)가 주는 것: `me, G, P(정책), wA(평균 일당), hr(집값 기준), x, y, t(나라), R0(나라 기록), ctx`와 효과 함수 `cash(n)`(음수면 가진 만큼만), `rep(d)`, `happy(d)`, `health(d)`, `tie(사람,d,이유)`, `appr(d)`(지지율), `tre(n)`(나라 금고), `tens(d)`(그 나라 긴장), `roll(p)`(wr 기반), `chain(...)`, `chron(문장)`, `n(사람)`=이름.
- 고르기: `dynStoryTick` 매일 — 대기 선택지가 있거나 freq=0이면 쉼 → 후속 대기열 먼저 → 날짜가 되면 `dynStoryPick`(지위·쿨다운·조건·등장인물 확인, 무작위 12번 시도). 선택 결과는 가문 연대기에 "제목: 선택 → 결과"로 남음.
- **사건 추가 방법**: `// ---------- 선택 처리 ----------` 줄 위에 `E(...)`를 쓰고, 후속이면 `chain:1` + `F(...)` 연결. 추가 뒤 `scripts/check-dynasty.js`의 15번이 모든 선택지를 실행해 본다.
- 표 크기(현재): 기본 106, 후속 80, 연결 75, 선택지 약 440.

### 4-5. 원래 엔진 안의 훅 (모두 `S.dyn`이 있을 때만 의미 있음)
- 1차: `mate()`(청혼·자녀 혼인), `step()` 끝 `dynTick()`, 일 고르기 점수(`budget.job`), `voterScore`(사돈 표), `mAppoint`(측근·귀족 후보), `election`/`councilElection`(`dynCandidacy`), 주식 자동 거래 제외(`dynOwnKey`), `exportState`(관련 죽은 인물 보존). 분리 함수(동작 동일): `councilVotes`, `foundCouncil`, `crownLord`, `revoltRun`, `makeGang`.
- 2차: 군사력 `const our`→`let our` 후 `if(S.dyn)our=dynMilAdj(our)` / 쿠데타 두 곳 `&&!(S.dyn&&dynCoupBlock(L|gen))`(R() 앞) / `royalTick`의 `if(S.dyn&&dynPrince(...))return` / 건물 완공 소유자 `site.dynOwner` / 공사 방치 기한에 `st.dynOwner`.
- 위 변경 뒤에도 원래 마을 불변 검사(300명 3,000일, 5,000명 50일 exportState 완전 일치) 통과.

### 4-6. 서버 명령 (`POST /god/api/cmd` body `{action,...}`)
`play, pause, speed{value}, advance{days}, autostop{value}, new{seed?}, save, choose{id,k}, act{k}, budget{budget}, vault{dir,frac}, rename{sur,given}, targets{id}`(인물 대상 행동 목록 반환), `story{freq 0~3}`. 대기 선택지가 있으면 재생·건너뛰기도 진행 안 함. 뷰는 `GET /god/api/view`의 `dyn`(내 캐릭터·가족·행동·세계·이야기 빈도 등).

## 5. 화면 (`god-client.js`) 구조
- `initDyn` → `dynInitWorld`(세계 지도) → `dynAppLayout`(한 화면 배치, 원래 요소를 `#dynApp`으로 옮김).
- 매 뷰마다 `dynHook` → `dynRender`(→ `dynAppRender` 상단 줄·사건 띠·메뉴 숫자, `dynPanelHTML` 메뉴 내용) → 세계 지도면 `dynDrawWorld`.
- 행동 버튼은 두 번 눌러 실행(`dynBindActions`, `dynActArm`). 선택 창 `dynOpen`(이야기 사건은 제목 표시). ⚙ `dynSettings`.
- 인물 카드: 원래 카드 위에 "이 사람에게"(`dynCardActions`, MutationObserver로 카드가 열릴 때 서버 `targets` 요청).
- 로컬스토리지 키: `v-dyntab, v-dynmap, v-dynmsz, v-dynopen, v-dynever, v-dynnew`.

## 6. 동현이 정한 것 / Claude가 정한 것
- 동현: 이름 "가문 모드", `/god` 별도 마을, 정치력 최고로 시작·이름 변경, 선택지 뜨면 멈춤, 정략결혼 모든 체제, 사돈 관계 점수, 처음부터 공산 혁명 가능, 무작위 시드(1안만), 속령+일부 이주, 혼인 동맹 의원·귀족부터/전쟁·동맹 최고 권력자만, 한 화면 UI, 이야기 사건(빈도는 위임), 후속 사건 대폭 확대.
- Claude(위임·문서화): 약혼 제외, 청혼 빈도, 지출 수치, 일 가중치, 이웃 정보 제한 기준, `DYN_POP_CAP=1500`, 성장 칭호 기준과 "나라" 명칭, 첩보 정확도·들킴 확률, 이야기 사건 빈도(보통 5~7일)·쿨다운(120일), 가게 7종·공사비·인부 진행.
- 아직 미정(상의 필요): **8번 소문**(평민에게 틀린 소문 섞기), 성향과 반대 선택 시 스트레스, 2차 인구 상한(메모리 측정 후), 왕으로 시작하는 옵션(가·나·다 안 제시했으나 답 없음).

## 7. 검사 방법
```
node scripts/build.js                         # 화면 수정 뒤 index.html 재생성
node scripts/check-dynasty.js origin/main     # 가문 모드 1~15번 + 원래 마을 불변(300명 3,000일·5,000명 50일), 약 7~10분
node scripts/check-dynasty.js origin/main --quick   # 불변은 300명 600일만, 약 2분
node scripts/check-worlds.js                  # 서버 월드 전환·가문 모드 API
node scripts/check-client.js                  # 원래 화면 26개 탭·카드·지도 모형
node scripts/check-server.js / check-http.js / check-migration.js / check-lifecycle.js
```
- `check-dynasty.js` 1~14번은 이야기 사건을 **끈 채로** 돈다(무작위 사건이 정해진 시나리오를 바꾸므로). 15번만 켜서 모든 사건·선택지 실행, 빈도(1,200일에 133~300개), 저장 왕복을 본다.
- 한 프로세스에서 두 마을을 번갈아 돌리지 않는다(지도 확장 목록 `EXPL`·`PLOTS`가 모듈 전역). 차례로 돌리면 된다.
- 폰 화면 확인(로컬): `WORLD_SWITCH_MIN_MS=0 PORT=8091 VILLAGE_SAVE_DIR=<임시폴더> POPULATION=200 node server.js` → Playwright `devices['iPhone 13']`로 `http://localhost:8091/god`. 가문 마을 저장을 미리 만들려면 엔진으로 N일 돌린 뒤 `{version:1,seed,population,state:exportState()}`를 gzip해 `<임시폴더>/god.json.gz`로 쓴다. 서버는 `god-client.js`를 시작 때 읽으므로 고친 뒤 **서버를 다시 켠다**.

## 8. 남은 일 (우선순위 순)
1. ~~main 병합~~ **완료(2026-11-17 밤).** 남은 것: 동현이 EC2를 켜서 폰으로 확인하고 피드백 받기.
2. **이야기 사건 계속 확장**: 동현 피드백을 받아 분야별로 늘린다. 추천 다음 묶음:
   - 지위·체제별 전용 사건 더(군주정 왕실 사건: 왕비 간택·세자 책봉·외척 / 공화정: 선거 유세·여론조사·탄핵 / 공산: 당 숙청·계획 경제 할당 / 신정: 이단 심문·성지 순례 / 군정: 장교 반란).
   - 시대(기술 `S.power`)별 사건: 증기기관·철도·전기·공장 노동·신문·주식 열풍 등.
   - 내 캐릭터 나이·건강·성향(g)에 따른 사건(노년 은퇴·유언, 젊은 날 방황, 야심가 전용 음모).
   - 후속 연결을 더 길게(4~5단계), 여러 사건이 같은 인물을 이어받는 "인물 이야기".
3. **사건 결과 피드백 강화**: 선택 전 "예상 결과", 선택 뒤 "변화 수치(재산 −300, 평판 +5…)" 표시.
4. **가문 목표(야망) 시스템**(이전에 제안, 미착수): 목표 선택·진행도·달성 보상.
5. 남은 [2] 행동: 작위 수여(엔진에 영구 작위 없음 → 설계 필요), 성직·교단 출세, 첩·재혼 주선, 결투(이야기 사건으로 일부 구현), 직원 고용·해고(인물 대상으로 구현됨, 회사 단위는 미구현), 조직 범죄 운영, 성형·시술.
6. **8번 소문** — 상의 먼저.
7. **성능·메모리**: 1GB 서버에서 속령 이주 후 인구(최대 1,500명)·RSS 측정, `DYN_POP_CAP` 조정.
8. 왕으로 시작 옵션 — 동현 답 대기(가: 시작 때 평민/영주 선택, 나: 초기 영주 자처 조건 완화, 다: 그대로).
9. AWS: ON_DEMAND 스택 배포·실서버 확인(인증 있는 환경 필요).

## 9. 주의할 함정
- `R()`(마을 난수)를 가문 모드 새 코드에서 쓰면 가문 마을 결과는 바뀌어도 되지만, **원래 마을 경로에서 R() 호출 횟수가 바뀌면 안 된다.** 훅은 `S.dyn` 조건을 R() 호출 **앞**에 둔다.
- 이야기 사건의 효과는 엔진 필드를 직접 바꾼다. 없는 필드를 만들지 말고 기존 필드(`cash, rep, happy, health, edu, skill[], inv, ties, rel, G.approval, G.tre, t.tension, S.rp, jailUntil, emp/ct` 등)를 쓴다.
- `c.cash(-n)`은 가진 돈까지만 뺀다(빚을 만들지 않음). 실제로 뺀 금액(음수)을 돌려준다.
- 엔진 1년 = 60일(`YEAR`), 계절 15일. "1년에 한 번" = 60일.
- 화면 수정 뒤 `node scripts/build.js` 필수. 로컬 서버는 재시작해야 새 `god-client.js`를 읽는다.
- 옛 커밋 메시지 일부가 깨져 있다(CP949). 새 커밋은 UTF-8.

## 2026-11-18 세션 (PR #6~#12, main 반영)
- #6 생활·정치·금융·세계지도 확장(d5bd998). PR #5는 CRLF 오염(내용 동일)이라 닫음.
- #7 결혼 기록 오류 수정(mate()의 `unregistered` 미정의 → 결혼 기록 순간 엔진 정지, 원래 마을 포함), 캐릭터 꾸미기 = 새 인물 이주(정착금·가족 동반), 시작 병역(군필/미필), 가문 마을 전용 정책 `draftSex`(남녀 모두 징병).
- #8 종교 창시(교리 2~3개)·전도·신정(정부 없으면 신정 국가, 있으면 종교 혁명), 출신 '몰락한 왕족'(`a.dynRoyal`)·'성직자 집안'.
- #9 교단 선행 10(`fgood:*`)·어둠 8(`fdark:*`), 교단 평판 `D.faithRep`, 들킬 위험 `D.faithRisk`·폭로 선택지 `faithExpose`, 세습 교단 `fa.dynLock`.
- #10 사건 장치: 가문 기억 `D.mem`(c.mem), 지난 선택 `D.storyHist`(c.did), `trig`/`season`(1년=60일, 닷새마다 확인)/`special`/`once`, 몇 년 뒤 사건 `c.later`(heirOk). 특별 사건은 `D.specials` → 소식 탭.
- #11 새 기능 사건 71개(병역·이주민·종교·신정·왕권·은행·정보기관·조직·공직), #12 기본·복합 줄거리 12·특별 17·계절 6·직업별 27(총 110개). 이야기 사건 392개.
- 점검: `check-draft-policy`, `check-faith-found`, `check-faith-deeds`, `check-story-engine`, `check-story-fuzz`(모든 사건 선택지 실행) 추가. 매 PR마다 원래 마을 300명·900일 exportState가 main과 일치함을 확인.
- AWS: 서버 저장소가 `claude/modest-volta-zqs2wm` 브랜치에 있어 main을 못 받던 것을 `main`으로 바꿈. 서버에서 수정돼 있던 engine.js는 `/opt/engine.js.server-backup-20261118`, `/opt/engine-server-changes-20261118.patch`, git stash에 보관. #7 이후 반영은 `sudo systemctl restart village` 필요.
