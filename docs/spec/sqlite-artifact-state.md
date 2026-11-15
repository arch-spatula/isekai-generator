# SQLite 기반 아티팩트 상태 관리와 작업 재개 구현 계획

> 상태: 구현 완료 — 합성 통합 회귀·독립 리뷰 승인, 실제 라이트 생성 검증 진행
> 작성일: 2026-11-12
> 결정: [SQLite와 목적별 CLI ADR](../ADR/2026-11-12-sqlite-agent-state-evaluation.md)
> 적용: 전환 후 새로 예약하는 차트·개인화 GDD 실행

## 1. 목표와 확정 범위

생성 실행의 상태와 이력을 단일 SQLite DB에서 관리한다. 에이전트는 정해진 인자를 받는
명령을 호출하고, 상태 조회·다음 작업 계산·시도 예약·검증 결과 저장·채택·지문 등록은
스크립트가 처리한다. 새 컨텍스트는 DB를 조회하여 같은 미완료 실행을 이어 간다.

이번 작업은 평가용 저장소를 추가하는 것이 아니라 파일 기반 상태 저장을 교체하는 계획이다.
JSON+CLI 비교 구현, 과거 실행 import, 구형 파일 fallback, 장기간 이중 쓰기는 만들지 않는다.
문서 작성 단계에서 실제 아티팩트 삭제·DB 생성·생성 실행을 수행하지 않는다.

성공 조건은 다음과 같다.

1. 신규 생성 시작 명령이 필요한 DB를 만들고 실행을 예약한다. 별도 서버가 필요 없다.
2. 신규 실행은 상태·로그·근거·편집 제출을 JSON/JSONL 파일로 저장하지 않는다.
3. 정상 완료와 재시도에서 상태·결과·진단·이벤트가 같은 DB 트랜잭션으로 반영된다.
4. 대화 이력, TODO, 시도 디렉터리 순회 없이 DB 조회로 진행 상황과 재개 행동을 얻는다.
5. 파일 게시 중단, 에이전트 실행 여부 불명, 쓰기 경합에서 중복 호출·중복 게시를 막는다.
6. 세 체계의 입력 격리, 기존 의미 검토, 재시도 총량과 지문 비교 계약을 보존한다.
7. 과거 아티팩트가 없어도 커밋된 합성 fixture만으로 동작과 복구를 검증한다.

## 2. DB 위치·생명주기·기존 데이터 경계

### 2.1 저장소당 하나의 DB

경로는 현재 작업 저장소 루트 기준 `artifacts/state.sqlite`로 고정한다. 모든 신규 run과
전투·세계 지문을 같은 DB에 저장한다. run별 DB는 만들지 않는다. 서로 다른 Git worktree는
각자의 `artifacts/`를 사용하며 다른 worktree의 DB를 자동 탐색·공유하지 않는다.

아래는 미래 저장 계약이며 실제 실행 자료가 아니다.

```text
artifacts/
├── state.sqlite
├── state.sqlite-wal           # SQLite가 필요할 때 관리
├── state.sqlite-shm           # SQLite가 필요할 때 관리
└── <version>/
    ├── docs/GDD/*.md          # 정식 생성 문서
    └── garbage/              # 시도별 Markdown·게시 대기 파일
```

- 첫 `allocate`가 DB를 열고 스키마 v1을 초기화한다. 빈 DB의 초기화와 첫 실행 예약은
  동시 호출에도 한 번만 성립해야 한다. 이미 있는 정상 DB는 재사용한다.
- 조회·재개·finish는 DB가 없으면 실패한다. 빈 DB를 만들어 과거 실행을 신규 실행처럼
  보이게 하지 않는다. 생성 진입점 이외의 명령에는 자동 생성 권한이 없다.
- DB에는 저장소 식별과 상대 경로 기준을 기록한다. 잘못된 루트에서 다른 DB를 사용하거나
  DB만 복사해 산출물과 연결이 끊긴 경우를 감지하고 중단한다.
- `schema_version`이 구현과 다르면 명시적 `schema-version-mismatch`로 중단한다.
  이 과제에는 이전 DB 스키마 변환기를 만들지 않는다.
- 프로세스가 끝나면 연결을 닫는다. 서버 시작·종료, ORM, 범용 워크플로 엔진을 추가하지 않는다.
- `artifacts/`는 계속 Git 제외다. DB, WAL, SHM, 생성 문서를 커밋하지 않는다.

### 2.2 과거 실행을 취급하는 방법

과거 아티팩트의 JSON을 읽어 DB로 가져오거나 상태를 추정하지 않는다. DB에 없는 버전의
조회·재개는 `run-not-managed`를 반환한다. 구형 실행을 이어야 한다는 이유로 새 DB에
가짜 체크포인트를 만들거나 종료 실행을 다시 열지 않는다.

기존 디렉터리와 버전 충돌은 피한다. 예약 시 동일 series의 **디렉터리 이름만** 확인하고,
DB 카운터보다 큰 번호가 있으면 그 다음 번호부터 예약한다. 과거 파일 내용은 읽지 않는다.
DB의 버전 UNIQUE와 디렉터리의 배타적 생성을 함께 사용한다. 충돌 번호는 건너뛰며 재사용하지 않는다.
이는 마이그레이션이 아니라 출력 경로 충돌 방지다. 배정 후 외부 작업이 같은 경로를
차지하면 `output-path-conflict`로 차단하며, 이미 확정한 run의 version을 바꾸거나 타인의
폴더를 덮어쓰지 않는다.

과거 로컬 JSON을 재귀 삭제하는 정리 도구는 만들지 않는다. 제거 대상은 저장소의 기존
JSON 생성·읽기·쓰기 코드와 신규 실행의 JSON 산출 계약이다. 과거 폴더 정리는 필요할 때
별도 사용자 지시로 수행한다. 새 DB의 지문 이력은 비어 있는 상태로 시작한다.

### 2.3 JSON 제거 대상과 유지 대상

