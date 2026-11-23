# SQLite 상태 저장소 제거와 파일 기반 진행 상태

> 상태: 결정 반영 — 구현 전
> 작성일: 2026-11-23
> 결정: [실행 상태 저장소를 없애고 진행 상태를 버전 폴더의 파일에서 계산한다](../ADR/2026-11-21-drop-sqlite-file-derived-progress.md)
> 대체 대상: [SQLite 상태 관리·작업 재개 명세](sqlite-artifact-state.md)(폐기됨)

## 1. 목표와 성공 조건

개인화 GDD 생성 파이프라인에서 SQLite 상태 저장소와 그 CLI를 제거한다. 에이전트가 어디까지 작업했고 어디서
이어 가야 하는지는 버전 폴더 안의 파일과 기존 검증기로 계산한다.

성공 조건:

1. 저장소 어디에서도 `bun:sqlite`를 import하지 않는다. 생성 실행이 `artifacts/state.sqlite`나 다른 DB 파일을 만들지 않는다.
2. 읽기 전용 상태 명령 하나가 버전 폴더만 보고 단계별 상태와 다음 행동을 돌려준다. 대화 기록, TODO, DB가 필요 없다.
3. 토큰이 떨어져 단계 도중에 끊겨도, 상태 명령이 같은 버전 폴더에서 정확한 재개 지점을 돌려준다.
4. 기존 단계 순서, 체계별 입력 격리, 재시도 한도, 방어 편집 필수 조건, 전투·세계 지문 비교를 유지한다.
5. SQLite 전환 전의 JSON/JSONL 상태 파일(실행 manifest, 이벤트 로그, 단계 checkpoint, 시도별 input·result·accepted JSON)을
   되살리지 않는다.
6. 필수 검증은 커밋된 합성 버전 폴더로 하며 모델을 호출하지 않는다.

## 2. 현재 책임과 대체 방식

`scripts/artifacts/artifact-state-store.ts`가 맡은 책임을 하나씩 대응시킨다.

| 현재 책임 (SQLite) | 대체 방식 |
| --- | --- |
| 버전 예약(`series_counters`, `allocate`) | 활성 series의 버전 폴더를 배타적으로 생성한다. 이미 있으면 다음 번호. `scripts/allocate-artifact-path.ts`의 방식을 공용으로 쓴다 |
| 실행 설정 snapshot(`runs.config`) | 할당 시 버전 폴더 루트에 한 번 쓰고 수정하지 않는 `run.md` (8절) |
| 단계 DAG·상태(`stages`, `next`, `summary`) | 코드 한 곳의 단계표 + 상태 명령의 계산 (3·4절) |
| 시도 번호·예산·scope(`attempts`) | `garbage/<stage>/<kind>-<n>/` 시도 폴더의 수와 그 안의 결과 파일 (5절) |
| 검증 결과(`validations`) | 저장하지 않는다. 상태 명령이 매번 기존 순수 검증기를 다시 실행한다 |
| 게시·게시 복구(`documents`, `publish`, `reconcile`) | 검증한 후보를 임시 파일에 쓴 뒤 rename으로 정식 경로에 둔다. 끊기면 상태 명령이 `publish`를 다시 안내한다 (6절) |
| 차트 근거(`evidence`) | 저장하지 않는다. `chart-report.md`에서 `buildEvidenceManifest`로 매번 다시 계산한다 |
| 입력 allowlist(`input`) | 단계표에 단계별 허용 입력 경로를 두고 상태 명령이 계산해 돌려준다 |
| 전투·세계 지문(`fingerprints`, `registry`, `finalize`) | 다른 버전 폴더에 게시된 브리프에서 `parseFinalFingerprint`·`parseWorldBrief`로 읽는다 (7절) |
| 이벤트 로그(`events`) | 두지 않는다. 시도 폴더의 결과 파일이 실패 이력이다 |
| 멱등 요청(`operations`, `--request`) | 두지 않는다. 각 쓰기 동작이 파일 존재로 멱등하다 |
| claim·worker 결합(`dispatch`, `bind-worker`, `resume`) | 두지 않는다. 외부 에이전트 생존 확인은 오케스트레이터가 실제 에이전트 상태를 조회해 판단한다 |
| run terminal 상태(`cancel`, `fail`, `succeeded`) | 두지 않는다. 완료는 마지막 단계의 검증 통과로, 실패는 예산 소진으로 계산한다. 중단은 사용자가 더 진행하지 않는 것이다 |
| 재선정 revision(`revisions/<attempt-id>/`) | 제거한다. 재선정이 필요하면 새 run (11절) |
| 검증기 revision 불일치 차단 | 두지 않는다. 검증은 항상 현재 코드로 다시 실행한다 |

