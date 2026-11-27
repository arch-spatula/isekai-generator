# isekai-generator

~~오픈소스로 공개하는 내가 부끄럽다.~~

> 본인의 생년월일 + 태어난 시간 + 태어난 도시(사주팔자, 자미두수, 네이탈 차트)를 활용해서 본인만이 경험할 수 있는 이세계 게임 생성기

multi agent workflow라고 불러야 할지 multi agent orchestration라고 불러야 할지는 잘 모르겠지만 어째는 본인만이 경험할 수 있는 게임을 생성해주는 레포입니다. 사실 가능할지도 잘 모르겠습니다. 거의 AI 프롬프트질 차력쇼 레포라고 말 할 수 있을 것 같습니다.

## 개발 환경

Node.js, Bun, Lua와 LÖVE2D는 Nix 개발 셸에서 제공합니다. `just`가 설치되어 있다면 저장소 루트에서 다음 명령으로 진입합니다.

```bash
just shell
```

현재 개발 셸에는 Codex CLI, Node.js 24, npm, Bun, just, Lua 5.1, LÖVE2D가 포함되어 있습니다. 정확한 버전은 `flake.lock`에 고정됩니다. 독립 실행용 Lua는 LÖVE의 Lua 5.1 계열과 맞추도록 `lua5_1` 패키지를 사용하며, LÖVE는 자체 런타임으로 게임을 실행합니다.

이 PC에 전역으로 설치된 Codex 대신 저장소에 고정된 Codex를 사용하려면 개발 셸 안에서 실행합니다.

```bash
just shell
codex
```

셸에 진입하지 않고 바로 실행할 수도 있습니다.

```bash
nix develop 'path:.' --command codex
```

두 방법 모두 저장소의 `flake.lock`이 지정한 Codex를 실행합니다. `just versions`로 실제 버전을 확인할 수 있습니다. Codex 인증은 실행 파일과 별개로 사용자 홈의 `~/.codex`에 저장되므로, 같은 사용자 계정에서는 기존 로그인을 그대로 사용합니다. 별도의 `CODEX_HOME`을 지정하거나 다른 사용자 또는 PC에서 실행하면 다시 로그인해야 할 수 있습니다.

반복해서 사용하는 프로젝트 명령은 루트 `justfile`에서 관리합니다. `just shell`로 먼저 진입하지 않아도 각 명령이 필요한 도구를 Nix 개발 셸 안에서 자동으로 실행합니다.

```bash
just          # 사용 가능한 명령 보기
just help     # 사용 가능한 명령과 설명 보기
just shell    # Nix 개발 셸 진입
just versions # 개발 도구 버전 확인
just report   # 전달한 출생정보의 전체 명식 보고서 출력
just test     # 자동화 테스트 실행
```

`just`가 설치되어 있지 않은 환경에서는 `nix develop`로 직접 진입할 수 있습니다.

개발 셸 안에서 `lua <script.lua>`로 Lua 스크립트를 실행하고, `main.lua`가 있는 게임 디렉터리를 `love <game-directory>`로 실행합니다. 셸에 진입하지 않고 실행하려면 다음과 같이 사용합니다.

```bash
nix develop 'path:.' --command lua -v
nix develop 'path:.' --command love --version
nix develop 'path:.' --command love <game-directory>
```

명식 보고서는 저장소에 고정된 개인 프로필을 사용하지 않습니다. 생년월일시, 성별, 좌표와
타임존을 실행할 때 전달해야 합니다.

```bash
just report -- \
  --year <year> --month <month> --day <day> \
  --hour <hour> --minute <minute> --gender <M|F> \
  --latitude <latitude> --longitude <longitude> \
  --timezone <IANA timezone> [--flow-year <year>]
```

## 스킬 호출 예시

아래 예시는 저장소를 연 에이전트의 채팅 입력입니다. 터미널 명령이 아니며,
`<...>`는 실제 입력이나 경로로 바꿉니다.

일반 수정이나 spec 구현은 단일 에이전트로 요청합니다.

```text
docs/spec/<명세 파일>.md를 구현해줘.
```

구현·테스트 작성·테스트 리뷰를 별도 에이전트로 진행하려면
[implement-with-test-review](.agents/skills/implement-with-test-review/SKILL.md)를 명시적으로 호출합니다.
일반 구현 요청이나 spec의 참조만으로 이 방식을 자동 실행하지 않습니다.

```text
$implement-with-test-review docs/spec/<명세 파일>.md를 구현해줘.
```

명식 계산과 일생 해석은 Claude Code의 스킬로 요청합니다. 각 스킬은 같은 차트 폴더에 파일 하나를 쓰고, 앞 단계 파일이 없으면
만드는 방법을 알린 뒤 멈춥니다. 달력 구분을 생략한 생년월일은 **양력**으로 처리하며, 시간대는 출생지에서 정합니다.

```text
/chart-report <생년월일> <시:분> <도시> <성별>, 파일로 저장해줘
/saju-judgment <차트 폴더>
/ziwei-judgment <차트 폴더>
/natal-judgment <차트 폴더>
/saju-life <차트 폴더>
/ziwei-life <차트 폴더>
/natal-life <차트 폴더>
/life-integration <차트 폴더>
```

