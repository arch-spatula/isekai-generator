import { describe, expect, test } from 'bun:test'

import { type ChartSystem, isValidSystemInterpretation } from './validate-system-interpretation'

const cases = {
  saju: {
    prefix: 'S',
    headings: ['# 사주팔자 심층 해석', '## 계산 전제와 불확실성', '## 원국과 십신 구조', '## 팔자 관계', '## 신살', '## 좌법과 인종법', '## 대운', '## 원문 항목 검토표'],
    report: '四柱八字\n時柱 日柱 月柱 年柱\n八字關係\n神殺\n大運\n1運',
    absent: ['坐法', '引從法'],
  },
  ziwei: {
    prefix: 'Z',
    headings: ['# 자미두수 심층 해석', '## 계산 전제와 불확실성', '## 명반 기본 구조', '## 십이궁과 성요', '## 본명 사화', '## 대한', '## 유년과 유월', '## 원문 항목 검토표'],
    report: '紫微斗數 命盤\n命宮 兄弟 夫妻\n四化\n大限\n流年\n流月 正月',
    absent: [],
  },
  natal: {
    prefix: 'N',
    headings: ['# 네이탈 차트 심층 해석', '## 계산 전제와 불확실성', '## 앵글과 하우스', '## 행성 배치', '## 주요 애스펙트', '## 차트 내부 종합', '## 원문 항목 검토표'],
    report: 'Natal Chart\nAngles\nASC 12°\nSun Aries 1°\nMajor Aspects\nSun Trine Moon 2°',
    absent: ['Houses', 'Chiron', 'Fortuna'],
  },
} as const

for (const [system, fixture] of Object.entries(cases)) {
  describe(system, () => {
    const checklist = fixture.report.split('\n').map(row => `- 검토: ${row}`).join('\n')
    const absences = fixture.absent.map(marker => `- 보고서에 없음: ${marker}`).join('\n')
    const valid = `${fixture.headings.join('\n')}\n${checklist}\n${absences}\n## 전문 해석 항목\n### ${fixture.prefix}-01\n해석: 구조적 긴장\n근거: 보고서 값\n## 한계와 금지된 단정`

    test('accepts the complete specialist contract', () => {
      expect(isValidSystemInterpretation(system as ChartSystem, valid, fixture.report)).toBe(true)
    })

    test('rejects a missing coverage section', () => {
      expect(isValidSystemInterpretation(system as ChartSystem, valid.replace(fixture.headings[2], ''), fixture.report)).toBe(false)
    })

    test('rejects an item without evidence', () => {
      expect(isValidSystemInterpretation(system as ChartSystem, valid.replace('근거:', '출처:'), fixture.report)).toBe(false)
    })

    test('rejects an omitted source row', () => {
      expect(isValidSystemInterpretation(system as ChartSystem, valid.replace(`- 검토: ${fixture.report.split('\n')[1]}`, ''), fixture.report)).toBe(false)
    })

    if (fixture.absent.length > 0) {
      test('rejects an unacknowledged conditional absence', () => {
        expect(isValidSystemInterpretation(system as ChartSystem, valid.replace(`- 보고서에 없음: ${fixture.absent[0]}`, ''), fixture.report)).toBe(false)
      })
    }
  })
}
