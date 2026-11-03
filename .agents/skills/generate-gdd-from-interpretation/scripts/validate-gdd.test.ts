import { describe, expect, test } from 'bun:test'

import { isValidGdd } from './validate-gdd'

describe('isValidGdd', () => {
  test('accepts a traceable GDD containing the complete report', () => {
    expect(isValidGdd(
      '# GDD\n\n해석 모티프: 경계의 수호자\n\n四柱八字\n命宮',
      '四柱八字\n命宮\n',
      '# 명식 창작 해석\n\n경계의 수호자',
    )).toBe(true)
  })

  test('rejects a GDD without a traceable motif', () => {
    expect(isValidGdd('# GDD\n\n四柱八字', '四柱八字', '# 해석')).toBe(false)
  })

  test('rejects a motif absent from the interpretation', () => {
    expect(isValidGdd(
      '# GDD\n\n해석 모티프: 발명된 모티프\n\n四柱八字',
      '四柱八字',
      '# 해석\n\n경계의 수호자',
    )).toBe(false)
  })
})
