import { describe, expect, test } from 'bun:test'

import { isValidInterpretation } from './validate-interpretation'

const valid = `# 명식 해석
## 해석 원칙
## 체계별 관찰
### 사주팔자
### 자미두수
### 서양 점성술
## 교차 체계 종합
## 핵심 해석 항목
### I-01
해석: 보존과 변화가 함께 요구된다.
근거: 사주 일간과 자미두수 명궁
## 불확실성과 금지된 단정`

describe('isValidInterpretation', () => {
  test('accepts the ordered evidence-bearing contract without creative motifs', () => {
    expect(isValidInterpretation(valid)).toBe(true)
  })

  test('rejects a missing section', () => {
    expect(isValidInterpretation(valid.replace('## 핵심 해석 항목', ''))).toBe(false)
  })

  test('rejects an interpretation item without evidence', () => {
    expect(isValidInterpretation(valid.replace('근거:', '출처:'))).toBe(false)
  })

  test('rejects non-sequential interpretation IDs', () => {
    expect(isValidInterpretation(valid.replace('### I-01', '### I-02'))).toBe(false)
  })

  test('rejects an interpretation item without an interpretation', () => {
    expect(isValidInterpretation(valid.replace('해석:', '의미:'))).toBe(false)
  })
})
