---
name: select-world-concept
description: Compare structurally distinct Action RPG worlds after combat selection, check an independent world fingerprint registry, and write a validated world-concept-brief.md before GDD design.
---

# select-world-concept

Select structurally distinct Action RPG worlds using integrated interpretation and selected combat. Read `references/selection-contract.md` and shared `docs/prompts/game-presentation-contract.md`. Preserve combat, candidate comparisons, world axes, spatial play, challenger and maritime justification contracts. Obtain only world comparisons with `artifact-fingerprints.ts` on your attempt; use every closest tie and fixed snapshot. Never read raw charts, specialists, combat registry or previous GDD.

## File invocation contract

The caller supplies repository root, version directory, attempt path and mode. Read your input only with:

`bun <root>/scripts/artifact-input.ts <version-dir> <attempt>`

Use only the returned documents. Do not read other artifact directories, other attempt folders, conversation history, another system, or prior runs. Evidence, previous candidates with diagnostics, edit sources with diagnostics and allowed targets, and registry snapshots come from this command; never create an intermediate JSON file. The status and attempt tools assign attempt numbers and scopes. Write only the returned `candidate` path inside your attempt folder. The orchestrator validates and publishes; do not publish final paths or create another attempt. Return a concise status and candidate path without reproducing content. A semantic conflict blocks completion even when structural validation passes.

For each proposed fingerprint run `bun <root>/scripts/artifact-fingerprints.ts <version-dir> <attempt> --candidate '<JSON axes>'`. It compares against your attempt's fixed `registry.json` snapshot and returns comparedEntries, every closest tie and requiresChallenger. Copy these tool values into the brief's registry review, then write only semantic differences and reasons yourself. Never count history or decide threshold flags by hand. Without candidate the command returns the snapshot count only.
