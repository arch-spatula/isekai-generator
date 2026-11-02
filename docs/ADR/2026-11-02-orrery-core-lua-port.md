# ADR: Orrery 계산 엔진의 단계적 Lua 포팅

* **Status:** Accepted
* **Date:** 2026-11-02
* **Decision Owners:** Project Owner
* **Scope:** 사주팔자·자미두수·네이탈 차트 계산 엔진

---

# 1. Context

이 프로젝트는 사용자의 출생정보로 사주팔자·자미두수·네이탈 차트를 계산하기 위해
[Orrery의 `@orrery/core`](https://github.com/rath/orrery/tree/main/packages/core)를 기준
구현으로 사용한다. 현재 패키지는 TypeScript로 작성되어 있으며 Bun에서 계산 스크립트로
실행할 수 있다.

생성되는 2D 게임의 우선 런타임은 LÖVE2D이고 게임 코드는 Lua로 작성한다. 장기적으로 계산
엔진을 Lua 환경에서도 직접 실행하고 수정할 수 있게 하려면 TypeScript 런타임과의 경계를
계속 유지하거나 계산 엔진을 Lua로 옮겨야 한다.

사주, 자미두수와 천문 계산은 날짜 경계, 타임존, 절기 및 부동소수점 처리에 따라 결과가
달라질 수 있다. 따라서 동작 기준 없이 코드를 바로 번역하면 눈에 띄지 않는 계산 차이가
생길 위험이 있다.

# 2. Decision

`@orrery/core`를 당분간 기준 구현으로 사용하고, 입력·출력 계약과 기준 결과를 먼저 고정한
뒤 계산 엔진을 단계적으로 Lua로 포팅한다. 포팅 완료 전까지 TypeScript 구현을 제거하지
않으며 Lua 구현의 결과를 비교하는 기준으로 유지한다.

포팅 순서는 모듈 의존성과 검증 난이도를 확인하여 정하되, 각 단계는 다음 조건을 만족해야
한다.

1. 공개 API에 대응하는 Lua 입력·출력 계약을 정의한다.
2. 정상 입력과 날짜·시간 경계 사례를 포함한 기준 결과를 `@orrery/core`에서 생성한다.
3. 같은 입력에 대한 Lua 결과를 기준 결과와 비교하는 자동화 테스트를 작성한다.
4. 해당 모듈의 호환성 테스트가 통과한 뒤에만 Lua 구현을 실제 계산 경로에 연결한다.
5. 포팅한 코드의 Orrery 출처, 변경 내용, 저작권과 AGPL-3.0 고지를 유지한다.

대상에는 사주팔자, 자미두수와 네이탈 차트 계산이 포함된다. 도시 검색 데이터처럼 계산과
분리할 수 있는 부가 기능은 필요성이 확인될 때 별도로 포팅한다.

# 3. Compatibility Boundary

TypeScript와 Lua 구현이 UI나 저장 형식에 직접 결합되지 않도록 프로젝트 소유의 계산 계약을
사이에 둔다.

```text
Birth Profile
    → Chart Calculation Contract
        ├── @orrery/core (기준 구현)
        └── Orrery Lua port (대체 구현)
    → Normalized Chart Result
    → Integrated Seed
```

`Date`, `Map` 등 JavaScript 런타임에 종속된 값은 정규화된 JSON 표현으로 변환한다. 기준
결과에는 사용한 Orrery 버전, 입력값, 타임존과 계산 옵션을 함께 기록하여 이후 버전의 결과와
구분한다.

# 4. Completion Criteria

Lua 포팅은 다음 조건을 모두 만족할 때 완료된 것으로 본다.

- 사주팔자·자미두수·네이탈 차트의 프로젝트 필수 결과 필드를 모두 계산한다.
- 대표 사례와 날짜·시간·타임존 경계 사례의 호환성 테스트가 통과한다.
- 허용할 수 있는 부동소수점 오차 범위를 명시하고 네이탈 계산 결과가 그 범위 안에 있다.
- LÖVE2D가 TypeScript 또는 Node.js 프로세스 없이 Lua 구현을 실행할 수 있다.
- Orrery의 크레딧, AGPL-3.0 라이선스와 포팅 변경 기록을 배포물에 포함한다.
- Lua 구현으로 전환한 뒤에도 기준 결과를 이용한 회귀 테스트를 계속 실행할 수 있다.

# 5. Consequences

## Positive

- LÖVE2D 런타임에서 별도 JavaScript 프로세스 없이 계산할 수 있다.
- 생성 게임과 계산 엔진 사이의 언어 및 배포 경계가 단순해진다.
- 기준 결과를 통해 계산 엔진 변경에 따른 회귀를 탐지할 수 있다.
- 입력·출력 정규화 계약이 특정 구현의 자료구조가 앱 전체로 퍼지는 것을 막는다.

## Negative

- 포팅 기간에는 TypeScript와 Lua 두 구현을 함께 유지해야 한다.
- `lunar-javascript` 등 TypeScript 구현의 의존 기능을 Lua에서 대체하거나 별도로 포팅해야
  한다.
- 천문 계산과 시간대 경계의 결과를 검증하는 데 많은 테스트가 필요하다.
- Orrery가 갱신되면 기준 구현의 변경을 Lua 포트에 반영할지 판단해야 한다.

# 6. Superseded Decisions

[출생 프로필 입력 UI 명세](../spec/birth-profile-input-ui.md)의 “Orrery 코드 또는 패키지의
사용 여부는 추후 결정”이라는 내용은 이 ADR로 대체한다. UI 명세의 나머지 결정은 유지한다.

# 7. Related Documents

- [Orrery `@orrery/core`](https://github.com/rath/orrery/tree/main/packages/core)
- [Tauri 출생 프로필·명식 톱니바퀴 UI 명세](../spec/tauri-birth-profile-gear-ui.md)
- [출생 프로필 입력 UI 명세](../spec/birth-profile-input-ui.md)
- [개인화 이세계 Action RPG 생성 프롬프트 설계](2026-09-24-personalized-action-rpg-concept-prompt.md)
