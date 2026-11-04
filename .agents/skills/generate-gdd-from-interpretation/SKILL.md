---
name: generate-gdd-from-interpretation
description: Generate a Korean personalized Action RPG GDD from chart-interpretation.md and validated combat and world concept briefs, using chart-report.md only to verify evidence. Use for the design stage without recalculating or independently reinterpreting charts.
---

# Generate a GDD from an interpretation

Design one Action RPG GDD from a supplied interpretation and its source chart report. Do not recalculate charts or replace the interpretation with an independent reading.

## Inputs

Require exact paths for `chart-interpretation.md`, `chart-report.md`, `gameplay-concept-brief.md`, `world-concept-brief.md`, and the GDD output. Read all four inputs in full. Refuse empty inputs or an interpretation that fails the section contract used by `$interpret-chart-report`. The world brief must already have passed `$select-world-concept`; never invent a default world when it is missing.

Read `references/design-prompt.md` and the selected mode contract in `references/light-mode.md` or `references/deep-mode.md`. Default to `light`; reject unsupported modes.

Do not list, search, read, or reference any other artifact. Do not use conversation history, inferred preferences, or an earlier GDD.

## Design

Use the interpretation as the primary design brief. Use its common core, system-specific insights, cross-domain operation structure, dual conditions, and temporal changes as the whole-person context. Select relevant interpretation items, extract their underlying motives, conflicts, decision patterns, and growth paths, and decide how those abstractions become game design. Consult the chart report only to verify cited evidence and avoid drift. If the interpretation and report conflict, preserve the ambiguity rather than silently reinterpreting the chart.

Do not directly turn a real-world occupation, work procedure, document, contract, accounting practice, management tool, or similar surface noun from the interpretation into the protagonist's job, power, weapon, world law, or dominant mechanic. Such material may appear as a secondary setting detail only when the concept has an independent genre reason for it and it does not dominate the protagonist, combat, progression, economy, world, and ending at once.

Use the selected candidate in `gameplay-concept-brief.md` as the fixed combat contract. Preserve its player fantasy, axes, primary verbs, core loop, growth path, weakness, and final fingerprint. Do not choose a different archetype, combine rejected candidates, or rescore the selection.

Use the selected `world-concept-brief.md` candidate as the fixed world contract. Preserve its topology, dominant ecology, campaign traversal, settlement, hazard, spatial logic, spatial play and combat verb translations. Develop concrete regions and relationships within that structure. Do not replace it with a rejected world, reinterpret anchor/route/flow as automatic maritime requirements, or expand an incidental sea simile or port into an archipelago civilization. Review the prose against the declared world structure; keyword absence alone is not consistency.

Make power growth causally legible. Establish the power's origin, first manifestation, initial capabilities and limits, practiced mastery, expansion events, late-game scale, cost or risk, and credible enemy or world responses. Keep combat-power growth distinct from character and relationship growth. Do not replace becoming stronger with merely accepting more responsibility, delegating authority, or managing resources.

Use multiple interpretation domains without allowing one surface metaphor to monopolize the protagonist, combat, progression, economy, world structure, relationships, and ending. Write the completed document in Korean without imposing a fixed outline. Do not append the chart report or the complete interpretation; they remain separate source artifacts.

After each major personalized design choice, add both `설계 모티프: <phrase>` and `해석 근거: <IDs>`. Create the motif in this stage; do not require it to appear in the interpretation. Cite one or more existing interpretation item IDs such as `I-01, I-03`. Keep these provenance lines concise.

Before writing, silently review the concept: reject direct job-to-magic translation, vague non-action gameplay, unexplained power escalation, power suppression presented as depth, and a single metaphor occupying most major systems. Do not include this review or hidden reasoning in the GDD.

Write directly to the exact output path.

Include exactly one `combat-fingerprint` fenced block containing a JSON object with the seven final fingerprint keys and values copied from the brief. Do not add other keys.

Include exactly one `world-structure` JSON fenced block with exactly `topology`, `ecology`, `traversal`, `settlement`, `hazard`, `spatialLogic`. Each value is an object with exactly `value` (copied from the selected world fingerprint) and `manifestation` (concrete named spaces, connections, movement, risks or return paths in this GDD). Keep the actual world and regional descriptions consistent with those declarations. Do not append either concept brief.

## Validate

Run:

`bun <skill-path>/scripts/validate-gdd.ts <gdd-output> <chart-report-output> <interpretation-output> <concept-brief-input> <world-brief-input>`

If validation reports an empty input, embedded source content, a missing design motif, an invalid interpretation ID reference, or a combat/world contract mismatch, repair only the current GDD once and validate again. Return the second failure unchanged.

## Complete

Return only the output path, mode, validation result, and a one-sentence status. Do not reproduce source material or GDD content.
