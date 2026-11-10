# ADR: Claude Code Game Studios의 게임 제작 워크플로 선택적 활용 검토

* **Status:** Proposed — 분석 기록, 도입 미구현
* **Date:** 2026-11-10
* **Decision Owners:** Project Owner
* **Scope:** 개인화 GDD 이후 프로토타입·구현 명세·플레이 검증 절차

## Context

현재 프로젝트는 명식 계산, 격리된 전문 해석, 통합 해석, 전투·세계 후보 선택을 거쳐
개인화 Action RPG GDD를 생성한다. 생성된 기획이 실제 조작과 전투에서 성립하는지는
문서의 구조·근거 검증만으로 확인할 수 없다.

[Claude Code Game Studios](https://github.com/Donchitos/Claude-Code-Game-Studios)는
게임 개발 조직과 작업 절차를 Claude Code 지침·스킬·훅으로 구성한 템플릿이다.
완성된 게임이나 게임 엔진 자체를 제공하는 프로젝트로 해석하지 않는다.
검토 기준은 2026-11-09의 `1.3.0`, 커밋
`abc0de79d6ceb0b5d7aa693945849b3937afbe6a`이다. 아래 외부 링크는 이 커밋에 고정한다.

## Observations

- [README](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/abc0de79d6ceb0b5d7aa693945849b3937afbe6a/README.md)는
  에이전트 49개와 본문 기준 스킬 75개를 설명한다. 소개의 72개와 차이가 있으므로
  개수를 기능 완성도의 근거로 삼지 않는다. 기본 경로는 브라우저 프로토타입이며,
  필요에 따라 시스템 설계·작업 분해·스튜디오 협업으로 확장한다.
- [시스템 설계](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/abc0de79d6ceb0b5d7aa693945849b3937afbe6a/.claude/skills/design-system/SKILL.md)는
  플레이어 경험, 상세 규칙, 수식, 예외, 의존성, 조정 값과 수용 기준을 다룬다.
  [설계 리뷰](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/abc0de79d6ceb0b5d7aa693945849b3937afbe6a/.claude/skills/design-review/SKILL.md)는
  구현 가능성, 경계값, 문서 간 일관성과 시험 가능한 완료 조건을 검토한다.
- [프로토타입 평가](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/abc0de79d6ceb0b5d7aa693945849b3937afbe6a/.claude/skills/prototype/references/6-debrief.md)는
  검증 가설과 실제 플레이 관찰을 연결하며, 사람이 플레이하지 않았다면 평가하지
  못했다고 기록한다. [Vertical Slice](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/abc0de79d6ceb0b5d7aa693945849b3937afbe6a/.claude/skills/vertical-slice/SKILL.md)는
  짧은 전체 게임 루프로 제작 가능성과 핵심 경험의 유지를 확인한다.
- [변경 전파](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/abc0de79d6ceb0b5d7aa693945849b3937afbe6a/.claude/skills/propagate-design-change/SKILL.md)는
  GDD 변경으로 전제가 달라지는 ADR을 찾는다. 시스템과 문서가 늘어날 때 참고할 수 있다.

## Proposed Decision

전체 프레임워크를 일괄 도입하기보다 GDD 이후의 제작·검증 절차를 선택적으로
참고하는 방향을 제안한다. 이 ADR을 기록하거나 병합하는 것만으로 스킬 설치,
도구 전환, 프로토타입 제작 또는 생성 기준선 변경을 시작하지 않는다.

우선 검토할 절차는 다음과 같다.

1. GDD의 핵심 전투에서 검증할 가설 하나를 정하고 최소 플레이 실험으로 확인한다.
2. 구현할 시스템에 한해 규칙·수식·예외·의존성·조정 값·수용 기준을 구체화한다.
3. 자동 검사의 실행·규칙 검증 결과와 사람의 조작감·재미 평가를 구분한다.
4. 핵심 전투를 확인한 뒤 보상과 성장 선택을 연결해 짧은 전체 루프를 검증한다.

기존 명식·해석·전투·세계 선택의 입력 격리와 근거 계약을 유지한다. 게임 구현에는
현재의 [구현·테스트 작성·테스트 리뷰 역할 분리](../spec/three-agent-implementation-workflow.md)를
적용한다. 외부의 팀 조직을 그대로 복제해 기존 계약과 중복되는 조정 체계를 만들지 않는다.

## Alternatives and Trade-offs

| 대안 | 장점 | 비용·판단 |
| --- | --- | --- |
| 전체 템플릿 도입 | 기획부터 출시까지 연결된 절차 확보 | 도구·엔진·승인·경로 계약의 이식과 기존 체계 병합이 필요해 보류 |
| 제작·검증 절차만 선택적으로 참고 | 기존 개인화 파이프라인을 유지하며 실제 플레이 검증을 보완 | 필요한 절차를 현재 환경에 맞게 설계하고 검증해야 하므로 우선 제안 |
| 참고 없이 현 체계 유지 | 당장 변경 비용 없음 | GDD 이후의 검증 절차는 별도로 설계해야 함 |

[엔진 설정표](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/abc0de79d6ceb0b5d7aa693945849b3937afbe6a/.claude/engines/engines.tsv)에는
Web·Godot·Unity·Unreal이 있으며 LÖVE2D는 없다. Lua/LÖVE2D 실행·테스트·스모크
검사와 현재 에이전트 도구 연결은 별도 구현 대상이다.
[최상위 지침](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/abc0de79d6ceb0b5d7aa693945849b3937afbe6a/CLAUDE.md)의
기본 협업 방식은 작성 전 승인을 자주 요구하므로, 자동화 모드가 있다는 이유만으로
현재 작업 방식과 호환된다고 가정하지 않는다.

[전투 팀](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/abc0de79d6ceb0b5d7aa693945849b3937afbe6a/.claude/skills/team-combat/SKILL.md)의
기본 구성은 구현 담당 중심으로 축소되며, 모든 전문 역할이 항상 별도로 실행되지 않는다.
QA 담당의 테스트 작성·검증만으로 현재 프로젝트의 독립 테스트 리뷰 계약을 대체할 수 없다.

## Validation and Limits

이번 분석은 README, 실제 스킬과 참조 문서, 엔진 설정표 및 검증 스크립트의 소스
검토다. 외부 게임 생성 워크플로·전체 테스트를 실행하거나 게임을 플레이하지 않았다.
README의 브라우저 게임 비교·확장 사례는 저자의 보고이며 독립 재현 결과가 아니다.
저자는 엔진 경로와 시스템별 심화 설계가 같은 수준의 실증을 거치지 않았다고 밝힌다.
[studio-tests](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/abc0de79d6ceb0b5d7aa693945849b3937afbe6a/studio-tests/README.md)는
스킬·에이전트 프레임워크의 검사를 위한 자료이며 생성 게임의 재미나 품질 보증이 아니다.

후속 실험이 승인되면 다음 기준으로 유용성을 판단한다.

- 합성 전투 콘셉트로 이동·주 공격·방어 대응·적 하나의 LÖVE2D 실험을 구성할 수 있다.
- 구현 전에 가설, 범위, 관찰할 행동과 완료 조건을 정한다.
- 실행 오류·전투 규칙은 자동 검사로, 조작감·재미는 직접 플레이로 각각 확인한다.
- 사람이 플레이하지 않았거나 환경 때문에 확인하지 못한 항목은 미평가로 남긴다.
- 결과를 계속 진행·수정·중단 판단에 연결하고, 전체 루프 확장은 별도 범위로 정한다.

이는 제안된 수용 기준이며 실험 완료 기록이 아니다. 실제 개인 출생정보나 특정 로컬
생성 결과를 필수 재현 자료로 요구하지 않는다. 문서 자체의 검증은
`bun run check:docs`와 `bun run check:docs --review`, `git diff --check`로 수행한다.

## Related Documents

- [게임 개발 결과물의 아티팩트 정의](2026-11-02-game-development-artifacts.md)
- [구현·테스트 작성·테스트 리뷰의 역할 분리](../spec/three-agent-implementation-workflow.md)
- [공통 게임 화면·아트 계약](../spec/game-presentation-contract.md)
- [로컬 아티팩트와 영구 문서의 경계](../spec/local-artifact-document-boundary.md)
