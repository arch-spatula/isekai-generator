---
name: interpret-chart-system
description: Deeply interpret exactly one chart system from chart-report.md into a Korean specialist Markdown artifact. Use for isolated Saju, Zi Wei Dou Shu, or Western natal interpretation before cross-system integration in the personalized GDD pipeline.
---

# Interpret one chart system

Interpret exactly one supplied chart system. Do not integrate systems or design a game.

## Inputs

Require exact absolute paths for `chart-report.md`, `interpretation-guidelines.md`, the output, this skill, and one supported system: `saju`, `ziwei`, or `natal`. Read the report, guidelines, `references/specialist-format.md`, the selected system reference, and the selected mode contract. Default to `light`; support only `light` and `deep`.

Do not list, search, read, or reference other artifacts. Do not use conversation history, inferred preferences, other specialist outputs, or prior interpretations.

## Interpret

Cover every element printed for the selected system, including temporal layers and conditional sections. Do not stop at a headline placement or, for Saju, the natal pillars. If a conditional section is absent, state that it is absent instead of inventing it.

Answer the ordinary life questions expected from a full reading. Cover all seven domains required by `references/specialist-format.md`: personality, career, wealth, romance and spouse, family and social relationships, health and daily rhythm, and timing. Translate technical placements into concrete tendencies, strengths, vulnerabilities, suitable conditions, and likely friction. Do not merely restate that a palace, axis, star, ten-god, or aspect is active.

Distinguish direct observations from interpretation. Give each reusable item a unique sequential system ID: `S-01` for Saju, `Z-01` for Zi Wei Dou Shu, or `N-01` for natal. Every item must contain `해상도:`, `해석:`, and `근거:` lines. Use the system-specific resolution labels defined in its reference and cover every label at least once. Preserve tensions and combinations instead of collapsing them into one balanced personality statement.

Develop every supported structure into concrete ordinary-life motives, choices, relationship patterns, environmental pressures, conflicts, and temporal changes. Do not preselect a protagonist role, fantasy ability, game mechanic, faction, location, or other creative material for downstream design. Keep the result bounded only by the supplied chart evidence; do not weaken supported interpretations with generic caveats or responsibility-avoidance language.

Write directly to the exact output path.

## Validate

Run `bun <skill-path>/scripts/validate-system-interpretation.ts <system> <output> <chart-report>`.

Repair only the current output once after a validation failure. Return the second failure unchanged.

## Complete

Return only the system, source path, output path, mode, validation result, and a one-sentence status. Do not reproduce interpretation content.
