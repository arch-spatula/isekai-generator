---
name: edit-defensive-phrases
description: Review one specialist or integrated interpretation for defensive wording and return scoped replacement proposals and semantic review before downstream consumption, using an allocated same-run editing input.
---

# Edit defensive phrases

Review exactly one assigned system and scope. Preserve interpretation, stable item IDs, evidence, headings, resolution and order. Make only local replacements linked to a diagnostic or explicit semantic secondary target. Review every automatic diagnostic and additional semantic target; unresolved and missing preservation confirmation cannot pass. Specialist false-positive decisions cannot pass. For integration, a false-positive decision with a contextual reason preserves the exact diagnosed source location; review every diagnostic explicitly. Do not expand scope yourself. For integration use only source, the three accepted specialist documents, supplied guidelines, diagnostics, mode and scope; do not read raw birth data or chart text. Preserve I-NN IDs, order, domains, relationships, all S/Z/N references and unique insights; add no interpretation or game design. Use data.allowedTargets for both edits and secondary review decisions: actual I-NN IDs or tool-generated region IDs, never arbitrary titles. A preservation-only decision requires no fake edit. Preserve calculation premises, real data limitations and conditional manifestations. Do not replace forbidden words with synonyms.

## SQLite invocation contract

The caller supplies repository root, run ID, attempt ID, claim, mode, and the reserved Markdown output. Read your input only with:

`bun <root>/scripts/read-artifact-state.ts input --attempt <id> --claim <claim> --root <root>`

Use the returned allowlist. Do not read other artifact directories, conversation history, another system, or prior runs. Evidence, diagnostics, previous results and registry snapshots are returned from SQLite; never create an intermediate JSON file. The DB assigns numbers and scopes. Return the structured edit proposal to the orchestrator. Do not write candidate Markdown: the tool assembles it. The orchestrator submits the proposal on stdin and finishes the attempt; do not publish final paths or allocate another attempt. Return a concise status and output path without reproducing content. A semantic conflict blocks completion even when structural validation passes.

Return the submission as JSON to the parent orchestrator, which pipes it directly to the tool stdin, with `{sourceSha256,edits,review,reviewMarkdown}`. The review contains system, attempt, scope, primary decisions with diagnosticIndex/status/reason/editIds, secondary decisions with id/target/status/reason/editIds, preservationConfirmed, unresolved, and nextScopeReason for unresolved targets. Every edit has id,target,original,replacement and diagnosticCode or reviewTargetId. `reviewMarkdown` is a nonempty semantic report. Do not write an edits file. The tool assembles and validates candidate Markdown, preserving the source on editing-contract errors. Retries include the exact previous candidate, proposal and diagnostics. For integration, format errors consume the three-call budget at the same scope; only unresolved semantic preservation expands sentence to item to system (related document regions, never a whole-document rewrite).
