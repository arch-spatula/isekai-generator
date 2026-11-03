---
name: generate-personalized-gdd
description: Orchestrate a versioned personalized Action RPG GDD by invoking the generate-chart-report, interpret-chart-report, and generate-gdd-from-interpretation skills in isolated sequential agents. Use when Codex should accept conversational birth details and produce validated chart-report.md, chart-interpretation.md, and personalized-action-rpg-concept.md artifacts without exposing stages to conversation history or prior versions.
---

# Orchestrate a personalized GDD

Run three isolated skills in order. Do not calculate, interpret, or design in the parent conversation.

## Accept the request

Pass user-stated birth details to the chart stage without inventing a date, exact time, gender, or ambiguous birthplace. Accept optional `mode` and semantic `version`.

Use these defaults unless overridden:

- `mode`: `light`
- `flow-year`: current calendar year
- `jasi-method`: `unified`
- `house-system`: `P`

Supported modes are `light` and `deep`. Before generation, briefly confirm only non-default choices and clarifications made for an ambiguous place.

## Allocate the version

Resolve the repository root containing `scripts/chart-report.ts`. Run:

`bun <skill-path>/scripts/resolve-output.ts <repository-root> [version]`

Derive these sibling paths from the returned GDD path:

- `chart-report.md`
- `chart-interpretation.md`

Never overwrite or reuse an existing version directory. Do not inspect previous artifact content.

## Run isolated stages

Invoke each stage sequentially with `fork_turns="none"`. Tell every stage to read and follow its named skill at the absolute path. Do not include other user messages, a conversation summary, inferred preferences, conclusions, or previous artifact content.

### 1. Generate the chart report

Invoke `$generate-chart-report` with only:

- the user-stated birth details and explicit chart options, including defaults;
- repository root, version, and exact `chart-report.md` output path;
- absolute skill path.

Use a lightweight model. If the stage reports a missing or ambiguous required input, relay one focused question to the user; do not guess. Stop on calculation failure.

### 2. Interpret the chart report

After stage 1 succeeds, invoke `$interpret-chart-report` with only:

- exact chart report and interpretation paths;
- selected mode;
- absolute skill path.

Use a lightweight model for `light` and a deep-reasoning model for `deep`. The stage must not receive raw birth arguments or conversation context.

### 3. Generate the GDD

After stage 2 succeeds, invoke `$generate-gdd-from-interpretation` with only:

- exact chart report, interpretation, and GDD paths;
- selected mode;
- absolute skill path.

Use a lightweight model for `light` and a deep-reasoning model for `deep`. The stage must not receive raw birth arguments or conversation context.

## Models

When available, use:

- chart stage: `gpt-5.6-terra`, low reasoning
- light interpretation and GDD: `gpt-5.6-terra`, low reasoning
- deep interpretation and GDD: `gpt-5.6-sol`, high reasoning

Use the closest exposed model if unavailable and report the substitution.

## Final validation

Run both:

`bun <interpret-skill-path>/scripts/validate-interpretation.ts <interpretation-output>`

`bun <skill-path>/scripts/validate-gdd.ts <gdd-output> <chart-report-output> <interpretation-output>`

Do not silently rewrite a stage's valid result. If final validation fails, return the exact error and the stage responsible.

## Complete

Report the mode, version, all three validated artifact paths, and whether a model substitution occurred. Do not reproduce birth arguments, chart content, interpretation, or GDD content.
