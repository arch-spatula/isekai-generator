# 생성 아티팩트 버전 및 기준선 관리 명세

> 상태: 구현 완료 (v0.2 채택 결정은 별도 ADR 참조)
> 작성일: 2026-11-04
> 근거 결정: [생성 아티팩트 버전을 기준선과 실행 이력으로 구분](../ADR/2026-11-04-artifact-generation-versioning.md)
> 범위: `artifacts/vX.Y.Z` 생성 실행의 series 승격, patch 예약, 실행 상태와 계보 기록

## SQLite 전환 적용

> 신규 생성은 아래 SQLite 전환 계약을 사용한다. 구형 아티팩트는 소급 변환하지 않는다.

신규 실행의 예약·상태·카운터·이벤트는 단일 `artifacts/state.sqlite`를 사용한다.
`.agents/artifact-series.json`은 Git 기준선 설정으로 유지한다. 구형 폴더는 이름만 확인하여
번호 충돌을 피하고 내용 import는 하지 않는다. 아래 manifest 파일 생성·갱신 설명은 전환 전
구현 기록이며 신규 실행 계약이 아니다.

상세 계약은 [SQLite 상태 관리·작업 재개 명세](sqlite-artifact-state.md)를 따른다.

## 1. 목적과 성공 조건

생성 파이프라인의 채택된 품질 기준은 minor로, 각 생성 시도는 patch로 식별한다. 자동
실행이 minor를 변경하지 않게 하고 실패한 시도까지 고유 번호로 남긴다.

구현 완료 조건은 다음과 같다.

- 일반 생성은 저장소에 기록된 활성 minor 안에서만 다음 patch를 예약한다.
- 성공, 실패, 취소와 비정상 종료 후에도 한 번 예약한 버전을 재사용하지 않는다.
- minor는 별도 승격 동작으로만 바뀌며 기존 아티팩트는 변경되지 않는다.
- 모든 새 실행에서 기준선, source revision, 생성 종류, 목적과 상태를 추적할 수 있다.
- 차트 단독 생성과 전체 GDD 생성이 같은 번호를 중복 예약하지 않는다.
- 문서 `schema-version` 변경과 아티팩트 버전 변경이 독립적이다.

## 2. 범위

### 2.1 포함

- 활성 artifact series 설정
- 명시적인 minor 승격 명령과 검증
- 공용 patch 예약기와 실행 manifest
- 차트 보고서 및 개인화 GDD 리졸버의 공용 예약기 사용
- 실행 성공·실패·취소 상태 갱신
- 단위 테스트와 임시 저장소 기반 통합 테스트
- 관련 스킬과 파이프라인 문서 갱신

### 2.2 제외

- 기존 `v0.1.x` 디렉터리의 재번호 부여 또는 소급 manifest 생성
- 생성 결과의 재미와 품질을 자동으로 판정하는 점수 시스템
- `v1.0.0` 승격 정책
- 게임 출시 버전, 패키지 버전과 문서 스키마 버전 변경
- 원격 또는 분산 실행을 위한 락 서비스
- 바다·군도 세계관 수렴 자체의 수정

## 3. 용어와 버전 규칙

| 용어 | 의미 |
| --- | --- |
| series | `MAJOR.MINOR`로 표현한 채택 기준선. 초기 구현에서는 `0.N`만 허용한다. |
| run | 차트 단독 또는 전체 GDD 생성 시도 한 번 |
| artifact version | run에 할당한 `vMAJOR.MINOR.PATCH` |
| promotion | 검증된 새 기준선을 활성 series로 명시적으로 채택하는 동작 |
| source revision | 해당 run의 생성 코드·프롬프트를 식별하는 Git commit |

patch는 활성 series마다 `0`부터 단조 증가한다. 번호는 정렬 이상의 의미를 갖지 않으며
성공 여부, mode 또는 생성 종류를 나타내지 않는다.

## 4. 저장 계약

### 4.1 활성 series 설정

저장소에서 추적하는 설정 파일 하나를 활성 series의 단일 기준으로 둔다.

