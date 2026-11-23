---
name: select-gameplay-concept
description: Extract gameplay tendencies from an integrated chart interpretation, compare structurally distinct personalized Action RPG combat candidates, check prior fingerprints, and write a validated gameplay-concept-brief.md. Use between chart interpretation and GDD generation when selecting the protagonist's combat archetype without reading prior GDD content.
---

# select-gameplay-concept

Select structurally distinct personalized Action RPG combat candidates from integrated interpretation only. Read `references/selection-prompt.md`, `references/<mode>-mode.md`, and shared `docs/prompts/game-presentation-contract.md`. Preserve existing candidate, scoring, challenger, fingerprint and semantic differentiation contracts. Obtain only combat comparisons with `artifact-fingerprints.ts` on your attempt; use all closest ties and the fixed registry snapshot. Never read chart, specialist output, other registry or previous GDD.

## File invocation contract

The caller supplies repository root, version directory, attempt path and mode. Read your input only with:

`bun <root>/scripts/artifact-input.ts <version-dir> <attempt>`

Use only the returned documents. Do not read other artifact directories, other attempt folders, conversation history, another system, or prior runs. Evidence, previous candidates with diagnostics, edit sources with diagnostics and allowed targets, and registry snapshots come from this command; never create an intermediate JSON file. The status and attempt tools assign attempt numbers and scopes. Write only the returned `candidate` path inside your attempt folder. The orchestrator validates and publishes; do not publish final paths or create another attempt. Return a concise status and candidate path without reproducing content. A semantic conflict blocks completion even when structural validation passes.

For each proposed fingerprint run `bun <root>/scripts/artifact-fingerprints.ts <version-dir> <attempt> --candidate '<JSON axes>'`. It compares against your attempt's fixed `registry.json` snapshot and returns comparedEntries, every closest tie and requiresChallenger. Copy these tool values into the brief's registry review, then write only semantic differences and reasons yourself. Never count history or decide threshold flags by hand. Without candidate the command returns the snapshot count only.
