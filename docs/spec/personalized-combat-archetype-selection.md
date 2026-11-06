# 개인화 전투 원형 선택 명세

> 상태: 구현 완료
> 작성일: 2026-11-04
> 근거 결정: [개인화 전투 원형을 후보 비교로 선택](../ADR/2026-11-03-personalized-combat-archetype-selection.md)
> 범위: `chart-interpretation.md`와 개인화 Action RPG GDD 사이의 전투 원형 후보 생성·선택·검증

## 1. 목적

통합 차트 해석에서 곧바로 하나의 GDD를 생성하지 않는다. 먼저 구조적으로 다른 전투
원형 후보를 최소 네 개 만들고, 해석 적합성·플레이 가능성·고유성을 비교하여 하나를
선택한다. 선택 과정은 `gameplay-concept-brief.md`에 남기며 최종 GDD는 선택된 전투
계약을 그대로 따라야 한다.

이 명세의 성공 조건은 다음과 같다.

- 후보마다 구조화된 전투 축과 유효한 통합 해석 ID가 있다.
- 최초 네 후보의 모든 쌍이 비교 축 중 최소 세 축에서 다르다.
- 과거 GDD 본문을 읽지 않고 선택 지문만으로 반복 수렴을 감지한다.
- 중복 가능성이 있는 선택은 추가 후보와 한 번 더 비교한다.
- 최종 GDD의 전투 계약이 선택 결과와 기계적으로 일치한다.

## 2. 범위

### 2.1 포함

- `select-gameplay-concept` 스킬과 생성 지침
- `gameplay-concept-brief.md` 계약과 validator
- 선택 지문 레지스트리의 조회와 등록
- `generate-personalized-gdd` 오케스트레이션 변경
- `generate-gdd-from-interpretation` 입력·프롬프트·validator 변경
- 단위 테스트와 파이프라인 회귀 테스트
- 파이프라인 문서 갱신

### 2.2 제외

- 기존 로컬 산출물 수정
- 차트 계산, 전문 해석, 통합 해석 방식 변경
- 특정 차트 요소와 직업·무기의 고정 대응표
- 자연어 임베딩 또는 외부 벡터 데이터베이스
- 과거 GDD 본문을 이용한 중복 비교
- UI와 Tauri 작업 큐 변경

## 3. 목표 파이프라인

```text
chart-interpretation.md
        │
        ▼
select-gameplay-concept
        ├── 읽기: chart-interpretation.md
        ├── 읽기: combat-concept-fingerprints.json
        └── 생성: gameplay-concept-brief.md
                         │
                         ▼
generate-gdd-from-interpretation
        ├── 읽기: chart-interpretation.md
        ├── 근거 확인: chart-report.md
        ├── 전투 계약: gameplay-concept-brief.md
        └── 생성: personalized-action-rpg-concept.md
                         │
                         ▼
최종 검증 성공 후 선택 지문을 레지스트리에 등록
```

`select-gameplay-concept`는 원시 출생정보, `chart-report.md`, 전문 해석, 과거 GDD를 받지
않는다. GDD 단계는 후보를 다시 고르지 않으며 선택된 후보만 전투 계약으로 사용한다.

## 4. 파일 배치

새 버전의 산출물은 다음과 같다.

```text
artifacts/vX.Y.Z/docs/GDD/
├── chart-report.md
├── chart-evidence.json
├── saju-interpretation.md
├── ziwei-interpretation.md
├── natal-interpretation.md
├── chart-interpretation.md
├── gameplay-concept-brief.md
└── personalized-action-rpg-concept.md
```

전역 레지스트리는 산출물 버전 디렉터리 밖에 둔다.

```text
artifacts/registries/combat-concept-fingerprints.json
```

구현 파일은 다음 위치를 사용한다.

```text
.agents/skills/select-gameplay-concept/
├── SKILL.md
├── agents/openai.yaml
├── references/selection-prompt.md
├── references/light-mode.md
├── references/deep-mode.md
└── scripts/
    ├── validate-concept-brief.ts
    ├── validate-concept-brief.test.ts
    ├── fingerprint-registry.ts
    ├── fingerprint-registry.test.ts
    └── manage-fingerprint-registry.ts
```

기존 `generate-personalized-gdd`와 `generate-gdd-from-interpretation` 스킬은 필요한 파일만
수정한다. 별도의 범용 스키마 프레임워크나 데이터베이스 계층은 만들지 않는다.

## 5. 전투 축 계약

