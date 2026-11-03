import { describe, expect, test } from 'bun:test'

import { isValidGdd } from './validate-gdd'

describe('isValidGdd', () => {
  test('accepts a traceable GDD containing the complete chart report', () => {
    expect(isValidGdd(
      '# 자유로운 제목\n\n해석 모티프: 경계의 수호자\n\n## 원문\n\n四柱八字\n命宮',
      '四柱八字\n命宮\n',
      '# 명식 창작 해석\n\n경계의 수호자',
    )).toBe(true)
  })

  test('rejects an empty document', () => {
    expect(isValidGdd(' \n\t', '四柱八字', '# 해석')).toBe(false)
  })

  test('rejects an empty chart report', () => {
    expect(isValidGdd('# GDD', ' \n\t', '# 해석')).toBe(false)
  })

  test('rejects a GDD that omits part of the chart report', () => {
    expect(isValidGdd('# GDD\n\n해석 모티프: 문턱\n\n四柱八字', '四柱八字\n命宮', '# 해석')).toBe(false)
  })

  test('rejects a GDD without a traceable interpretation motif', () => {
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
