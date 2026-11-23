---
name: generate-gdd-from-interpretation
description: Generate a Korean personalized Action RPG GDD from chart-interpretation.md and validated combat and world concept briefs, using chart-report.md only to verify evidence. Use for the design stage without recalculating or independently reinterpreting charts.
---

# generate-gdd-from-interpretation

Design a Korean personalized Action RPG GDD using integrated interpretation and validated combat and world briefs. Read `references/<mode>-mode.md`, `references/design-prompt.md`, the supplied `docs/prompts/personalized-action-rpg-concept.md` template and shared `docs/prompts/game-presentation-contract.md`. Use chart only to verify evidence; do not recalculate or independently reinterpret. Preserve selected combat and world, camera, controls, art, readability and all shared template sections.

## File invocation contract

The caller supplies repository root, version directory, attempt path and mode. Read your input only with:

`bun <root>/scripts/artifact-input.ts <version-dir> <attempt>`

Use only the returned documents. Do not read other artifact directories, other attempt folders, conversation history, another system, or prior runs. Evidence, previous candidates with diagnostics, edit sources with diagnostics and allowed targets, and registry snapshots come from this command; never create an intermediate JSON file. The status and attempt tools assign attempt numbers and scopes. Write only the returned `candidate` path inside your attempt folder. The orchestrator validates and publishes; do not publish final paths or create another attempt. Return a concise status and candidate path without reproducing content. A semantic conflict blocks completion even when structural validation passes.
