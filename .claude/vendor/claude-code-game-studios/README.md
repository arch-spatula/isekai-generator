# Claude Code Game Studios에서 가져온 파일

[Claude Code Game Studios](https://github.com/Donchitos/Claude-Code-Game-Studios)의 일부를
가져왔다. 원본 라이선스는 같은 디렉터리의 [LICENSE](LICENSE)(MIT)다. 도입 범위와 이유는
[Godot 게임 제작용 에이전트 도구 생태계 도입](../../../docs/ADR/2026-11-17-godot-agent-tooling-ecosystem.md)에 있다.

* 원본 커밋: `abc0de79d6ceb0b5d7aa693945849b3937afbe6a` (1.3.0)
* 가져온 날짜: 2026-11-17

## 파일 대응

| 이 레포 경로 | 원본 경로 | 수정 |
|---|---|---|
| `.claude/vendor/claude-code-game-studios/engine-reference/godot/` | `docs/engine-reference/godot/` | 아래 2건 |
| `.claude/vendor/claude-code-game-studios/scripts/godot-parse-check.gd` | `.claude/scripts/godot-parse-check.gd` | 없음 |
| `.claude/rules/scene-files.md` | `.claude/rules/scene-files.md` | 없음 |
| `.claude/agents/godot-specialist.md` | 같은 경로 | 아래 공통·개별 수정 |
| `.claude/agents/godot-gdscript-specialist.md` | 같은 경로 | 아래 공통·개별 수정 |
| `.claude/agents/godot-shader-specialist.md` | 같은 경로 | 아래 공통·개별 수정 |

## 수정 내용

엔진 참조:

* `VERSION.md`의 `Installed at pin time`에 Nix `godot_4_7`의 4.7.2-stable을 기록했다.
* `current-best-practices.md`의 파싱 검사 명령에 `godot-parse-check.gd`를 Godot 프로젝트로
  복사해야 한다는 안내를 덧붙였다. 스크립트는 `res://` 경로로 실행되므로 이 레포의
  `.claude/`에서는 직접 실행되지 않는다.

에이전트 공통:

* 참조 경로 `docs/engine-reference/godot/`를 위 vendor 경로로 바꿨다.
* 원본의 `production/` 오케스트레이션 예외 조항을 제거했다. 이 레포에는 해당 디렉터리 규약이 없다.
* 이 레포에 없는 스튜디오 역할(technical-director, lead-programmer, gameplay-programmer,
  art-director 등)로의 위임·보고 문구를 제거하고, 결정은 사용자나 호출한 에이전트에게
  보고하도록 바꿨다.

에이전트 개별:

* `godot-specialist`: C#·GDExtension 언어 선택 안내를 GDScript 유지(평가 ADR 결정)로 바꾸고,
  하위 전문가를 GDScript·셰이더 2개로 줄였다. `project.yaml` 엔진 확인 문단을 LÖVE 작업은
  호출자에게 남긴다는 안내로 바꿨다.
* `godot-gdscript-specialist`: GDExtension 이전 기준을 프로파일링 결과 보고로 바꿨다.
* `godot-shader-specialist`: 시각 방향 기준을 `docs/spec/game-presentation-contract.md`로 바꿨다.

## 갱신

원본을 갱신할 때는 새 커밋에서 위 원본 경로를 다시 가져오고 같은 수정을 다시 적용한 뒤,
이 문서의 커밋과 날짜를 바꾼다. 수정 후에는 에이전트 파일이 존재하지 않는 에이전트나 경로를
참조하지 않는지 확인한다.
