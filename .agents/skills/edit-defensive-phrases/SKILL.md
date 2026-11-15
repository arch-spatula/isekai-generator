---
name: edit-defensive-phrases
description: Review one specialist interpretation for defensive wording and return scoped replacement proposals and semantic review before integration, using an allocated same-run editing input.
---

# Edit defensive phrases

Review exactly one assigned system and scope. Preserve interpretation, stable item IDs, evidence, headings, resolution and order. Make only local replacements linked to a diagnostic or explicit semantic secondary target. Review every automatic diagnostic and additional semantic target; unresolved, false-positive and missing preservation confirmation cannot pass. Do not expand scope yourself.

## SQLite invocation contract

The caller supplies repository root, run ID, attempt ID, claim, mode, and the reserved Markdown output. Read your input only with:

`bun <root>/scripts/read-artifact-state.ts input --attempt <id> --claim <claim> --root <root>`

Use the returned allowlist. Do not read other artifact directories, conversation history, another system, or prior runs. Evidence, diagnostics, previous results and registry snapshots are returned from SQLite; never create an intermediate JSON file. The DB assigns numbers and scopes. Return the structured edit proposal to the orchestrator. Do not write candidate Markdown: the tool assembles it. The orchestrator submits the proposal on stdin and finishes the attempt; do not publish final paths or allocate another attempt. Return a concise status and output path without reproducing content. A semantic conflict blocks completion even when structural validation passes.

Return the submission as JSON to the parent orchestrator, which pipes it directly to the tool stdin, with `{sourceSha256,edits,review,reviewMarkdown}`. The review contains system, attempt, scope, primary decisions with diagnosticIndex/status/reason/editIds, secondary decisions with id/target/status/reason/editIds, preservationConfirmed, unresolved, and nextScopeReason for unresolved targets. Every edit has id,target,original,replacement and diagnosticCode or reviewTargetId. `reviewMarkdown` is a nonempty semantic report. Do not write an edits file. The tool assembles and validates candidate Markdown, preserving the source on editing-contract errors.
