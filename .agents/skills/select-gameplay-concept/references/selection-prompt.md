# Selection rules

Abstract motives, tensions, action patterns, and growth conditions from the integrated interpretation. Do not turn occupations, documents, contracts, procedures, or other surface nouns into combat content. Every tendency and candidate must cite existing `I-NN` items.

## Axes

Use exactly these values:

- `combatRange`: `close`, `mid`, `long`
- `powerMedium`: `body`, `weapon`, `spell`, `summon`, `device`, `environment`
- `initiative`: `direct`, `reactive`, `command`, `prepare`, `transform`
- `spaceUse`: `pursuit`, `fortify`, `swap`, `expand`, `aerial`
- `combatRhythm`: `pressure`, `build_release`, `cycle`, `prepare_execute`, `improvise`
- `mastery`: `timing`, `aim`, `resource_combo`, `placement`, `command`, `form_shift`
- `risk`: `health`, `overheat`, `focus_break`, `summon_loss`, `terrain_collapse`

The first four candidates must differ pairwise on at least three axes. Use two or three lowercase kebab-case primary verbs per candidate.

## Scores

Score each candidate from 1 to 5 for:

- `interpretationFit`
- `distinctiveness`
- `actionability`
- `progression`
- `nonMonopoly`
- `genreIndependence`
- `candidateDistance`

Select the greatest sum. Break ties by `interpretationFit`, then `actionability`, then `distinctiveness`, then the lower candidate ID.

## Registry comparison

Compare all seven axes by exact equality. List every registry entry tied for the greatest number of equal axes. Five or more equal axes means similar. If the initial winner is similar, add `C-05` that differs from it and every tied closest registry entry on at least three axes. If the final winner remains similar, explain why interpretation fit wins and how play differs.

## Markdown format

Use this exact heading and field order. Repeat trait, candidate, rejected, and closest-match blocks as needed. Use `none` only for absent challenger and similarity justification.

```markdown
# Gameplay Concept Brief

- schema-version: 1

## Interpretation Traits

### Trait T-01

- axis: combatRange
- value: close
- evidence: I-01, I-02
- counter-evidence: <non-empty limitation>
- confidence: 0.8

## Candidates

### Candidate C-01

- name: <name>
- player-fantasy: <fantasy>
- primary-verbs: mark, redirect, detonate
- core-loop: <loop>
- growth-path: <causal growth>
- weakness: <weakness>
- evidence: I-01, I-02

#### Axes

- combatRange: close
- powerMedium: weapon
- initiative: direct
- spaceUse: pursuit
- combatRhythm: pressure
- mastery: timing
- risk: health

#### Scores

- interpretationFit: 5 | <rationale>
- distinctiveness: 4 | <rationale>
- actionability: 5 | <rationale>
- progression: 4 | <rationale>
- nonMonopoly: 4 | <rationale>
- genreIndependence: 5 | <rationale>
- candidateDistance: 4 | <rationale>

## Selection

- initial-selected: C-01
- selected: C-01
- reason: <reason>

### Rejected C-02

- reason: <comparison with selected candidate>

## Registry Review

- threshold: 5
- compared-entries: 0
- challenger-required: false
- challenger-candidate: none
- similarity-justification: none

### Initial Closest Match v0.1.0 C-01

- equal-axes: 4
- similar: false

### Final Closest Match v0.1.0 C-01

- equal-axes: 4
- similar: false

## Final Fingerprint

- combatRange: close
- powerMedium: weapon
- initiative: direct
- spaceUse: pursuit
- combatRhythm: pressure
- mastery: timing
- risk: health
```

Omit closest-match headings when the registry is empty. The final fingerprint must exactly copy the selected candidate's axes. Do not add YAML front matter, tables, JSON, extra machine fields, or alternate headings.
