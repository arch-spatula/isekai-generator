---
name: generate-personalized-gdd
description: Generate a versioned personalized Action RPG GDD from conversational birth details using Saju, Zi Wei Dou Shu, and Western natal-chart output. Use when Codex should interview the user for missing chart inputs, resolve a city-level birthplace by default, create an experimental Korean GDD in light or deep mode, preserve prior artifact versions, and isolate generation from both the current conversation and earlier GDDs.
---

# Generate a personalized GDD

Collect birth details conversationally, then generate and validate one versioned Markdown GDD without exposing either generation agent to the current conversation or earlier artifacts.

## Collect inputs

Act as an input adapter. Never ask the user to fill out a CLI argument template.

1. Extract details already stated in natural language.
2. Ask one focused follow-up question at a time for missing required information.
3. Treat a city or county name as sufficient birthplace detail. Resolve it to the representative coordinates of that municipality and its IANA timezone, then proceed without asking the user to confirm the coordinates.
4. Also accept a birth hospital, street address, or more specific place when the user volunteers one. Resolve that location instead, but never ask for hospital-level detail when a municipality is available.
5. Ask for clarification only when the place itself is ambiguous, such as names shared across countries or regions. Do not treat the geographic size of a municipality as ambiguity.
6. Normalize ordinary gender answers to the CLI values `M` or `F`; this is format conversion, not inference.
7. Do not infer a missing birth date, exact birth time, gender, or ambiguous birthplace. Unknown birth time is unsupported.

Required birth details are year, month, day, hour, minute, gender, latitude, longitude, and timezone.

Use these defaults unless the user overrides them:

- `mode`: `light`
- `flow-year`: current calendar year
- `jasi-method`: `unified`
- `house-system`: `P` (Placidus)

The Western natal chart follows Orrery/sky.told.me: tropical zodiac, geocentric positions, mean lunar node, and Placidus houses by default. Supported house-system overrides are the codes accepted by `scripts/chart-report.ts`.

Refuse unsupported modes or chart options. Before generation, briefly confirm only non-default choices and any clarification made for an ambiguous place. Do not read back automatically resolved coordinates or make the user repeat already supplied facts.

## Allocate the artifact version

Store every GDD in the existing artifact layout:

`artifacts/v<version>/docs/GDD/personalized-action-rpg-concept.md`

Accept an optional semantic `version`. If omitted, run:

`bun <skill-path>/scripts/resolve-output.ts <repository-root>`

This starts at `v0.1.0` and otherwise increments the greatest existing version's patch number. If the user supplies a version, pass it after the repository root. Never overwrite or reuse an existing version directory. Do not accept a free-form output path.

## Orchestrate in isolation

1. Resolve the repository root containing `scripts/chart-report.ts` and `docs/prompts/personalized-action-rpg-concept.md`.
2. Resolve the versioned output path before launching an agent.
3. Launch a coordinator subagent with `fork_turns="none"` and a lightweight model.
4. Give the coordinator only the normalized inputs, repository root, absolute skill path, resolved output path and version, and the workflow below.
5. Never include other user messages, a conversation summary, inferred preferences, conclusions, or any previous GDD content.
6. Do not generate the GDD in the parent conversation.

## Coordinator workflow

1. Do not list, search, open, or summarize `artifacts/` except to create the already resolved output directory. Never inspect a previous GDD.
2. Run `bun scripts/chart-report.ts` with every normalized chart option explicitly supplied, including the defaults. Capture stdout. Treat failure as a final input error; do not repair or guess an input.
3. Read `docs/prompts/personalized-action-rpg-concept.md` in full.
4. Read the selected mode contract:
   - `light`: `references/light-mode.md`
   - `deep`: `references/deep-mode.md`
5. Create the resolved output directory.
6. Launch a writer subagent with `fork_turns="none"`:
   - `light`: use a lightweight model.
   - `deep`: use a deep-reasoning model.
7. Give the writer only the full concept prompt, chart report, selected mode contract, and resolved output path. Include these rules:
   - use chart systems only as creative seeds, never as real-world prediction;
   - write the completed document in Korean without imposing a fixed outline;
   - do not list, search, read, or reference any file under `artifacts/` other than writing the exact resolved output path;
   - do not use or imitate any earlier GDD version;
   - write the completed GDD directly to the output path;
   - return only the output path and a one-sentence completion status.
8. Run `bun <skill-path>/scripts/validate-gdd.ts <output>`.
9. If validation reports an empty document, send that exact failure back to the same writer once and ask it to repair only the current output. Validate once more.
10. If the second validation fails, return the validation error without silently rewriting the GDD. If it passes, return the output path, version, and selected mode.

The coordinator must not summarize, polish, or rewrite a valid writer result.

## Model mapping

When available, use:

- coordinator: `gpt-5.6-terra` with low reasoning
- light writer: `gpt-5.6-terra` with low reasoning
- deep writer: `gpt-5.6-sol` with high reasoning

If an identifier is unavailable, choose the closest exposed lightweight or deep-reasoning model and report the substitution.

## Complete

Report the mode, version, validated artifact path, and whether a model substitution occurred. Do not reproduce birth arguments or the chart report.
