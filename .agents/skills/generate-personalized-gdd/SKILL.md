---
name: generate-personalized-gdd
description: Generate a personalized Action RPG GDD from the birth-chart arguments accepted by scripts/chart-report.ts. Use when Codex needs to turn Saju, Zi Wei Dou Shu, and natal-chart output into the 22-section GDD defined by docs/prompts/personalized-action-rpg-concept.md, in either light or deep mode, while isolating the generation from the current conversation with fresh subagents.
---

# Generate a personalized GDD

Generate one Markdown GDD without passing the current conversation to either generation agent.

## Inputs

Accept:

- `mode`: `light` (default) or `deep`
- every required option accepted by `scripts/chart-report.ts`: `year`, `month`, `day`, `hour`, `minute`, `gender`, `latitude`, `longitude`, and `timezone`
- optional chart options: `flow-year`, `jasi-method`, and `house-system`
- optional `output`; default to `artifacts/personalized-action-rpg-gdd.md`

Do not support an unknown birth time. If any required time component is missing, stop and explain that an exact birth time is currently required.

Refuse an unsupported mode or chart option. Do not infer missing birth data. If the output already exists, ask before replacing it.

## Orchestration

1. Resolve the repository root containing both `scripts/chart-report.ts` and `docs/prompts/personalized-action-rpg-concept.md`.
2. Launch a coordinator subagent with `fork_turns="none"`. Use a lightweight model for this coordinator.
3. Give the coordinator only:
   - the normalized skill inputs;
   - the repository root;
   - the absolute path of this skill;
   - the workflow below.
4. Never include the user's other messages, a conversation summary, inferred preferences, or conclusions from the parent agent.
5. Have the coordinator perform the remaining steps. Do not generate the GDD in the parent conversation.

## Coordinator workflow

1. Run `bun scripts/chart-report.ts` with the supplied chart options and capture stdout. Treat failure as a final input error; do not repair or guess an input.
2. Read `docs/prompts/personalized-action-rpg-concept.md` in full.
3. Read the selected mode contract:
   - `light`: `references/light-mode.md`
   - `deep`: `references/deep-mode.md`
4. Launch a writer subagent with `fork_turns="none"`:
   - `light`: use a lightweight model.
   - `deep`: use a deep-reasoning model.
5. Give the writer only the full concept prompt, the chart report, the selected mode contract, the output path, and these rules:
   - use the chart systems only as creative seeds, never as real-world prediction;
   - write all 22 required sections in Korean;
   - write the completed GDD directly to the output path;
   - return only the output path and a one-sentence completion status.
6. Run `bun <skill-path>/scripts/validate-gdd.ts <output>`.
7. If validation reports missing or empty sections, send that exact failure list back to the same writer once and ask it to repair the file. Validate once more.
8. If the second validation fails, return the validation error without silently rewriting the GDD. If it passes, return the output path and selected mode.

The coordinator must not summarize, polish, or otherwise rewrite a valid writer result.

## Model mapping

When the runtime exposes the repository's current model identifiers, use:

- coordinator: `gpt-5.6-terra` with low reasoning
- light writer: `gpt-5.6-terra` with low reasoning
- deep writer: `gpt-5.6-sol` with high reasoning

If an identifier is unavailable, choose the closest lightweight or deep-reasoning model exposed by the runtime and report the substitution in the completion status.

## Completion

Report the mode, the validated artifact path, and whether a model substitution occurred. Do not reproduce the birth arguments or chart report in the final response.
