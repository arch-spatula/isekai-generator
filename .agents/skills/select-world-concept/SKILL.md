---
name: select-world-concept
description: Compare structurally distinct Action RPG worlds after combat selection, check an independent world fingerprint registry, and write a validated world-concept-brief.md before GDD design.
---

# Select a world concept

Require exact paths for the integrated interpretation, selected gameplay concept brief, world brief output, world fingerprint registry, and shared `docs/prompts/game-presentation-contract.md`, plus mode `light` or `deep`. Read only those inputs and [references/selection-contract.md](references/selection-contract.md). Do not read raw birth data, chart reports, specialist outputs, prior GDDs, or conversation history.

Require the shared contract's exact path even for standalone calls; do not infer a default. Resolve the repository root from this skill's location and run `bun <repository-root>/scripts/run-logged-step.ts <run-directory> world-selection <validation-attempt> -- bun <repository-root>/scripts/game-presentation.ts <presentation-input>` before creating candidates. Stop on missing, empty or invalid input. Read the contract in full and check that the selected combat brief preserves its declaration before designing a world.

Preserve the selected combat candidate and all its primary verbs. Translate verbs such as anchor, route, flow, pressure, and collapse into neutral functions before inventing settings. A combat anchor does not require a nautical anchor, and a route does not require sailing. Do not change the combat archetype to fit a world.

Compare four world candidates using the reference contract. Each must connect specific interpretation tensions to traversable space, gates, return paths, settlement and combat opportunities. Avoid mapping only generic stability/change onto island/sea. Label topology by playable connections: isolated sky islands connected by shipping lanes still use archipelago grammar. Distinguish a local port or a sea simile from a maritime civilization.

Compute score order and closest registry matches. If the initial winner is similar, add exactly one challenger without editing the original four candidates or scores. Maritime settings remain valid when the recorded comparisons support them. Review fit and spatial-play differences rather than rewarding novelty for its own sake.

Use the same schema and validation rules in both modes. In light mode keep explanations concise; in deep mode develop spatial loops, counter-evidence, verb translations and comparisons sufficiently to distinguish actual play. Write Korean explanations and exactly one `world-concept` JSON block directly to the supplied output path.

Apply the shared contract to every candidate's spatialPlay and verbMapping, including challengers. Review all candidates before scoring and the final prose before writing. Copy its `game-presentation` block exactly once at the end, outside `world-concept`. Keep common presentation conditions separate from world fingerprint axes.

Follow [the unified event-log contract](../../../docs/spec/artifact-event-log.md). Resolve `<run-directory>` from the reserved output's `docs/GDD/` parent. Use validation attempt 1 initially and 2 only for the existing permitted repair. Before repairing, append `retry_scheduled` with the actual failed conditions and repair reason through `scripts/log-artifact-event.ts`; do not overwrite or read other runs. Record semantic-review failures as `validation_failed` with explicit issues, and record `stage_stopped` on unresolved failure. Logging failure blocks further work. Do not copy generated content into events.

Validate with:

`bun <repository-root>/scripts/run-logged-step.ts <run-directory> world-selection <validation-attempt> -- bun <skill-path>/scripts/validate-world-brief.ts <world-brief-output> <interpretation-input> <combat-brief-input> <world-registry-input> <presentation-input>`

If validation or the shared contract's semantic review fails, repair only the current world brief once and revalidate and review again. Return an unresolved semantic conflict as failure even when the declaration validator passes. Return the second failure unchanged. Do not register a fingerprint; the orchestrator registers it after every final validator passes. Validator success covers declarations, not prose consistency. Return only output path, mode, candidate count and validation result.
