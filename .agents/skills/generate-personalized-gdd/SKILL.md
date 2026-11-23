---
name: generate-personalized-gdd
description: Orchestrate a versioned personalized Action RPG GDD through chart calculation, parallel specialist interpretations, integration, independent combat and world selection, and GDD design without exposing stages to conversation history or prior versions.
---

# Orchestrate a personalized GDD

Use isolated agents in dependency order, with three specialist agents concurrently. Never calculate, interpret, integrate, select or design in the parent. Every stage agent uses `fork_turns="none"`, the matching named skill and only the assigned inputs. Default mode light and purpose experiment; accept deep and the existing purpose enum. Birth defaults: current flow-year, unified jasi-method, P house-system. Ask only for genuinely missing or ambiguous birth inputs. Never inspect previous artifact content.

Before asking any input question, check explicit user values, existing agreements and applicable settings, then apply every defined default, including mode, purpose and chart options. Omission of an option with a default is not missing or ambiguous input; do not request confirmation of defaults or values already resolved from supplied information. Explicit user values override defaults. Ask only for required information still missing or conflicts still unresolved after this step. Pass the resolved values to stage agents so they do not ask again.

Use the chart skill's birth input rules: an omitted calendar means Gregorian (양력), and an unambiguous birthplace determines timezone (South Korean cities use `Asia/Seoul`). Never silently treat an explicitly lunar date as Gregorian.

## Allocate

`bun <root>/scripts/artifact-allocate.ts personalized-gdd <mode> <purpose> <root>`

It creates the next version directory of the active Git series and writes the write-once `run.md` (kind, mode, purpose, revisions). There is no state database. Publication paths are fixed: chart `charts/`, specialist and integrated interpretations `interpretation/`, combat and world briefs `design-rationale/`, GDD `game/`, with the existing filenames. Attempts live in `garbage/<stage>/<kind>-<n>/`. Never choose version or attempt numbers yourself.

## Execute the DAG

Progress is computed from files, never recorded separately. After each confirmed result run:

`bun <root>/scripts/artifact-status.ts <version-dir>`

Each stage reports `done`, `publish`, `repair`, `edit`, `ready`, `exhausted`, `wait` or `input` with its next action. Stages without dependencies on each other (`saju`, `ziwei`, `natal`) can be `ready` together; run them concurrently. Chart `input` means the chart skill must run with the user's birth inputs. Specialists and integration must pass a separate edit attempt before publication, even without automatic diagnostics. Match the stage skill: interpret-chart-system, edit-defensive-phrases, interpret-chart-report, select-gameplay-concept, select-world-concept, generate-gdd-from-interpretation.

For each model invocation:

1. `bun <root>/scripts/artifact-attempt.ts <version-dir> <stage>` creates the next attempt for a `ready` or `edit` stage and returns attempt, candidate path, inputs, and for edits the source and scope. Selection attempts receive a fixed `registry.json` snapshot.
2. Spawn one isolated agent with `fork_turns="none"`, the matching skill, mode, version directory and attempt path. It reads only `bun <root>/scripts/artifact-input.ts <version-dir> <attempt>`. Specialist agents receive only the selected system prompt and common guidelines. Input paths are not permission to inspect sibling files.
3. Generation agents write only the returned candidate path. Edit agents return `{sourceSha256,edits,review,reviewMarkdown}`; pipe it directly to `bun <root>/scripts/artifact-edit.ts <version-dir> <attempt>`. If the edit agent ended without a proposal, run the same command with `--execution-failed`. Never write temporary JSON.
4. Run status again. Structural validation of a candidate is computed by status: an invalid candidate becomes the next `repair`, a valid specialist or integration candidate becomes `edit`, and a passed edit or valid selection/GDD candidate becomes `publish`.
5. For `publish` run `bun <root>/scripts/artifact-publish.ts <version-dir> <stage>`. It never overwrites an existing output.

Attempt limits are enforced by the tools: specialists 3 generations and 3 edits, integration 2 generations and 3 edits, other stages 2. Integration edit format errors keep the scope; only semantic failures widen sentence → item → system. A normal validation failure is not a new run. `exhausted` stops that stage and requires the user's decision.

Shared presentation is `docs/prompts/game-presentation-contract.md`; GDD template is `docs/prompts/personalized-action-rpg-concept.md`. Stage contracts and semantic presentation review remain mandatory. Unresolved camera/control/art/readability conflicts block dependent work.

## Resume and completion

For explicit continuation run status on the specified version directory; do not guess among several unfinished versions. Status lists `unfinished` attempts (generation without candidate, edit without result). Before creating another attempt, query the actual worker: alive means wait; unknown means stop. Only when it is confirmed terminated use `artifact-attempt.ts <version-dir> <stage> --replace-unfinished`; the unfinished attempt still counts toward the limit. Never regenerate accepted documents. The run is complete when every stage is `done`; there is no separate finalize or fingerprint registration, because published briefs are the next runs' registry.

## Models and completion

When exposed use gpt-5.6-terra low for chart and light stages; gpt-5.6-sol high for deep interpretation/integration/selection/design. Otherwise use the closest available model and report substitution. Report mode, purpose, version, status summary and local final Markdown paths. Do not reproduce birth inputs or generated contents. Markdown paths identify local outputs, not permanent repository evidence.
