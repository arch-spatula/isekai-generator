---
name: select-world-concept
description: Compare structurally distinct Action RPG worlds after combat selection, check an independent world fingerprint registry, and write a validated world-concept-brief.md before GDD design.
---

# select-world-concept

Select structurally distinct Action RPG worlds using integrated interpretation and selected combat. Read `references/selection-contract.md` and shared `docs/prompts/game-presentation-contract.md`. Preserve combat, candidate comparisons, world axes, spatial play, challenger and maritime justification contracts. Obtain only world comparisons with `read-artifact-state.ts fingerprints --attempt <id> --kind world`; use every closest tie and fixed snapshot. Never read raw charts, specialists, combat registry or previous GDD.

## SQLite invocation contract

The caller supplies repository root, run ID, attempt ID, claim, mode, and the reserved Markdown output. Read your input only with:

`bun <root>/scripts/read-artifact-state.ts input --attempt <id> --claim <claim> --root <root>`

Use the returned allowlist. Do not read other artifact directories, conversation history, another system, or prior runs. Evidence, diagnostics, previous results and registry snapshots are returned from SQLite; never create an intermediate JSON file. The DB assigns numbers and scopes. Write only your reserved Markdown. The orchestrator submits and finishes the attempt; do not publish final paths or allocate another attempt. Return a concise status and output path without reproducing content. A semantic conflict blocks completion even when structural validation passes.

For each proposed fingerprint pass `--candidate '<JSON axes>'` to the fingerprints command. It returns comparedEntries, every closest tie, requiresChallenger and deterministic registryReview values. Copy these tool values into the brief, then write only semantic differences and reasons yourself. Never count history or decide threshold flags by hand. Without candidate the query returns snapshot revision and count only.
