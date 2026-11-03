import { describe, expect, test } from 'bun:test'

import { isValidInterpretation } from './validate-interpretation'

const valid = `# 명식 창작 해석
## 해석 원칙
근거: 원문
## 체계별 관찰
### 사주팔자
### 자미두수
### 서양 점성술
## 교차 체계 종합
## 창작 모티프
## 불확실성과 금지된 단정`

describe('isValidInterpretation', () => {
  test('accepts the ordered evidence-bearing contract', () => {
    expect(isValidInterpretation(valid)).toBe(true)
  })

  test('rejects a missing section', () => {
    expect(isValidInterpretation(valid.replace('## 창작 모티프', ''))).toBe(false)
  })

  test('rejects an interpretation without evidence', () => {
    expect(isValidInterpretation(valid.replace('근거:', '출처:'))).toBe(false)
  })
})
