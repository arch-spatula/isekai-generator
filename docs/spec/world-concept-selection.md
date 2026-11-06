# 개인화 세계 구조 선택 명세

> 상태: 구현 완료, 대표 입력군 회귀 대기 (v0.2 채택은 별도 ADR)
> 작성일: 2026-11-04
> 결정: [세계 구조 선택 분리](../ADR/2026-11-04-independent-world-concept-selection.md)

## 목적과 범위

해양 세계를 금지하지 않고 군도·항로가 기본 해법이 되는 경로를 끊는다. 전투 선택 다음,
GDD 이전에 독립된 세계 선택 단계를 둔다. 통합 해석·선택 전투·세계 지문과
[공통 화면·아트 계약](../prompts/game-presentation-contract.md)을 입력하며
원시 출생정보, 차트, 전문 해석, 과거 GDD와 대화 문맥은 전달하지 않는다.

출력은 같은 예약 디렉터리의 `world-concept-brief.md`다. light/deep은 설명 깊이만 다르고
같은 검증 계약을 사용한다. 기존 아티팩트를 수정하거나 manifest를 소급 생성하지 않는다.
이번 구현은 새 실제 GDD를 생성하거나 minor를 승격하지 않는다.

## 지문

| 축 | 허용 값 |
| --- | --- |
| topology | continental, archipelago, vertical, underground, mobile, celestial |
| ecology | forest, desert, ice, wetland, marine, urban, organism, immaterial |
| traversal | overland, aerial, sea, subterranean, teleport, creature |
| settlement | fixed-cities, mobile-base, distributed, single-fortress, cyclic |
| hazard | flooding, falling, collapse, contamination, depletion, time-distortion, predation |
| spatialLogic | routes, borders, layers, veins, fractures, cycles, gravity |

지형은 실제 연결 구조로 판정한다. 고립된 하늘섬을 항로로 연결하면 `archipelago`이며
`celestial`로 이름만 바꾸지 않는다. 대륙 일부의 항구, 바다 비유와 세계 전체 항해는
분리한다. 해양 역할은 `none`, `decoration`, `major-region`, `core-world`, `core-grammar`다.
`archipelago` 또는 `sea` 이동은 core 역할, 지배 생태 `marine`은 적어도 major 역할이어야
한다. `core-world`는 실제 해상 이동과 해양 생태를 요구한다. 자연어 판정은 에이전트가
맡으며 validator는 명시된 구조와 역할의 모순만 검사한다.

## 후보와 선택

처음 W-01~W-04 네 후보는 모든 쌍에서 6축 중 최소 3축이 다르고, 전체에 최소 3개
topology와 core 해양 역할이 아닌 후보 최소 2개가 있어야 한다. 각 후보는 실제 공간
연결과 해금·귀환 방식(`spatialPlay`), 세계의 긴장(`causalChain`), 최소 2개 실제 해석 ID,
반대 근거, 선택 전투의 모든 primary verb를 환경에 옮긴 `verbMapping`을 기록한다.
전투 동사의 명칭이 바다를 요구한다는 이유만으로 세계 설정을 고정하지 않는다.

점수는 `interpretationFit`, `combatFit`, `spatialPlay`, `distinctiveness` 각각 1~5와
근거를 기록한다. 합계, interpretationFit, combatFit, 낮은 후보 ID 순으로 결정한다.
모든 탈락 후보에 선택 후보와 비교한 이유를 기록한다.

별도 `artifacts/registries/world-concept-fingerprints.json`의 6축과 비교한다. 모든 항목 중
최대 일치 축을 가진 동률을 전부 기록한다. 4축 이상 같으면 유사하다고 본다. 최초 선택이
유사하면 정확히 W-05 한 개를 추가하며 최초 4개와 점수를 바꾸지 않는다. W-05는 최초
선택과 모든 최초 근접 지문에서 최소 3축 달라야 한다. 최종 후보를 전체 점수로 재선택한다.

최종 선택이 여전히 유사하면 모든 최종 근접 항목에 해석 적합성과 실제 공간 플레이 차이를
기록한다. 최종 후보가 major 또는 core 해양 역할이면 비해양 대안보다 필요한 이유를
`maritimeJustification`에 기록한다. 장식·비유는 이 추가 정당화를 요구하지 않는다.
내용이 구체적인지는 에이전트가 검토하며 validator가 자동 점수로 증명한다고 주장하지 않는다.

## 저장 및 검증

세계 브리프는 한국어 설명과 정확히 한 `world-concept` JSON fenced block을 사용한다.
추가로 공통 `game-presentation` 블록을 JSON 밖에 정확히 한 번 선언한다. 생성 전에
공통 입력의 정확한 경로를 받아 검사·읽기하며 전투 브리프의 선언도 일치해야 한다.
모든 후보의 spatialPlay·verbMapping은 공통 화면 안에서 이동·높이·가림을 설명한다.
선언과 본문의 일치는 에이전트가 선택 전에 검토하고 validator는 선언만 확인한다.
정확한 필드 계약은 스킬의 `references/selection-contract.md`가 정의한다. `schemaVersion: 1`은
artifact series와 독립이다. 알 수 없는 필드, 빠진 필드, 잘못된 열거형, 없는 ID, 거리·점수·
유사도 불일치, 누락된 비교와 전투 verb는 실패한다.

