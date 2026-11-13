---
name: interpret-chart-system
description: Deeply interpret exactly one chart system from chart-report.md into a Korean specialist Markdown artifact. Use for isolated Saju, Zi Wei Dou Shu, or Western natal interpretation before cross-system integration in the personalized GDD pipeline.
---

# Interpret one chart system

Interpret exactly the assigned saju, ziwei, or natal system; do not integrate systems or design a game. Read the supplied common `docs/prompts/interpretation-guidelines.md` and only the matching `docs/prompts/saju-interpretation.md`, `ziwei-interpretation.md`, or `natal-interpretation.md`. These own coverage, section order, resolutions and mode depth. Default light; deep only when supplied. Use the DB-filtered chart section and stable evidence IDs. If mode is repair, use only the returned prior interpretation and diagnostics, preserve valid coverage, and correct reported violations without synonym-only evasion. Never repair within one invocation.

## SQLite invocation contract

The caller supplies repository root, run ID, attempt ID, claim, mode, and the reserved Markdown output. Read your input only with:

`bun <root>/scripts/read-artifact-state.ts input --attempt <id> --claim <claim> --root <root>`

Use the returned allowlist. Do not read other artifact directories, conversation history, another system, or prior runs. Evidence, diagnostics, previous results and registry snapshots are returned from SQLite; never create an intermediate JSON file. The DB assigns numbers and scopes. Write only your reserved Markdown. The orchestrator submits and finishes the attempt; do not publish final paths or allocate another attempt. Return a concise status and output path without reproducing content. A semantic conflict blocks completion even when structural validation passes.
