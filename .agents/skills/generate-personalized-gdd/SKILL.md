---
name: generate-personalized-gdd
description: Orchestrate a versioned personalized Action RPG GDD through chart calculation, parallel specialist interpretations, integration, independent combat and world selection, and GDD design without exposing stages to conversation history or prior versions.
---

# Orchestrate a personalized GDD

Run isolated agents in dependency order. Execute the three specialist interpretation agents concurrently. Do not calculate, interpret, integrate, select combat or world concepts, or design in the parent conversation.

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

This command atomically reserves a new version directory and writes `artifact-run.json` with status `allocated`. Read the allocated version from that manifest; never calculate a version yourself. `.agents/artifact-series.json` is the only active-series authority. A dirty `release-candidate` is rejected before consuming a patch. Generation never guesses a new minor. If the user explicitly adopts a new series (for example “now v0.3.x”), treat that declaration as authorization for the separate promotion workflow: record the decision, validate and commit the intended baseline, promote from a clean tree with `scripts/promote-artifact-series.ts`, and commit the configuration before allocation. Do not request the same authorization again. Ordinary generation only increments the active patch; explicit artifact versions remain unsupported.

Derive these sibling paths from the returned GDD path:

- `chart-report.md`
- `chart-evidence.json`
- `saju-interpretation.md`
- `ziwei-interpretation.md`
- `natal-interpretation.md`
- `chart-interpretation.md`
- `gameplay-concept-brief.md`
- `world-concept-brief.md`

Use `<repository-root>/artifacts/registries/combat-concept-fingerprints.json` as the fingerprint registry. Initialize it before the selection stage with:

`bun <selection-skill-path>/scripts/manage-fingerprint-registry.ts init <registry-path>`

Use `<repository-root>/artifacts/registries/world-concept-fingerprints.json` as the independent world registry. Initialize it before world selection:

`bun <world-skill-path>/scripts/manage-world-registry.ts init <world-registry-path>`

Never overwrite or reuse an existing version directory. Do not inspect previous artifact content.

Before starting the chart agent, record the start:

`bun <repository-root>/scripts/update-artifact-run.ts <version-directory> running`

The orchestrator owns this run's status. Subagents use the reserved paths without allocating or finalizing the parent run. On any caught stage error (including registry initialization, final validation, or fingerprint registration), stop dependent work and record:

`bun <repository-root>/scripts/update-artifact-run.ts <version-directory> failed <stage> "<short non-sensitive error summary>"`

Use stage identifiers such as `chart-report`, `saju`, `ziwei`, `natal`, `integration`, `selection`, `world-selection`, `gdd`, `final-validation`, or `fingerprint-registration`. Never put raw birth details, generated content, command arguments, or raw calculator stderr in the summary. Report the original error separately. If manifest update also fails, report both errors. On user cancellation, stop dependent work and record `cancelled` with the same command, without a failure object. Let active parallel specialists finish safely before finalizing. Never remove a reserved directory. After an abnormal interruption, leave unfinished status unchanged; do not guess the result or reassign the version.

## Persist progress and handoff

Allocation creates `<version-directory>/TODO.md` and per-stage checkpoints under `garbage/progress/`. The TODO is a readable handoff for the orchestrator, not a source artifact for downstream agents. Do not put birth arguments, chart or interpretation text, raw stderr, or a conversation summary in it. Do not hand-edit its generated contents.

The allocator, parent status updater, chart runner, and specialist attempt manager update it automatically. For all remaining stages, the orchestrator must record `start` **before** launching work and `done` **only after** the stage's validator succeeds:

`bun <repository-root>/scripts/update-artifact-progress.ts start <version-directory> <stage>`

`bun <repository-root>/scripts/update-artifact-progress.ts done <version-directory> <stage>`

Use stages `integration`, `selection`, `world-selection`, `gdd`, `final-validation`, `combat-registration`, and `world-registration`. After spawning an agent, repeat `start` with its agent identifier as the last argument to retain a lookup hint. Specialists already have a running checkpoint allocated by `prepare`; record their agent identifier with `start <version-directory> <system> <agent-id>` after spawning. The manager retains the attempt number.

