---
name: generate-gdd-from-interpretation
description: Generate a Korean personalized Action RPG GDD from chart-interpretation.md while using chart-report.md only to verify evidence and preserve the source appendix. Use when Codex needs the game-concept design stage without recalculating or independently reinterpreting charts, either independently or as the final stage of the personalized GDD pipeline.
---

# Generate a GDD from an interpretation

Design one Action RPG GDD from a supplied interpretation and its source chart report. Do not recalculate charts or replace the interpretation with an independent reading.

## Inputs

Require exact paths for `chart-interpretation.md`, `chart-report.md`, and the GDD output. Read both inputs in full. Refuse empty inputs or an interpretation that fails the section contract used by `$interpret-chart-report`.

Read `references/design-prompt.md` and the selected mode contract in `references/light-mode.md` or `references/deep-mode.md`. Default to `light`; reject unsupported modes.

Do not list, search, read, or reference any other artifact. Do not use conversation history, inferred preferences, or an earlier GDD.

## Design

Use the interpretation as the primary design brief. Select relevant interpretation items, extract creative motifs from them, and decide how those motifs become game design. Consult the chart report only to verify cited evidence and avoid drift. If the interpretation and report conflict, preserve the ambiguity rather than silently reinterpreting the chart.

Use chart systems only as creative seeds, never as real-world prediction or factual personality diagnosis. Write the completed document in Korean without imposing a fixed outline. Include the complete chart report unchanged in a Markdown appendix after the designed GDD. Do not append the complete interpretation.

After each major personalized design choice, add both `설계 모티프: <phrase>` and `해석 근거: <IDs>`. Create the motif in this stage; do not require it to appear in the interpretation. Cite one or more existing interpretation item IDs such as `I-01, I-03`. Keep these provenance lines concise and outside the chart-report appendix.

Write directly to the exact output path.

## Validate

Run:

`bun <skill-path>/scripts/validate-gdd.ts <gdd-output> <chart-report-output> <interpretation-output>`

If validation reports an empty input, missing report appendix, missing design motif, or an invalid interpretation ID reference, repair only the current GDD once and validate again. Return the second failure unchanged.

## Complete

Return only the output path, mode, validation result, and a one-sentence status. Do not reproduce source material or GDD content.
