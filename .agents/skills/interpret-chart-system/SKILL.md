---
name: interpret-chart-system
description: Deeply interpret exactly one chart system from chart-report.md into a Korean specialist Markdown artifact. Use for isolated Saju, Zi Wei Dou Shu, or Western natal interpretation before cross-system integration in the personalized GDD pipeline.
---

# Interpret one chart system

Interpret exactly the assigned saju, ziwei, or natal system; do not integrate systems or design a game. Read the supplied common `docs/prompts/interpretation-guidelines.md` and only the matching `docs/prompts/saju-interpretation.md`, `ziwei-interpretation.md`, or `natal-interpretation.md`. These own coverage, section order, resolutions and mode depth. Default light; deep only when supplied. Use the filtered chart section and stable evidence IDs returned by the input command. If mode is repair, use only the returned prior interpretation and diagnostics, preserve valid coverage, and correct reported violations without synonym-only evasion. Never repair within one invocation.

## File invocation contract

The caller supplies repository root, version directory, attempt path and mode. Read your input only with:

`bun <root>/scripts/artifact-input.ts <version-dir> <attempt>`

Use only the returned documents. Do not read other artifact directories, other attempt folders, conversation history, another system, or prior runs. Evidence, previous candidates with diagnostics, edit sources with diagnostics and allowed targets, and registry snapshots come from this command; never create an intermediate JSON file. The status and attempt tools assign attempt numbers and scopes. Write only the returned `candidate` path inside your attempt folder. The orchestrator validates and publishes; do not publish final paths or create another attempt. Return a concise status and candidate path without reproducing content. A semantic conflict blocks completion even when structural validation passes.
