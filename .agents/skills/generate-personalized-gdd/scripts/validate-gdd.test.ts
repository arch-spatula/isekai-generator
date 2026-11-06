import { describe, expect, test } from 'bun:test'
import { presentationFixture } from '../../../../scripts/fixtures/game-presentation'

import { isValidGdd as validateGdd } from './validate-gdd'
import { serializeWorldBrief, worldStructureFixture } from '../../select-world-concept/scripts/world-fixtures'

function isValidGdd(gdd: string, chart: string, interpretation: string, combat: string): boolean {
  return validateGdd(gdd, chart, interpretation, combat, serializeWorldBrief())
}

const conceptBrief = `## Selection

- selected: C-01

## Final Fingerprint

- combatRange: long
- powerMedium: spell
- initiative: reactive
- spaceUse: swap
- combatRhythm: cycle
- mastery: aim
- risk: focus_break` + presentationFixture

const fingerprint = presentationFixture + worldStructureFixture() + `\n\n\`\`\`combat-fingerprint
{"combatRange":"long","powerMedium":"spell","initiative":"reactive","spaceUse":"swap","combatRhythm":"cycle","mastery":"aim","risk":"focus_break"}
\`\`\``

describe('orchestrator GDD contract', () => {
  test('accepts a design motif traced to an interpretation item', () => {
    expect(isValidGdd(
      `# 자유로운 제목\n\n설계 모티프: 경계의 수호자\n해석 근거: I-01${fingerprint}`,
      '四柱八字\n命宮\n',
      '# 통합 차트 해석\n\n### I-01\n해석: 보존과 변화의 긴장',
      conceptBrief,
    )).toBe(true)
  })

  test('rejects an empty document', () => {
    expect(isValidGdd(' \n\t', '四柱八字', '### I-01', conceptBrief)).toBe(false)
  })

  test('rejects an empty chart report', () => {
    expect(isValidGdd(`# GDD${fingerprint}`, ' \n\t', '### I-01', conceptBrief)).toBe(false)
  })

  test('rejects a GDD that embeds the chart report', () => {
    expect(isValidGdd(
      `# GDD\n\n설계 모티프: 문턱\n해석 근거: I-01\n\n四柱八字\n命宮${fingerprint}`,
      '四柱八字\n命宮',
      '### I-01',
      conceptBrief,
    )).toBe(false)
  })

  test('rejects a design motif without a valid interpretation ID', () => {
    expect(isValidGdd(
      '# GDD\n\n설계 모티프: 문턱\n해석 근거: I-02',
      '四柱八字',
      '### I-01',
      conceptBrief,
    )).toBe(false)
  })
})
