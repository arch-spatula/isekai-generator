---
name: interpret-chart-report
description: Integrate separate Saju, Zi Wei Dou Shu, and Western natal specialist interpretations into a Korean chart-interpretation.md that preserves every specialist item, system-specific resolution, cross-system relationship, and reusable creative seed. Use after three isolated specialist interpretation agents and before personalized GDD design.
---

# Integrate specialist interpretations

Integrate three supplied specialist interpretations. Do not calculate charts, reinterpret them independently, or design a GDD.

## Inputs

Require absolute paths for `saju-interpretation.md`, `ziwei-interpretation.md`, `natal-interpretation.md`, the interpretation guidelines, and output `chart-interpretation.md`. Use supplied paths exactly and refuse identical paths or empty inputs.

Read the supplied `interpretation-guidelines.md`, `references/interpretation-format.md`, and the selected mode contract in `references/light-mode.md` or `references/deep-mode.md`. Default to `light`; reject unsupported modes.

Do not read `chart-report.md`, list or search other artifacts, or use conversation history, inferred preferences, and previous versions.

## Interpret

Use the specialist documents as a complete interpretation-source set. Preserve every specialist item and organize it without flattening system-specific structures. Clearly separate:

- interpretations that are consistent across systems;
- interpretations where one system adds specificity to another;
- interpretations that conflict or resist reconciliation;
- non-substitutable interpretations available from only one system;
- alternative manifestations supported by the same evidence;
  - reusable interpretation items with stable `I-01`-style IDs;

Build one integrated person model instead of stopping at system-by-system comparison:

- identify shared core desires, recurring conflicts, and decision criteria;
- preserve one non-substitutable insight from each system and cite only that system's IDs;
- connect inner motive, behavior, environmental response, and recurring result across life domains;
- explain when the same tendency becomes a strength or vulnerability and under which conditions;
- distinguish traits that remain stable from expressions that change across calculated timing layers.
- retain Saju's natal structure, relational operations, and long-term changes; Zi Wei Dou Shu's palace roles, star strength and combinations, and nested timing; and natal astrology's psychological functions, life arenas, and aspect dynamics;
- cite every supplied `S-*`, `Z-*`, and `N-*` specialist item in at least one integrated interpretation item;
- preserve concrete motives, choices, relationships, pressures, conflicts, and changes as ordinary-life interpretation without choosing creative material for the final game design.

For every interpretation item, write `관계: 일관|구체화|상충|고유`, a concise `해석:` line, a different `연결 영역:`, an evidence-bounded `작동 사슬:`, `양면성:`, `조건:`, and a `근거:` line. Cite IDs from at least two specialist systems for `일관`, `구체화`, and `상충`. For `고유`, cite only the one originating system so the insight remains selectable by downstream work without false cross-system support. Use unique sequential IDs beginning with `I-01`. Do not add creative seeds, copy complete specialist documents, invent evidence, or resolve contradictions silently.

Preserve the seven life domains from the specialist documents. Give each integrated item an exact `영역:` label and cover personality, career, wealth, romance and spouse, family and social relationships, health and daily rhythm, and timing at least once. Synthesize concrete conclusions rather than replacing them with abstract cross-system labels.

Follow the exact section contract in `references/interpretation-format.md`. Write the completed Korean document directly to the output path.

## Validate

Run:

`bun <skill-path>/scripts/validate-interpretation.ts <interpretation-output> <saju-output> <ziwei-output> <natal-output>`

If validation fails, repair only the current output once and validate again. Return failure unchanged after a second failure.

## Complete

Return only the three source paths, output path, selected mode, validation result, and a one-sentence status. Do not reproduce interpretation content.