후보와 최종 지문은 아래 일곱 축을 모두 가진다. 값은 표시 문구가 아니라 다음 영문
열거형을 그대로 저장한다.

| 축 | 허용 값 |
| --- | --- |
| `combatRange` | `close`, `mid`, `long` |
| `powerMedium` | `body`, `weapon`, `spell`, `summon`, `device`, `environment` |
| `initiative` | `direct`, `reactive`, `command`, `prepare`, `transform` |
| `spaceUse` | `pursuit`, `fortify`, `swap`, `expand`, `aerial` |
| `combatRhythm` | `pressure`, `build_release`, `cycle`, `prepare_execute`, `improvise` |
| `mastery` | `timing`, `aim`, `resource_combo`, `placement`, `command`, `form_shift` |
| `risk` | `health`, `overheat`, `focus_break`, `summon_loss`, `terrain_collapse` |

`primaryVerbs`는 위 축과 별도로 정확히 2개 또는 3개의 kebab-case 동사를 순서 있는
배열로 기록한다. 예: `['mark', 'redirect', 'detonate']`. 동사는 후보 설명과 최종 GDD의
핵심 루프를 구체화하지만 후보 간 최소 거리와 레지스트리 유사도 계산에는 사용하지
않는다. 자유 문자열을 구조 비교에 사용하면 동의어만 바꾸어 검증을 통과할 수 있기
때문이다.

## 6. `gameplay-concept-brief.md` 계약

파일은 UTF-8 Markdown이다. 사람이 후보와 선택 근거를 읽을 수 있어야 하며, validator가
결정적으로 파싱할 수 있도록 제목 순서와 필드 이름을 다음 형식으로 고정한다.

아래 버전과 레지스트리 값은 형식 설명용 가상 예시이며 실제 로컬 실행을 가리키지 않는다.

```markdown
# Gameplay Concept Brief

- schema-version: 1

## Interpretation Traits

### Trait T-01

- axis: combatRange
- value: long
- evidence: I-01, I-04
- counter-evidence: 즉각적인 대면 행동을 지지하는 항목도 있다.
- confidence: 0.8

## Candidates

### Candidate C-01

- name: 궤도 편향술사
- player-fantasy: 날아오는 힘의 궤도를 읽고 되돌리는 원거리 술사
- primary-verbs: mark, redirect, detonate
- core-loop: 표식을 남기고 궤도를 바꾼 뒤 교차점에서 폭발시킨다.
- growth-path: 단일 탄도 편향에서 전장 전체의 궤도 중첩으로 성장한다.
- weakness: 집중이 끊기면 준비한 궤도가 무너진다.
- evidence: I-01, I-04

#### Axes

- combatRange: long
- powerMedium: spell
- initiative: reactive
- spaceUse: swap
- combatRhythm: cycle
- mastery: aim
- risk: focus_break

#### Scores

- interpretationFit: 5 | 해석의 핵심 긴장을 반응과 반전으로 구현한다.
- distinctiveness: 4 | 고유 항목의 조합을 사용한다.
- actionability: 5 | 조준과 위치 교환으로 직접 조작할 수 있다.
- progression: 4 | 같은 힘의 계통으로 규모가 확장된다.
- nonMonopoly: 4 | 하나의 은유가 전체 시스템을 점령하지 않는다.
- genreIndependence: 5 | 차트 용어 없이도 전투 판타지가 성립한다.
- candidateDistance: 4 | 다른 후보와 구조적으로 구별된다.

## Selection

- initial-selected: C-01
- selected: C-01
- reason: 해석 적합성과 액션성이 가장 높다.

### Rejected C-02

- reason: C-01보다 성장 경로가 좁고 고유 항목 활용이 약하다.

## Registry Review

- threshold: 5
- compared-entries: 2
- challenger-required: false
- challenger-candidate: none
- similarity-justification: none

### Initial Closest Match v0.9.2 C-01

- equal-axes: 3
- similar: false

### Final Closest Match v0.9.2 C-01

- equal-axes: 3
- similar: false

## Final Fingerprint

- combatRange: long
- powerMedium: spell
- initiative: reactive
- spaceUse: swap
- combatRhythm: cycle
- mastery: aim
- risk: focus_break
```

반복 가능한 블록의 ID는 순차적이어야 한다. 성향은 `T-01`부터, 후보는 `C-01`부터
시작한다. 탈락 비교 제목은 `### Rejected C-NN`, 레지스트리 비교 제목은
`### Initial Closest Match <version> <candidate-id>` 또는
`### Final Closest Match <version> <candidate-id>`를 사용한다. 해당 목록이 비어 있으면
하위 제목을 만들지 않는다.

