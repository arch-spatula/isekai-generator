# ADR: Godot 게임 제작용 에이전트 도구 생태계 도입

* **Status:** Accepted — 프로젝트 설정 작성 완료, MCP 서버·플러그인의 실제 로드 검증 전
* **Date:** 2026-11-17
* **Decision Owners:** Project Owner
* **Scope:** Claude Code에서 Godot 프로토타입을 만들고 검증할 때 쓰는 MCP 서버, 스킬, 에이전트와
  참조 문서. 게임 런타임 의존성은 범위 밖이다.

## 배경

[Godot과 PixelFX를 이용한 게임 제작 경로 평가](2026-11-11-godot-pixelfx-evaluation.md)는
Godot 4.7.x와 GDScript로 격리된 전투 프로토타입을 만들고, PixelFX를 VFX 카탈로그 후보로
연결하기로 했다. 이 프로토타입은 사람이 아니라 주로 코딩 에이전트가 만든다. 따라서 평가의
성패는 엔진 자체만이 아니라 **에이전트가 Godot을 얼마나 정확하게 다룰 수 있는가**에도 달려 있다.

에이전트가 Godot 작업에서 겪는 문제는 대체로 세 가지다.

1. **지식 공백** — 모델 학습 데이터는 Godot 4.3 전후까지가 중심이고, 4.5–4.7의 API 변경과
   폐기 API를 잘 모른다.
2. **피드백 부재** — 에이전트가 쓴 씬과 스크립트를 실제 엔진에서 실행해 오류를 보는 경로가
   없으면, 텍스트로만 맞아 보이는 결과를 만든다.
3. **텍스트 리소스 취약성** — `.tscn`, `.tres`, UID를 손으로 고치다 참조가 조용히 끊긴다.

이 문제를 프로젝트가 직접 해결하는 도구를 만들 수도 있다. 그러나 Godot·Claude Code 주변에는
이미 같은 문제를 다루는 오픈소스 도구가 많은 사용자와 함께 유지되고 있다. 이 프로젝트의 목표는
개인화 게임 생성이지 에이전트 도구 개발이 아니므로, **생태계에서 검증된 도구를 쓰고 필요한
부분만 고정 버전으로 가져오는 것**이 비용 대비 효과가 크다.

[Claude Code Game Studios의 게임 제작 워크플로 선택적 활용 검토](2026-11-10-claude-code-game-studios-evaluation.md)는
같은 저장소의 GDD 이후 **제작·검증 절차**를 선택적으로 참고하자고 제안했고, 전체 템플릿 도입은
보류했다. 이 결정은 그 판단을 유지하면서, 절차가 아니라 **Godot 엔진 참조와 전문 에이전트**를
가져오는 별도 범위를 정한다. 절차 도입 여부는 계속 그 ADR이 다룬다.

## 결정

다음 네 가지를 Godot 프로토타입용 개발 도구로 도입한다. 저장소마다 이 프로젝트와 맞는 범위가
다르므로, 전부 가져올 수 있는 것은 전부, 충돌하거나 불필요한 부분이 있는 것은 일부만 가져온다.

