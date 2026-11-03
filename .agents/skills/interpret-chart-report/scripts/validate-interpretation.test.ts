import { describe, expect, test } from 'bun:test'

import { isValidInterpretation } from './validate-interpretation'

const domains = ['성격과 기질', '직업과 적성', '재물', '연애와 배우자', '가족과 대인관계', '건강과 생활 리듬', '시기운']
const items = domains.map((domain, index) => `### I-${String(index + 1).padStart(2, '0')}
영역: ${domain}
관계: 일관
해석: 세 체계가 공통으로 가리키는 생활 경향을 결론부터 제시하고, 강점이 잘 드러나는 환경과 반복해서 부담이 생기는 조건을 일상 수준에서 구체적으로 설명한다.
근거: S-01, Z-01`).join('\n')

const valid = `# 통합 차트 해석
## 해석 원칙
## 전문 해석 요약
### 사주팔자
### 자미두수
### 서양 점성술
## 교차 체계 비교
### 일관된 해석
### 구체성을 더하는 해석
### 상충하는 해석
## 핵심 해석 항목
${items}
`

const specialistIds = {
  S: new Set(['S-01']),
  Z: new Set(['Z-01']),
  N: new Set(['N-01']),
}

describe('isValidInterpretation', () => {
  test('accepts the ordered evidence-bearing contract without creative motifs', () => {
    expect(isValidInterpretation(valid, specialistIds)).toBe(true)
  })

  test('rejects a missing section', () => {
    expect(isValidInterpretation(valid.replace('## 핵심 해석 항목', ''), specialistIds)).toBe(false)
  })

  test('rejects an interpretation item without evidence', () => {
    expect(isValidInterpretation(valid.replace('근거:', '출처:'), specialistIds)).toBe(false)
  })

  test('rejects an omitted life domain', () => {
    expect(isValidInterpretation(valid.replace('영역: 재물', '영역: 성격과 기질'), specialistIds)).toBe(false)
  })

  test('rejects a shallow interpretation', () => {
    expect(isValidInterpretation(valid.replace(/^해석:.+$/m, '해석: 보존과 변화가 함께 요구된다.'), specialistIds)).toBe(false)
  })

  test('rejects a deprecated disclaimer section', () => {
    expect(isValidInterpretation(`${valid}\n## 불확실성과 금지된 단정`, specialistIds)).toBe(false)
  })

  test('rejects non-sequential interpretation IDs', () => {
    expect(isValidInterpretation(valid.replace('### I-01', '### I-02'), specialistIds)).toBe(false)
  })

  test('rejects an interpretation item without an interpretation', () => {
    expect(isValidInterpretation(valid.replace('해석:', '의미:'), specialistIds)).toBe(false)
  })

  test('rejects an unknown specialist ID', () => {
    expect(isValidInterpretation(valid.replace('Z-01', 'Z-99'), specialistIds)).toBe(false)
  })

  test('rejects a missing relationship classification', () => {
    expect(isValidInterpretation(valid.replace('관계: 일관\n', ''), specialistIds)).toBe(false)
  })

  test('rejects a cross-system relationship backed by only one system', () => {
    expect(isValidInterpretation(valid.replace('S-01, Z-01', 'S-01'), specialistIds)).toBe(false)
  })

  test('rejects an ID placed in the wrong specialist source', () => {
    const misplaced = { S: new Set<string>(), Z: new Set(['Z-01', 'S-01']), N: new Set(['N-01']) }
    expect(isValidInterpretation(valid, misplaced)).toBe(false)
  })
})