| 현재 저장물 | 전환 후 원본 | 파일 처리 |
| --- | --- | --- |
| `artifact-run.json` | runs | 생성·조회·갱신 코드 제거 |
| `events.jsonl` | events와 진단 | 파일 append·전용 lock 제거 |
| `garbage/progress/*.json` | stages | 파일 checkpoint·lock 제거 |
| 전문 해석 `input.json`, `result.json`, `accepted.json` | attempts, stages의 채택 참조 | 생성·대조 제거 |
| 방어 편집 `input.json`, `result.json`, 중복 `accepted.json` | attempts, stages의 채택 참조 | 생성·중복 게시 기록 제거 |
| `chart-evidence.json`, 편집용 `evidence.json` | evidence | 체계 필터 조회로 교체 |
| 편집 `edits.json` | attempts의 검증된 제출 payload | stdin 제출 명령으로 교체 |
| 전투·세계 지문 JSON 레지스트리 | fingerprints | init/load/register 파일 경로 계약 제거 |
| run 루트 `TODO.md` | DB 조회의 진행 요약 | 자동 생성·쓰기·재개 입력 사용 제거 |
| 시도별 `interpretation.md`, `candidate.md`, `review.md`와 정식 문서 | 파일, DB의 경로·해시 참조 | 유지; 내용은 로그에 복사하지 않음 |
| Git 설정 `.agents/artifact-series.json` | Git으로 관리하는 기준선 설정 | 유지; DB는 실행 시 설정을 snapshot |
| 저장소 원본 데이터·테스트 fixture JSON | 기존 소스 | 운영 상태와 무관하므로 유지 |

CLI의 stdin/stdout JSON 및 Markdown 안의 구조화된 JSON block은 저장 파일이 아니다.
이를 금지하거나 전부 별도 테이블로 분해하지 않는다. 에이전트가 JSON 파일을 만들어
다음 명령에 전달하는 임시 우회도 허용하지 않는다. 제출은 stdin으로 직접 전달한다.
Git 설정을 mutable DB로 옮겨 기준선 변경 이력을 잃지 않는다.

## 3. 구현 구성과 DB 연결 계약

