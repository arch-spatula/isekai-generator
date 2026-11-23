import { describe, expect, test } from 'bun:test'

import { isCompleteChartReport, runChartReport } from './run-chart-report'
import { buildEvidenceManifest } from './chart-evidence'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { allocateRun } from '../../../../scripts/artifacts/pipeline-run'
import { pipelineStatus } from '../../../../scripts/artifacts/pipeline-status'
import { commitFixture, makeRepository } from '../../../../scripts/artifacts/test-fixtures'

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

describe('chart runs in an allocated version folder', () => {
  const report = '四柱八字\n甲子\n紫微斗數 命盤\n命宮 子\nNatal Chart\nSun Aries\n'

  function fixture(fail = false): string {
    const root = makeRepository()
    mkdirSync(join(root, 'scripts'))
    writeFileSync(join(root, 'scripts/chart-report.ts'), fail ? 'console.error("private calculator details"); process.exit(1)' : `process.stdout.write(${JSON.stringify(report)})`)
    commitFixture(root)
    return root
  }

  function files(dir: string): string[] {
    return readdirSync(dir, { recursive: true }).map(String).sort()
  }

  test('standalone success publishes the unchanged report and the run is done without any state database', async () => {
    const root = fixture(), { directory } = allocateRun(root, 'chart-report', 'light', 'experiment')
    expect(await runChartReport(root, directory, [])).toBe(join(directory, 'charts/chart-report.md'))
    expect(readFileSync(join(directory, 'charts/chart-report.md'), 'utf8')).toBe(report)
    expect(pipelineStatus(directory).steps).toEqual([expect.objectContaining({ id: 'chart-report', state: 'done' })])
    expect(files(join(root, 'artifacts')).filter(path => /\.(sqlite|jsonl?)$|TODO\.md$/.test(path))).toEqual([])
    await expect(runChartReport(root, directory, [])).rejects.toThrow()
    expect(readFileSync(join(directory, 'charts/chart-report.md'), 'utf8')).toBe(report)
  })

  test('calculator failure records only a short safe result and consumes the patch', async () => {
    const root = fixture(true), { directory } = allocateRun(root, 'chart-report', 'light', 'experiment')
    await expect(runChartReport(root, directory, [])).rejects.toThrow('private calculator details')
    const result = readFileSync(join(directory, 'garbage/chart-report/generate-1/result.md'), 'utf8')
    expect(result).toContain('상태: execution-failed')
    expect(result).not.toContain('private calculator details')
    expect(existsSync(join(directory, 'charts/chart-report.md'))).toBe(false)
    expect(pipelineStatus(directory).steps[0]).toMatchObject({ state: 'ready', generationAttempts: 1 })
    expect(allocateRun(root, 'chart-report', 'light', 'experiment').version).toBe('v0.1.1')
  })

  test('GDD chart stage makes the three specialist stages ready without allocating another run', async () => {
    const root = fixture(), { directory } = allocateRun(root, 'personalized-gdd', 'deep', 'experiment')
    await runChartReport(root, directory, [])
    const states = Object.fromEntries(pipelineStatus(directory).steps.map(step => [step.id, step.state]))
    expect(states).toMatchObject({ 'chart-report': 'done', saju: 'ready', ziwei: 'ready', natal: 'ready', integration: 'wait' })
    expect(readdirSync(join(root, 'artifacts'))).toEqual(['v0.1.0'])
  })

  test('refuses a folder that was not allocated with run.md', async () => {
    const root = fixture(), directory = join(root, 'artifacts', 'v0.1.0')
    mkdirSync(directory, { recursive: true })
    await expect(runChartReport(root, directory, [])).rejects.toThrow('run.md')
    expect(readdirSync(directory)).toEqual([])
  })
})
