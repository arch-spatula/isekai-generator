---
name: select-gameplay-concept
description: Extract gameplay tendencies from an integrated chart interpretation, compare structurally distinct personalized Action RPG combat candidates, check prior fingerprints, and write a validated gameplay-concept-brief.md. Use between chart interpretation and GDD generation when selecting the protagonist's combat archetype without reading prior GDD content.
---

# select-gameplay-concept

Select structurally distinct personalized Action RPG combat candidates from integrated interpretation only. Read `references/selection-prompt.md`, `references/<mode>-mode.md`, and shared `docs/prompts/game-presentation-contract.md`. Preserve existing candidate, scoring, challenger, fingerprint and semantic differentiation contracts. Obtain only combat comparisons with `read-artifact-state.ts fingerprints --attempt <id> --kind combat`; use all closest ties and the fixed registry snapshot. Never read chart, specialist output, other registry or previous GDD.

## SQLite invocation contract

The caller supplies repository root, run ID, attempt ID, claim, mode, and the reserved Markdown output. Read your input only with:

`bun <root>/scripts/read-artifact-state.ts input --attempt <id> --claim <claim> --root <root>`

Use the returned allowlist. Do not read other artifact directories, conversation history, another system, or prior runs. Evidence, diagnostics, previous results and registry snapshots are returned from SQLite; never create an intermediate JSON file. The DB assigns numbers and scopes. Write only your reserved Markdown. The orchestrator submits and finishes the attempt; do not publish final paths or allocate another attempt. Return a concise status and output path without reproducing content. A semantic conflict blocks completion even when structural validation passes.

For each proposed fingerprint pass `--candidate '<JSON axes>'` to the fingerprints command. It returns comparedEntries, every closest tie, requiresChallenger and deterministic registryReview values. Copy these tool values into the brief, then write only semantic differences and reasons yourself. Never count history or decide threshold flags by hand. Without candidate the query returns snapshot revision and count only.