기존 Bun/TypeScript 런타임과 내장 `bun:sqlite`를 사용한다. 연결·스키마·짧은 트랜잭션은
`scripts/artifacts/`의 작은 공용 모듈에 둔다. 공개 진입점은 쓰기용
`scripts/artifact-state.ts`와 읽기용 `scripts/read-artifact-state.ts`로 구분한다.
기존 차트·전문 해석·편집 관리 함수는 이 저장 계층을 호출하며 상태 규칙을 중복 구현하지 않는다.
[Bun SQLite API](https://bun.sh/docs/runtime/sqlite)는 동기식 드라이버와 트랜잭션을 제공한다.
구현 시 프로젝트에 고정된 Bun 버전에서 사용하는 API를 확인하고, 이 작업 때문에 런타임을
함께 올리지 않는다.

연결 규칙은 다음으로 고정한다.

- 모든 연결에 `foreign_keys=ON`, `busy_timeout=5000`을 설정하고 적용 여부를 검증한다.
- 초기화 시 WAL 모드를 설정한다. 쓰기 연결의 `synchronous=FULL`을 사용한다.
- 모든 쓰기 단위는 짧은 `BEGIN IMMEDIATE` 트랜잭션 안에서 선행 조건을 재확인한다.
  파일 읽기·검증기·모델 호출·사용자 응답 대기는 트랜잭션 밖에서 수행한다.
- 쓰기 경합의 제한 대기 후 `state-busy`를 반환한다. 무한 재시도·lock 디렉터리 삭제를 하지 않는다.
- SQL 값은 바인딩한다. 에이전트에게 임의 SQL, 테이블 수정이나 범용 patch 명령을 제공하지 않는다.
- 조회는 논리적 읽기 전용 연결을 사용하고 스키마 초기화·상태 변경을 수행하지 않는다.
  WAL/SHM 파일의 SQLite 내부 처리는 별개다.

WAL에서도 쓰기는 직렬화되며 같은 호스트의 로컬 파일시스템을 전제로 한다.
WAL/SHM은 SQLite가 관리하는 보조 파일이므로 임의 삭제하지 않는다.
[SQLite WAL 설명](https://www.sqlite.org/wal.html)과
[PRAGMA 설명](https://www.sqlite.org/pragma.html)을 따른다.

## 4. 데이터 모델과 불변 조건

최종 SQL은 구현에서 작성하되 아래 데이터와 제약을 빠뜨리지 않는다. 모든 소속 관계는
외래키와 소유 run 검사로 강제한다. 시각은 도구가 UTC로 생성하며 입력받지 않는다.
임의 현재 상태를 수정하는 API와 cascade로 이력을 지우는 API는 제공하지 않는다.

| 테이블 | 필수 데이터 | 제약·조회 기준 |
| --- | --- | --- |
| store_meta | schema version, 저장소 식별, 생성 시각 | 단일 행; 미지원 버전 즉시 중단 |
| series_counters | series, 마지막 예약 patch | series PK; 예약과 같은 트랜잭션 |
| runs | run ID, version, kind, mode, purpose, source/baseline revision, dirty, 설정 snapshot, 상태, 실패 요약, 생성·시작·종료 시각 | version UNIQUE; terminal 시각과 상태 일치 |
| stages | run, 단계, 상태, 현재 attempt, 채택 attempt/document, blocked reason | `(run, stage)` UNIQUE; 채택 참조는 동일 run·단계 |
| attempts | ID, run, 단계, 종류, 번호, scope, 상태, 원본 attempt/document/hash, 입력 snapshot, 제출 payload/hash, 결과, unresolved, 모델·사용량, 실행 식별, claim 세대 | `(run, stage, kind, number)` UNIQUE; 활성 시도 하나; 원본·완료 결과 불변 |
| operations | request ID, 명령 종류, 정규화 인자 hash, 대상 ID, pending/completed 상태, 완료 응답 | request ID UNIQUE; 다른 인자 재사용 거부 |
| events | 단조 증가 ID, run, stage/attempt, 사건, operation, reason, 안전한 구조화 진단, 시각 | append-only; `(run, id)` 인덱스; 시각만으로 순서 정렬하지 않음 |
| documents | run/attempt, 역할, 상대 경로, SHA-256, 준비/게시 상태, 최종 경로 | 정식 경로 소유권 UNIQUE; hash 없이 게시 완료 금지 |
| validations | 대상 document/hash, validator ID와 revision, 결과·진단, 실행 시각 | 실제 검증한 바이트와 결합; 파일 존재만으로 생성 금지 |
| evidence | run, 체계, evidence ID, 정규화 text, chart hash | `(run, system, evidence ID)` UNIQUE; 동일 report의 근거만 조회 |
| fingerprints | run, 종류(combat/world), 후보 ID, 축, 비교 revision | `(run, kind)` UNIQUE; 같은 run의 두 종류만 원자적 등록 |

복잡한 입력·편집 제안·진단은 스키마 검증한 JSON 값으로 DB TEXT에 보존할 수 있다.
조회·제약에 쓰는 run/stage/번호/상태/해시/종류는 JSON 안에만 숨기지 않는다. 테이블을
파일 수만큼 만들거나 거대한 단일 JSON blob으로 파일 저장 구조를 그대로 복제하지 않는다.

추가 불변 조건:

- run ID와 version은 다르다. version은 사람이 보는 경로 식별이며 DB ID는 도구가 할당한다.
- 시도 번호·편집 범위·이벤트 시각·선행 단계·재시도 가능 여부를 모델이 계산하지 않는다.
- 시도 입력 snapshot은 배정 뒤 수정하지 않는다. submit은 별도 payload를 한 번 결합한다.
- 논리적 채택 원본은 stages의 단일 참조다. 전문 해석과 편집 양쪽에 accepted 기록을 복제하지 않는다.
- 활성 시도 UNIQUE, 외래키, 상태 CHECK와 트랜잭션 내부 상태 전이를 함께 사용한다.
- 원시 출생 인자·대화·전체 명령·원시 stderr는 운영 로그와 일반 상태 조회에 넣지 않는다.
  근거 text와 편집 payload는 제한된 도메인 입력이며 일반 이벤트나 summary에 복제하지 않는다.

## 5. 실행·단계·시도 상태와 재시도

### 5.1 실행

```text
allocated → running → succeeded
                ├──→ blocked → running
                ├──→ failed
                └──→ cancelled
allocated → failed / cancelled
blocked   → failed / cancelled
```

`blocked`는 미완료 상태다. 인프라 오류, 입력 대기, 실행 여부 불명 또는 게시 복구 필요를
표현한다. 컨텍스트 종료·도구 연결 끊김을 곧바로 terminal `failed`로 만들지 않는다.
`succeeded/failed/cancelled`는 terminal이며 같은 run을 다시 열지 않는다.
계산기가 확정적으로 실패(nonzero 또는 필수 체계 누락)한 차트 단독 실행은 기존처럼
`failed`와 chart-report 실패 단계를 보존한다. spawn·DB·파일 I/O·게시 중단은 계산 실패와
구분하여 차트 단독 실행에서도 blocked로 둔다. 재입력이 필요한 입력 대기는 request-input으로 표시한다.

성공 전제는 다음과 같다.

- 차트 단독: chart 보고서 게시와 근거 저장·검증 완료.
- 개인화 GDD: 모든 단계의 채택 문서, 최종 validator 결과와 두 지문 등록 완료.
- terminal 결과와 최종 이벤트는 같은 트랜잭션에서 확정한다.
- 취소는 claim을 무효화하고 새 작업을 막는다. 실행 중인 외부 agent 종료 요청과 실제
  종료 확인은 별개이며, 늦게 도착한 결과로 terminal 상태를 바꾸지 않는다.

### 5.2 단계 의존성

```text
chart-report
  ├─ saju  (생성 → 구조 검증 → 방어 편집 → 게시)
  ├─ ziwei (생성 → 구조 검증 → 방어 편집 → 게시)
  └─ natal (생성 → 구조 검증 → 방어 편집 → 게시)
       ↓ 세 체계 모두 채택·게시
integration → selection → world-selection → gdd → final-validation
       → fingerprint-registration → run succeeded
```

실제 의존성은 코드의 한 정의에서 사용한다. saju/ziwei/natal은 각각 chart-report만을
선행 조건으로 가지며 서로를 기다리지 않는다. 차트 단독 run에는 이후 단계가 없다.

단계 상태는 `pending/running/blocked/succeeded/failed`다. 예산 내 제출 실패는 attempt의
결과이고 단계의 최종 실패와 구분한다. 후속 시도는 도구가 배정한다. 성공 단계는 일반
start로 다시 실행할 수 없고, 의존 단계는 선행 채택·게시·검증이 확인될 때만 시작한다.

기존 `combat-registration`, `world-registration` 체크포인트는 하나의
`fingerprint-registration`으로 교체한다. DB 전환 뒤 부분 등록 상태를 정상 경로로 만들지 않는다.

### 5.3 시도와 예산

시도의 실행 상태와 도메인 결과를 구분한다. 실행 상태는 `prepared/dispatching/running/
submitted/interrupted/completed`, 도메인 결과는 전문 해석의 `editing-required/
validation-failed/execution-failed`, 편집의 `passed/editing-failed/execution-failed` 등을
종류별 enum으로 제한한다. 모든 조합을 허용하지 않는다.

- 전문 해석은 체계당 생성·수정·재생성 합계 최대 3회다. 구조 실패는 직전 결과를 이용한
  repair, 출력 없는 실행 실패는 새 generate로 판단하는 기존 의미를 유지한다.
- 편집도 체계당 최대 3회다. `editing-failed`가 확정된 경우에만
  `sentence → item → system`으로 확대한다. 남은 예산 없이 새 scope를 예약하지 않는다.
- 통합·전투·세계·GDD의 일반 수정은 최초 1회와 허용된 수정 1회의 기존 한도를 유지한다.
  새 challenger 작성은 해당 선택 계약의 일부이며 임의 추가 agent 호출 근거가 아니다.
- 예약이 예산을 소비한다. 동일 request 재호출은 추가 소비하지 않는다. 번호를 초기화하거나
  미사용으로 보이는 시도를 삭제해 예산을 늘리지 않는다.
- 기존과 달리 명시적 재개 요청에서 **실행 종료가 확인된 운영 중단**은 남은 예산 안에서
  같은 scope로 새 invocation을 배정할 수 있게 한다. 이것은 scope 확대가 아니다.
  운영 재시도도 총 3회에 포함하므로 후속 scope가 남지 않을 수 있다. 자동 운영 재시도는 없다.
- 준비만 끝난 시도는 같은 배정으로 dispatch한다. dispatch 여부가 불명확하면 새 호출을
  하지 않는다. 도구가 재개 가능한 행동을 확정하기 전에는 모델에게 재생성을 요청하지 않는다.
- `editing-required`는 구조 검증 성공이며 최종 채택은 아니다. 편집을 거쳐야 게시할 수 있다.
- 잘못된 편집 제출은 `editing-contract` 진단과 원본 후보·hash를 남겨 `editing-failed`로
  확정한다. 원본/input/hash 변조와 DB·파일 I/O 실패는 제출 오류로 바꾸지 않는다.

## 6. 목적별 CLI 계약

아래 명령은 구현할 인터페이스 계약이다. 아직 실행 가능한 명령이 아니다. root는 명령의
작업 저장소에서 해석하고 DB 경로를 에이전트가 매번 조합하지 않게 한다. 일반 명령은
run ID 또는 version 중 하나로 실행을 식별하며 혼용하거나 `latest`로 대체하지 않는다.

### 6.1 쓰기 명령

```text
bun scripts/artifact-state.ts allocate --kind <kind> --mode <mode> --purpose <purpose> --request <id>
bun scripts/artifact-state.ts start --run <id> --request <id>
bun scripts/artifact-state.ts prepare --run <id> --stage <stage> --kind <kind> --request <id>
bun scripts/artifact-state.ts dispatch --attempt <id> --claim <claim> --request <id>
bun scripts/artifact-state.ts bind-worker --attempt <id> --claim <claim> --agent <id> --request <id>
bun scripts/artifact-state.ts submit --attempt <id> --claim <claim> --request <id> < <stdin-payload>
bun scripts/artifact-state.ts finish --attempt <id> --claim <claim> --request <id>
bun scripts/artifact-state.ts reconcile --run <id> --request <id>
bun scripts/artifact-state.ts resume --run <id> --request <id>
bun scripts/artifact-state.ts cancel --run <id> --reason <safe-reason> --request <id>
bun scripts/artifact-state.ts fail --run <id> --reason <safe-reason> --request <id>
bun scripts/artifact-state.ts finalize --run <id> --request <id>
```

`<stdin-payload>`는 형식 설명용 표기다. 실제 사용은 payload를 파이프나 도구 stdin으로
직접 전달하며 파일로 먼저 저장하지 않는다. 출생 인자는 계산기에만 전달하며 공통 명령
로그·operation hash·요약에 복사하지 않는다.

| 명령 | 책임과 반환 |
| --- | --- |
| allocate | DB 초기화, 기준선·목적 검증, 버전 예약, 디렉터리 준비; run ID/version 반환 |
| prepare | 선행 조건·예산·활성 시도를 원자적으로 확인; attempt ID, claim, scope, 출력 경로, 필요한 입력 참조 반환 |
| dispatch / bind-worker | 외부 실행 요청 직전 상태 기록 / 반환된 실행 식별 결합; 자체적으로 agent를 spawn하지 않음 |
| submit | 문서 경로/hash 또는 편집 제안·의미 리뷰를 immutable 제출로 결합; 자동 성공 처리 금지 |
| finish | 정해진 validator 실행, 제출 결과·진단 저장, 필요 시 게시 복구 절차 수행; 결과와 다음 행동 반환 |
| reconcile | DB의 미완성 예약·검증·게시 기록을 확인하고 확인 가능한 결과만 정합화; agent 신규 호출 금지 |
| resume | 사용자 재개 요청의 진입점; reconcile과 입력·실행 증거 확인 후 재개 허용 또는 차단 이유 반환 |
| finalize | 최종 검증 snapshot·지문 revision 확인 후 두 지문+완료 상태를 같은 트랜잭션으로 확정 |

worker 종료 확인이 필요한 경우 resume은 worker 관측값을 stdin으로 받는다. 로컬 프로세스는
PID와 시작 식별을 함께 확인하고, agent 도구만 아는 실행은 오케스트레이터가 실제 상태
조회 결과를 제공한다. `terminated/alive/unknown`, 관측 주체와 참조를 기록한다. timeout만
보고 `terminated`를 제출하지 않는다. 이 관측 결과는 무결성 claim을 대체하지 않는다.

### 6.2 읽기 명령

```text
bun scripts/read-artifact-state.ts runs --unfinished
bun scripts/read-artifact-state.ts summary --run <id>
bun scripts/read-artifact-state.ts next --run <id>
bun scripts/read-artifact-state.ts input --attempt <id> --claim <claim>
bun scripts/read-artifact-state.ts issues --attempt <id>
bun scripts/read-artifact-state.ts events --run <id> --after <event-id> --limit <n>
bun scripts/read-artifact-state.ts fingerprints --attempt <id> --kind <combat|world>
```

- summary는 전체 상태, 단계별 현재 상태·시도/남은 예산, blocked reason과 정식 경로만 반환한다.
- next는 `dispatch/wait/verify-worker/validate/reconcile-publication/prepare-retry/
  request-input/finalize/done/terminal` 중 실행 가능한 행동과 이유·참조 ID를 반환한다.
  병렬 실행 가능한 세 체계는 각각 확정된 행동으로 반환한다. 모델이 미확정 후보들 사이의
  기계적인 선행 조건을 다시 계산하도록 하지 않는다.
- input은 배정된 단계의 allowlist로 필터링한다. 전문 해석은 해당 체계, 편집은 해당 체계의
  원본·진단·직전 후보/리뷰, 통합은 현재 run의 세 채택본을 제공한다.
- 전투 단계는 통합 해석과 전투 비교 결과, 세계 단계는 통합 해석·선택 전투와 세계 비교
  결과만 받는다. chart·다른 체계·이전 GDD·다른 종류 레지스트리의 본문은 전달하지 않는다.
- DB에 있는 chart evidence는 해당 체계만 stdout으로 조회한다. 기존 validator는 DB를
  읽는 adapter에서 기존 타입 객체를 받아 순수 검증 함수에 넘긴다. 임시 evidence JSON을 만들지 않는다.
- events는 기본 20개, cursor 기반 조회다. 오류 진단의 총수·다음 cursor를 명시하며 필요한
  항목만 추가 조회한다. 페이지를 잘랐다고 전체 오류가 해결된 것으로 판정하지 않는다.
- 임의 SQL이나 전체 DB dump를 에이전트의 정상 입력으로 사용하지 않는다. 논리적인 입력
  격리이며 같은 OS 사용자의 DB 직접 접근까지 보안 sandbox로 차단한다고 주장하지 않는다.

### 6.3 응답·멱등성·실패

stdout은 버전이 있는 간결한 JSON 응답 하나다. 진행 로그를 섞지 않는다. 정상 기록된
도메인 실패는 명령 성공과 구분하여 `outcome`, `nextAction`으로 반환한다. CLI 종료 코드는
0=명령 처리 완료, 1=운영 실패, 2=잘못된 인자로 통일한다. 재시도 여부를 exit code만으로 정하지 않는다.

request ID는 모델이 만드는 업무 데이터가 아니라 명령 재전송 식별자다. 같은 논리 호출은
같은 ID를 재사용한다. 같은 request+같은 정규화 인자는 기존 결과를 반환하고, 다른 인자는
`request-conflict`다. 응답 유실 뒤에는 operation ID를 조회하거나 같은 명령을 재호출한다.
완료 시도에 다른 request를 붙여도 기존 결과를 덮어쓸 수 없다.
파일·검증기 경계가 있는 명령은 pending operation과 처리 의도를 먼저 기록한다. 동일 요청이
pending이면 같은 작업을 무작정 다시 실행하지 않고 해당 의도의 정합화 결과를 반환한다.
submit 응답은 접수 ID·payload hash·다음 행동만 반환하고 제출 본문을 다시 출력하지 않는다.

claim은 attempt와 실행 세대에 결합한다. 준비 이후 취소·회수된 claim, 다른 체계 claim,
다른 run의 참조는 쓰기를 거부한다. 쓰기 직전 부모 상태와 claim을 다시 확인하므로 늦은
agent가 재개된 작업 결과를 덮어쓰지 못한다. claim은 일반 summary/events에 노출하지 않는다.
명시적 resume 응답의 `data.resumedAttempts`는 prepared/submitted 시도의 새 claim과 출력
경로를 반환하여 이전 대화의 claim·request를 모르는 새 컨텍스트도 같은 시도를 이어가게 한다.
회수 이전 claim은 무효화하며 시도 번호·예산은 유지한다. running/dispatching은 실제 종료
확인 전에 회수하지 않는다. 종료 확인된 일반 문서의 예약 출력이 이미 존재하면 같은 시도의
제출·검증으로 이어가고, 출력이 없거나 편집 payload가 없는 중단만 새 호출 예산을 사용한다.

모델 사용량 제한·일시적 인프라 장애는 blocked 사유로 기록하고 자동 호출을 멈춘다.
오류를 이유로 전체 GDD 생성을 새 run에서 자동 재시작하지 않는다.

원래 예외와 DB 기록 실패가 함께 있으면 둘 다 호출자에게 보고한다. DB 기록이 불가능하면
파일 로그로 fallback하거나 DB를 지우고 재생성하지 않는다. 실행은 차단하고 DB 복구 후
동일 run의 reconcile에서 확인한다. 기록 성공을 확인하기 전에는 후속 agent를 시작하지 않는다.

## 7. 파일·DB 경계와 게시 복구

DB 트랜잭션은 파일 쓰기나 agent 호출을 원자적으로 포함하지 못한다. 파일 존재를 완료
증거로 쓰는 대신 documents의 게시 의도와 실제 hash를 대조한다.

1. prepare가 출력 경로와 원본 hash를 DB에 예약한다. 시도별 경로는 재사용하지 않는다.
2. agent는 배정된 임시 Markdown만 쓴다. submit이 결과 바이트/hash를 결합한다.
3. finish는 동일 snapshot을 검증한다. 검증 후 파일이 바뀌면 채택하지 않는다.
4. DB에 validator 결과와 `ready-to-publish` 문서·최종 경로·예상 hash를 원자적으로 저장한다.
5. 최종 경로가 비어 있으면 덮어쓰기 없는 게시를 수행한다. 최종 파일이 이미 있으면
   기록된 소유자·hash와 같은지 확인한다. 다른 내용은 덮어쓰지 않고 차단한다.
6. 최종 hash 확인 후 DB에서 document를 published, stage를 succeeded, 채택 참조를 확정하고
   이벤트를 함께 기록한다. 이때까지 후속 단계는 시작할 수 없다.

| 중단 위치 | DB 조회 결과 | 재개 행동 |
| --- | --- | --- |
| 버전 예약 후 디렉터리 생성 전 | allocated, 경로 미준비 | 같은 예약 경로 생성; 새 번호 배정 금지 |
| agent 실행 요청 전 | prepared | 기존 attempt dispatch; 예산 추가 소비 없음 |
| dispatch 기록 후 agent ID 기록 전 | dispatching, 실행 불명 | worker 확인; 중복 spawn 금지 |
| 문서 생성 후 submit 전 | 실행 미확정, 예약 경로 존재 | 종료 확인 후 해당 출력 검증·submit; 존재만으로 성공 금지 |
| 제출 저장 후 finish 전 | submitted | 기존 제출 검증; 모델 재호출 금지 |
| 검증 후 게시 전 | ready-to-publish | 검증 hash와 후보 확인 후 게시 |
| 파일 게시 후 DB 완료 전 | ready-to-publish, 최종 파일 존재 | 소유권·hash 확인 후 DB 완료 반영 |
| DB 완료 후 응답 전 | succeeded 또는 완료 operation | 동일 응답 반환; 게시·시도·지문 중복 없음 |
| 원본/후보/hash 변조 | blocked, integrity 오류 | 자동 재시도·덮어쓰기 금지; 원본 확인 필요 |
| DB 접근 불가·손상 | 조회 실패 | 생성 중단; 빈 DB fallback 금지 |

DB 파일만 복사하는 백업을 정상 절차로 제공하지 않는다. 운영 백업이 필요하면 SQLite의
일관된 백업 방식을 사용하고, 대응하는 문서 파일과 hash를 함께 복구할 수 있어야 한다.
자동 백업 서비스나 보존 정책은 이 과제에 추가하지 않는다.

## 8. 중단 후 작업 재개 절차

재개는 새 버전 예약 명령과 분리한다. 사용자가 특정 미완료 실행을 이어 달라고 하면
`runs --unfinished` 또는 지정 ID의 summary부터 조회한다. 후보가 여러 개면 실행을
추측하지 않고 식별을 요청한다. 이전 대화 내용을 재개 상태 원본으로 삼지 않는다.

1. **실행 확인:** schema/run 존재와 terminal 여부를 확인한다. DB 없는 과거 버전은 거부한다.
2. **진행 확인:** next로 현재 시도·claim·제출·게시 상태와 blocked reason을 얻는다.
3. **생존 확인:** 실행 중 agent/process는 실제 관측한다. 살아 있으면 기다리며, 알 수 없으면
   차단을 유지한다. 시간 경과만으로 예산을 다시 배정하지 않는다.
4. **출력 정합화:** reconcile이 검증·게시·완료 operation을 복구한다. 파일 누락·변조가
   확인되면 그 단계와 의존 단계 실행을 차단한다. 이미 성공한 이력을 조용히 삭제하지 않는다.
5. **완료본 재검증:** 재개 시 채택 hash와 필요한 validator를 확인한다. validator revision은
   관련 validator·입력 계약의 content hash로 식별하여 dirty 코드 변경도 검출한다. 무관한
   문서 commit 때문에 전체 run을 차단하지 않는다. validator revision이나
   저장된 입력 revision이 다르면 `validator-revision-mismatch`로 차단한다. 변경된 코드를
   자동 승인하거나 진행 중 run의 계약을 바꾸지 않는다.
6. **미완료 실행 계속:** 제출이 있으면 검증/게시를 마친다. 출력 없이 종료가 확인되면
   interruption 기록 후 남은 예산과 scope 규칙으로 명시적인 운영 재시도를 배정한다.
7. **입력 대기:** chart가 없고 출생 입력이 보존되지 않았다면 필요한 입력만 다시 받는다.
   운영 DB에서 입력을 꾸며내거나 다른 run에서 가져오지 않는다. 이미 검증된 chart는 재계산하지 않는다.
8. **진행 재개:** run이 blocked였다면 차단 사유 해소와 claim 갱신을 함께 확정하고 running으로
   전환한다. 후속 단계는 DB가 반환한 순서와 필요한 입력만 사용한다.

에이전트 실행 요청과 DB 기록 사이에는 외부 도구 경계가 있다. 따라서 DB만으로 모든
외부 agent의 종료를 증명할 수는 없다. DB는 **확정된 재개 지점과 확인할 대상**을 제공하고,
관측이 없는 실행은 `verify-worker`로 돌려준다. 이를 자동 재생성으로 대체하지 않는다.

## 9. 전투·세계 지문과 최종 확정

두 종류의 지문은 같은 DB에 있지만 조회 인터페이스와 축 규칙은 분리한다. 기본 조회는
성공 확정된 run의 지문만 사용한다. 실패·미완료 run의 후보는 다른 run의 이력으로 노출하지 않는다.

- 선택 시작 시 registry revision을 읽고 같은 snapshot 기준으로 비교한다. 근접 항목 계산,
  동일 축 수, 비교 개수, challenger 필요 여부는 스크립트가 계산한다.
- 에이전트는 후보 설계와 의미적 차이·선택 이유를 작성한다. registryReview 같은 결정적
  필드는 도구가 비교 결과에서 생성·검증하며, 모델이 전체 레지스트리를 읽어 수치를 세지 않는다.
- 모든 최단 거리 동률을 보존한다. 출력이 길면 cursor와 총수를 제공하되 계산·검증은
  전체 결과를 사용한다. 조용한 top-1 축약으로 challenger 판단을 바꾸지 않는다.
- 최종 검증은 채택된 chart/해석/전투/세계/GDD의 hash와 validator revision을 snapshot한다.
- finalize의 트랜잭션에서 snapshot과 최신 registry revision을 다시 확인한다. 다른 run이
  먼저 등록했으면 아무것도 등록하지 않고 `registry-stale`로 차단한다.
- revision 변경 뒤에는 최신 비교를 다시 계산한다. challenger·재선정이 필요하면 관련
  선택과 의존 문서의 재검토를 요구하고 기존 시도 예산을 초기화하지 않는다. 이때 기존
  성공 이력과 문서는 보존하되 현재 채택 snapshot을 stale로 표시해 후속 실행을 막는다.
  재검토 대상 단계는 남은 예산의 새 시도로만 갱신하며, 새 채택 뒤 의존 문서를 다시 검증한다.
  일반 start가 성공 단계를 다시 여는 것과 구별된 reconcile 경로로 처리한다.
  이미 게시한 단계의 재선정본은 `docs/GDD/revisions/<attempt-id>/<document-name>.md`에
  게시하여 옛 파일을 보존한다. DB의 채택 참조가 현재 정식본을 가리키며 다음 입력과 완료
  경로 안내도 이 참조를 따른다. 최초 게시의 기존 파일명은 유지한다. 새 모델 호출은
  사용자의 재개 요청 및 남은 예산 안에서만 허용한다. 예산 소진이면 새 run이 필요하다.
- 최종 snapshot이 유효하면 전투·세계 지문 두 행, 등록 단계 성공, run 성공과 이벤트를
  같은 트랜잭션으로 확정한다. 한 종류만 등록되는 상태는 rollback한다.
- 동일 완료 요청은 저장된 결과를 반환한다. 같은 run에 다른 지문을 덮어쓰지 않는다.

## 10. 기존 코드·스킬·문서 변경 목록

다음 목록은 구현 작업 범위이며 현재 완료를 뜻하지 않는다. 아직 이 브랜치에 없는 과거
이벤트 CLI·명세 파일을 복원하는 일을 전제로 하지 않는다. 실제 추적 파일과 호출자를 기준으로 바꾼다.

| 영역 | 필요한 변경 | 완료 확인 |
| --- | --- | --- |
| artifact-run.ts, resolve-output 계열 | DB 초기화·예약·상태 전이·version 충돌 방지 | 차트/GDD가 같은 allocator 사용; manifest 생성 없음 |
| artifact-progress.ts, update-artifact-progress.ts | 단계 상태·next 조회로 교체; TODO/lock renderer 제거 | 단일 DAG; 직접 done으로 검증 우회 불가 |
| artifact-events.ts 및 로그 호출자 | DB 트랜잭션 이벤트 기록으로 교체 | 상태와 이벤트의 분리 쓰기 없음 |
| specialist-attempt.ts와 CLI | DB attempt·진단·예산·claim으로 전환 | input/result/accepted 파일과 디렉터리 순회 없음 |
| defensive-edit.ts와 CLI | stdin 제출·DB 입력/채택·게시 복구 | edits/evidence JSON 없음; 의미 검토 보존 |
| run-chart-report.ts, chart-evidence.ts | 보고서 게시와 DB 근거 저장 | 계산 stdout 원문 유지; 체계별 근거 ID 보존 |
| 체계·통합·전투·세계·GDD validator CLI | DB adapter와 순수 validator 분리 | JSON 경로 인자 제거; 잘못된 run/체계 거부 |
| 두 fingerprint registry 관리자 | 공용 DB 저장·종류별 조회·원자적 finalize | 파일 init/load/register 및 lock 제거 |
| 생성·해석·편집·선택·GDD 스킬과 references | 새 입력/제출/조회 명령·재개 행동 사용 | 과거 JSON 읽기·시도 번호 계산·TODO 전달 지시 없음 |
| versioning/progress/recovery/defensive/world/combat spec | 적용 경계와 DB 계약으로 갱신 | active spec 간 충돌 없음 |
| README, package scripts, smoke fixture, 전체 테스트 호출자 | 새로운 진입점 연결과 합성 DB 사용 | 폐기 CLI를 호출하는 smoke/회귀 없음 |

관리 함수의 순수 판정·검증 로직은 재사용한다. 파일 저장 계층과 불필요해진 lock/helper만
제거하며 다른 품질 정책·모델 선택·창작 프롬프트를 함께 개편하지 않는다. JSON 문자열 검색을
0건으로 만드는 것이 목표가 아니라 제거 대상 **파일에 대한 생성·읽기 의존을 없애는 것**이다.

## 11. 작업 순서와 인계 단위

실제 코드 구현은 [3개 역할 명세](three-agent-implementation-workflow.md)와
[implement-with-test-review 스킬](../../.agents/skills/implement-with-test-review/SKILL.md)을 따른다.
구현·테스트 작성은 병렬, 테스트 인계→독립 리뷰→작성자 수정→재리뷰는 직렬로 진행한다.
각 단계에서 승인된 테스트와 제품 코드를 고정한 뒤 통합 검증한다.

| 순서 | 구현 산출물 | 해당 단계 통과 조건 |
| --- | --- | --- |
| 1. 계약 고정 | 상태 enum, 테이블 제약, CLI 응답·오류 타입, DAG·예산 정의 | 구현·테스트 담당이 같은 계약으로 정상/거부 사례 합의 |
| 2. 저장소와 예약 | schema v1, 연결 설정, allocator, operations/events | 최초·동시 초기화, 중복 request, 번호 충돌, rollback 통과 |
| 3. 조회·claim·재개 골격 | summary/next/input, prepare/dispatch/bind, blocked/claim 검증 | 실행 불명 중복 차단, 입력 격리, stale claim 거부 |
| 4. 차트·근거 | chart runner, DB evidence adapter, 차트 단독 finalize | JSON 없이 standalone 성공·중단 복구 통과 |
| 5. 전문 해석·방어 편집 | 시도 결과·stdin 제출·진단·scope·게시 정합화 | 계약 오류 복구와 운영·무결성 경계 통과 |
| 6. 통합·전투·세계·GDD | 단계별 adapter, 지문 조회, 최종 snapshot·등록 | DAG·최신 지문 재검토·두 등록 원자성 통과 |
| 7. 전면 연결·기존 경로 제거 | 스킬/문서/fixture/CLI 정비, 파일 backend 삭제 | 새 생성 경로가 JSON/JSONL 없이 작동, 폐기 계약 사용 없음 |
| 8. 재개·충돌 통합 검증 | 프로세스 중단 주입과 새 컨텍스트 재개 시나리오 | 아래 회귀표 전부 통과; 최종 독립 리뷰 승인 |

중간 개발 단계에서 helper를 추가할 수 있지만 배포 가능한 전환본에는 두 상태 backend나
구형 JSON fallback을 남기지 않는다. 새 구현이 불완전할 때 실제 개인화 생성을 실행하지 않는다.
작업은 이 spec 작성만으로 완료 처리하지 않으며 각 단계의 미완료·검증 결과를 별도로 기록한다.

## 12. 필수 회귀·수용 시나리오

모든 시나리오는 개인정보 없는 임시 저장소와 DB에서 실행한다. 병렬성·crash 검증은
실제 별도 프로세스와 재접속으로 확인하며 단일 연결 mock만으로 통과시키지 않는다.

| 분류 | 사례 | 기대 결과 |
| --- | --- | --- |
| 초기화 | DB 없는 첫 생성·동시 첫 생성 | schema 한 번, 서로 다른 run/version, 유실 없음 |
| 조회 | DB 없음·run 없음·schema 불일치 | 파일 생성 없이 명확한 거부 |
| 과거 자료 | 구형 폴더·JSON 존재 | 내용 읽기/import 없음; 번호 충돌만 회피 |
| 예약 | commit 후 디렉터리 생성 전 종료 | 동일 예약 복구; 번호 중복·재사용 없음 |
| 멱등성 | 응답 유실 후 같은 request 재호출 | 동일 ID·결과; 예산·이벤트 중복 없음 |
| 충돌 | 같은 request 다른 payload | request-conflict; 기존 결과 보존 |
| 동시성 | 같은 체계 prepare 경쟁·세 체계 병렬 finish | 체계별 활성 시도 하나; 세 결과 모두 보존 |
| claim | 취소·재개 이전 claim의 늦은 submit/finish | 쓰기 거부; 새 결과·terminal 상태 보존 |
| 실행 불명 | dispatch 후 bind 전 중단 | verify-worker; 자동 spawn 없음 |
| 실행 확인 | alive/unknown/종료 확인 | wait/blocked/남은 예산 내 명시적 재개로 구분 |
| 전문 해석 | clean·방어문구만·구조 오류·출력 없음 | editing-required/repair/generate 경로와 3회 한도 유지 |
| 편집 | 잘못된 JSON·secondary target·리뷰 누락 | editing-contract, 원본 후보·hash, 다음 허용 scope |
| 의미 검토 | unresolved·false-positive·preservation 미확인 | 자동 passed 금지; 진단·이유 보존 |
| 무결성 | 준비 입력·원본·후보·source hash 변조 | blocked; 편집 계약 실패로 위장하지 않음 |
| 운영 실패 | DB lock·쓰기 불가·후보/게시 I/O 실패 | 제한 시간 내 오류; 후속 호출 차단; 새 DB fallback 없음 |
| 게시 | 검증 전/후, 파일 게시 후 DB commit 전 종료 | 같은 후보 검증·게시 복구; 덮어쓰기·모델 재호출 없음 |
| 선행 조건 | 미채택 체계가 있는데 integration 실행 | 시작 거부; 단순 done 우회 불가 |
| 입력 격리 | 다른 체계/run/레지스트리 접근·summary | allowlist만 반환; 본문·출생 인자·claim 노출 없음 |
| 근거 | report와 다른 evidence/hash·체계 지정 | 거부; 정상 ID·text는 기존 함수 결과와 일치 |
| 지문 | 동률·challenger·다른 run의 동시 등록 | 전체 비교 보존; revision 변경 시 재검토 |
| 등록 | 첫 지문 insert 후 두 번째 insert 실패 | 두 종류·단계·run 성공 모두 rollback |
| 재개 | 별도 프로세스가 DB를 열어 이어하기 | 대화·TODO·JSON 없이 미완료 행동 반환·완료본 재사용 |
| 코드 변경 | 재개 시 validator/input revision 달라짐 | 자동 승인 없이 차단 사유와 필요한 조치 반환 |
| 입력 부재 | chart 미완료, 출생 입력 없음 | request-input; 추정·다른 run 복사 없음 |
| 종료 | succeeded/failed/cancelled 재개 | 재개 거부; 기존 이력 불변 |
| 파일 계약 | 신규 전체 합성 파이프라인 | JSON/JSONL·TODO·구형 lock 미생성; Markdown·DB만 생성 |

각 버그 회귀는 가능하면 변경 전 실패·변경 후 통과를 확인한다. 오류 메시지만 맞고 잘못된
상태가 남는 테스트, 어떤 예외든 통과시키는 catch, 파일 존재만 검사하는 테스트는 승인하지 않는다.
최종 검증은 `bun run test`, `bun run check:docs`, `bun run check:docs --review`,
`git diff --check`와 수정 스킬의 기존 검사를 포함한다. 명령 자체의 성공과 문서 의미 품질을 구별한다.

## 13. 비용·토큰 확인과 최종 완료 기준

전환은 확정 방향이며 과거 방식과의 A/B 구현을 채택 선행 조건으로 요구하지 않는다.
대신 합성 정상·실패·재개 경로에서 도구 호출 수, 응답 크기와 제거된 기계적 판단 항목을
기록한다. 모델 사용량이 제공되면 입력·출력·판단·캐시를 구분한다. 실제 측정 없이
절약률을 보장하거나 응답 바이트 감소를 전체 토큰 절약률로 환산하지 않는다.

최종 완료에는 다음 조건을 모두 요구한다.

- 신규 생성의 상태 원본은 단일 DB이며 제거 대상 JSON/JSONL의 writer·reader가 없다.
- 모든 생성 진입점이 자동 DB 초기화와 같은 version allocator를 사용한다.
- 상태·결과·이벤트의 트랜잭션과 파일 게시의 재개 프로토콜이 실제 중단 시험을 통과한다.
- next/input이 기계적 상태 판단과 입력 조합을 대신하고 기존 입력 격리를 보존한다.
- 새 컨텍스트가 DB 조회와 필요한 외부 생존 확인만으로 미완료 작업을 계속할 수 있다.
- 등록·완료의 원자성, 중복 호출·늦은 결과 차단과 총 시도 예산이 검증된다.
- 구형 아티팩트 import·자동 삭제·fallback이 없고 DB 없는 구형 실행을 명확히 거부한다.
- 기존 스킬·명세·테스트와 폐기 파일 경로 계약이 정리되고 독립 테스트 리뷰가 승인한다.
- 실제 모델 생성 품질·비용을 시험하지 않았다면 그 한계를 완료 보고에 명시한다.

## 14. 구현 결과와 검증 기록

단일 DB 저장 계층, 읽기·쓰기 CLI, 기존 차트·해석·편집·선택·GDD adapter와 스킬을 연결했다.
상태·근거·편집 제출·지문의 JSON/JSONL backend와 TODO renderer를 제거했고 Git 기준선
설정과 순수 validator는 유지했다. 실행 간 지문 비교는 snapshot과 도구 계산을 사용한다.

구현·테스트 작성·읽기 전용 리뷰를 분리했다. 독립 리뷰에서 발견한 동시 배정, 선행 조건,
입력 격리, 변조·게시·등록 원자성, 재선정 이력, 새 컨텍스트의 claim 회수 시험을 보강하고
수정본을 재검토했다. 최종 고정본의 `bun run test`는 29개 파일에서 220개 통과·실패 0개,
8,099개 assertion을 확인했다. 별도 프로세스 경합, SIGKILL 뒤 재접속과 DB trigger를 이용한
두 번째 지문 insert 실패를 포함한다. 전체 검사는 고정 후 한 번 실행했다.

문서 검사 오류 0개, 기존 검토 후보 10개는 버전 정책·가상 예제·과거 문제 설명으로 유지했다.
변경한 스킬 8개의 quick_validate와 `git diff --check`도 통과했다. 실제 모델 생성의 품질·비용과
모든 OS 장애를 이 자동 테스트가 증명한다고 주장하지 않는다. 개인 입력과 생성 본문은
커밋된 fixture나 이 기록에 포함하지 않는다.
