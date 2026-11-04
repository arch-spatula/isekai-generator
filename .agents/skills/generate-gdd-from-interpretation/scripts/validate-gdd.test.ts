import { describe, expect, test } from 'bun:test'

import { isValidGdd as validateGdd } from './validate-gdd'
import { serializeWorldBrief, worldStructureFixture } from '../../select-world-concept/scripts/world-fixtures'

function isValidGdd(gdd: string, chart: string, interpretation: string, combat: string): boolean {
  return validateGdd(gdd, chart, interpretation, combat, serializeWorldBrief())
}

const conceptBrief = `# Gameplay Concept Brief

## Selection

- selected: C-01

## Final Fingerprint

- combatRange: long
- powerMedium: spell
- initiative: reactive
- spaceUse: swap
- combatRhythm: cycle
- mastery: aim
- risk: focus_break`

const fingerprint = worldStructureFixture() + `\n\n\`\`\`combat-fingerprint
{"combatRange":"long","powerMedium":"spell","initiative":"reactive","spaceUse":"swap","combatRhythm":"cycle","mastery":"aim","risk":"focus_break"}
\`\`\``

describe('isValidGdd', () => {
  test('accepts a traceable GDD without the source report', () => {
    expect(isValidGdd(
      `# GDD\n\n설계 모티프: 경계의 수호자\n해석 근거: I-01${fingerprint}`,
      '四柱八字\n命宮\n',
      '# 통합 차트 해석\n\n### I-01\n해석: 보존과 변화의 긴장',
      conceptBrief,
    )).toBe(true)
  })

  test('rejects a GDD without a design motif', () => {
    expect(isValidGdd(`# GDD${fingerprint}`, '四柱八字', '### I-01', conceptBrief)).toBe(false)
  })

  test('rejects an interpretation ID absent from the interpretation', () => {
    expect(isValidGdd(
      '# GDD\n\n설계 모티프: 경계의 수호자\n해석 근거: I-02',
      '四柱八字',
      '# 통합 차트 해석\n\n### I-01',
      conceptBrief,
    )).toBe(false)
  })

  test('rejects a design motif without an interpretation reference', () => {
    expect(isValidGdd(
      '# GDD\n\n설계 모티프: 경계의 수호자',
      '四柱八字',
      '# 통합 차트 해석\n\n### I-01',
      conceptBrief,
    )).toBe(false)
  })

  test('rejects a GDD containing the complete source report', () => {
    expect(isValidGdd(
      `# GDD\n\n설계 모티프: 경계의 수호자\n해석 근거: I-01\n\n四柱八字\n命宮${fingerprint}`,
      '四柱八字\n命宮',
      '### I-01',
      conceptBrief,
    )).toBe(false)
  })

  test('rejects a combat fingerprint that differs from the selected concept', () => {
    expect(isValidGdd(
      `# GDD\n\n설계 모티프: 경계\n해석 근거: I-01${fingerprint.replace('"long"', '"close"')}`,
      '四柱八字',
      '### I-01',
      conceptBrief,
    )).toBe(false)
  })
})
