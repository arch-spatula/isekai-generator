---
name: generate-gdd-from-interpretation
description: Generate a Korean personalized Action RPG GDD from chart-interpretation.md and validated combat and world concept briefs, using chart-report.md only to verify evidence. Use for the design stage without recalculating or independently reinterpreting charts.
---

# generate-gdd-from-interpretation

Design a Korean personalized Action RPG GDD using integrated interpretation and validated combat and world briefs. Read `references/<mode>-mode.md`, `references/design-prompt.md`, the supplied `docs/prompts/personalized-action-rpg-concept.md` template and shared `docs/prompts/game-presentation-contract.md`. Use chart only to verify evidence; do not recalculate or independently reinterpret. Preserve selected combat and world, camera, controls, art, readability and all shared template sections.

## SQLite invocation contract

The caller supplies repository root, run ID, attempt ID, claim, mode, and the reserved Markdown output. Read your input only with:

`bun <root>/scripts/read-artifact-state.ts input --attempt <id> --claim <claim> --root <root>`

Use the returned allowlist. Do not read other artifact directories, conversation history, another system, or prior runs. Evidence, diagnostics, previous results and registry snapshots are returned from SQLite; never create an intermediate JSON file. The DB assigns numbers and scopes. Write only your reserved Markdown. The orchestrator submits and finishes the attempt; do not publish final paths or allocate another attempt. Return a concise status and output path without reproducing content. A semantic conflict blocks completion even when structural validation passes.
