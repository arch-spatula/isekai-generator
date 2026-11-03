import { describe, expect, test } from 'bun:test'

import { isValidInterpretation } from './validate-interpretation'

const domains = ['성격과 기질', '직업과 적성', '재물', '연애와 배우자', '가족과 대인관계', '건강과 생활 리듬', '시기운']
const items = domains.map((domain, index) => `### I-${String(index + 1).padStart(2, '0')}
영역: ${domain}
연결 영역: ${domains[(index + 1) % domains.length]}
관계: 일관
해석: 세 체계가 공통으로 가리키는 생활 경향을 결론부터 제시하고, 강점이 잘 드러나는 환경과 반복해서 부담이 생기는 조건을 일상 수준에서 구체적으로 설명한다.
작동 사슬: 자율성을 지키려는 욕구 → 먼저 기준을 세우는 행동 → 통제적인 환경과 마찰 → 혼자 책임을 떠안는 반복 결과
양면성: 강점: 스스로 방향을 정하고 끝까지 추진한다. | 취약점: 도움을 늦게 요청해 부담이 누적될 수 있다.
조건: 역할과 권한이 분명할 때 강점이 살아나며, 기준이 자주 바뀌거나 간섭이 심한 환경에서는 경직되기 쉽다.
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
## 통합 인물 구조
### 공통 핵심축
핵심 욕구: 자기 기준을 지키면서도 현실에서 성과를 확인하려 한다.
반복 갈등: 자율성을 지키려는 태도와 타인에게 협조를 구해야 하는 상황이 충돌한다.
의사결정 기준: 장기적으로 통제권과 전문성을 확보할 수 있는지를 먼저 판단한다.
근거: S-01, Z-01, N-01
### 체계별 고유 통찰
- 사주 고유: 에너지 배분과 장기 변화의 관점에서 지속 가능한 선택 조건을 좁힌다. (근거: S-01)
- 자미두수 고유: 삶의 무대와 시기 층위를 통해 같은 성향이 드러나는 영역을 특정한다. (근거: Z-01)
- 서양 점성술 고유: 내적 동기와 심리적 긴장을 통해 행동 이전의 갈등 구조를 설명한다. (근거: N-01)
### 영역 간 작동 구조
내적 동기: 자기 기준과 선택권을 보존하려 한다.
행동 방식: 충분히 검토한 뒤 혼자 책임질 수 있는 방향으로 움직인다.
환경 반응: 자율성이 보장되면 몰입하지만 통제가 강하면 방어적으로 거리를 둔다.
반복 결과: 성취의 질은 높아지지만 협업 요청이 늦어져 관계와 생활 리듬에 부담이 이어질 수 있다.
근거: S-01, Z-01, N-01
### 시간에 따른 변화
유지: 자기 기준과 전문성을 중시하는 기본 성향은 시간층이 달라져도 유지된다.
변화: 운의 층위에 따라 그 성향이 직업 선택, 관계 조정, 생활 리듬 재편 중 어디에 집중되는지가 달라진다.
근거: S-01, Z-01
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
    expect(isValidInterpretation(valid.replace('\n영역: 재물\n', '\n영역: 성격과 기질\n'), specialistIds)).toBe(false)
  })

  test('rejects a missing integrated-person structure section', () => {
    expect(isValidInterpretation(valid.replace('### 체계별 고유 통찰', ''), specialistIds)).toBe(false)
  })

  test('rejects a missing system-specific insight', () => {
    expect(isValidInterpretation(valid.replace(/- 자미두수 고유:.+\n/, ''), specialistIds)).toBe(false)
  })

  test('rejects system-specific insight backed by another system', () => {
    expect(isValidInterpretation(valid.replace('(근거: N-01)', '(근거: S-01)'), specialistIds)).toBe(false)
  })

  test('rejects a missing cross-domain link', () => {
    expect(isValidInterpretation(valid.replace(/^연결 영역:.+\n/m, ''), specialistIds)).toBe(false)
  })

  test('rejects an incomplete operation chain', () => {
    expect(isValidInterpretation(valid.replace(/^작동 사슬:.+$/m, '작동 사슬: 욕구 → 행동'), specialistIds)).toBe(false)
  })

  test('rejects a missing strength-vulnerability pair', () => {
    expect(isValidInterpretation(valid.replace(/^양면성:.+$/m, '양면성: 강점만 드러난다.'), specialistIds)).toBe(false)
  })

  test('rejects missing persistence and change over time', () => {
    expect(isValidInterpretation(valid.replace(/^변화:.+\n/m, ''), specialistIds)).toBe(false)
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

  test('accepts a system-specific item backed by that system alone', () => {
    const systemSpecific = valid.replace(/(### I-01[\s\S]*?)관계: 일관/, '$1관계: 고유')
      .replace(/(### I-01[\s\S]*?근거:) S-01, Z-01/, '$1 S-01')
    expect(isValidInterpretation(systemSpecific, specialistIds)).toBe(true)
  })

  test('rejects a system-specific item backed by multiple systems', () => {
    const mixedSpecific = valid.replace(/(### I-01[\s\S]*?)관계: 일관/, '$1관계: 고유')
    expect(isValidInterpretation(mixedSpecific, specialistIds)).toBe(false)
  })

  test('rejects a cross-system relationship backed by only one system', () => {
    const singleSystem = valid.replace(/(### I-01[\s\S]*?근거:) S-01, Z-01/, '$1 S-01')
    expect(isValidInterpretation(singleSystem, specialistIds)).toBe(false)
  })

  test('rejects an ID placed in the wrong specialist source', () => {
    const misplaced = { S: new Set<string>(), Z: new Set(['Z-01', 'S-01']), N: new Set(['N-01']) }
    expect(isValidInterpretation(valid, misplaced)).toBe(false)
  })
})
