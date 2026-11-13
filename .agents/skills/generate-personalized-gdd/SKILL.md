---
name: generate-personalized-gdd
description: Orchestrate a versioned personalized Action RPG GDD through chart calculation, parallel specialist interpretations, integration, independent combat and world selection, and GDD design without exposing stages to conversation history or prior versions.
---

# Orchestrate a personalized GDD

Use isolated agents in dependency order, with three specialist agents concurrently. Never calculate, interpret, integrate, select or design in the parent. Every stage agent uses `fork_turns="none"`, the matching named skill and only the assigned inputs. Default mode light and purpose experiment; accept deep and the existing purpose enum. Birth defaults: current flow-year, unified jasi-method, P house-system. Ask only for genuinely missing or ambiguous birth inputs. Never inspect previous artifact content.

Before asking any input question, check explicit user values, existing agreements and applicable settings, then apply every defined default, including mode, purpose and chart options. Omission of an option with a default is not missing or ambiguous input; do not request confirmation of defaults or values already resolved from supplied information. Explicit user values override defaults. Ask only for required information still missing or conflicts still unresolved after this step. Pass the resolved values to stage agents so they do not ask again.

Use the chart skill's birth input rules: an omitted calendar means Gregorian (양력), and an unambiguous birthplace determines timezone (South Korean cities use `Asia/Seoul`). Never silently treat an explicitly lunar date as Gregorian.

## Reserve and start

`bun <root>/scripts/artifact-state.ts allocate --kind personalized-gdd --mode <mode> --purpose <purpose> --request <id>`

`bun <root>/scripts/artifact-state.ts start --run <run-id> --request <id>`

Use the returned version/directory. Requests identify logical calls: reuse the same request after response loss. Active series comes from Git configuration; never choose patch numbers or initialize registries manually.

## Execute the DAG

Call `read-artifact-state.ts next --run <id>` after each confirmed result. Chart calls the chart skill and its runner with only the user birth inputs. After chart publication, prepare `saju`, `ziwei`, `natal` concurrently. Each uses `--kind generate`; each successful structure result requires a separate `--kind edit` attempt. Following their published acceptance, execute `integration`, `selection`, `world-selection`, and `gdd`, all `--kind generate`. Match the stage skill: interpret-chart-system, edit-defensive-phrases, interpret-chart-report, select-gameplay-concept, select-world-concept, generate-gdd-from-interpretation.

For each model invocation:

1. `artifact-state.ts prepare --run <id> --stage <stage> --kind <generate|edit> --request <id>` returns attemptId, claim, scope, mode and output.
2. Read `read-artifact-state.ts input --attempt <id> --claim <claim>` and pass only its filtered data, matching skill, mode, shared prompt/template/presentation inputs to an isolated agent. Specialist agents receive only the selected system prompt and common guidelines. Input paths are not permission to inspect sibling files.
3. Record `artifact-state.ts dispatch --attempt <id> --claim <claim> --request <id>` immediately before spawning; then `bind-worker --attempt <id> --claim <claim> --agent <agent-id> --request <id>`. Never spawn twice when dispatch result is unknown.
4. Agent writes reserved Markdown; edit agent instead returns `{sourceSha256,edits,review,reviewMarkdown}`. Pipe directly to `artifact-state.ts submit --attempt <id> --claim <claim> --request <id>`. Ordinary Markdown submit payload is `{}` or `{path,sha256}` for the reserved output. Never write temporary JSON.
5. `artifact-state.ts finish --attempt <id> --claim <claim> --request <id>` performs validation and safe publication. Use outcome and nextAction, not exit code alone. Tool assigns repair mode, scopes and remaining budgets. A normal submission failure is not a new run.

Shared presentation is `docs/prompts/game-presentation-contract.md`; GDD template is `docs/prompts/personalized-action-rpg-concept.md`. Stage contracts and semantic presentation review remain mandatory. Unresolved camera/control/art/readability conflicts block dependent work.

## Resume and finalize

For explicit continuation query runs --unfinished or the specified summary, then next. Do not guess among multiple unfinished runs. Use reconcile for stored submissions/publication; never regenerate accepted documents. If external execution is uncertain, query the actual worker, then resume with stdin `{workers:[{attemptId,status:"terminated|alive|unknown",observer,reference}]}`. A timeout is not proof of termination. Alive means wait; unknown remains blocked. Explicit resume returns `data.resumedAttempts` with a renewed claim and reserved output for each prepared/submitted attempt. Use those returned claims to read input, submit or finish the same attempt; never depend on previous conversation claims. Running/dispatching claims remain unavailable before worker verification. Confirmed terminated workers with existing ordinary Markdown resume as submitted in that same attempt; only absent output or absent edit payload permits an interrupted invocation and a budgeted retry. Terminal runs cannot reopen; no JSON import or fallback exists.

After all documents are accepted, `artifact-state.ts finalize --run <id> --request <id>` revalidates the complete snapshot and atomically registers combat+world fingerprints and run success. Registry-stale requires latest comparison/review within remaining budgets; do not overwrite old documents or reset attempts. On infrastructure failure stop calls and retain the same run for recovery. Cancel/fail require a short safe reason; do not log birth arguments or raw stderr.

## Models and completion

When exposed use gpt-5.6-terra low for chart and light stages; gpt-5.6-sol high for deep interpretation/integration/selection/design. Otherwise use the closest available model and report substitution. Report mode, purpose, version, DB summary status and local final Markdown paths. Do not reproduce birth inputs or generated contents. Markdown paths identify local outputs, not permanent repository evidence.