## 3. 단계표

단계표는 코드 한 곳(예: `scripts/artifacts/pipeline-steps.ts`)에 둔다. 상태 명령, 게시 도구, 스킬 안내가 모두 이 정의를 쓴다.

| 필드 | 뜻 |
| --- | --- |
| `id` | 단계 ID. 현재 DAG와 같다: `chart-report`, `saju`, `ziwei`, `natal`, `integration`, `selection`, `world-selection`, `gdd` |
| `needs` | 선행 단계 ID 목록 |
| `output` | 버전 폴더 기준 정식 경로. [책임별 폴더 계약](artifact-directory-layout.md)을 따른다 |
| `inputs` | 이 단계가 읽어도 되는 경로(allowlist). 체계별 격리를 여기서 표현한다 |
| `check` | 완료 판정 함수. 기존 순수 검증기(`diagnoseSystemInterpretation`, `isValidInterpretation`, `validateConceptBrief`, `validateWorldBrief`, `isValidGdd` 등)를 감싼다 |
| `attempts` | 시도 종류별 한도. 전문 해석 생성·수정 합계 3, 방어 편집 3, 그 밖의 단계 2 (현재 한도와 같음) |
| `requiresEdit` | 게시 전에 방어 편집 통과가 필요한지. 세 체계와 통합은 `true` |
| `action` | 비어 있을 때 실행할 스킬 이름 |

`gdd` 단계의 `check`가 통과하면 그 run은 완료다. 별도 `final-validation`·`fingerprint-registration` 단계를 두지 않는다.

## 4. 상태 명령

```text
bun scripts/artifact-status.ts <version-dir>
```

읽기 전용이다. 파일을 만들거나 고치지 않는다. 단계표 순서대로 단계마다 하나의 상태를 계산한다.

| 상태 | 조건 | 다음 행동 |
| --- | --- | --- |
| `done` | 정식 파일이 있고 `check` 통과. `requiresEdit` 단계는 통과한 편집 시도의 후보와 정식 파일의 내용이 같음 | 없음 |
| `publish` | 정식 파일은 없지만 검증·편집을 통과한 후보가 시도 폴더에 있음 | 게시 도구 실행 |
| `repair` | 정식 파일이 있으나 `check` 실패 | 같은 파일을 고쳐 검증 통과 |
| `edit` | 생성 후보는 검증을 통과했으나 필요한 방어 편집이 아직 통과하지 않음 | 다음 편집 시도 (scope 포함) |
| `ready` | 선행 단계가 모두 `done`이고 시도 한도가 남음 | `action` 스킬 실행, 시도 번호·출력 경로·입력 allowlist 포함 |
| `exhausted` | 시도 한도를 모두 썼는데 `done`이 아님 | 사용자 판단 필요 |
| `wait` | 선행 단계가 끝나지 않음 | 없음 |
| `input` | `chart-report`가 없음 | 출생 입력 요청 (출생 정보는 파일에 남기지 않는다) |

출력은 stdout JSON 한 개다. 단계별 상태, 사용한 시도 수, 실행 가능한 행동 목록을 담는다. 서로 기다리지 않는 세 체계는
`ready`가 동시에 여러 개 나올 수 있다. 이 JSON은 저장하지 않는 명령 응답이다.

## 5. 시도 폴더

```text
artifacts/<version>/garbage/<stage>/<kind>-<n>/
├── candidate.md     # 모델이 쓴 후보 (생성) 또는 편집을 적용한 후보 (편집)
└── result.md        # 도구가 쓰는 결과: 상태, 진단, 편집 scope
```

- `<kind>`는 `generate`·`repair`·`edit`, `<n>`은 1부터의 번호다. 시도 번호는 `mkdir`의 배타적 생성으로 확정한다.
  이미 있으면 다음 번호로 넘어간다. 같은 run 안에서 세 체계를 병렬로 진행해도 서로 다른 폴더를 쓰므로 잠금이 필요 없다.