필드 값의 `none`은 JSON의 null에 해당하는 예약어이며 자유 문장에 사용하지 않는다.
문장 필드는 공백이 아닌 값이어야 한다. `confidence`는 `0` 이상 `1` 이하, 각 점수의
`|` 앞 정수는 `1` 이상 `5` 이하다. 점수 근거는 같은 줄의 `|` 뒤에 기록한다.
`evidence`는 쉼표로 구분한 통합 해석 ID만 허용한다. ID의 실제 허용 범위는 정규식만으로
판단하지 않고 입력 `chart-interpretation.md`의 `### I-NN` 제목에서 읽는다.

Markdown 표현의 자유는 문장 값에만 허용한다. 제목 수준, 필드 이름, 축·점수 순서와
예약어는 바꾸지 않는다. 표, YAML front matter와 기계 계약을 복제한 JSON 코드 블록은
사용하지 않는다.

## 7. 후보 생성 규칙

### 7.1 성향 추출

모델은 후보를 만들기 전에 일곱 축 각각에 대해 하나 이상의 `interpretationTraits` 항목을
기록한다. 모든 항목은 유효한 해석 ID, 반대 근거 또는 한계, 확신도를 포함한다.

해석 속 직업·문서·계약·업무 도구 같은 표면 명사는 전투 요소로 직접 치환하지 않는다.
모델은 그 아래의 동기, 갈등, 행동 패턴, 성장 조건을 추출한다.

### 7.2 최초 후보군

최초 후보는 정확히 네 개(`C-01`~`C-04`)를 생성한다. 각 후보는 다음 조건을 만족한다.

- 일곱 축과 2~3개의 주 공격 동사가 모두 있다.
- 하나 이상의 유효한 통합 해석 ID를 인용한다.
- 초기 핵심 루프, 같은 힘 계통 안의 성장 경로, 명시적인 약점이 있다.
- 이름이나 무기 외형이 아니라 조작과 적 대응으로 구별된다.

최초 네 후보의 모든 쌍은 일곱 축 중 최소 세 축에서 값이 달라야 한다. validator는 두
후보의 같은 키를 직접 비교해 이 조건을 검사한다.

### 7.3 평가와 선택

모델은 ADR의 일곱 선택 기준을 각각 1~5점으로 평가하고 기준별 근거를 기록한다. 총점은
일곱 점수의 단순 합이다. `selectedCandidateId`는 총점이 가장 높은 후보여야 한다. 동점이면
`interpretationFit`, `actionability`, `distinctiveness` 순서로 비교하고, 그래도 같으면 낮은
후보 ID를 선택한다.

`initialSelectedCandidateId`는 항상 `C-01`~`C-04`에 같은 정렬 규칙을 적용한 결과다.
중복 재검토가 없으면 `selectedCandidateId`와 같다. `C-05`가 추가되더라도 최초 네 후보의
점수와 근거는 다시 쓰지 않으며, `selectedCandidateId`만 다섯 후보 전체에 같은 규칙을
적용해 다시 계산한다. 이 제약으로 validator가 최초 선택과 재검토 결과를 재현할 수 있다.

`rejectedComparisons`는 선택되지 않은 모든 후보를 정확히 한 번 포함하며 선택 후보와
비교한 탈락 이유를 기록한다. 선택 후보에도 `weakness`가 있어야 한다.

점수와 근거의 의미적 타당성은 모델이 담당한다. validator는 범위, 합산 결과, 동점 규칙,
필드 존재만 검사한다.

## 8. 중복 감지와 추가 비교

### 8.1 유사도

두 지문의 유사도는 일곱 축에서 값이 같은 축의 개수 `equalAxes`다.

```text
equalAxes = count(left[axis] === right[axis] for each of 7 axes)
similar = equalAxes >= 5
```

이 계산은 가중치, 자연어 비교, `primaryVerbs`를 사용하지 않는다. 임계값은 스키마 버전
1에서 `5`로 고정한다.

### 8.2 재검토

최초 선택 후보가 레지스트리의 한 항목 이상과 유사하면 다음 절차를 한 번만 수행한다.

1. `challengerRequired`를 `true`로 기록한다.
2. `C-05` 후보를 하나 추가한다.
3. `C-05`는 최초 선택 후보와 최소 세 축, 가장 가까운 과거 지문과 최소 세 축이 달라야
   한다.