일생 해석 사이에는 스크립트 단계가 있습니다. `/<체계>-life` 앞에 `bun scripts/derive-judgment-facts.ts <saju|ziwei> <차트 폴더>`,
`/life-integration` 앞에 `bun scripts/assemble-life-material.ts <차트 폴더>`를 실행합니다. 스킬이 필요한 시점에 알려 줍니다.
`life.md` 다음은 게임 설계 단계입니다. 각 단계는 앞 단계 문서만 읽습니다([Claude 게임 설계 흐름](docs/spec/claude-game-design-flow.md)).

```text
/translate-life <차트 폴더>
/design-identity <차트 폴더>
/design-combat <차트 폴더>
/design-world <차트 폴더>
/write-gdd <차트 폴더>
```

| 스킬 | 용도 |
| --- | --- |
| [chart-report](.claude/skills/chart-report/SKILL.md) | 출생정보로 사주·자미두수·네이탈 차트와 판단 근거 사실 계산 |
| [saju-judgment](.claude/skills/saju-judgment/SKILL.md) 외 2개 | 체계별 1차 판단 |
| [saju-life](.claude/skills/saju-life/SKILL.md) 외 2개 | 체계별 일생 해석 |
| [life-integration](.claude/skills/life-integration/SKILL.md) | 세 체계 일생 해석을 하나의 일생 통합 해석(`life.md`)으로 합침 |
| [translate-life](.claude/skills/translate-life/SKILL.md) | `life.md`를 게임 재료로 옮긴 번역 브리프(`translation-brief.md`) |
| [design-identity](.claude/skills/design-identity/SKILL.md) | 클래스·속성·부직업·출신지를 정한 이세계 정체성(`identity.md`) |
| [design-combat](.claude/skills/design-combat/SKILL.md) | 클래스 안에서 후보 네 개를 비교해 고른 전투 설계(`combat.md`) |
| [design-world](.claude/skills/design-world/SKILL.md) | 출신지에서 출발해 세계를 먼저 세우고 장마다 지역을 고른 세계 설계(`world.md`) |
| [write-gdd](.claude/skills/write-gdd/SKILL.md) | 앞 네 문서를 잇는 GDD(`gdd.md`) |

`/design-identity`·`/design-combat`·`/design-world`는 검증기를 통과한 뒤 작성자와 다른 검토 에이전트([game-step-reviewer](.claude/agents/game-step-reviewer.md))를 불러 `<단계>-review-<n>.md`를 남깁니다.

## 크레딧

이 프로젝트의 사주팔자·자미두수·네이탈 차트 계산에는 [Orrery의 `@orrery/core`](https://github.com/rath/orrery/tree/main/packages/core)를 사용할 예정입니다. Orrery가 밝힌 계산 엔진의 계보와 기반 기술은 다음과 같습니다.

- 사주 만세력: 고영창님의 Perl [진짜만세력](https://afnmp3.homeip.net/~kohyc/calendar/cal20000.html)을 김정균님이 [PHP로 포팅](https://github.com/OOPS-ORG-PHP/Lunar)하고, 황장호가 2018년 11월 Java와 Python으로 옮겨 사용하다가 2026년 2월 Claude Code(Opus 4.6)를 통해 TypeScript로 포팅했습니다.
- 자미두수 명반: [`lunar-javascript`](https://www.npmjs.com/package/lunar-javascript)를 기반으로 Claude(Opus 4.5)가 중국어 문헌을 조사하며 구현했습니다.
- 점성술 출생차트: [Swiss Ephemeris](https://www.astro.com/swisseph/)의 Moshier 이론을 순수 TypeScript로 포팅했습니다.

## 라이선스

Copyright (C) 2026 김상현

이 프로젝트는 [GNU Affero General Public License v3.0 only](LICENSE)에 따라 배포됩니다.

### 쉽게 설명하면

할 수 있는 일:

- 개인적으로 자유롭게 사용하고 수정할 수 있습니다.
- 소스 코드를 읽고 공부할 수 있습니다.
- 수정한 버전을 다른 사람에게 배포할 수 있습니다.

지켜야 할 일:

- 수정하거나 이 코드를 포함한 프로그램을 배포할 때는 전체를 AGPL-3.0으로 공개해야 합니다.
- 웹 서비스처럼 네트워크를 통해 제공하는 경우에도 이용자가 해당 버전의 소스 코드를 받을 수 있어야 합니다.
- 변경한 사실을 표시하고 기존 저작권 및 라이선스 고지를 유지해야 합니다.

할 수 없는 일:

- 이 코드를 포함하거나 수정한 서비스를 소스 비공개 상태로 제공할 수 없습니다.
- AGPL 코드를 MIT나 Apache 같은 더 허용적인 라이선스로 바꾸어 배포할 수 없습니다.

한 줄로 말하면, 자유롭게 사용하고 고칠 수 있지만 배포하거나 서비스로 제공하는 버전의 소스도 같은 AGPL-3.0 조건으로 공개해야 합니다.
