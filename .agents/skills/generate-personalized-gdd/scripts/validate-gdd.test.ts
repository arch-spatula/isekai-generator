import { describe, expect, test } from 'bun:test'

import { isValidGdd } from './validate-gdd'

describe('orchestrator GDD contract', () => {
  test('accepts a design motif traced to an interpretation item', () => {
    expect(isValidGdd(
      '# 자유로운 제목\n\n설계 모티프: 경계의 수호자\n해석 근거: I-01\n\n## 원문\n\n四柱八字\n命宮',
      '四柱八字\n命宮\n',
      '# 명식 해석\n\n### I-01\n해석: 보존과 변화의 긴장',
    )).toBe(true)
  })

  test('rejects an empty document', () => {
    expect(isValidGdd(' \n\t', '四柱八字', '### I-01')).toBe(false)
  })

  test('rejects an empty chart report', () => {
    expect(isValidGdd('# GDD', ' \n\t', '### I-01')).toBe(false)
  })

  test('rejects a GDD that omits part of the chart report', () => {
    expect(isValidGdd(
      '# GDD\n\n설계 모티프: 문턱\n해석 근거: I-01\n\n四柱八字',
      '四柱八字\n命宮',
      '### I-01',
    )).toBe(false)
  })

  test('rejects a design motif without a valid interpretation ID', () => {
    expect(isValidGdd(
      '# GDD\n\n설계 모티프: 문턱\n해석 근거: I-02\n\n四柱八字',
      '四柱八字',
      '### I-01',
    )).toBe(false)
  })
})