4. `C-05`를 같은 기준으로 평가하고 다섯 후보 전체에서 최종 선택을 다시 계산한다.
5. 최종 선택도 과거 지문과 유사하면 `similarityJustification`에 해석 적합성을 우선한
   이유와 실제 플레이 차이를 기록한다.

유사 항목이 없으면 후보는 정확히 네 개이고 `challengerRequired`는 `false`,
`challengerCandidateId`와 `similarityJustification`은 `null`이다. 유사 항목이 있으면 후보는
정확히 다섯 개이고 challenger ID는 `C-05`다. 추가 비교는 반복하지 않는다.

`initialClosestMatches`는 초기 선택 지문과 비교해 `equalAxes`가 가장 큰 레지스트리 항목을
모두 담고, `finalClosestMatches`는 최종 선택 지문에 같은 계산을 적용한다. 레지스트리가
비어 있으면 두 배열도 비어 있다. 이 배열은 유사 항목만 거르는 목록이 아니라 최대값에
공동으로 해당하는 항목 전체다.

## 9. 지문 레지스트리

### 9.1 파일 계약

레지스트리의 초기값과 항목 계약은 다음과 같다.

```json
{
  "schemaVersion": 1,
  "entries": []
}
```

```ts
type RegistryEntry = {
  version: string
  candidateId: string
  fingerprint: Axes
}
```

버전은 `vX.Y.Z` 형식이고 중복될 수 없다. 이름, 설명, 해석 ID, 출생정보, GDD 본문은
저장하지 않는다.

### 9.2 읽기와 쓰기 시점

- 레지스트리가 없으면 빈 레지스트리로 취급한다.
- 선택 단계는 레지스트리를 읽기만 한다.
- GDD와 모든 최종 validator가 성공한 뒤 오케스트레이터가 선택 지문을 한 번 등록한다.
- 실패하거나 취소된 생성은 등록하지 않는다.
- 등록은 같은 디렉터리의 임시 파일에 완성된 JSON을 쓴 뒤 rename하여 교체한다.
- 이미 같은 버전이 있으면 덮어쓰지 않고 실패한다.

레지스트리 쓰기는 생성 결과에 영향을 주는 마지막 부수 효과다. 구현 1차 범위는 한
프로세스에서 순차 생성하는 현재 CLI 사용을 전제로 하며 다중 프로세스 잠금은 추가하지
않는다.

## 10. GDD 계약 변경

`generate-gdd-from-interpretation`은 기존 세 경로에 concept brief 경로를 추가로 요구한다.

```text
bun validate-gdd.ts \
  <gdd.md> \
  <chart-report.md> \
  <chart-interpretation.md> \
  <gameplay-concept-brief.md>
```

GDD 생성기는 선택 후보의 플레이어 판타지, 축, 주 동사, 핵심 루프, 성장 경로와 약점을
전투 설계의 고정 계약으로 사용한다. 세계, 인물, 관계, 미술 방향은 통합 해석에 맞게
설계할 수 있지만 다른 전투 원형으로 바꾸거나 탈락 후보를 결합하지 않는다.

GDD에는 다음 형식의 블록을 정확히 한 번 포함한다.

````markdown
```combat-fingerprint
{
  "combatRange": "long",
  "powerMedium": "spell",
  "initiative": "reactive",
  "spaceUse": "swap",
  "combatRhythm": "cycle",
  "mastery": "aim",
  "risk": "focus_break"
}
```
````

validator는 이 블록을 JSON으로 파싱하고 brief의 `## Final Fingerprint` 일곱 값과 정확히
비교한다.
기존의 원본 보고서 비첨부와 `설계 모티프`·`해석 근거` 검증도 그대로 유지한다.

## 11. 결정적 검증 규칙

`validate-concept-brief.ts`는 concept brief, 통합 해석, 레지스트리 경로를 입력받는다.

```text
bun validate-concept-brief.ts \
  <gameplay-concept-brief.md> \
  <chart-interpretation.md> \
  <combat-concept-fingerprints.json>
```

레지스트리 파일은 선택 사항이 아니다. 파일이 아직 없을 때 오케스트레이터가 빈
레지스트리 파일을 먼저 생성한다. validator는 다음을 검사한다.

