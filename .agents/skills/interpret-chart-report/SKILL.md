---
name: interpret-chart-report
description: Integrate separate Saju, Zi Wei Dou Shu, and Western natal specialist interpretations into a Korean chart-interpretation.md that preserves every specialist item, system-specific resolution, cross-system relationship, and reusable creative seed. Use after three isolated specialist interpretation agents and before personalized GDD design.
---

# interpret-chart-report

Integrate all three supplied specialist interpretations into Korean. Read `references/interpretation-format.md`, `references/<mode>-mode.md`, and the supplied common interpretation guidelines. Preserve every specialist item, system-specific resolution and reusable creative seed, make cross-system evidence relationships explicit, and cover every specialist ID. Do not recalculate or reinterpret charts independently.

## SQLite invocation contract

The caller supplies repository root, run ID, attempt ID, claim, mode, and the reserved Markdown output. Read your input only with:

`bun <root>/scripts/read-artifact-state.ts input --attempt <id> --claim <claim> --root <root>`

Use the returned allowlist. Do not read other artifact directories, conversation history, another system, or prior runs. Evidence, diagnostics, previous results and registry snapshots are returned from SQLite; never create an intermediate JSON file. The DB assigns numbers and scopes. Write only your reserved Markdown. The orchestrator submits and finishes the attempt; do not publish final paths or allocate another attempt. Return a concise status and output path without reproducing content. A semantic conflict blocks completion even when structural validation passes.
