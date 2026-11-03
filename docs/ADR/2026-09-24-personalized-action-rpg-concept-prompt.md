# ADR: 개인화 이세계 Action RPG 생성 프롬프트 설계

* **Status:** Accepted
* **Date:** 2026-09-24
* **Decision Owners:** Project Owner
* **Scope:** 사주팔자·자미두수·네이탈 차트를 Seed로 사용하는 개인화 이세계 Action RPG 생성 시스템
* **Related Artifact:** [개인화 이세계 Action RPG 생성 Master Prompt](../prompts/personalized-action-rpg-concept.md)

---

# 1. Context

본 프로젝트의 핵심 아이디어는 사용자의

* 생년월일
* 출생시간
* 출생도시

로부터 계산한

* 사주팔자
* 자미두수
* 서양 점성술 네이탈 차트

를 **창작적 Seed**로 사용하여 각 사용자에게 서로 다른 판타지 이세계 Action RPG 경험을 생성하는 것이다.

목표는 운세를 게임 형태로 보여주는 것이 아니다.

핵심 질문은 다음과 같다.

> **"이 사람이 판타지 이세계에 태어났다면 어떤 존재로 태어나, 어떤 삶을 살고, 어떤 방식으로 싸우며, 모험을 통해 무엇이 되어갈 것인가?"**



## Related Documents

- [출생 프로필 입력 UI 명세](../spec/birth-profile-input-ui.md)
- [개인화 Action RPG 생성 Master Prompt](../prompts/personalized-action-rpg-concept.md)

이 결정으로 Tauri 사용을 확정하지만, Tauri 플러그인 종류, 백그라운드 워커의 실행 방식,
로컬 저장소 형식 및 톱니바퀴의 시각 디자인은 후속 ADR 또는 상세 명세에서 결정한다.
