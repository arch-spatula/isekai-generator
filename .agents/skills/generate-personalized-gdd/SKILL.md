---
name: generate-personalized-gdd
description: Orchestrate a versioned personalized Action RPG GDD through chart calculation, three parallel specialist interpretation agents, one integration agent, and GDD design. Use when Codex should produce validated source, specialist, integrated, and game-concept artifacts without exposing stages to conversation history or prior versions.
---

# Orchestrate a personalized GDD

Run isolated agents in dependency order. Execute the three specialist interpretation agents concurrently. Do not calculate, interpret, integrate, select a combat concept, or design in the parent conversation.

## Accept the request

Pass user-stated birth details to the chart stage without inventing a date, exact time, gender, or ambiguous birthplace. Accept optional `mode` and `purpose`. Reject explicit `version` / `--version`; versions are reserved only through the active series allocator.

Use these defaults unless overridden:

- `mode`: `light`
- `purpose`: `experiment` (also accepts `regression`, `new-profile`, `incident-reproduction`, `release-candidate`)
- `flow-year`: current calendar year
- `jasi-method`: `unified`
- `house-system`: `P`

Supported modes are `light` and `deep`. Before generation, briefly confirm only non-default choices and clarifications made for an ambiguous place.

## Allocate the version

Resolve the repository root containing `scripts/chart-report.ts`. Run:

`bun <skill-path>/scripts/resolve-output.ts <repository-root> --purpose <purpose> --mode <mode>`

This command atomically reserves a new version directory and writes `artifact-run.json` with status `allocated`. Read the allocated version from that manifest; never calculate a version yourself. `.agents/artifact-series.json` is the only active-series authority. A dirty `release-candidate` is rejected before consuming a patch. Never promote the series as part of generation.

Derive these sibling paths from the returned GDD path:

- `chart-report.md`
- `chart-evidence.json`
- `saju-interpretation.md`
- `ziwei-interpretation.md`
- `natal-interpretation.md`
- `chart-interpretation.md`
- `gameplay-concept-brief.md`

Use `<repository-root>/artifacts/registries/combat-concept-fingerprints.json` as the fingerprint registry. Initialize it before the selection stage with:

`bun <selection-skill-path>/scripts/manage-fingerprint-registry.ts init <registry-path>`

Never overwrite or reuse an existing version directory. Do not inspect previous artifact content.

Before starting the chart agent, record the start:

`bun <repository-root>/scripts/update-artifact-run.ts <version-directory> running`

The orchestrator owns this run's status. Subagents use the reserved paths without allocating or finalizing the parent run. On any caught stage error (including registry initialization, final validation, or fingerprint registration), stop dependent work and record:

`bun <repository-root>/scripts/update-artifact-run.ts <version-directory> failed <stage> "<short non-sensitive error summary>"`

Use stage identifiers such as `chart-report`, `saju`, `ziwei`, `natal`, `integration`, `selection`, `gdd`, `final-validation`, or `fingerprint-registration`. Never put raw birth details, generated content, command arguments, or raw calculator stderr in the summary. Report the original error separately. If manifest update also fails, report both errors. On user cancellation, stop dependent work and record `cancelled` with the same command, without a failure object. Let active parallel specialists finish safely before finalizing. Never remove a reserved directory. After an abnormal interruption, leave unfinished status unchanged; do not guess the result or reassign the version.

## Run isolated stages

Invoke every agent with `fork_turns="none"`. Tell every agent to read and follow its named skill at the absolute path. Do not include other user messages, a conversation summary, inferred preferences, conclusions, or previous artifact content.

### 1. Generate the chart report

Invoke `$generate-chart-report` with only:

- the user-stated birth details and explicit chart options, including defaults;
- repository root, version, and exact `chart-report.md` and sibling `chart-evidence.json` output paths;
- absolute skill path.

Use a lightweight model. If the stage reports a missing or ambiguous required input, relay one focused question to the user; do not guess. Stop on calculation failure.

### 2. Run three specialist interpretations in parallel

After stage 1 succeeds, start three `$interpret-chart-system` agents concurrently for `saju`, `ziwei`, and `natal`. Give each agent only:

- its system name;
- exact chart report, evidence manifest, and system-specific output paths;
- exact `docs/prompts/interpretation-guidelines.md` path;
- selected mode;
- absolute skill path.

They must not receive raw birth arguments, conversation context, or each other's outputs. Wait for all three validations. Stop if any specialist fails.

### 3. Integrate the specialist interpretations

After all specialists succeed, invoke `$interpret-chart-report` with only:

- exact Saju, Zi Wei Dou Shu, natal, and integrated interpretation paths;
- exact `docs/prompts/interpretation-guidelines.md` path;
- selected mode;
- absolute skill path.

The integration agent must not receive the chart report, raw birth arguments, or conversation context.

### 4. Select the gameplay concept

After stage 3 succeeds, invoke `$select-gameplay-concept` with only:

- exact integrated interpretation, concept brief output, and fingerprint registry paths;
- selected mode;
- absolute skill path.

The selection agent must not receive the chart report, specialist outputs, raw birth arguments, conversation context, or prior GDD content.

### 5. Generate the GDD

After stage 4 succeeds, invoke `$generate-gdd-from-interpretation` with only:

- exact chart report, interpretation, concept brief, and GDD paths;
- selected mode;
- absolute skill path.

Use a lightweight model for `light` and a deep-reasoning model for `deep`. The stage must not receive raw birth arguments or conversation context.

## Models

When available, use:

- chart stage: `gpt-5.6-terra`, low reasoning
- light specialist, integration, selection, and GDD: `gpt-5.6-terra`, low reasoning
- deep specialist, integration, selection, and GDD: `gpt-5.6-sol`, high reasoning

Use the closest exposed model if unavailable and report the substitution.

## Final validation

Run all specialist validators, then both final validators:

`bun <system-skill-path>/scripts/validate-system-interpretation.ts saju <saju-output> <chart-evidence-output>`

`bun <system-skill-path>/scripts/validate-system-interpretation.ts ziwei <ziwei-output> <chart-evidence-output>`

`bun <system-skill-path>/scripts/validate-system-interpretation.ts natal <natal-output> <chart-evidence-output>`

`bun <interpret-skill-path>/scripts/validate-interpretation.ts <interpretation-output> <saju-output> <ziwei-output> <natal-output>`

`bun <selection-skill-path>/scripts/validate-concept-brief.ts <concept-brief-output> <interpretation-output> <registry-path>`

`bun <skill-path>/scripts/validate-gdd.ts <gdd-output> <chart-report-output> <interpretation-output> <concept-brief-output>`

Do not silently rewrite a stage's valid result. If final validation fails, return the exact error and the stage responsible.

After every validation succeeds, register the selected fingerprint exactly once:

`bun <selection-skill-path>/scripts/manage-fingerprint-registry.ts register <registry-path> <version> <concept-brief-output>`

Only after all validators and fingerprint registration succeed, record:

`bun <repository-root>/scripts/update-artifact-run.ts <version-directory> succeeded`

## Complete

Report the mode, artifact version, purpose, final manifest status, all eight validated artifact paths, and whether a model substitution occurred. On failure or cancellation, report the reserved version, purpose, final status and any errors without claiming unvalidated outputs succeeded. Do not reproduce birth arguments, chart content, interpretation, concept brief, or GDD content.
