import { describe, expect, test } from 'bun:test'

import { isCompleteChartReport } from './run-chart-report'

describe('isCompleteChartReport', () => {
  test('accepts output containing all chart systems', () => {
    expect(isCompleteChartReport('四柱八字\n紫微斗數 命盤\nNatal Chart')).toBe(true)
  })

  test('rejects incomplete output', () => {
    expect(isCompleteChartReport('四柱八字\nNatal Chart')).toBe(false)
  })
})