1. 고정 Markdown 제목·필드 파싱, `schema-version`, 허용 필드와 열거형
2. 일곱 성향 축의 존재, confidence 범위, 유효한 해석 ID
3. 후보 ID의 `C-01`부터 시작하는 연속성
4. 후보별 필수 필드, 점수 범위, 2~3개 kebab-case 주 동사
5. 최초 네 후보 모든 쌍의 축 차이가 3 이상인지
6. 초기·최종 선택 후보의 총점 및 동점 규칙 일치
7. 모든 탈락 후보가 비교 목록에 정확히 한 번 있는지
8. `Final Fingerprint`가 선택 후보의 `Axes`와 정확히 같은지
9. 레지스트리의 실제 초기·최종 최근접 항목과 `registryReview`가 일치하는지
10. 유사도에 따른 `C-05` 생성과 추가 거리 조건이 맞는지
11. 유사한 최종 선택에 비어 있지 않은 정당화가 있는지

알 수 없는 최상위·후보·축 필드는 오타를 숨길 수 있으므로 실패시킨다. 오류 메시지는
최초 실패 하나만 반환하지 않고 발견한 구조 오류를 모두 나열하며 종료 코드는 계약 위반
`1`, 사용법 오류 `2`를 사용한다.

`validate-gdd.ts`는 기존 검사에 다음을 추가한다.

- concept brief 자체가 비어 있지 않고 파싱 가능한가
- `combat-fingerprint` 블록이 정확히 한 개인가
- 블록이 brief의 `Final Fingerprint`와 정확히 같은가
- GDD가 concept brief 전문을 그대로 포함하지 않는가

## 12. 스킬과 오케스트레이터 변경

### 12.1 새 선택 스킬

`.agents/skills/select-gameplay-concept/SKILL.md`는 다음 계약을 갖는다.

- 입력: 통합 해석, 출력 concept brief, 레지스트리, mode의 정확한 경로
- 다른 산출물 탐색·읽기 금지
- 후보 생성 전에 mode별 reference와 selection prompt 읽기
- 현재 출력만 한 번 수정 후 재검증 가능
- 완료 응답은 출력 경로, mode, 후보 수, 검증 결과만 포함

`light`와 `deep`은 후보 수, 스키마, 검증 기준이 같고 설명의 깊이만 다르다.

### 12.2 GDD 스킬

`.agents/skills/generate-gdd-from-interpretation/SKILL.md`와 design prompt를 다음처럼 바꾼다.

- concept brief를 필수 입력으로 읽는다.
- 독립적으로 전투 원형을 선택하라는 기존 지시를 제거한다.
- 선택 후보를 고정 전투 계약으로 사용한다.
- 탈락 후보를 혼합하거나 선택 결과를 재평가하지 않는다.
- 고정 fingerprint 블록을 출력한다.

### 12.3 오케스트레이터

`generate-personalized-gdd`는 통합 뒤, GDD 앞에 격리된 선택 에이전트를 추가한다. 기존과
같이 `fork_turns="none"`을 사용하며 전달 데이터는 정확한 경로와 mode뿐이다.

최종 검증 순서는 다음과 같다.

1. 전문 해석 3개 validator
2. 통합 해석 validator
3. concept brief validator
4. [독립 세계 구조 선택](world-concept-selection.md) validator
5. 전투·세계 concept brief를 입력받는 GDD validator
6. 전투·세계 레지스트리 등록

버전 경로 resolver는 GDD 경로와 같은 디렉터리의 `gameplay-concept-brief.md` 경로를
파생한다. 전투 브리프는 여덟 번째 산출물이고, 후속 세계 구조 선택 명세의
`world-concept-brief.md`를 포함해 완료 메시지는 아홉 산출물 경로를 보고한다.

## 13. 테스트 계획

### 13.1 concept brief validator 단위 테스트

- 유효한 네 후보 brief를 통과시킨다.
- 후보가 세 개면 실패한다.
- 허용되지 않은 축 값과 알 수 없는 필드를 실패시킨다.
- 존재하지 않는 `I-NN` 참조를 실패시킨다.
- 최초 후보 한 쌍의 차이가 두 축이면 실패시킨다.
- 선택이 총점 또는 동점 규칙과 다르면 실패시킨다.
- 탈락 비교 누락과 fingerprint 불일치를 실패시킨다.
- 과거 지문과 5축이 같은데 `C-05`가 없으면 실패시킨다.
- `C-05`가 기존 선택 또는 과거 지문과 3축 미만으로 다르면 실패시킨다.
- 유사한 최종 선택의 정당화가 없으면 실패시킨다.