- 사용한 시도 수는 해당 단계·종류의 폴더 수다. 폴더를 지우거나 번호를 다시 쓰지 않는다.
- `result.md`는 `키: 값` 줄로 쓴다. 필수 키는 `상태`(`passed`, `validation-failed`, `editing-failed`, `execution-failed` 등 현재
  종류별 결과 값)와 `scope`(편집만)다. 진단은 그 아래 목록으로 쓴다.
- `result.md`가 없는 시도 폴더는 끊긴 시도다. 후보가 있으면 상태 명령이 그 후보를 다시 검증하도록 안내한다.
  후보도 없으면 시도 하나를 쓴 것으로 센다(현재의 운영 중단 처리와 같음).
- 편집 scope는 앞선 편집 시도의 `result.md`에서 `editing-failed` 수를 세어 `sentence → item → system`으로 계산한다.
- 방어 편집 제안 원문은 보관하지 않는다. 통합 편집의 `result.md`에는 자동 진단마다 처리 결과(수정 또는 보존)와 보존 사유를 남긴다
  ([인시던트 보완](../incidents/2026-11-21-artifact-root-sqlite-design.md) 참고).
- 시도 폴더는 게임 개발 문서 탐색과 후속 단계 입력에서 제외한다(기존 `garbage/` 규칙).

## 6. 게시

```text
bun scripts/artifact-publish.ts <version-dir> <stage>
```

- 상태 명령이 `publish`로 판정한 단계만 게시한다. 통과한 후보를 정식 경로 옆 임시 파일에 쓰고 rename한다.
- 정식 파일이 이미 있으면 덮어쓰지 않는다. 같은 내용이면 성공, 다르면 실패를 돌려준다.
- 게시 도중 끊기면 정식 파일이 없거나 완전한 상태다. 상태 명령이 다시 `publish`를 안내하므로 별도 복구 절차가 없다.

## 7. 전투·세계 지문

- 선택 단계는 같은 series의 다른 버전 폴더 중 `gdd` 단계가 `done`인 run의 `design-rationale/gameplay-concept-brief.md`와
  `world-concept-brief.md`에서 지문을 읽는다. 비교 결과(근접 항목, 동률, challenger 필요 여부)는 지금처럼 스크립트가 계산한다.
- 다른 버전 폴더에는 쓰지 않는다. 동시에 진행 중인 run끼리는 서로 보지 못할 수 있다(ADR이 받아들인 한계).
- 지문 등록 단계가 없다. 게시된 브리프 자체가 다음 run의 비교 자료다.

## 8. 실행 설정 `run.md`

할당 때 버전 폴더 루트에 한 번 쓰고 수정하지 않는다.

```text
종류: personalized-gdd
모드: light
목적: experiment
series: 0.5
기준선 revision: <commit>
source revision: <commit>
dirty: 아니오
```

원시 출생 정보는 쓰지 않는다. `release-candidate`는 지금처럼 깨끗한 작업 트리에서만 할당한다.

`run.md`는 진행 상태가 아니라 실행을 시작할 때 받은 입력이다. 사용자가 고른 값이라 파일에서 계산할 수 없지만, 한 번 쓰고
다시 바꾸지 않는다. 새 컨텍스트가 이어 갈 때 모드(모델 선택)를 되찾고, 결과의 계보(어느 커밋에서 만들었는지)를 남기는 데 쓴다.
진행 판정에는 쓰지 않는다.

이 설계의 기록은 모두 한 번 만들고 고치지 않는다(`run.md`, 배타적으로 만든 시도 폴더와 그 안의 파일, rename으로 게시한 정식 문서).
같은 기록을 여러 작업자가 고쳐 쓰는 일이 없으므로 트랜잭션이나 DB가 필요 없다.

## 9. 제거와 변경 대상

