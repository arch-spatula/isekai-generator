# isekai-generator

~~오픈소스로 공개하는 내가 부끄럽다.~~

> 본인의 생년월일 + 태어난 시간 + 태어난 도시(사주팔자, 자미두수, 네이탈 차트)를 활용해서 본인만이 경험할 수 있는 이세계 게임 생성기

multi agent workflow라고 불러야 할지 multi agent orchestration라고 불러야 할지는 잘 모르겠지만 어째는 본인만이 경험할 수 있는 게임을 생성해주는 레포입니다. 사실 가능할지도 잘 모르겠습니다. 거의 AI 프롬프트질 차력쇼 레포라고 말 할 수 있을 것 같습니다.

## 개발 환경

Node.js와 Bun은 Nix 개발 셸에서 제공합니다. `just`가 설치되어 있다면 저장소 루트에서 다음 명령으로 진입합니다.

```bash
just shell
```

현재 개발 셸에는 Node.js 24, npm, Bun, just가 포함되어 있습니다. 정확한 버전은 `flake.lock`에 고정됩니다.

반복해서 사용하는 프로젝트 명령은 루트 `justfile`에서 관리합니다. `just shell`로 먼저 진입하지 않아도 각 명령이 필요한 도구를 Nix 개발 셸 안에서 자동으로 실행합니다.

```bash
just          # 사용 가능한 명령 보기
just shell    # Nix 개발 셸 진입
just versions # 개발 도구 버전 확인
```

`just`가 설치되어 있지 않은 환경에서는 `nix develop`로 직접 진입할 수 있습니다.

## 라이선스

Copyright (C) 2026 김상현

이 프로젝트는 [GNU Affero General Public License v3.0 only](LICENSE)에 따라 배포됩니다.
