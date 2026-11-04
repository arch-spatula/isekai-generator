import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { makeRepository } from '../../../../scripts/artifacts/test-fixtures'
import { readRunManifest } from '../../../../scripts/artifacts/artifact-run'
import { resolveChartOutput } from './resolve-chart-output'

test('resolveChartOutput reserves a run and returns the existing output layout', () => {
  const root = makeRepository()
  const output = resolveChartOutput(root, { mode: 'deep', purpose: 'regression' })
  expect(output).toBe(join(root, 'artifacts/v0.1.0/docs/GDD/chart-report.md'))
  expect(readRunManifest(join(root, 'artifacts/v0.1.0'))).toMatchObject({ status: 'allocated', mode: 'deep', purpose: 'regression' })
  expect(resolveChartOutput(root)).toContain('/v0.1.1/')
})

test('resolveChartOutput refuses legacy explicit version arguments', () => {
  const root = makeRepository()
  expect(() => resolveChartOutput(root, 'v0.2.0' as never)).toThrow()
})