Record `final-validation` around all final validators. Record each registration separately: start before that registration command, done after its confirmed success. On a caught stage error, record `fail <version-directory> <stage>` before finalizing the parent failure; if progress recording also fails, report both errors and still attempt the terminal manifest update. A progress command failure blocks dependent work. Parent status changes refresh TODO automatically; they do not silently check off unfinished stages.

Before yielding with unfinished work or after a context interruption, ensure durable checkpoints reflect the latest confirmed result. `sync <version-directory>` rebuilds TODO from manifest and checkpoints if rendering was interrupted. Do not mark a stage complete based solely on file existence.

If the user explicitly continues an existing **unfinished** run, read only its manifest, TODO, checkpoints, and relevant same-run attempt records first. Do not allocate a replacement version. Check recorded agent/process liveness before launching another, revalidate completed outputs, and continue only unmet dependencies using the isolated inputs below. An allocated/running status is not evidence that the previous agent stopped. Do not delete locks or classify unfinished attempts automatically. If a tool succeeded before its checkpoint was written, reconcile the existing output and validator result instead of rerunning it. Before registering fingerprints, inspect both registries for this version to avoid duplicate registration. Terminal runs remain closed; TODO is a recovery hint, not authorization to reopen one.

Never pass TODO or the progress directory to specialist, integration, selection, or GDD agents. Preserve their data isolation. Existing versions without TODO are not backfilled automatically.

## Run isolated stages

Invoke every agent with `fork_turns="none"`. Tell every agent to read and follow its named skill at the absolute path. Do not include other user messages, a conversation summary, inferred preferences, conclusions, or previous artifact content.

### 1. Generate the chart report

Invoke `$generate-chart-report` with only:

- the user-stated birth details and explicit chart options, including defaults;
- repository root, version, and exact `chart-report.md` and sibling `chart-evidence.json` output paths;
- absolute skill path.

Use a lightweight model. If the stage reports a missing or ambiguous required input, relay one focused question to the user; do not guess. Stop on calculation failure.

### 2. Run three specialist interpretations in parallel

After stage 1 succeeds, run the three systems concurrently, with independent recovery. For each system, before each agent invocation run:

`bun <repository-root>/scripts/manage-specialist-attempt.ts prepare <version-directory> <system>`

This allocates an immutable attempt under `<version-directory>/garbage/attempts/<system>/NNN/` and returns its run-relative output path, attempt number, and `mode` (`generate` or `repair`). Resolve returned paths against the version directory. Never allocate attempts yourself. The shared budget is **three total invocations per system, including initial generation, repairs, and fresh generations**. There is no unlimited flag. A fresh generation also consumes this budget; it is not three additional attempts.

Give each `$interpret-chart-system` agent only:

- its system name;
- exact chart report, evidence manifest, and allocated attempt output paths;
- exact `docs/prompts/interpretation-guidelines.md` path;
- exact `docs/prompts/<system>-interpretation.md` task prompt path, matching the selected system (`saju`, `ziwei`, or `natal`);
- selected interpretation mode (`light` or `deep`);
- absolute skill path;
- for `repair` only: the exact previous failed output and result paths returned by the manager.

Use `fork_turns="none"` for every attempt. Agents must not receive raw birth arguments, conversation context, other systems' outputs, or any other garbage content. Each invocation writes once and validates once; agents must not perform their own repair loop.

After an agent returns, run:

`bun <repository-root>/scripts/manage-specialist-attempt.ts finish <version-directory> <system> <attempt>`

If the agent failed to execute, use `error` in place of `finish`. Do not pass raw stderr or generated text to the manager. `finish` independently runs the full validator, writes the immutable `result.json` **before** another attempt may be prepared, and publishes only passing output to the system's final `docs/GDD/<system>-interpretation.md`. It records the chosen attempt and content hash in `garbage/attempts/<system>/accepted.json`.

The manager's successful exit means the outcome was recorded; inspect its returned `status`. For `validation-failed`, call `prepare` again: the default is policy B, repairing the preserved failed document. For `execution-failed` (including missing output), call `prepare` again to generate fresh from source without reading failed content. Never combine attempts. Preserve all failure documents and logs. A repeated validation failure stays on repair; it does not trigger a fresh generation just to avoid the rule.

