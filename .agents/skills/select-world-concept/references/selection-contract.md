# World selection contract

Use one `world-concept` JSON fenced block with this exact top-level schema:

- `schemaVersion`: integer 1
- `combatCandidateId`: the selected C-NN from the gameplay brief
- `candidates`: W-01 through W-04, plus W-05 only when required
- `initialSelected`: highest ranked of the first four
- `selected`: highest ranked of all candidates
- `reason`: concrete final selection comparison
- `rejected`: one `{ "id": "W-NN", "reason": "comparison with winner" }` for every unselected candidate
- `registryReview`: defined below
- `maritimeJustification`: non-empty comparison against non-maritime alternatives if the final role is major-region, core-world or core-grammar; otherwise null

No extra or missing machine fields are accepted. Korean prose may surround the JSON block. Do not include raw birth details, hidden reasoning, or prior GDD content.

## Candidate fields

Every candidate has exactly these fields:

- `id`, `name`: sequential W-NN and a distinct name
- `fingerprint`: exactly the six keys and one allowed value per key listed below
- `maritimeRole`: none, decoration, major-region, core-world, core-grammar
- `evidence`: array of at least two different existing I-NN interpretation IDs
- `causalChain`: specific interpretation pattern → spatial rule → player decision
- `counterEvidence`: interpretation or combat limitation that argues against this candidate
- `spatialPlay`: actual connected spaces, traversal/gating loop, return paths and settlement behavior
- `verbMapping`: one `{ "verb": "selected-primary-verb", "operation": "concrete combat use in this world" }` per primary verb, without omission or duplication
- `scores`: interpretationFit, combatFit, spatialPlay, distinctiveness; each is `{ "value": 1, "reason": "concrete rationale" }`, value integer 1–5

## Fingerprint values

| Key | Values |
| --- | --- |
| topology | continental, archipelago, vertical, underground, mobile, celestial |
| ecology | forest, desert, ice, wetland, marine, urban, organism, immaterial |
| traversal | overland, aerial, sea, subterranean, teleport, creature |
| settlement | fixed-cities, mobile-base, distributed, single-fortress, cyclic |
| hazard | flooding, falling, collapse, contamination, depletion, time-distortion, predation |
| spatialLogic | routes, borders, layers, veins, fractures, cycles, gravity |

Describe the dominant world structure. Continental means connected land; archipelago means isolated islands separated by dangerous transit, including sky islands; vertical means interdependent stacked spaces; underground means a connected subterranean network; mobile means the world itself or its principal habitable spaces relocate; celestial means traversal among celestial bodies, not renamed sky islands. Ecology is the dominant habitat; traversal is the campaign's main travel method, not a temporary combat dash. Settlement describes return and resupply organization. Spatial logic is the principle governing connection and progression rather than an incidental metaphor.

Archipelago topology or sea traversal requires core-world or core-grammar. Core-world requires marine ecology and sea traversal. Marine dominant ecology requires at least major-region. Local ports, one water region, and similes alone do not make the whole world an archipelago. Use decoration for incidental imagery; major-region for a substantial region that does not control overall traversal; core-grammar for archipelago/convoy/navigation structure transposed into another medium.

The first four candidates must differ pairwise on at least three axes, cover at least three topology values, and include at least two candidates without a core maritime role. A different name, color or biome does not create a new topology.

## Ranking and registry

Rank by score sum, then interpretationFit, then combatFit, then lower candidate ID. Compare fingerprints by exact equality across six axes. Four or more equal axes is similar. Record every entry tied for the greatest equality, even if below the similarity threshold.

`registryReview` has exactly:

- `comparedEntries`: actual registry entry count
- `initialClosest`: array of `{ "version": "vX.Y.Z", "candidateId": "W-NN", "equalAxes": 0 }`
- `finalClosest`: same match schema, recomputed for the final selection
- `similarityDifferences`: empty unless the final selection remains similar; then one `{ "version": "vX.Y.Z", "candidateId": "W-NN", "interpretationFit": "why fit outweighs similarity", "spatialDifference": "actual connection, gating, return or exploration difference" }` for every final closest entry

For an empty registry all match arrays are empty. If any initial closest entry has at least four equal axes, add W-05. It must differ on at least three axes from the initial winner and every initial closest entry. Preserve the first four candidates and scores, then rank all five. Otherwise do not add W-05. This is a reconsideration trigger, not a ban on reusing a suitable world.

## GDD handoff

The winner's fingerprint and spatial play are the fixed world contract. The GDD must realize this world's structure while preserving the separate combat contract. It declares exactly one `world-structure` JSON block. That block has the six fingerprint keys, each containing exactly `{ "value": "selected-axis-value", "manifestation": "concrete named spaces, traversal or resupply rules in this GDD" }`. It is an explicit playable structure description, not a keyword counter or proof that every prose sentence agrees. Review prose consistency before returning.