| 대상 | 처리 |
| --- | --- |
| `scripts/artifacts/artifact-state-store.ts`, `scripts/artifact-state.ts`, `scripts/read-artifact-state.ts` | 삭제 |
| `scripts/artifacts/artifact-events.ts`, `artifact-progress.ts`, `scripts/update-artifact-progress.ts` | 삭제 |
| `scripts/artifacts/sqlite-*.test.ts`, `sqlite-test-fixtures.ts`, `scripts/fixtures/sqlite-crash-worker.ts`, `artifact-state.test.ts` | 삭제. 남길 동작은 새 합성 버전 폴더 테스트로 옮긴다 |
| `scripts/artifacts/artifact-run.ts` | 버전 할당·`run.md` 쓰기만 남기고 DB 호출 제거 |
| `scripts/artifacts/specialist-attempt.ts`, `defensive-edit.ts` | 시도 폴더·`result.md` 기반으로 변경. 순수 판정 로직은 재사용 |
| `.agents/skills/generate-chart-report/scripts/run-chart-report.ts` | DB 근거 저장 제거. 차트 게시만 |
| `.agents/skills/select-*/scripts/manage-*-registry.ts`, `fingerprint-registry.ts` | DB 조회를 다른 버전 폴더의 브리프 읽기로 교체 |
| `.agents/skills/`의 생성 스킬 8개 | `artifact-state.ts`·`read-artifact-state.ts` 호출을 상태 명령·게시 도구 호출로 교체. `registry-stale`·claim·request 안내 제거 |
| `docs/spec/sqlite-artifact-state.md` | 삭제. 이력은 Git과 두 Superseded ADR에 남는다 |
| 각 명세의 `SQLite 전환 적용` 절, 파이프라인 문서 | 파일 기반 진행 상태로 다시 쓴다 |

순수 검증기와 해석·선택·GDD 프롬프트는 바꾸지 않는다.

## 10. 구현 순서와 검증

1. **단계표와 상태 명령** — SQLite 코드와 나란히 추가하고 아직 아무도 호출하지 않는다.
   - 검증: 합성 버전 폴더로 `done · publish · repair · edit · ready · exhausted · wait · input`을 각각 만들고 기대 상태를
     확인한다. 기대값은 4절 표에서 직접 쓴다. 정식 파일을 반쯤 쓴 경우가 `repair`가 되는지 확인한다.
2. **시도 폴더·게시 도구**
   - 검증: 같은 단계의 병렬 시도가 서로 다른 번호를 받는다. 한도 초과 시 `exhausted`. 편집 scope 확대. 끊긴 시도 처리.
     게시가 덮어쓰지 않고, 같은 내용 재게시는 성공한다.
3. **지문 조회 교체**
   - 검증: 완료 run의 브리프만 비교 대상이 된다. 미완료 run은 제외된다. 다른 버전 폴더에 쓰지 않는다.
4. **스킬·호출자 전환**
   - 검증: 합성 전체 파이프라인을 상태 명령 안내만으로 끝까지 진행할 수 있다. 실행 중 DB 파일이 생기지 않는다.
5. **SQLite 코드·테스트·명세 삭제**
   - 검증: `git grep "bun:sqlite"` 결과 0건. `bun run test`, `bun run check:docs`, `git diff --check` 통과.

[테스트 작성 가이드](test-writing-guide.md)를 따른다. 상태 명령의 통과는 형식과 파일 일치만 확인하며 생성 품질을 증명하지 않는다.

## 11. 정한 결정

2026-11-23에 정했다. 남은 열린 질문은 없다.

- **방어 편집 제안 원문:** 보관하지 않는다. 결과 `candidate.md`·`result.md`만 남기고, 통합 편집은 진단별 처리와 보존 사유를 `result.md`에 쓴다(5절).
- **일생 해석 흐름:** 같은 단계표 모듈을 쓰되, 일생 해석 단계표와 폴더 배치 정리는 이 작업의 별도 서브 브랜치에서 진행한다.
- **재선정 revision:** 첫 구현에서 제거한다. 지금 revision은 `registry-stale`로 선택·세계·GDD가 막혔을 때만 생기는데, 그 검사가
  없어지므로 자동 재선정 경로도 없다. 사용자가 다른 선택을 원하면 새 run을 만든다. 버전 폴더 하나에 결정 하나만 두어
  "어느 파일이 현재 정식본인가"와 "의존 문서가 낡았는가"를 기록할 필요가 없게 한다.
- **`run.md` 형식:** `키: 값` Markdown으로 쓴다(8절). 판단·해석 문서와 같은 형식이고, SQLite 전의 JSON 실행 manifest와 혼동되지 않는다.
