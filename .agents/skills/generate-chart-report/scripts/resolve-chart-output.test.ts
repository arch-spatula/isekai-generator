import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { resolveChartOutput } from './resolve-chart-output'

function makeRoot(): string {
  return mkdtempSync(join(tmpdir(), 'chart-report-skill-'))
}

describe('resolveChartOutput', () => {
  test('starts at v0.1.0', () => {
    expect(resolveChartOutput(makeRoot())).toEndWith(
      '/artifacts/v0.1.0/docs/GDD/chart-report.md',
    )
  })

  test('increments the greatest semantic version patch', () => {
    const root = makeRoot()
    mkdirSync(join(root, 'artifacts', 'v0.2.3'), { recursive: true })
    expect(resolveChartOutput(root)).toEndWith(
      '/artifacts/v0.2.4/docs/GDD/chart-report.md',
    )
  })

  test('refuses an existing requested version', () => {
    const root = makeRoot()
    mkdirSync(join(root, 'artifacts', 'v1.0.0'), { recursive: true })
    expect(() => resolveChartOutput(root, '1.0.0')).toThrow('Artifact version already exists: v1.0.0')
  })
})