```text
.agents/artifact-series.json
```

초기 스키마는 다음과 같다.

```json
{
  "schemaVersion": 1,
  "activeSeries": "0.1",
  "baselineRevision": "<40-character-git-commit>",
  "promotedAt": "2026-11-04T00:00:00.000Z",
  "decision": "docs/ADR/2026-11-04-artifact-generation-versioning.md",
  "knownIssues": [
    "docs/incidents/2026-11-04-maritime-world-setting-convergence.md"
  ]
}
```

- `schemaVersion`은 정수 `1`이다.
- `activeSeries`는 `0.N` 형식이다.
- `baselineRevision`은 승격 대상으로 검증한 Git commit의 전체 hash다.
- `promotedAt`은 UTC ISO 8601 시각이다.
- `decision`은 승격 근거 ADR 또는 승인 문서의 저장소 상대 경로다.
- `knownIssues`는 승격 시점에 남은 incident 문서 경로 배열이며 없으면 빈 배열이다.

현재 `v0.1`은 과거에 정식 기준선 메타데이터 없이 시작되었으므로 최초 도입 시
`baselineRevision`에는 최초 설정 작성 당시 HEAD를 기록하고, `knownIssues`에 해양 문법
수렴 incident를 남긴다. 자기 commit의 hash를 같은 commit 안에 기록할 수 없으므로
이 기능을 도입한 commit을 기준선으로 삼으려면 구현 commit 이후 별도 설정 commit으로
갱신한다. 이는 과거 v0.1 실행의 소급 계보를 주장하지 않는다.

### 4.2 실행 디렉터리와 manifest

patch 예약은 다음과 같은 디렉터리와 manifest를 먼저 만든다. 아래 버전은 가상 예시다.

```text
artifacts/v0.1.28/
└── artifact-run.json
```

manifest 스키마는 다음과 같다. 아래 실행 번호·revision·시각은 형식 설명용 가상 값이며
실제 로컬 아티팩트에 대한 근거 참조가 아니다.

```json
{
  "schemaVersion": 1,
  "artifactVersion": "v0.1.28",
  "series": "0.1",
  "artifactKind": "personalized-gdd",
  "purpose": "experiment",
  "mode": "deep",
  "baselineRevision": "<40-character-git-commit>",
  "sourceRevision": "<40-character-git-commit>",
  "workingTreeDirty": true,
  "status": "allocated",
  "allocatedAt": "2026-11-04T00:00:00.000Z",
  "startedAt": null,
  "finishedAt": null,
  "failure": null
}
```

허용 값은 다음과 같다.

- `artifactKind`: `chart-report`, `personalized-gdd`
- `purpose`: `experiment`, `regression`, `new-profile`, `incident-reproduction`,
  `release-candidate`
- `mode`: `light`, `deep`
- `status`: `allocated`, `running`, `succeeded`, `failed`, `cancelled`

`failure`은 실패 단계와 짧은 오류 요약만 담고 원시 출생정보나 생성 본문을 담지 않는다.
`sourceRevision`이 `baselineRevision`과 다르면 commit된 실험 변경이 있는 run임을 알 수
있다. `workingTreeDirty`가 `true`인 실행은 commit되지 않은 변경도 사용했음을 뜻하므로
해당 commit만으로 완전히 재현할 수 없다고 간주한다. 실험 실행은 허용하되
`release-candidate` 목적은 clean working tree에서만 허용한다.

## 5. Patch 예약

공용 예약기는 다음 순서로 동작한다.

1. series 설정을 읽고 스키마와 `activeSeries`를 검증한다.
2. 현재 HEAD와 working tree 상태를 읽고 `baselineRevision`이 존재하는 commit인지
   확인한다.
