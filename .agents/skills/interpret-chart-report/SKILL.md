---
name: interpret-chart-report
description: Read a calculated chart-report.md and create a separate Korean chart-interpretation.md that distinguishes direct observations, evidence-bearing cross-system interpretation items, conflicts, and uncertainty. Use when Codex needs a chart interpretation artifact without extracting creative motifs, designing a game, or making real-world predictions, either independently or as the second stage of the personalized GDD pipeline.
---

# Interpret a chart report

Interpret one supplied `chart-report.md` into a separate Markdown creative brief. Do not calculate charts or design a GDD.

## Inputs

Require absolute paths for the source report, interpretation guidelines, and output interpretation. When invoked by an orchestrator, use the supplied paths exactly. Refuse identical input and output paths, an empty report or guidelines document, or a report missing any of `四柱八字`, `紫微斗數 命盤`, and `Natal Chart`.

Read the supplied `interpretation-guidelines.md`, `references/interpretation-format.md`, and the selected mode contract in `references/light-mode.md` or `references/deep-mode.md`. Default to `light`; reject unsupported modes.

Do not list, search, read, or reference any other artifact. Do not use conversation history, inferred user preferences, or previous interpretations.

## Interpret

Use the chart systems only as creative seeds, never as factual personality diagnosis, advice, fate, or prediction. Clearly separate:

- direct observations traceable to the report;
- cross-system patterns and tensions;
- confidence or ambiguity;
- reusable interpretation items with stable `I-01`-style IDs;
- claims that the downstream designer must not make.

For every interpretation item, write a concise `해석:` line and cite the relevant report labels or values in a `근거:` line. Use unique sequential IDs beginning with `I-01`. Do not extract creative motifs, invent absent placements, or resolve contradictions silently.

Follow the exact section contract in `references/interpretation-format.md`. Write the completed Korean document directly to the output path.

## Validate

Run:

`bun <skill-path>/scripts/validate-interpretation.ts <interpretation-output>`

If validation fails, repair only the current output once and validate again. Return failure unchanged after a second failure.

## Complete

Return only the source path, output path, selected mode, validation result, and a one-sentence status. Do not reproduce the report or interpretation.
