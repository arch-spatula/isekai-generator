import { describe, expect, test } from 'bun:test'

import { type ChartSystem, isValidSystemInterpretation, diagnoseSystemInterpretation } from './validate-system-interpretation'
import type { ChartEvidenceManifest } from '../../generate-chart-report/scripts/chart-evidence'

const cases = {
  saju: {
    prefix: 'S',
    resolutions: ['원국 구조', '관계 작용', '운의 변화'],
    evidenceSystem: 'saju',
    headings: ['# 사주팔자 심층 해석', '## 계산 전제', '## 원국과 십신 구조', '## 팔자 관계', '## 신살', '## 좌법과 인종법', '## 대운'],
  },
  ziwei: {
    prefix: 'Z',
    resolutions: ['궁위 역할', '성요 상태', '시간 층위'],
    evidenceSystem: 'ziwei',
    headings: ['# 자미두수 심층 해석', '## 계산 전제', '## 명반 기본 구조', '## 십이궁과 성요', '## 본명 사화', '## 대한', '## 유년과 유월'],
  },
  natal: {
    prefix: 'N',
    resolutions: ['심리 기능', '삶의 영역', '내적 역동'],
    evidenceSystem: 'natal',
    headings: ['# 네이탈 차트 심층 해석', '## 계산 전제', '## 앵글과 하우스', '## 행성 배치', '## 주요 애스펙트', '## 차트 내부 종합'],
  },
} as const

for (const [system, fixture] of Object.entries(cases)) {
  describe(system, () => {
    const evidenceId = `${fixture.prefix}-E0000000000000001`
    const manifest: ChartEvidenceManifest = { version: 1, systems: { saju: [], ziwei: [], natal: [], [fixture.evidenceSystem]: [{ id: evidenceId, text: 'fixture evidence' }] } }
    const domains = ['성격과 기질', '직업과 적성', '재물', '연애와 배우자', '가족과 대인관계', '건강과 생활 리듬', '시기운']
    const items = domains.map((domain, index) => `### ${fixture.prefix}-${String(index + 1).padStart(2, '0')}
영역: ${domain}
해상도: ${fixture.resolutions[index % fixture.resolutions.length]}
해석: 이 영역에서는 차트의 구조를 실제 생활의 선택과 반응 방식으로 연결하여, 강점이 드러나는 조건과 반복해서 마찰이 생길 수 있는 조건을 함께 구체적으로 설명한다.
근거: ${evidenceId}`).join('\n')
    const valid = `${fixture.headings.join('\n')}\n## 전문 해석 항목\n${items}`

    test('accepts the complete specialist contract', () => {
      expect(isValidSystemInterpretation(system as ChartSystem, valid, manifest)).toBe(true)
    })

    test('rejects a missing coverage section', () => {
      expect(isValidSystemInterpretation(system as ChartSystem, valid.replace(fixture.headings[2], ''), manifest)).toBe(false)
    })

    test('rejects an item without evidence', () => {
      expect(isValidSystemInterpretation(system as ChartSystem, valid.replace('근거:', '출처:'), manifest)).toBe(false)
    })

    test('rejects an item without a system resolution', () => {
      expect(isValidSystemInterpretation(system as ChartSystem, valid.replace(/^해상도:.+\n/m, ''), manifest)).toBe(false)
    })

    test('rejects a specialist item that preselects creative material', () => {
      expect(isValidSystemInterpretation(system as ChartSystem, valid.replace(
        /^근거:/m,
        '시드 가치: 현실의 관리 역할을 판타지 직업과 능력으로 바꾸는 창작 재료다.\n근거:',
      ), manifest)).toBe(false)
    })

    test('rejects an omitted system resolution', () => {
      expect(isValidSystemInterpretation(system as ChartSystem, valid.replaceAll(`해상도: ${fixture.resolutions[2]}`, `해상도: ${fixture.resolutions[0]}`), manifest)).toBe(false)
    })

    test('rejects an omitted life domain', () => {
      expect(isValidSystemInterpretation(system as ChartSystem, valid.replace('영역: 재물', '영역: 성격과 기질'), manifest)).toBe(false)
    })

    test('rejects a shallow interpretation', () => {
      expect(isValidSystemInterpretation(system as ChartSystem, valid.replace(/^해석:.+$/m, '해석: 구조적 긴장'), manifest)).toBe(false)
    })

    test('diagnoses responsibility wording with a location and no quoted content', () => {
      const errors = diagnoseSystemInterpretation(system as ChartSystem, `${valid}\n단정하지 않는다.`, manifest)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toMatchObject({ code: 'responsibility-avoidance', line: valid.split('\n').length + 1 })
      expect(JSON.stringify(errors)).not.toContain('단정하지')
    })

    test('diagnoses item and coverage failures', () => {
      const extra = structuredClone(manifest)
      extra.systems[fixture.evidenceSystem].push({ id: `${fixture.prefix}-E0000000000000002`, text: 'missing fixture' })
      const errors = diagnoseSystemInterpretation(system as ChartSystem, valid.replace('근거:', '출처:'), extra)
      expect(errors).toContainEqual(expect.objectContaining({ code: 'item-evidence', itemId: `${fixture.prefix}-01`, line: expect.any(Number) }))
      expect(errors.some(error => error.code === 'evidence-coverage')).toBe(true)
    })

    test('rejects responsibility-avoidance language', () => {
      expect(isValidSystemInterpretation(system as ChartSystem, `${valid}\n이 해석은 미래를 예언하지 않는다.`, manifest)).toBe(false)
    })

    test('rejects an unknown evidence ID', () => {
      expect(isValidSystemInterpretation(system as ChartSystem, valid.replace(evidenceId, `${fixture.prefix}-Effffffffffffffff`), manifest)).toBe(false)
    })
  })
}
