# ADR: LibreSprite를 게임 이미지 생성 도구로 활용

* **Status:** Accepted — 활용 결정, 설치 및 생성 절차 검증 전
* **Date:** 2026-11-09
* **Decision Owners:** Project Owner
* **Scope:** 게임용 픽셀 이미지 생성

## 배경

게임에 사용할 픽셀 이미지를 제작하면서 생성 절차를 최대한 코드로 관리하고자 한다.
무료로 사용할 수 있고, 스크립트 생성과 시각적 편집을 함께 지원하는 도구가 필요하다.

[LibreSprite](https://github.com/LibreSprite/LibreSprite)는 Aseprite의 마지막 GPL 버전에서
분기해 독립적으로 개발되는 무료 오픈소스 픽셀 이미지·애니메이션 편집기다.

## 결정

LibreSprite를 게임 이미지 생성 도구로 활용한다. JavaScript 스크립트로 이미지를 생성하고,
필요한 경우 편집기에서 결과를 확인·보정하며 PNG 또는 스프라이트시트로 내보낸다.

- 생성 스크립트와 팔레트 등 재사용할 제작 원본, 사용한 도구 버전과 생성 명령을 관리한다.
  편집기에서 보정한 경우 보정 원본도 함께 관리한다.
- CLI 배치 실행과 스크립팅은 선택한 배포판에서 지원 범위를 확인한 뒤 연결한다.
  Aseprite의 Lua API와 호환된다고 가정하지 않는다.
- LÖVE2D는 출력 이미지를 사용하며 LibreSprite를 게임 실행 의존성으로 추가하지 않는다.

이 결정은 이미지 제작 도구의 활용에 한정한다. 기존
[Pixelbolt 활용 계획](2026-11-09-pixelbolt-vfx-plan.md)의 변경이나 대체 여부는 별도로 판단한다.

## 비용과 라이선스

LibreSprite 프로그램은 GPL-2.0으로 제공된다. 직접 제작한 이미지는 상용 게임에 사용할 수
있으며, 도구 사용만으로 해당 이미지나 게임 전체를 GPL로 공개할 의무가 생기지는 않는다.
외부 소재를 입력으로 사용하면 해당 소재의 라이선스는 별도로 확인한다.
LibreSprite 프로그램 자체를 수정·재배포하는 경우에는 GPL 배포 조건을 따른다.

## 검증과 한계

설치와 생성 자동화는 아직 수행하지 않았다. 적용 시 작은 이미지 하나를 스크립트로 생성하고
저장·재생성하여 픽셀 크기, 팔레트, 투명 배경과 출력 결과를 확인한다. 애니메이션을 제작할
경우에는 프레임과 재생 시간도 확인한다. 도구 채택만으로 미술 품질을 보장하지 않는다.

## 근거

- [LibreSprite 소개와 연혁](https://github.com/LibreSprite/LibreSprite#readme)
- [GPL-2.0 라이선스](https://github.com/LibreSprite/LibreSprite/blob/master/LICENSE.txt)
- [스크립팅 API](https://github.com/LibreSprite/LibreSprite/blob/master/SCRIPTING.md)
- [CLI 옵션 구현](https://github.com/LibreSprite/LibreSprite/blob/master/src/app/app_options.cpp)
