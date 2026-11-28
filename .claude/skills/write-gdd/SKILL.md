---
name: write-gdd
description: 일생 통합 해석(life.md)이 있는 차트 디렉터리에서 기운 사실을 계산하고 gdd-writer 에이전트를 불러 그 사람의 이세계 환생 게임 GDD(gdd.md)를 쓰게 한 뒤 차트 용어 검증기로 확인한다. GDD를 작성해 달라는 요청에 사용한다.
allowed-tools: Bash(bun scripts/attribute-facts.ts:*), Bash(bun scripts/check-gdd.ts:*)
---

# GDD 작성

계약: `docs/ADR/2026-11-28-minimal-gdd-agent.md`. GDD는 `gdd-writer` 에이전트가 쓴다. 이 스킬은 입력을 준비하고 부르기만 한다.

이 스킬과 `.claude/agents/gdd-writer.md`에 설계 규칙을 더하지 않는다. 지시문을 바꾸려면 같은 명식에서 바꾸기 전과 후로 GDD를 다시 생성하고 사용자가 판정해야 한다(ADR).

## 1. 대상 디렉터리

- 사용자가 준 차트 디렉터리, 또는 같은 대화에서 chart-report가 저장한 `chartDir`를 쓴다. 둘 다 없으면 묻는다.
  `artifacts/`를 탐색하거나 최신 버전을 추측하지 않는다.
- `test -e <디렉터리>/gdd.md`가 성공하면 덮어쓰지 않고 멈춘 뒤 알린다.
- `test -e <디렉터리>/life.md`가 실패하면 `/life-integration <디렉터리>`로 만들 수 있다고 알리고 멈춘다. 대신 실행하지 않는다.

## 2. 기운 사실

```bash
bun scripts/attribute-facts.ts <디렉터리> > <디렉터리>/attribute-facts.txt
```

## 3. 작성

Agent 도구로 `gdd-writer` 에이전트를 부른다. 프롬프트에는 차트 디렉터리 경로만 쓴다.
`life.md`의 내용, 이 대화의 맥락, 자신의 의견이나 요구는 넣지 않는다. 이 스킬을 부른 세션은 `life.md`와 `gdd.md`를 대신 쓰거나 고치지 않는다.

## 4. 검증

```bash
bun scripts/check-gdd.ts <디렉터리>
```

- 출력이 없고 exit 0이면 끝이다.
- 차트 명칭이 나오면 그 줄과 이름을 사용자에게 알리고 멈춘다. 이 세션이 직접 고치지 않는다.

## 5. 보고

`gdd.md` 경로와 에이전트의 한 줄 요약을 알린다. 문서 본문을 다시 옮겨 쓰지 않는다.
