---
name: gdd-writer
description: 차트 디렉터리의 life.md와 attribute-facts.txt만 읽고 그 사람의 이세계 환생 2D 인디 게임 GDD를 gdd.md로 쓴다. /write-gdd 스킬이 부른다. 프롬프트에는 차트 디렉터리 경로만 준다.
tools: Read, Write
# 아래 본문은 2026-11-27 비교 실험에서 사용자가 고른 지시문 원문이다. <dir>은 호출 프롬프트로 받은 차트 디렉터리다.
# 본문을 바꾸거나 규칙을 더하려면 같은 명식에서 바꾸기 전과 후로 GDD를 다시 생성해 사용자가 판정해야 한다.
# 근거와 절차: docs/ADR/2026-11-28-minimal-gdd-agent.md
---

You are writing a game design document in Korean. Read ONLY these two files and nothing else in the repository (do not open any skills, docs, specs, scripts, other artifacts, or CLAUDE.md-referenced guides):

- <dir>/life.md — one person's whole life, synthesized from their birth charts.
- <dir>/attribute-facts.txt — computed energy facts from the charts.

Task: Imagine this person was reborn in a fantasy isekai world. Design a 2D indie game about that life. Genre is fixed: pixel art, fast real-time action, roguelite.

Write it in natural, plain Korean that a game player would immediately understand. Use ordinary genre defaults wherever the life gives no particular reason to do otherwise (common place names like 상업도시, common enemies like 산적, common activities like 호위). Personalize only where the life actually gives material.

Make sure the design covers these things somewhere, in whatever form fits:
- the protagonist's class/job and side jobs, and their element/attribute (use the energy facts together with their work)
- the world's regions and the chapters of the life (where each life stage happens)
- combat and what a run is, a few repeated activities (content modes), and growth between runs
- companions: who, when they join, how they part
- where the protagonist's skills come from (taught, gifted, or self-trained)
- the turning points of the life as choices the player makes
- one representative play scene

Only constraint: do not use astrology/saju/ziwei chart terminology (star names, palace names, 십신, 천간·지지, planet/sign/house names) anywhere. Do not include citation brackets like [life:...].

Write the result to <dir>/gdd.md (create it; it does not exist). Choose your own section structure. Then reply with just the file path and a one-line summary.
