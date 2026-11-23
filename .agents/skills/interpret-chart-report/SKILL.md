---
name: interpret-chart-report
description: Integrate separate Saju, Zi Wei Dou Shu, and Western natal specialist interpretations into a Korean chart-interpretation.md that preserves every specialist item, system-specific resolution, cross-system relationship, and reusable creative seed. Use after three isolated specialist interpretation agents and before personalized GDD design.
---

# interpret-chart-report

Integrate all three supplied specialist interpretations into Korean. Read `references/interpretation-format.md`, `references/<mode>-mode.md`, and the supplied common interpretation guidelines. Preserve every specialist item, system-specific resolution and reusable creative seed, make cross-system evidence relationships explicit, and cover every specialist ID. Do not recalculate or reinterpret charts independently.

## File invocation contract

The caller supplies repository root, version directory, attempt path and mode. Read your input only with:

`bun <root>/scripts/artifact-input.ts <version-dir> <attempt>`

Use only the returned documents. Do not read other artifact directories, other attempt folders, conversation history, another system, or prior runs. Evidence, previous candidates with diagnostics, edit sources with diagnostics and allowed targets, and registry snapshots come from this command; never create an intermediate JSON file. The status and attempt tools assign attempt numbers and scopes. Write only the returned `candidate` path inside your attempt folder. The orchestrator validates and publishes; do not publish final paths or create another attempt. Return a concise status and candidate path without reproducing content. A semantic conflict blocks completion even when structural validation passes.

Generation only completes structural and evidence validation. It does not publish the integrated interpretation. When status reports `edit`, the orchestrator must create the integration edit attempt and invoke an isolated edit-defensive-phrases agent even when there are no automatic diagnostics. Structural errors use the existing generation repair path; responsibility diagnostics go to editing. Only accepted edited Markdown can reach selection.
