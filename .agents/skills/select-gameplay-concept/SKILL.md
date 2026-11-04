---
name: select-gameplay-concept
description: Extract gameplay tendencies from an integrated chart interpretation, compare structurally distinct personalized Action RPG combat candidates, check prior fingerprints, and write a validated gameplay-concept-brief.md. Use between chart interpretation and GDD generation when selecting the protagonist's combat archetype without reading prior GDD content.
---

# Select a gameplay concept

Select one combat archetype through structured comparison. Do not write the GDD or reinterpret the source charts.

## Inputs

Require exact paths for:

- `chart-interpretation.md`
- `gameplay-concept-brief.md`
- `combat-concept-fingerprints.json`
- mode: `light` or `deep`

Read only those inputs and this skill's references. Do not search for or read the chart report, specialist interpretations, raw birth data, prior artifacts, or prior GDDs.

## Select

Read `references/selection-prompt.md` and the selected mode contract in `references/light-mode.md` or `references/deep-mode.md`.

Extract tendencies for all seven axes with interpretation evidence, counter-evidence, and confidence. Generate four structurally distinct candidates and score them using the required criteria. Select by the deterministic score and tie-break order.

Compare the initial selection with the fingerprint registry. If any closest match shares five or more axes, add exactly one challenger as `C-05`, score it, and select again across all candidates. Do not change the first four candidates or their scores after adding the challenger.

Write the brief directly to the exact output path. Preserve the fixed Markdown headings and fields from the selection prompt.

## Validate

Run:

`bun <skill-path>/scripts/validate-concept-brief.ts <brief-output> <interpretation-input> <registry-input>`

If validation fails, repair only the current brief once and validate again. Return the second failure unchanged. Do not register the selected fingerprint; the orchestrator does that only after the GDD also passes validation.

## Complete

Return only the output path, mode, candidate count, validation result, and a one-sentence status. Do not reproduce the interpretation or brief content.