3. `artifacts/v<activeSeries>.*` 디렉터리만 읽어 가장 큰 patch를 찾는다.
4. 디렉터리가 없으면 patch `0`, 있으면 가장 큰 patch에 `1`을 더한다.
5. 대상 버전 디렉터리를 원자적으로 생성한다.
6. 동시 생성으로 이미 존재하면 다시 조회하여 다음 번호로 재시도한다.
7. `artifact-run.json`을 `allocated` 상태로 기록하고 출력 경로를 반환한다.

다른 minor의 더 큰 버전은 다음 patch 계산에 사용하지 않는다. 이름이 버전 형식과 맞지
않는 디렉터리와 `artifacts/registries`는 무시한다.

예약기는 차트와 GDD에 공통으로 하나만 둔다. 두 기존 리졸버가 각자 디렉터리를 검색하는
중복 구현을 유지하지 않는다. 다중 호스트와 네트워크 파일시스템의 원자성은 범위 밖이며,
로컬 파일시스템의 디렉터리 생성 충돌만 처리한다.

## 6. 실행 상태 전이

허용 상태 전이는 다음과 같다.

```text
allocated → running → succeeded
                    ├→ failed
                    └→ cancelled
allocated ──────────├→ failed
                    └→ cancelled
```

- 실제 계산 전에 `running`과 `startedAt`을 기록한다.
- 모든 필수 산출물과 validator가 성공한 뒤에만 `succeeded`로 바꾼다.
- 포착한 오류는 `failed`, 사용자 취소는 `cancelled`로 기록한다.
- 종료 상태에는 `finishedAt`이 반드시 있다.
- 비정상 종료로 `allocated` 또는 `running`이 남아도 자동으로 성공·실패를 추측하지 않는다.
- 어떤 상태에서도 디렉터리를 지우거나 같은 버전을 새 run에 재할당하지 않는다.

manifest 갱신은 같은 디렉터리에 임시 파일을 완성한 뒤 rename한다. 상태 갱신 실패 시
원래 manifest를 보존한다.

## 7. 명시적 minor 승격

승격 도구의 인터페이스는 다음으로 고정한다.

```text
bun promote-artifact-series.ts \
  <repository-root> \
  <next-series> \
  <decision-path> \
  [known-issue-path ...]
```

도구는 다음 조건을 모두 검증한다.

- `next-series`가 현재와 같은 major이고 minor가 정확히 1 크다.
- working tree가 깨끗하다.
- `decision-path`와 모든 known issue 경로가 저장소 안의 기존 파일이다.
- 현재 HEAD를 `baselineRevision`으로 기록할 수 있다.
- 대상 series의 아티팩트 디렉터리가 아직 없다.

승격은 설정 파일만 갱신하며 실행을 자동 시작하지 않는다. 변경된 설정을 commit한 뒤
별도의 `release-candidate` 또는 `regression` run으로 `.0`을 생성한다. 승격 설정 commit은
기준선 코드 자체를 바꾸지 않으므로 `baselineRevision`은 승격 직전 검증을 마친 HEAD를
가리킨다.

일반 생성 명령의 명시적 `--version` 생성 기능은 제거한다. 이미 예약된 실행을 재개하는
기능이 필요해지면 별도 명령으로 설계하며, 임의 버전 지정으로 promotion과 예약 절차를
우회하지 않는다.

## 8. 기존 스킬 변경

### 8.1 `generate-chart-report`

- `resolve-chart-output.ts`의 독립 버전 계산을 공용 예약기 호출로 교체한다.
- 독립 실행일 때 `artifactKind: chart-report`로 예약한다.
- 계산과 validator의 성공·실패에 따라 manifest 상태를 갱신한다.
- 전체 GDD 실행의 하위 단계일 때는 새 버전을 예약하지 않고 오케스트레이터가 예약한
  디렉터리를 사용한다.

### 8.2 `generate-personalized-gdd`

- 파이프라인 시작 시 `artifactKind: personalized-gdd`로 한 번만 예약한다.
- 하위 스킬은 전달받은 같은 버전 디렉터리에 쓴다.
- 마지막 GDD validator와 지문 등록까지 성공한 뒤 `succeeded`로 기록한다.
- 단계 오류와 사용자 취소 시 종료 상태를 기록한다.

