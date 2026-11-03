---
name: interpret-chart-report
description: Integrate separate Saju, Zi Wei Dou Shu, and Western natal specialist interpretations into a Korean chart-interpretation.md that distinguishes consistent, specificity-adding, and conflicting readings. Use after three isolated specialist interpretation agents and before personalized GDD design.
---

# Integrate specialist interpretations

Integrate three supplied specialist interpretations. Do not calculate charts, reinterpret them independently, or design a GDD.

## Inputs

Require absolute paths for `saju-interpretation.md`, `ziwei-interpretation.md`, `natal-interpretation.md`, the interpretation guidelines, and output `chart-interpretation.md`. Use supplied paths exactly and refuse identical paths or empty inputs.

Read the supplied `interpretation-guidelines.md`, `references/interpretation-format.md`, and the selected mode contract in `references/light-mode.md` or `references/deep-mode.md`. Default to `light`; reject unsupported modes.

Do not read `chart-report.md`, list or search other artifacts, or use conversation history, inferred preferences, and previous versions.

## Interpret

Use the specialist documents only as creative interpretation sources, never as factual personality diagnosis, advice, fate, or prediction. Clearly separate:

- interpretations that are consistent across systems;
- interpretations where one system adds specificity to another;
- interpretations that conflict or resist reconciliation;
- confidence or ambiguity;
- reusable interpretation items with stable `I-01`-style IDs;
- claims that the downstream designer must not make.

For every interpretation item, write `관계: 일관|구체화|상충`, a concise `해석:` line, and a `근거:` line citing one or more existing specialist IDs such as `S-01, Z-02, N-03`. Use unique sequential IDs beginning with `I-01`. Do not copy complete specialist documents, extract creative motifs, invent evidence, or resolve contradictions silently.

Follow the exact section contract in `references/interpretation-format.md`. Write the completed Korean document directly to the output path.

## Validate

Run:

`bun <skill-path>/scripts/validate-interpretation.ts <interpretation-output> <saju-output> <ziwei-output> <natal-output>`

If validation fails, repair only the current output once and validate again. Return failure unchanged after a second failure.

## Complete

Return only the three source paths, output path, selected mode, validation result, and a one-sentence status. Do not reproduce interpretation content.
