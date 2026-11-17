# Godot 최소 전투 방 템플릿

[Godot 최소 전투 방 템플릿 명세](../../docs/spec/godot-minimal-template.md) 8절 2단계의 구현이다.
씬과 스크립트는 고정이고, 기획마다 달라지는 값은 `data/slots.json`만 바꾼다. 지금 들어 있는
값은 명세 7절의 "형태 전환형" 합성 입력이다.

## 실행

개발 셸(`just shell`)에서 이 디렉터리를 기준으로 실행한다.

```bash
godot --headless --path . --import                       # 가져오기, 처음과 에셋 변경 후
godot --headless --path . -s res://tools/godot-parse-check.gd -- \
  $(find scripts tests -name '*.gd' | sed 's#^#res://#')  # 파싱 검사
godot --headless --path . -s res://tests/smoke_test.gd   # 스모크 테스트, 실패 시 종료 코드 1
godot --path .                                           # 직접 플레이
```

`--check-only`는 `class_name` 캐시와 오토로드를 모르므로 파싱 검사로 쓰지 않는다.

## 조작

| 동작 | 키보드 | 게임패드 |
|---|---|---|
| 이동 | WASD, 방향키 | 왼쪽 스틱, 십자키 |
| 공격 (연타로 연계) | J, Z | X |
| 회피 | K, X | A |
| 형태 전환 | L, C | Y |
| 일시정지 | Esc | Start |
| 공격 키 재지정 | 일시정지 중 R, 그다음 새 키 | — |

## 슬롯 필드

길이는 픽셀, 시간은 초다. 입력 검증은 채우기 도구(명세 8절 3단계)의 책임이며, 템플릿은 값을 읽기만 한다.

| 필드 | 의미 |
|---|---|
| `fingerprint` | 기획서의 전투 축 7개. 실행에는 쓰지 않고 지원 범위 판정에 쓴다 |
| `player.moveSpeed`, `maxHealth` | 이동 속도(px/s), 최대 체력 |
| `player.dodge.distance`, `duration`, `invulnerable` | 회피 이동 거리, 걸리는 시간, 무적 시간 |
| `forms[].shape` | `thrust`(직선, `width` 사용), `arc`(원호, `arcDegrees`), `area`(전방 `range` 지점의 원, `radius`), `projectile`(`speed`, 지름 `width`) |
| `forms[].range`, `damage`, `windup`, `active`, `recovery`, `combo` | 사거리, 피해, 준비·유효·회복 시간, 최대 연타 수 |
| `forms[].effect` | `assets/effects/` 아래 PixelFX 효과 ID |
| `formSwitch.duration`, `sideStep` | 전환에 걸리는 시간, 그동안의 측면 이동 거리 |
| `formSwitch.earlyWindow`, `focusBreakDelay` | 직전 전환 후 이 시간 안에 다시 전환하면 집중이 깨지고, 그 시간만큼 공격·회피가 막힌다 |
| `enemies[]` | 정확히 3개. `type`은 `charger`, `shielder`(정면 피해 막음), `ranged` |
| `palette` | 자리표시자 도형과 타일 색 |
| `labels` | 화면에 표시할 형태 이름 |

## 알려진 한계

- 캐릭터와 타일은 팔레트 색의 단순 도형이다. 픽셀아트 제작 도구가 정해지면 바꾼다.
- 기본 폰트에 한글이 없어서 예시 `labels`는 영어로 두었다.
- PixelFX 효과는 옆에서 본 시점으로 그려져 있어 회전해서 쓰며, 크기도 16px 타일 기준보다 크다.
  탑다운 원근과 크기 적합성은 평가 ADR의 PixelFX 기준에 따라 사람이 판단한다.
- 효과음이 없다.

## PixelFX 효과 출처

`assets/effects/`의 PNG와 JSON은 PixelFX 커밋 `5294518ce7c72e48b6100a744596e0acf57f2826`에서
다음 명령으로 렌더했다. 같은 명령으로 다시 렌더한 결과가 바이트 단위로 같은 것을 확인했다.

```bash
node tools/render.mjs <id> --sheet --no-actor --seed 1 --out <dir>
```

| ID | 쓰임 |
|---|---|
| `melee/thrust` | 예시 형태 `spear` |
| `melee/spin-slash` | 예시 형태 `ring` |
| `impacts/hit-spark` | 명중 표시 (템플릿 고정) |
| `projectiles/energy-disc` | `ranged` 적의 투사체 (템플릿 고정) |

라이선스는 `assets/effects/PIXELFX-LICENSE`(MIT)와 `assets/effects/PIXELFX-NOTICE.md`에 있다.
