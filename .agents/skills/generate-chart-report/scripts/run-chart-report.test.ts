import { describe, expect, test } from 'bun:test'

import { isCompleteChartReport } from './run-chart-report'
import { buildEvidenceManifest } from './chart-evidence'

describe('isCompleteChartReport', () => {
  test('accepts output containing all chart systems', () => {
    expect(isCompleteChartReport('四柱八字\n紫微斗數 命盤\nNatal Chart')).toBe(true)
  })

  test('rejects incomplete output', () => {
    expect(isCompleteChartReport('四柱八字\nNatal Chart')).toBe(false)
  })
})

describe('buildEvidenceManifest', () => {
  test('assigns stable IDs and omits decorative separators', () => {
    const report = `四柱八字\n─────\n甲子\n\n紫微斗數 命盤\n═════\n命宮 子\n\nNatal Chart\n═════\nSun Aries`
    const first = buildEvidenceManifest(report)
    const second = buildEvidenceManifest(report.replace('─────', '═════'))
    expect(first).toEqual(second)
    expect(first.systems.saju).toHaveLength(1)
    expect(first.systems.saju[0].id).toMatch(/^S-E[0-9a-f]{16}$/)
    expect(first.systems.natal[0].text).toBe('Sun Aries')
  })
})
