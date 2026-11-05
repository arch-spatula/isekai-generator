---
name: interpret-chart-system
description: Deeply interpret exactly one chart system from chart-report.md into a Korean specialist Markdown artifact. Use for isolated Saju, Zi Wei Dou Shu, or Western natal interpretation before cross-system integration in the personalized GDD pipeline.
---

# Interpret one chart system

Interpret exactly one supplied chart system. Do not integrate systems or design a game.

## Inputs

Require exact absolute paths for `chart-report.md`, its sibling `chart-evidence.json`, `interpretation-guidelines.md`, the output, this skill, and one supported system: `saju`, `ziwei`, or `natal`. Read the report, evidence manifest, guidelines, `references/specialist-format.md`, the selected system reference, and the selected mode contract. Default to `light`; support only `light` and `deep`.

For a repair attempt, also accept only the exact previous failed interpretation and its result.json supplied by the orchestrator, from the same run and system. Read those two files to repair the reported violations. Do not list, search, read, or reference any other artifacts. Do not use conversation history, inferred preferences, other specialist outputs, or prior interpretations.

## Interpret

Cover every element printed for the selected system, including temporal layers and conditional sections. Do not stop at a headline placement or, for Saju, the natal pillars. If a conditional section is absent, state that it is absent instead of inventing it.

Answer the ordinary life questions expected from a full reading. Cover all seven domains required by `references/specialist-format.md`: personality, career, wealth, romance and spouse, family and social relationships, health and daily rhythm, and timing. Translate technical placements into concrete tendencies, strengths, vulnerabilities, suitable conditions, and likely friction. Do not merely restate that a palace, axis, star, ten-god, or aspect is active.

Distinguish direct observations from interpretation. Give each reusable item a unique sequential system ID: `S-01` for Saju, `Z-01` for Zi Wei Dou Shu, or `N-01` for natal. Every item must contain `해상도:`, `해석:`, and `근거:` lines. In `근거:`, cite only exact evidence IDs from the selected system in `chart-evidence.json`; cite every supplied evidence ID at least once across the document. Do not reproduce an evidence checklist. Use the system-specific resolution labels defined in its reference and cover every label at least once. Preserve tensions and combinations instead of collapsing them into one balanced personality statement.

Develop every supported structure into concrete ordinary-life motives, choices, relationship patterns, environmental pressures, conflicts, and temporal changes. Do not preselect a protagonist role, fantasy ability, game mechanic, faction, location, or other creative material for downstream design. Keep the result bounded only by the supplied chart evidence; do not weaken supported interpretations with generic caveats or responsibility-avoidance language.

Write once to the exact attempt output path supplied by the orchestrator under garbage/attempts/<system>/<number>/interpretation.md. Never edit a previous attempt or publish to the final docs/GDD path. For a repair, remove unnecessary responsibility-avoidance statements and replace the affected passage with direct evidence-based interpretation; do not merely substitute synonyms to bypass validation. Preserve valid interpretation and evidence coverage. For a fresh generation, do not read failed attempts.

## Validate

Run `bun <skill-path>/scripts/validate-system-interpretation.ts <system> <output> <chart-evidence.json>`.

Do not repair within this agent invocation. Return the first validation result, including diagnostic codes and locations on failure. The orchestrator owns the shared three-attempt budget, records each result before retrying, and launches a new isolated agent when needed. Never allocate another attempt or change the parent run status. Standalone callers must use the same attempt manager and a running reserved run; do not bypass the attempt contract.

## Complete

Return only the system, source path, output path, mode, validation result (with diagnostic codes and locations on failure), and a one-sentence status. Do not reproduce interpretation content.
