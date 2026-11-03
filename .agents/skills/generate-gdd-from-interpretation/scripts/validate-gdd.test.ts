import { describe, expect, test } from 'bun:test'

import { isValidGdd } from './validate-gdd'

describe('isValidGdd', () => {
  test('accepts a traceable GDD containing the complete report', () => {
    expect(isValidGdd(
      '# GDD\n\n설계 모티프: 경계의 수호자\n해석 근거: I-01\n\n四柱八字\n命宮',
      '四柱八字\n命宮\n',
      '# 명식 해석\n\n### I-01\n해석: 보존과 변화의 긴장',
    )).toBe(true)
  })

  test('rejects a GDD without a design motif', () => {
    expect(isValidGdd('# GDD\n\n四柱八字', '四柱八字', '### I-01')).toBe(false)
  })

  test('rejects an interpretation ID absent from the interpretation', () => {
    expect(isValidGdd(
      '# GDD\n\n설계 모티프: 경계의 수호자\n해석 근거: I-02\n\n四柱八字',
      '四柱八字',
      '# 명식 해석\n\n### I-01',
    )).toBe(false)
  })

  test('rejects a design motif without an interpretation reference', () => {
    expect(isValidGdd(
      '# GDD\n\n설계 모티프: 경계의 수호자\n\n四柱八字',
      '四柱八字',
      '# 명식 해석\n\n### I-01',
    )).toBe(false)
  })
})
