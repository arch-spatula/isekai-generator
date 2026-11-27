# ADR

아키텍처 결정과 그 배경을 기록합니다.

결정 기록의 파일명에는 `YYYY-MM-DD-주제.md` 형식으로 날짜 접두어를 붙입니다. 예: `2026-09-20-love2d.md`

## 결정 목록

- [개인화 이세계 Action RPG 생성 프롬프트 설계](2026-09-24-personalized-action-rpg-concept-prompt.md)
- [게임 개발 결과물의 아티팩트 정의](2026-11-02-game-development-artifacts.md)
- [Orrery 계산 엔진의 단계적 Lua 포팅](2026-11-02-orrery-core-lua-port.md)
- [게임 핵심 서사의 8단계 구조 채택](2026-11-03-eight-stage-story-structure.md)
- [게임을 개인화된 서사 전달 매체로 정의](2026-11-03-game-as-narrative-medium.md)
- [개인화 전투 원형을 후보 비교로 선택](2026-11-03-personalized-combat-archetype-selection.md)
- [생성 아티팩트 버전을 기준선과 실행 이력으로 구분](2026-11-04-artifact-generation-versioning.md)
- [전투 선택과 세계 구조 선택을 분리](2026-11-04-independent-world-concept-selection.md)
- [생성 아티팩트 기준선 0.2 채택](2026-11-05-adopt-artifact-series-0.2.md)
- [진행 기록을 포함한 생성 기준선 0.3 채택](2026-11-05-adopt-artifact-series-0.3.md)
- [고정 GDD 출력 템플릿 기준선 0.4 채택](2026-11-08-adopt-artifact-series-0.4.md)
- [책임별 게시 폴더를 포함한 생성 기준선 0.5 채택](2026-11-15-adopt-artifact-series-0.5.md)
- [Pixelbolt를 활용한 코드 기반 이펙트 제작 계획](2026-11-09-pixelbolt-vfx-plan.md)
- [LibreSprite를 게임 이미지 생성 도구로 활용](2026-11-09-libresprite-image-generation.md)
- [Godot과 PixelFX를 이용한 게임 제작 경로 평가](2026-11-11-godot-pixelfx-evaluation.md)
- [Claude Code Game Studios의 게임 제작 워크플로 선택적 활용 검토](2026-11-10-claude-code-game-studios-evaluation.md)
- [인물과 주변 환경의 해석을 구분해 세계관과 스토리 설정에 활용](2026-11-10-person-environment-world-story.md)
- [SQLite와 목적별 CLI를 통한 에이전트 상태 관리 평가](2026-11-12-sqlite-agent-state-evaluation.md) — 2026-11-21 파일 기반 진행 상태 결정으로 대체
- [실행 상태 SQLite를 각 버전 폴더 루트에 둔다](2026-11-21-per-version-sqlite-state.md) — 같은 날 파일 기반 진행 상태 결정으로 대체
- [실행 상태 저장소를 없애고 진행 상태를 버전 폴더의 파일에서 계산한다](2026-11-21-drop-sqlite-file-derived-progress.md)
- [차트부터 GDD까지 하나의 Claude 흐름으로 만든다](2026-11-23-claude-gdd-flow.md)
- [옮겨 적기 흐름에 생업·이세계 정체성 설계·검토 단계를 둔다](2026-11-24-isekai-identity-design.md)
- [주인공의 배경은 차트 해석 층이 환경 자리에서 읽는다](2026-11-24-chart-background-interpretation.md)
- [게임 설계 단계의 검토를 한 번으로 줄이고 재료 없는 요구를 없앤다](2026-11-25-single-pass-review.md)
- [재능과 기질을 나누고 기질이 능력이 되지 않게 한다](2026-11-25-talent-temperament.md)
- [재료 지도가 드러낸 재료 부족을 정리한다](2026-11-25-material-gaps.md)
- [클래스를 정하기 전에 영역을 이세계의 힘으로 옮긴 후보를 견준다](2026-11-25-class-candidates.md)
- [게임 설계의 칸 목록과 재료 배정 규칙을 정한다](2026-11-26-game-slots.md)
- [반복되는 실패를 플레이 시스템으로 옮기고 플레이어용 이름을 따로 둔다](2026-11-26-draw-system-and-player-names.md)
- [장르의 흔한 이름과 여러 부직업을 허용하고 클래스 하나에 독창성을 몰지 않는다](2026-11-26-genre-names-and-sub-jobs.md)
- [출신지를 도시로 못 박지 않고 권력·역사와 지역마다의 전장을 강제하지 않는다](2026-11-26-open-origin.md) — 장별 세계와 장마다의 전장은 2026-11-27 결정으로 대체
- [배경은 조건으로 쓰고 집안의 생업을 쓰지 않으며, 배경과 재능은 같은 자리를 쓰지 않는다](2026-11-26-background-conditions.md)
- [세계를 생애의 장과 따로 먼저 세우고, 장은 그 안에서 일어날 지역을 고른다](2026-11-27-world-before-chapters.md)
- [속성은 세 체계의 기운 사실과 하는 일을 함께 읽어 정체성에서 정한다](2026-11-27-attribute.md)
- [콘텐츠 모드는 전투 단계가 세계의 지역·세력에서 지어내고 GDD 런과 성장이 잇는다](2026-11-27-content-modes.md)
- [스토리 영감용 해석의 방어 문구를 생성 지시와 사후 편집에서 제거](2026-11-09-interpretation-defensive-wording-editing.md) — 2026-11-09 결정 기록
