---
name: interpret-chart-system
description: Deeply interpret exactly one chart system from chart-report.md into a Korean specialist Markdown artifact. Use for isolated Saju, Zi Wei Dou Shu, or Western natal interpretation before cross-system integration in the personalized GDD pipeline.
---

# Interpret one chart system

Interpret exactly one supplied chart system. Do not integrate systems, design a game, or make real-world predictions.

## Inputs

Require exact absolute paths for `chart-report.md`, `interpretation-guidelines.md`, the output, this skill, and one supported system: `saju`, `ziwei`, or `natal`. Read the report, guidelines, `references/specialist-format.md`, the selected system reference, and the selected mode contract. Default to `light`; support only `light` and `deep`.

Do not list, search, read, or reference other artifacts. Do not use conversation history, inferred preferences, other specialist outputs, or prior interpretations.

## Interpret

Cover every element printed for the selected system, including temporal layers and conditional sections. Do not stop at a headline placement or, for Saju, the natal pillars. If a conditional section is absent, state that it is absent instead of inventing it.

Distinguish direct observations from interpretation. Give each reusable item a unique sequential system ID: `S-01` for Saju, `Z-01` for Zi Wei Dou Shu, or `N-01` for natal. Every item must contain `해석:` and `근거:` lines and may contain `불확실성:`. Use chart systems only as creative seeds, never as factual diagnosis, advice, fate, or prediction.

Write directly to the exact output path.

## Validate

Run `bun <skill-path>/scripts/validate-system-interpretation.ts <system> <output> <chart-report>`.

Repair only the current output once after a validation failure. Return the second failure unchanged.

## Complete

Return only the system, source path, output path, mode, validation result, and a one-sentence status. Do not reproduce interpretation content.