세계 지문 레지스트리는 `schemaVersion: 1`, `entries` 배열을 갖는다. 각 항목은 version,
candidateId, fingerprint, spatialPlay만 저장한다. 원시 개인정보, 과거 GDD 본문과 전체
해석은 저장하지 않는다. 중복 버전을 거부하고 같은 디렉터리의 임시 파일과 rename으로
갱신한다. 쓰기 락이 이미 있으면 실패하고 다음 호출에서 재시도한다. 자동 락 삭제나
분산 잠금은 지원하지 않는다.

GDD는 정확히 한 `world-structure` JSON block으로 6축 각각의 `value`와 실제
`manifestation`을 선언한다. 값은 선택 후보와 전부 같고 설명은 비어 있지 않아야 한다.
전투 지문도 그대로 검증한다. 세계 브리프 전체 복제는 금지한다. 설명 본문과 선언의
의미적 일치, 지역 생태와 실제 탐험 구조의 자연스러움은 생성 에이전트가 검토한다.

기존 GDD validator의 다섯 번째 인수로 세계 브리프가 필수가 된다. 생략하면 실패한다.
현재 여섯 번째 인수로 공통 화면 계약도 필수다. 공통 조건은 6축 지문에 추가하지 않는다.
과거 문서 재검증을 위해 새 계약을 자동 채우거나 기본 세계를 만들지 않는다.

오케스트레이터는 세계 validator까지 성공한 뒤 GDD를 실행한다. 최종 검증에서는 세계
브리프도 다시 검증한다. 모든 validator가 통과한 뒤 두 지문을 등록하고 manifest를
`succeeded`로 바꾼다. 등록 중 오류가 나면 `failed`로 기록하고 부분 등록 여부를 보고한다.
두 별도 레지스트리는 단일 트랜잭션이 아니므로 부분 등록을 자동 성공으로 취급하거나 같은
run을 재등록하지 않는다. 세계 단계 실패는 `world-selection`으로 기록한다.

## 회귀 검증과 완료 판정

- 후보 이름·고유명사가 달라도 같은 축이면 같은 구조로 비교한다.
- 공중 군도와 해상 군도의 공유 구조, 단일 항구와 전체 항해의 차이를 fixture로 검증한다.
- 후보 거리, 점수와 tie-break, 유사 시 추가 후보, 모든 동률, 재선택 후 최종 비교를 검증한다.
- 바다 비유를 이유로 실패시키지 않고 세계 계약 이탈과 전투 지문 변경을 거부한다.
- 레지스트리 중복·손상·원자적 기록과 전체 파이프라인 테스트를 실행한다.
- incident의 28개 역할 분류는 원본이 저장소에 없는 당시 관찰 기록으로 유지한다.
  재현 데이터나 fixture로 간주하거나 6축 지문을 추측하지 않는다. 구조 비교는 커밋된
  synthetic fixture로 수행한다. 별도 생성 실험에도 당시의 개인 출생 입력을 요구하지 않는다.
- 실제 대표 입력군을 연속 생성하여 세계 후보의 비교 품질과 해양 재선택의 필요성을 검토한
  기록이 마련되어야 incident를 해결 완료로 닫는다. v0.2 최초 승격은
  [별도 채택 결정](../ADR/2026-11-05-adopt-artifact-series-0.2.md)에 따라 회귀 비교를 후속 작업으로 남긴다.

## 실행 경로

```text
bun scripts/game-presentation.ts <game-presentation-contract.md>
bun .agents/skills/select-world-concept/scripts/validate-world-brief.ts <world-brief> <interpretation> <combat-brief> <world-registry> <game-presentation-contract.md>
bun .agents/skills/select-world-concept/scripts/manage-world-registry.ts init <world-registry>
bun .agents/skills/select-world-concept/scripts/manage-world-registry.ts register <world-registry> <version> <world-brief>
```

## 2026-11-04 검증 기록

- `bun test ./scripts ./.agents`: 123개 통과, 실패 0개. 기존 전투·차트·해석·버전 관리 검증을 포함한다.
- 신규 세계 선택 스킬과 변경된 오케스트레이터·GDD 스킬의 `quick_validate.py` 통과.
- 개인정보 없는 가상 통합 해석과 선택된 anchor/redirect 전투 계약으로 독립 에이전트의
  light 세계 선택을 임시 디렉터리에서 실행했다. 수직 도시·연속 숲·지하망·이동 세계 네
  후보가 생성되고 세계 validator를 통과했다. 선택 후보는 수직 도시였으며 anchor와
  redirect를 벽체 고정·충격 편향으로 구현해 해양 문명으로 확대하지 않았다.
- CLI 통합 테스트는 서로 다른 가상 해석의 세계 선택·등록과 두 GDD validator의 세계 계약
  필수 여부를 확인했다. 새 세계 레지스트리나 실제 GDD를 저장소 artifacts에 생성하지 않았다.
- 이 기록은 실제 대표 출생 입력군의 전체 GDD 회귀 생성과 비교를 대신하지 않는다.
