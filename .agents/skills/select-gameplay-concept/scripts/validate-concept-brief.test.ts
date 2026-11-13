import { describe, expect, test } from 'bun:test'
import { presentationFixture } from '../../../../scripts/fixtures/game-presentation'

import { isValidConceptBrief, validateConceptBrief } from './validate-concept-brief'
import { parseRegistry } from './fingerprint-registry'

const interpretation = [1, 2, 3, 4, 5, 6, 7].map(id => `### I-${String(id).padStart(2, '0')}`).join('\n')
const emptyRegistry = JSON.stringify({ schemaVersion: 1, entries: [] })

const axes = [
  ['close', 'weapon', 'direct', 'pursuit', 'pressure', 'timing', 'health'],
  ['long', 'spell', 'reactive', 'swap', 'cycle', 'aim', 'focus_break'],
  ['mid', 'summon', 'command', 'fortify', 'prepare_execute', 'command', 'summon_loss'],
  ['close', 'body', 'transform', 'aerial', 'improvise', 'form_shift', 'overheat'],
]

function candidate(id: number, values: string[], fit: number): string {
  const keys = ['combatRange', 'powerMedium', 'initiative', 'spaceUse', 'combatRhythm', 'mastery', 'risk']
  const scoreKeys = ['interpretationFit', 'distinctiveness', 'actionability', 'progression', 'nonMonopoly', 'genreIndependence', 'candidateDistance']
  return `### Candidate C-${String(id).padStart(2, '0')}

- name: 후보 ${id}
- player-fantasy: 구조적으로 구별되는 전투 판타지 ${id}
- primary-verbs: mark, redirect, detonate
- core-loop: 읽고 준비한 뒤 실행한다.
- growth-path: 같은 힘의 계통 안에서 범위가 확장된다.
- weakness: 잘못된 판단은 자원 손실을 일으킨다.
- evidence: I-01, I-02

#### Axes

${keys.map((key, index) => `- ${key}: ${values[index]}`).join('\n')}

#### Scores

${scoreKeys.map(key => `- ${key}: ${key === 'interpretationFit' ? fit : 4} | 평가 근거가 있다.`).join('\n')}`
}

function validBrief(): string {
  const traits = [
    ['combatRange', 'close'],
    ['powerMedium', 'weapon'],
    ['initiative', 'direct'],
    ['spaceUse', 'pursuit'],
    ['combatRhythm', 'pressure'],
    ['mastery', 'timing'],
    ['risk', 'health'],
  ].map(([axis, value], index) => `### Trait T-${String(index + 1).padStart(2, '0')}

- axis: ${axis}
- value: ${value}
- evidence: I-${String(index + 1).padStart(2, '0')}
- counter-evidence: 반대 방향의 가능성도 있다.
- confidence: 0.8`).join('\n\n')
  const candidates = axes.map((values, index) => candidate(index + 1, values, 5 - index)).join('\n\n')
  return `# Gameplay Concept Brief

- schema-version: 1

## Interpretation Traits

${traits}

## Candidates

${candidates}

## Selection

- initial-selected: C-01
- selected: C-01
- reason: 가장 높은 평가를 받았다.

### Rejected C-02

- reason: 선택 후보보다 적합도가 낮다.

### Rejected C-03

- reason: 선택 후보보다 적합도가 낮다.

### Rejected C-04

- reason: 선택 후보보다 적합도가 낮다.

## Registry Review

- threshold: 5
- compared-entries: 0
- challenger-required: false
- challenger-candidate: none
- similarity-justification: none

## Final Fingerprint

- combatRange: close
- powerMedium: weapon
- initiative: direct
- spaceUse: pursuit
- combatRhythm: pressure
- mastery: timing
- risk: health
` + presentationFixture
}

