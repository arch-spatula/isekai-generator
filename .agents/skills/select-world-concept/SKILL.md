---
name: select-world-concept
description: Compare structurally distinct Action RPG worlds after combat selection, check an independent world fingerprint registry, and write a validated world-concept-brief.md before GDD design.
---

# Select a world concept

Require exact paths for the integrated interpretation, selected gameplay concept brief, world brief output, and world fingerprint registry, plus mode `light` or `deep`. Read only those inputs and [references/selection-contract.md](references/selection-contract.md). Do not read raw birth data, chart reports, specialist outputs, prior GDDs, or conversation history.

Preserve the selected combat candidate and all its primary verbs. Translate verbs such as anchor, route, flow, pressure, and collapse into neutral functions before inventing settings. A combat anchor does not require a nautical anchor, and a route does not require sailing. Do not change the combat archetype to fit a world.

Compare four world candidates using the reference contract. Each must connect specific interpretation tensions to traversable space, gates, return paths, settlement and combat opportunities. Avoid mapping only generic stability/change onto island/sea. Label topology by playable connections: isolated sky islands connected by shipping lanes still use archipelago grammar. Distinguish a local port or a sea simile from a maritime civilization.

Compute score order and closest registry matches. If the initial winner is similar, add exactly one challenger without editing the original four candidates or scores. Maritime settings remain valid when the recorded comparisons support them. Review fit and spatial-play differences rather than rewarding novelty for its own sake.

Use the same schema and validation rules in both modes. In light mode keep explanations concise; in deep mode develop spatial loops, counter-evidence, verb translations and comparisons sufficiently to distinguish actual play. Write Korean explanations and exactly one `world-concept` JSON block directly to the supplied output path.

Validate with:

`bun <skill-path>/scripts/validate-world-brief.ts <world-brief-output> <interpretation-input> <combat-brief-input> <world-registry-input>`

If validation fails, repair only the current world brief once and revalidate. Return the second failure unchanged. Do not register a fingerprint; the orchestrator registers it after every final validator passes. Return only output path, mode, candidate count and validation result.
