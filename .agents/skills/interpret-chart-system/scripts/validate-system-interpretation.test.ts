import { describe, expect, test } from 'bun:test'

import { type ChartSystem, isValidSystemInterpretation } from './validate-system-interpretation'

const cases = {
  saju: {
    prefix: 'S',
    resolutions: ['원국 구조', '관계 작용', '운의 변화'],
    headings: ['# 사주팔자 심층 해석', '## 계산 전제', '## 원국과 십신 구조', '## 팔자 관계', '## 신살', '## 좌법과 인종법', '## 대운', '## 원문 항목 검토표'],
    report: '四柱八字\n時柱 日柱 月柱 年柱\n八字關係\n神殺\n大運\n1運',
    absent: ['坐法', '引從法'],
  },
  ziwei: {
    prefix: 'Z',
    resolutions: ['궁위 역할', '성요 상태', '시간 층위'],
    headings: ['# 자미두수 심층 해석', '## 계산 전제', '## 명반 기본 구조', '## 십이궁과 성요', '## 본명 사화', '## 대한', '## 유년과 유월', '## 원문 항목 검토표'],
    report: '紫微斗數 命盤\n命宮 兄弟 夫妻\n四化\n大限\n流年\n流月 正月',
    absent: [],
  },
  natal: {
    prefix: 'N',
    resolutions: ['심리 기능', '삶의 영역', '내적 역동'],
    headings: ['# 네이탈 차트 심층 해석', '## 계산 전제', '## 앵글과 하우스', '## 행성 배치', '## 주요 애스펙트', '## 차트 내부 종합', '## 원문 항목 검토표'],
    report: 'Natal Chart\nAngles\nASC 12°\nSun Aries 1°\nMajor Aspects\nSun Trine Moon 2°',
    absent: ['Houses', 'Chiron', 'Fortuna'],
  },
} as const

for (const [system, fixture] of Object.entries(cases)) {
  describe(system, () => {
    const checklist = fixture.report.split('\n').map(row => `- 검토: ${row}`).join('\n')
    const absences = fixture.absent.map(marker => `- 보고서에 없음: ${marker}`).join('\n')
    const domains = ['성격과 기질', '직업과 적성', '재물', '연애와 배우자', '가족과 대인관계', '건강과 생활 리듬', '시기운']
    const items = domains.map((domain, index) => `### ${fixture.prefix}-${String(index + 1).padStart(2, '0')}
영역: ${domain}
해상도: ${fixture.resolutions[index % fixture.resolutions.length]}
해석: 이 영역에서는 차트의 구조를 실제 생활의 선택과 반응 방식으로 연결하여, 강점이 드러나는 조건과 반복해서 마찰이 생길 수 있는 조건을 함께 구체적으로 설명한다.
근거: 보고서에 기록된 배치와 관계를 함께 사용한 근거`).join('\n')
    const valid = `${fixture.headings.join('\n')}\n${checklist}\n${absences}\n## 전문 해석 항목\n${items}`

    test('accepts the complete specialist contract', () => {
      expect(isValidSystemInterpretation(system as ChartSystem, valid, fixture.report)).toBe(true)
    })

    test('rejects a missing coverage section', () => {
      expect(isValidSystemInterpretation(system as ChartSystem, valid.replace(fixture.headings[2], ''), fixture.report)).toBe(false)
    })

    test('rejects an item without evidence', () => {
      expect(isValidSystemInterpretation(system as ChartSystem, valid.replace('근거:', '출처:'), fixture.report)).toBe(false)
    })

    test('rejects an item without a system resolution', () => {
      expect(isValidSystemInterpretation(system as ChartSystem, valid.replace(/^해상도:.+\n/m, ''), fixture.report)).toBe(false)
    })

    test('rejects a specialist item that preselects creative material', () => {
      expect(isValidSystemInterpretation(system as ChartSystem, valid.replace(
        /^근거:/m,
        '시드 가치: 현실의 관리 역할을 판타지 직업과 능력으로 바꾸는 창작 재료다.\n근거:',
      ), fixture.report)).toBe(false)
    })

    test('rejects an omitted system resolution', () => {
      expect(isValidSystemInterpretation(system as ChartSystem, valid.replaceAll(`해상도: ${fixture.resolutions[2]}`, `해상도: ${fixture.resolutions[0]}`), fixture.report)).toBe(false)
    })

    test('rejects an omitted life domain', () => {
      expect(isValidSystemInterpretation(system as ChartSystem, valid.replace('영역: 재물', '영역: 성격과 기질'), fixture.report)).toBe(false)
    })

    test('rejects a shallow interpretation', () => {
      expect(isValidSystemInterpretation(system as ChartSystem, valid.replace(/^해석:.+$/m, '해석: 구조적 긴장'), fixture.report)).toBe(false)
    })

    test('rejects responsibility-avoidance language', () => {
      expect(isValidSystemInterpretation(system as ChartSystem, `${valid}\n이 해석은 미래를 예언하지 않는다.`, fixture.report)).toBe(false)
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