| 도구 | 해결하는 문제 | 도입 범위 | 고정 기준 | 라이선스 |
|---|---|---|---|---|
| [Godot MCP](https://github.com/Coding-Solo/godot-mcp) | 피드백 부재, 텍스트 리소스 취약성 | 전부 | 커밋 `1209744` | MIT |
| [PixelFX](https://github.com/patch-gg/pixelfx) | VFX 탐색·내보내기 | 전부 (Claude Code 플러그인) | 커밋 `5294518` | MIT, 갤러리 폰트 제외 |
| [awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) | 지식 공백 (작업 절차) | 일부 (플러그인 묶음 3개) | 커밋 `c6ca6c4` | Apache-2.0 |
| [claude-code-game-studios](https://github.com/donchitos/claude-code-game-studios) | 지식 공백 (버전 참조) | 일부 (파일 복사) | 커밋 `abc0de7` | MIT |

조사와 고정 시점은 2026-11-17이다. Godot 실행 파일은
[PR #28](https://github.com/arch-spatula/isekai-generator/pull/28)이 Nix 개발 셸에
`godot_4_7`(4.7.2-stable)로 추가하며, 이 결정은 그 변경을 전제로 한다.

### 1. Godot MCP — 전부

* "Godot MCP"라는 이름의 서버는 여러 개다. GitHub에서 가장 많이 쓰이는 MIT 서버(조사 시점
  별 약 6.7k, 다음 후보의 7배 이상)인 Coding-Solo 구현을 선택한다. 유료 서버(godot-mcp-pro)와
  편집기 플러그인 설치가 필요한 서버는 제외한다.
* 에디터 실행, 디버그 실행과 출력 수집, 씬 생성·노드 추가, UID 갱신 기능을 제공한다.
  에이전트가 생성 결과를 **실제 Godot에서 실행해 오류를 확인하는 경로**가 생긴다.
* 단일 MCP 서버이므로 나눌 부분이 없다. 프로젝트 `.mcp.json`에 등록한다.
* **npm 배포본이 아니라 GitHub 커밋으로 고정한다.** npm 최신 `0.1.1`(2026-02-03)에는
  2026-04-16의 보안 수정 "prevent arbitrary GDScript instantiation via add_node/create_scene"이
  없다. 그래서 수정이 들어간 커밋 `1209744fad78f3998f98c7394fd0f6ef50da5281`을
  `npx github:` 형식으로 실행한다. 이 방식은 첫 실행 때 패키지를 내려받아 빌드한다.
* 서버는 `PATH`의 `godot`을 먼저 찾으므로, `nix develop` 셸에서 Claude Code를 실행하면
  `GODOT_PATH` 설정이 필요 없다.

### 2. PixelFX — 전부

* 기존 평가 ADR은 PixelFX를 **게임 에셋 출력**으로 다뤘다. 이 결정은 같은 저장소가 함께 배포하는
  **Claude Code 플러그인**(`pixelfx` 스킬)을 쓰는 것이다. 스킬은 효과 검색, 렌더해서 보기,
  팔레트 변경, 스프라이트시트 내보내기와 새 효과 다듬기 절차를 제공한다.
* 플러그인은 저장소 전체를 소스로 쓰는 단일 단위라 나눌 이유가 없다. 저장소 자체 마켓플레이스를
  커밋으로 고정해 설치한다.
* 렌더 도구 checkout은 로컬 도구로 두고 커밋하지 않는다. 게임에 쓰는 출력과 재생성 정보는
  기존 평가 ADR의 PixelFX 통합 경계를 따른다.
* 포함하지 않는 것: Patch 배포 CLI(`pch`)와 Patch 플랫폼 연동. 이 프로젝트의 배포 경로가 아니다.
  `gallery/fonts`의 Patch Pixel 폰트는 MIT 대상이 아니므로 배포물에 넣지 않는다.

### 3. awesome-gamedev-agent-skills — 일부, 플러그인 묶음 단위

* 79개 스킬이 엔진·분야별 플러그인 묶음으로 나뉘어 있고, 각 묶음을 따로 설치할 수 있다.
  저장소 README도 Claude Code의 스킬 설명 예산 때문에 전체 대신 필요한 묶음만 설치하라고 권한다.
* 가져오는 묶음:
  * `router` — 엔진과 작업을 판별해 필요한 스킬만 읽게 하는 진입점
  * `godot` — Godot 4.7 기준 16개 스킬(GDScript, 씬, 시그널, 2D 이동, TileMap, 물리, UI,
    애니메이션, 셰이더, 리소스, 오디오, 내보내기, headless 테스트 등)
  * `disciplines` — 엔진 중립 15개 스킬(게임 AI, 입력, 카메라, 게임 필, UI/UX, 레벨 디자인,
    세이브, 성능 등). 탑다운 액션 RPG 전투 방 구현에 직접 쓰인다.
* 가져오지 않는 묶음과 이유:
  * Unity, Unreal, Ebitengine, web-engines — 사용하지 않는 엔진
  * `other-engines` — LÖVE 스킬 하나가 필요할 수 있지만 Roblox 등 11개가 함께 설치된다.
    LÖVE 쪽 작업에 필요해지면 별도로 결정한다.
  * `genres` — 관련 있는 것은 `rpg` 하나이고, 장르 구조는 이 프로젝트의 GDD 파이프라인과
    전투 원형 선택이 정한다.
  * `workflows` — `game-docs`는 GDD 생성 스킬과 역할이 겹치고, Steam·itch 배포는 아직
    범위가 아니다.
* **묶음 단위로 설치하고 스킬을 골라 복사하지 않는다.** 마켓플레이스 커밋만 바꾸면 갱신되고,
  가져온 사본을 직접 관리할 필요가 없다. 대가로 `godot` 묶음의 C#·3D·멀티플레이어 스킬도
  함께 설치된다.
* 스킬 설명은 플러그인이 켜져 있는 동안 이 레포의 모든 세션 컨텍스트에 상시 포함된다. 세 묶음
  32개 설명은 조사 시점 약 12,000자다. 스킬 본문은 호출할 때만 읽으므로 호출당 비용은 설치
  방식과 무관하다.

### 4. claude-code-game-studios — 일부, 파일 복사

* 이 저장소는 플러그인이 아니라 **프로젝트 템플릿**이다. 자체 `CLAUDE.md`, 49개 에이전트,
  75개 스킬, 18개 훅, 권한 설정, 상태줄, `design/`·`production/` 디렉터리 규약을 한 묶음으로
  전제한다. 전부 가져오면 이 레포의 지침, OMC 다중 에이전트 구성, GDD 생성 스킬, ADR·명세
  체계와 충돌한다. 기존 CCGS ADR의 전체 도입 보류 판단과 같이 템플릿 골격은 가져오지 않는다.
* 가져오는 것:
  * `docs/engine-reference/godot/` — Godot 4.4–4.7 변경점, 폐기 API, 모범 사례와 모듈별
    참조(약 76KB). 문제 1(지식 공백)을 직접 줄이며, 다른 도구에는 없는 부분이다.
  * `.claude/scripts/godot-parse-check.gd` — 오토로드를 등록한 상태로 스크립트를 로드해
    파싱 실패를 종료 코드로 알리는 33줄 검사기. 평가 ADR의 headless 검사 기준에 쓴다.
  * `.claude/rules/scene-files.md` — `.tscn`·`.tres`·UID를 손으로 고칠 때의 규칙. 경로 범위
    규칙이라 해당 파일을 다룰 때만 적용된다.
  * Godot 전문 에이전트 3개: `godot-specialist`, `godot-gdscript-specialist`,
    `godot-shader-specialist`.
* 에이전트는 이 레포에 없는 스튜디오 역할로의 위임, `production/` 오케스트레이션 예외,
  C#·GDExtension 분기를 담고 있다. 이 부분만 수정했고, 원본 커밋과 파일별 수정 내용은
  `.claude/vendor/claude-code-game-studios/README.md`에 기록한다.
* 엔진 참조와 검사기는 `.claude/vendor/claude-code-game-studios/` 아래에 원본 `LICENSE`와 함께
  둔다. 커밋 문서 체계(`docs/`)와 섞지 않는다.

## 공통 원칙

* **개발 도구이며 게임 의존성이 아니다.** 생성된 게임 배포물에는 Node.js, MCP 서버, 스킬 파일이
  들어가지 않는다. 평가 ADR의 "새 범용 프레임워크·플러그인 묶음을 먼저 도입하지 않는다"는
  게임 런타임에 대한 원칙이며 이 결정과 충돌하지 않는다.
* **버전 고정.** MCP 서버와 마켓플레이스는 40자 커밋으로 고정한다. Claude Code는 커밋으로
  고정한 마켓플레이스를 새로고침이나 자동 업데이트로 옮기지 않으므로, 개발 셸 래퍼의
  `FORCE_AUTOUPDATE_PLUGINS=1`이 있어도 버전이 유지된다. 갱신은 변경 내용을 확인한 뒤 커밋
  값을 수동으로 바꾼다.
* **프로젝트 범위 설정.** 사용자 전역이 아니라 이 레포의 `.claude/settings.json`과 `.mcp.json`에
  기록해, 다른 작업 환경에서도 같은 도구 구성을 재현한다. 프로젝트 MCP 서버는 Claude Code가
  처음 사용할 때 승인을 요청한다.
* **우선순위.** 외부 스킬·에이전트의 지시가 이 레포의 지침, 기존 ADR·명세와 충돌하면 이 레포의
  문서를 따른다. 외부 도구의 Godot 버전 정보가 평가 ADR의 고정 버전과 다르면 고정 버전을
  기준으로 한다.

## 검증

2026-11-17 설정 작성 시점에 확인한 것:

* PR #28 브랜치에서 `nix flake check --no-build`가 통과하고, `nix develop`에서
  `godot --version`이 `4.7.2.stable.nixpkgs.ed1daf0bf`를 출력한다.
* 가져온 Godot 에이전트 3개와 규칙 파일이 참조하는 경로가 모두 존재하고, 이 레포에 없는
  에이전트 이름이 남아 있지 않다.
* 문서 변경 후 `bun run check:docs`가 통과한다.

설정을 적용한 Claude Code 세션에서 아직 확인해야 하는 것:

1. Godot MCP가 연결되고, `get_godot_version`과 빈 프로젝트의 실행·디버그 출력 수집이 동작한다.
   외부 패키지 실행이 필요한 검증이라 설정 작성 중에는 실행하지 않았다.
2. `pixelfx`, `router`, `godot`, `disciplines` 플러그인이 설치·활성화되고 스킬 목록에 나타난다.
   스킬 설명이 예산 때문에 잘리는지 확인한다.
3. PixelFX 렌더 도구로 효과 하나를 렌더해 PNG와 JSON이 생성된다.

## 영향

### 기대 효과

* 프로젝트가 직접 만들고 유지할 에이전트 도구가 줄고, 각 도구의 상위 저장소가 Godot 버전
  변화를 따라가는 비용을 부담한다.
* 에이전트가 생성한 Godot 결과를 실제 엔진에서 실행해 확인할 수 있어, 평가 ADR 성공 기준의
  "headless 검사로 누락 경로와 잘못된 연결 탐지"에 가까워진다.
* 모델이 모르는 Godot 4.5–4.7 변경점을 참조 문서로 보완한다.

### 비용과 위험

* 외부 도구 네 개의 갱신을 각각 추적해야 한다. 특히 Godot MCP는 npm 배포가 보안 수정을
  따라오지 못했으므로, 커밋 갱신 시 변경 내역을 직접 확인해야 한다.
* 스킬 수가 늘어 상시 컨텍스트가 커지고, 스킬 설명 예산을 넘으면 OMC·GDD 스킬을 포함한 자동
  선택 정확도가 떨어질 수 있다. 문제가 확인되면 묶음을 줄이거나 필요한 스킬만 복사하는 방식으로
  바꾼다.
* 일부만 가져온 claude-code-game-studios 파일은 상위 갱신을 자동으로 받지 못하고, 수정본과
  원본의 차이를 직접 관리해야 한다.
* 외부 스킬과 이 레포 지침이 같은 작업에 다른 절차를 권할 수 있다. 우선순위 원칙으로 해결하되,
  반복되는 충돌은 해당 스킬을 제거하는 근거로 삼는다.
* Godot 평가가 LÖVE 유지로 끝나면 이 도구들은 제거한다. 제거는 `.mcp.json`의 `godot` 항목,
  `.claude/settings.json`의 마켓플레이스·플러그인 항목, `.claude/` 아래 가져온 파일 삭제로
  끝나야 한다.

## 근거

- [Godot과 PixelFX를 이용한 게임 제작 경로 평가](2026-11-11-godot-pixelfx-evaluation.md)
- [Claude Code Game Studios의 게임 제작 워크플로 선택적 활용 검토](2026-11-10-claude-code-game-studios-evaluation.md)
- [Pixelbolt를 활용한 코드 기반 이펙트 제작 계획](2026-11-09-pixelbolt-vfx-plan.md)
- [Godot MCP README](https://github.com/Coding-Solo/godot-mcp/blob/1209744fad78f3998f98c7394fd0f6ef50da5281/README.md)
- [Godot MCP 보안 수정 PR #99](https://github.com/Coding-Solo/godot-mcp/pull/99)
- [PixelFX Claude Code 스킬 설치](https://github.com/patch-gg/pixelfx/blob/5294518ce7c72e48b6100a744596e0acf57f2826/README.md)
- [PixelFX NOTICE](https://github.com/patch-gg/pixelfx/blob/5294518ce7c72e48b6100a744596e0acf57f2826/NOTICE.md)
- [awesome-gamedev-agent-skills 설치 안내와 스킬 예산](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/c6ca6c41c839b68319ffc08430b99ab768debc32/docs/INSTALLATION.md)
- [awesome-gamedev-agent-skills 플러그인 묶음](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/c6ca6c41c839b68319ffc08430b99ab768debc32/.claude-plugin/marketplace.json)
- [claude-code-game-studios Godot 엔진 참조](https://github.com/donchitos/claude-code-game-studios/tree/abc0de79d6ceb0b5d7aa693945849b3937afbe6a/docs/engine-reference/godot)
- [claude-code-game-studios LICENSE](https://github.com/donchitos/claude-code-game-studios/blob/abc0de79d6ceb0b5d7aa693945849b3937afbe6a/LICENSE)