목적을 지정하지 않으면 `experiment`, mode를 지정하지 않으면 기존 기본 mode를 사용한다.
완료 응답에는 기존 산출물 경로와 함께 artifact version, purpose와 최종 상태를 포함한다.

## 9. v0.2 승격 관문

2026-11-05 소유자의 전환 의사에 따라 [0.2 채택 결정](../ADR/2026-11-05-adopt-artifact-series-0.2.md)에서
최초 승격의 예외를 승인했다. 아래 원래 관문 중 대표 입력군 회귀 비교는 후속 작업으로
남기고 known issue를 유지한다. 이후 minor의 일반 승격 조건은 바꾸지 않는다.

첫 `v0.2` 승격에는 ADR의 공통 조건과 함께 다음을 요구한다.

1. 전투 원형 선택 기능과 validator가 현재 전체 테스트를 통과한다.
2. 해양 세계관 수렴 incident의 완화 설계가 ADR/spec으로 채택되고 구현된다.
3. 서로 다른 대표 입력군으로 회귀 생성하여 세계 구조 후보가 실제로 비교되는지 확인한다.
4. 전투 지문과 세계 구조 검증에서 중대한 회귀가 없음을 기록한다.
5. 알려진 한계와 비교 결과를 승격 근거 문서에서 연결한다.

원래 정책은 위 조건 충족 전 승격을 금지했으며, 이번 최초 승격에는 위 ADR의 예외를 적용한다.

## 10. 오류 처리

- 설정 누락·스키마 오류·잘못된 series는 예약 전에 실패한다.
- `release-candidate`의 dirty working tree는 예약 전에 실패하므로 patch를 소비하지 않는다.
- 디렉터리 예약 뒤 발생한 오류는 patch를 소비하고 manifest에 남긴다.
- 종료 manifest 기록에 실패하면 원래 생성 오류와 manifest 오류를 모두 보고한다.
- 기존 버전 디렉터리나 manifest를 덮어쓰지 않는다.
- manifest에는 민감한 입력과 생성 문서 본문을 기록하지 않는다.

## 11. 테스트 계획

### 11.1 공용 예약기 단위 테스트

- 빈 활성 series에서 `.0`을 예약한다.
- 같은 series의 최대 patch 다음 번호를 예약한다.
- 다른 minor와 비버전 디렉터리를 무시한다.
- 차트와 GDD 예약이 같은 번호를 얻지 않는다.
- 디렉터리 생성 충돌 뒤 다음 번호로 재시도한다.
- 잘못된 설정에서 디렉터리를 만들지 않는다.
- dirty 실험은 표시하여 예약하고 dirty release candidate는 예약 전에 거부한다.
- 임의 버전 지정으로 예약 절차를 우회할 수 없다.

### 11.2 Manifest 단위 테스트

- 필수 필드와 열거형을 검증한다.
- 허용 상태 전이만 수행한다.
- 성공·실패·취소에 종료 시각을 요구한다.
- 원자적 갱신 중 오류가 나도 기존 JSON이 유효하다.
- failure에 허용되지 않은 원시 입력 필드를 저장하지 않는다.

### 11.3 승격 단위 테스트

- 정확히 다음 minor와 유효한 문서 경로를 승인한다.
- minor 건너뛰기, major 변경과 기존 대상 series를 거부한다.
- dirty working tree에서 설정을 변경하지 않는다.
- 승격이 기존 아티팩트를 이동하거나 수정하지 않는다.
- 승격만으로 `.0` 실행이 생성되지 않는다.

### 11.4 통합 테스트

- 차트 단독 성공 run이 예약부터 `succeeded`까지 전이한다.
- 전체 GDD 실패 run의 번호와 실패 단계가 남고 다음 run은 다음 patch를 사용한다.
- 비정상 종료 상태의 디렉터리가 있어도 다음 run이 번호를 재사용하지 않는다.
- 승격 후 첫 run은 새 series의 `.0`이며 이전 series는 변경되지 않는다.
- 기존 차트·해석·concept brief·GDD validator가 계속 통과한다.

