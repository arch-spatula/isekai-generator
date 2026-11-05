---
name: interpret-chart-system
description: Deeply interpret exactly one chart system from chart-report.md into a Korean specialist Markdown artifact. Use for isolated Saju, Zi Wei Dou Shu, or Western natal interpretation before cross-system integration in the personalized GDD pipeline.
---

# Interpret one chart system

Interpret exactly one supplied chart system. Do not integrate systems or design a game.

## Inputs

Require exact absolute paths for `chart-report.md`, its sibling `chart-evidence.json`, `interpretation-guidelines.md`, the selected task prompt, the output, this skill, and one supported system: `saju`, `ziwei`, or `natal`. Default to `light`; support only `light` and `deep`.

Read the report, evidence manifest, supplied common guidelines, and **only the task prompt matching the selected system**. The caller supplies the exact prompt path from the same repository's `docs/prompts/`:

| System | Task questions and output template |
| --- | --- |
| `saju` | [saju-interpretation.md](../../../docs/prompts/saju-interpretation.md) |
| `ziwei` | [ziwei-interpretation.md](../../../docs/prompts/ziwei-interpretation.md) |
| `natal` | [natal-interpretation.md](../../../docs/prompts/natal-interpretation.md) |

If the selected prompt path is omitted, resolve its filename beside the supplied `interpretation-guidelines.md`. Stop if the required prompt is missing; do not reconstruct its task from memory.
For a repair attempt, also accept only the exact previous failed interpretation and its result.json supplied by the orchestrator, from the same run and system. Read those two files to repair the reported violations. Do not list, search, read, or reference any other artifacts. Do not use conversation history, inferred preferences, other specialist outputs, or prior interpretations.

## Interpret

Complete the selected prompt's template by answering its questions using the supplied evidence. The task prompt owns system-specific coverage, section order, and interpretation resolutions; the common guidelines own shared item fields, life questions, evidence rules, and mode depth. Follow those documents rather than creating another format in this skill.

Write once to the exact attempt output path supplied by the orchestrator under garbage/attempts/<system>/<number>/interpretation.md. Never edit a previous attempt or publish to the final docs/GDD path. For a repair, use the diagnostic to revise the affected answers under the same prompt contract. Preserve valid interpretation and evidence coverage, and do not merely substitute synonyms to bypass validation. For a fresh generation, do not read failed attempts.

## Validate

Run `bun <skill-path>/scripts/validate-system-interpretation.ts <system> <output> <chart-evidence.json>`.

Do not repair within this agent invocation. Return the first validation result, including diagnostic codes and locations on failure. The orchestrator owns the shared three-attempt budget, records each result before retrying, and launches a new isolated agent when needed. Never allocate another attempt or change the parent run status. Standalone callers must use the same attempt manager and a running reserved run; do not bypass the attempt contract.

## Complete

Return only the system, source path, output path, mode, validation result (with diagnostic codes and locations on failure), and a one-sentence status. Do not reproduce interpretation content.