describe('gameplay concept brief validator', () => {
  test('accepts a valid four-candidate Markdown brief', () => {
    expect(isValidConceptBrief(validBrief(), interpretation, emptyRegistry)).toBe(true)
  })

  test('rejects missing, duplicate or incompatible presentation while preserving candidate validation', () => {
    for (const invalid of [
      validBrief().replace(presentationFixture, ''),
      validBrief() + presentationFixture,
      validBrief().replace('"top-down"', '"side-scrolling"'),
      validBrief().replace('"pixel-art"', '"painted"'),
    ]) expect(isValidConceptBrief(invalid, interpretation, emptyRegistry)).toBe(false)
  })

  test('shared presentation contract remains mandatory in the immutable brief validator', () => {
    expect(isValidConceptBrief(validBrief(), interpretation, emptyRegistry)).toBe(true)
    expect(isValidConceptBrief(validBrief().replace(presentationFixture, ''), interpretation, emptyRegistry)).toBe(false)
    expect(isValidConceptBrief(validBrief().replace('"top-down"', '"side-scrolling"'), interpretation, emptyRegistry)).toBe(false)
  })

  test('rejects an unknown interpretation ID', () => {
    expect(isValidConceptBrief(validBrief().replace('- evidence: I-01, I-02', '- evidence: I-99'), interpretation, emptyRegistry)).toBe(false)
  })

  test('rejects an unknown machine field', () => {
    expect(isValidConceptBrief(validBrief().replace('- schema-version: 1', '- schema-version: 1\n- surprise-field: value'), interpretation, emptyRegistry)).toBe(false)
  })

  test('rejects candidates that differ on fewer than three axes', () => {
    const invalid = validBrief()
      .replace('- combatRange: long', '- combatRange: close')
      .replace('- powerMedium: spell', '- powerMedium: weapon')
      .replace('- initiative: reactive', '- initiative: direct')
      .replace('- spaceUse: swap', '- spaceUse: pursuit')
      .replace('- combatRhythm: cycle', '- combatRhythm: pressure')
    expect(isValidConceptBrief(invalid, interpretation, emptyRegistry)).toBe(false)
  })

  test('rejects a selected candidate that violates score ordering', () => {
    expect(isValidConceptBrief(validBrief().replace('- selected: C-01', '- selected: C-02'), interpretation, emptyRegistry)).toBe(false)
  })

  test('requires a challenger when the initial fingerprint is similar', () => {
    const registry = JSON.stringify({
      schemaVersion: 1,
      entries: [{
        version: 'v0.1.0',
        candidateId: 'C-01',
        fingerprint: {
          combatRange: 'close', powerMedium: 'weapon', initiative: 'direct',
          spaceUse: 'pursuit', combatRhythm: 'pressure', mastery: 'timing', risk: 'health',
        },
      }],
    })
    expect(isValidConceptBrief(validBrief(), interpretation, registry)).toBe(false)
  })

  test('accepts one challenger and justification for a similar final choice', () => {
    const registry = JSON.stringify({
      schemaVersion: 1,
      entries: [{
        version: 'v0.1.0',
        candidateId: 'C-01',
        fingerprint: {
          combatRange: 'close', powerMedium: 'weapon', initiative: 'direct',
          spaceUse: 'pursuit', combatRhythm: 'pressure', mastery: 'timing', risk: 'health',
        },
      }],
    })
    const review = `## Registry Review

- threshold: 5
- compared-entries: 1
- challenger-required: true
- challenger-candidate: C-05
- similarity-justification: 해석 적합성이 우선이며 실제 조작 동사가 다르다.

### Initial Closest Match v0.1.0 C-01

- equal-axes: 7
- similar: true

### Final Closest Match v0.1.0 C-01

- equal-axes: 7
- similar: true`
    const withChallenger = validBrief()
      .replace('\n## Selection', `\n\n${candidate(5, axes[1], 1)}\n\n## Selection`)
      .replace('\n## Registry Review', '\n\n### Rejected C-05\n\n- reason: 선택 후보보다 적합도가 낮다.\n\n## Registry Review')
      .replace(/## Registry Review[\s\S]*?(?=\n## Final Fingerprint)/, review)
    expect(validateConceptBrief(withChallenger, interpretation, parseRegistry(registry))).toEqual([])
  })

  test('rejects a Final Fingerprint that differs from the selection', () => {
    expect(isValidConceptBrief(validBrief().replace('- risk: health\n', '- risk: overheat\n'), interpretation, emptyRegistry)).toBe(false)
  })
})