### 13.2 레지스트리 단위 테스트

- 없는 레지스트리를 빈 값으로 초기화한다.
- 성공 지문을 보존된 스키마로 등록한다.
- 같은 버전 재등록을 거부한다.
- 임시 파일 교체 후 유효한 JSON만 남긴다.
- 이름, 설명, 해석 ID 같은 허용되지 않은 데이터가 저장되지 않는다.

### 13.3 GDD validator 단위 테스트

- 선택 지문과 같은 fingerprint 블록을 통과시킨다.
- 블록 누락, 중복, 잘못된 JSON을 실패시킨다.
- 일곱 축 중 하나가 다르면 실패시킨다.
- 기존 모티프·해석 ID 검증이 계속 동작하는지 확인한다.

### 13.4 파이프라인 회귀 테스트

- 빈 전투·세계 레지스트리에서 아홉 산출물을 만들고 마지막에 각각 지문을 등록한다.
- 선택 또는 GDD 검증 실패 시 레지스트리가 변하지 않는다.
- 같은 통합 해석을 다시 사용해도 후보 선택 근거와 중복 재검토가 수행된다.
- 다른 통합 해석에서도 최초 네 후보의 구조적 거리가 유지된다.
- 최종 선택이 과거 지문과 유사할 때 `C-05`와 정당화가 남는다.

LLM 결과의 재미나 문학성을 자동 테스트하지 않는다. 회귀 fixture는 최소한의 가상 통합
해석과 concept brief를 사용하며 실제 출생정보나 기존 GDD를 복사하지 않는다.

## 14. 구현 순서

1. 전투 축 타입, brief parser와 validator를 구현한다.
   - 검증: 13.1의 단위 테스트 통과
2. 레지스트리 읽기·유사도·원자적 등록을 구현한다.
   - 검증: 13.2의 단위 테스트 통과
3. `select-gameplay-concept` 스킬과 reference를 추가한다.
   - 검증: fixture 통합 해석으로 유효한 네 후보 brief 생성
4. GDD 스킬 입력 계약과 validator를 변경한다.
   - 검증: 13.3의 단위 테스트 및 기존 GDD validator 테스트 통과
5. 오케스트레이터와 output resolver에 여덟 번째 산출물·등록 단계를 연결한다.
   - 검증: 빈 임시 저장소의 파이프라인 회귀 테스트 통과
6. `docs/GDD/personalized-gdd-pipeline.md`와 관련 스킬 문서를 갱신한다.
   - 검증: 문서의 흐름·산출물 수·명령이 실제 구현과 일치
7. 전체 테스트를 실행한다.
   - 검증: `bun test ./scripts ./.agents` 성공

각 단계는 앞 단계의 테스트가 통과한 뒤 진행한다. 기존 로컬 산출물에는 새
validator를 소급 적용하지 않으며 회귀 테스트는 합성 자료로 수행한다.

## 15. 완료 조건

- 새 생성에는 `gameplay-concept-brief.md`가 반드시 존재한다.
- 최초 네 후보 모든 쌍이 일곱 축 중 세 축 이상 다르다.
- 모든 성향과 후보가 실제 통합 해석 ID를 인용한다.
- 선택은 명시된 점수와 동점 규칙을 따른다.
- 과거 지문과 5축 이상 같으면 `C-05` 비교가 정확히 한 번 수행된다.
- 유사한 원형을 최종 선택하면 해석 적합성과 플레이 차이가 기록된다.
- GDD의 fingerprint 블록이 선택 지문과 정확히 일치한다.
- 모든 검증이 성공한 생성만 레지스트리에 등록된다.
- 레지스트리는 출생정보, 해석 내용과 과거 GDD 본문을 포함하지 않는다.
- 전체 기존 테스트와 새 테스트가 통과한다.

## 16. 보류하지 않는 구현 결정

이 명세는 구현 중 재논의를 줄이기 위해 다음을 확정한다.

- 산출물 형식은 고정된 제목과 필드를 사용하는 Markdown이다.
- 후보의 구조적 비교는 일곱 열거형 축만 사용한다.
- 유사도 임계치는 같은 축 5개 이상이다.
- 최초 후보는 네 개, 중복 재검토 후보는 한 개다.
- 점수는 동일 가중치이며 동점 규칙은 고정한다.
- 레지스트리 등록은 최종 검증 뒤에만 수행한다.
- 1차 구현에는 임베딩, 가중 유사도와 다중 프로세스 잠금을 넣지 않는다.