## 12. 구현 순서

1. series 설정 parser와 run manifest 타입·validator를 추가한다.
   - 검증: 설정 및 manifest 단위 테스트 통과
2. 공용 patch 예약기와 원자적 상태 갱신기를 구현한다.
   - 검증: 예약 충돌, 번호 비재사용과 상태 전이 테스트 통과
3. 두 output resolver를 공용 예약기로 교체하고 하위 단계의 이중 예약을 제거한다.
   - 검증: 차트 단독 및 전체 GDD 통합 테스트 통과
4. 명시적 minor 승격 도구를 구현한다.
   - 검증: 승격 단위 테스트와 기존 아티팩트 무변경 확인
5. 스킬 및 파이프라인 문서에 목적·상태·승격 절차를 반영한다.
   - 검증: 문서의 명령, 경로와 열거형이 구현과 일치
6. 전체 테스트를 실행한다.
   - 검증: `bun test ./scripts ./.agents` 성공
7. 해양 세계관 수렴 완화 작업과 대표 회귀 검증이 끝난 뒤 별도 승인으로 `v0.2`를
   승격하고 새 `.0`을 생성한다.
   - 검증: 승격 근거 문서, 설정 commit과 `v0.2.0` 확인 시도 manifest가 서로 연결되고,
     실패했다면 다음 patch의 성공 run까지 추적됨

## 13. 구현하지 않는 동안의 운영 규칙

아래는 버전 관리 도입 당시의 운영 규칙이다. 현재 구현은 완료됐으며 0.2 전환에는
[0.2 채택 결정](../ADR/2026-11-05-adopt-artifact-series-0.2.md)을 적용한다.

이 명세가 구현되기 전에는 기존 리졸버가 계속 `v0.1.x` patch를 증가시킨다. 사용자가
명시적 버전을 줄 수 있더라도 `v0.2.x`를 선점하지 않는다. 구현 완료와 별도의 승격 승인
전까지 `v0.2.0`은 예약된 의미만 가지며 실제 디렉터리로 만들지 않는다.

## 14. 구현 경로와 실행 명령

- 공용 예약기·manifest 검증·상태 전이: `scripts/artifacts/artifact-run.ts`
- 상태 갱신: `bun scripts/update-artifact-run.ts <run-directory> <running|succeeded|failed|cancelled> [failure-stage failure-summary]`
- minor 승격: `bun scripts/promote-artifact-series.ts <repository-root> <next-series> <decision-path> [known-issue-path ...]`
- 차트 예약: `bun .agents/skills/generate-chart-report/scripts/resolve-chart-output.ts <repository-root> [--purpose <purpose>] [--mode <mode>]`
- GDD 예약: `bun .agents/skills/generate-personalized-gdd/scripts/resolve-output.ts <repository-root> [--purpose <purpose>] [--mode <mode>]`

예약 시 루트 `TODO.md`도 생성하며 단계별 진행은
[생성 진행 기록 명세](artifact-progress-handoff.md)를 따른다. 이 파일은 상태·검증 결과와
중단 후 확인 순서를 전달하며 새로운 아티팩트나 하위 설계 입력으로 취급하지 않는다.
사용자의 명시적 minor 채택 의사는 승격 권한으로 처리한다. 예를 들어 0.3 전환은
[채택 결정](../ADR/2026-11-05-adopt-artifact-series-0.3.md)을 근거로 수행하며 같은 의사를 다시 묻지 않는다.

리졸버는 예약된 출력 경로를 stdout으로 반환하며 기존 positional version과 `--version`을
거부한다. 상태 갱신은 동일 실행의 소유자 한 명이 수행한다. GDD 실행의 소유자는
오케스트레이터이고 차트 단독 실행의 소유자는 runner다. 상태 갱신 도구는 생성물 검증을
대신하지 않으며 소유자가 모든 필수 검증을 마친 후 성공을 기록한다.