On `passed`, keep that system's final output and do not rerun it. Wait until all three systems have passed before integration. If the budget is exhausted or allocation, validation infrastructure, logging, or publication throws an error, stop dependent work, let active parallel specialists finish safely, and record the parent failure under that system's stage. Report the original error. Do not launch another agent when result recording fails. A passed validation with a publication error is a run failure, not successful completion.

Keep the parent run `running` during recovery; only the orchestrator finalizes it. On cancellation, launch no further attempts, let active specialists finish safely, then record `cancelled`. An unfinished attempt or abandoned lock after interruption is not automatically resumed, removed or classified. Never reopen a terminal run. `garbage/` is for recovery tooling only; do not provide it to integration, selection, GDD, or game-development agents.

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

### 5. Select the world concept

After stage 4 succeeds, invoke `$select-world-concept` with only:

- exact integrated interpretation, selected gameplay brief, world brief output, and world registry paths;
- selected mode;
- absolute world skill path.

The world agent must not receive raw birth details, chart report, specialist outputs, conversation history, combat registry, or prior GDDs. It preserves the selected combat contract and independently compares world structures. Stop if world validation fails.

### 6. Generate the GDD

After stage 5 succeeds, invoke `$generate-gdd-from-interpretation` with only:

- exact chart report, interpretation, gameplay concept brief, world concept brief, and GDD paths;
- selected mode;
- absolute skill path.

Use a lightweight model for `light` and a deep-reasoning model for `deep`. The stage must not receive raw birth arguments or conversation context.

## Models

When available, use:

- chart stage: `gpt-5.6-terra`, low reasoning
- light specialist, integration, combat/world selection, and GDD: `gpt-5.6-terra`, low reasoning
- deep specialist, integration, combat/world selection, and GDD: `gpt-5.6-sol`, high reasoning

Use the closest exposed model if unavailable and report the substitution.

## Final validation

Run all specialist, integration, combat, world and GDD validators:

`bun <system-skill-path>/scripts/validate-system-interpretation.ts saju <saju-output> <chart-evidence-output>`

`bun <system-skill-path>/scripts/validate-system-interpretation.ts ziwei <ziwei-output> <chart-evidence-output>`

`bun <system-skill-path>/scripts/validate-system-interpretation.ts natal <natal-output> <chart-evidence-output>`

`bun <interpret-skill-path>/scripts/validate-interpretation.ts <interpretation-output> <saju-output> <ziwei-output> <natal-output>`

`bun <selection-skill-path>/scripts/validate-concept-brief.ts <concept-brief-output> <interpretation-output> <registry-path>`

`bun <world-skill-path>/scripts/validate-world-brief.ts <world-brief-output> <interpretation-output> <concept-brief-output> <world-registry-path>`

`bun <skill-path>/scripts/validate-gdd.ts <gdd-output> <chart-report-output> <interpretation-output> <concept-brief-output> <world-brief-output>`

Do not silently rewrite a stage's valid result. If final validation fails, return the exact error and the stage responsible.

After every validation succeeds, register both selected fingerprints exactly once:

`bun <selection-skill-path>/scripts/manage-fingerprint-registry.ts register <registry-path> <version> <concept-brief-output>`

`bun <world-skill-path>/scripts/manage-world-registry.ts register <world-registry-path> <version> <world-brief-output>`

If either registration fails, record `failed` and report which registrations already completed. The two files are not a transaction; do not mark success, silently remove an entry, or retry registration of the same run. Revalidate current registry comparisons before registration if another run registered in the meantime.

Only after all validators and fingerprint registration succeed, record:

`bun <repository-root>/scripts/update-artifact-run.ts <version-directory> succeeded`

## Complete

Report the mode, artifact version, purpose, final manifest status, all nine validated artifact paths, the root TODO.md path, and whether a model substitution occurred. On failure or cancellation, report the reserved version, purpose, final status and any errors without claiming unvalidated outputs succeeded. Do not reproduce birth arguments, chart content, interpretation, concept briefs, or GDD content.
