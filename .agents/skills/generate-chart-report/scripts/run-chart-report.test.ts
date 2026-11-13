import { ArtifactState } from '../../../../scripts/artifacts/artifact-state-store'
import { tree } from '../../../../scripts/artifacts/sqlite-test-fixtures'
import { describe, expect, test } from 'bun:test'

import { isCompleteChartReport, runChartReport } from './run-chart-report'
import { buildEvidenceManifest } from './chart-evidence'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { allocateRun, failRun, readRunManifest, updateRun } from '../../../../scripts/artifacts/artifact-run'
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

describe('reserved chart runs', () => {
  const report = '四柱八字\n甲子\n紫微斗數 命盤\n命宮 子\nNatal Chart\nSun Aries\n'

  function fixture(fail = false): string {
    const root = makeRepository()
    mkdirSync(join(root, 'scripts'))
    writeFileSync(join(root, 'scripts/chart-report.ts'), fail ? 'console.error("private calculator details"); process.exit(1)' : `process.stdout.write(${JSON.stringify(report)})`)
    commitFixture(root)
    return root
  }

  test('standalone success writes unchanged report and evidence before succeeding', async () => {
    const root = fixture(), directory = allocateRun(root, 'chart-report')
    const output = join(directory, 'docs/GDD/chart-report.md')
    await runChartReport(root, output, [])
    expect(readFileSync(output, 'utf8')).toBe(report)
    const state = new ArtifactState(root, false, true)
    try { expect(state.evidence(state.run(directory.split('/').at(-1)!).id)).toEqual(buildEvidenceManifest(report)) } finally { state.close() }
    expect(tree(join(root, 'artifacts')).filter(path => /\.jsonl?$|TODO\.md$/.test(path))).toEqual([])
    expect(readRunManifest(directory)).toMatchObject({ status: 'succeeded', failure: null })
    const summary = new ArtifactState(root, false, true)
    try { expect(summary.summary(summary.run(directory.split('/').at(-1)!).id).data.stages).toContainEqual(expect.objectContaining({ stage: 'chart-report', status: 'succeeded' })) } finally { summary.close() }
    await expect(runChartReport(root, output, [])).rejects.toThrow()
  })

  test('calculator failure consumes patch and stores only a short safe failure summary', async () => {
    const root = fixture(true), directory = allocateRun(root, 'chart-report')
    await expect(runChartReport(root, join(directory, 'docs/GDD/chart-report.md'), [])).rejects.toThrow('private calculator details')
    expect(readRunManifest(directory)).toMatchObject({ status: 'failed', failure: { stage: 'chart-report', summary: 'Chart calculation or evidence validation failed.' } })
    const state = new ArtifactState(root, false, true)
    try {
      const run = state.run(directory.split('/').at(-1)!)
      expect(JSON.stringify(state.summary(run.id))).not.toContain('private calculator details')
      expect(JSON.stringify(state.all('SELECT * FROM events WHERE run_id=?', run.id))).not.toContain('private calculator details')
    } finally { state.close() }
    expect(allocateRun(root, 'chart-report')).toEndWith('/v0.1.1')
  })

  test('GDD chart stage does not allocate a second run or finalize its parent', async () => {
    const root = fixture(), directory = allocateRun(root, 'personalized-gdd', { mode: 'deep' })
    updateRun(directory, 'running')
    await runChartReport(root, join(directory, 'docs/GDD/chart-report.md'), [])
    expect(readRunManifest(directory).status).toBe('running')
    expect(() => failRun(directory, 'specialist', 'Specialist validation failed.', new Error('validation failed'))).toThrow('validation failed')
    expect(readRunManifest(directory).failure?.stage).toBe('specialist')
    expect(allocateRun(root, 'personalized-gdd')).toEndWith('/v0.1.1')
  })

  test('refuses a free-form output path and an unstarted GDD run', async () => {
    const root = fixture(), directory = allocateRun(root, 'personalized-gdd')
    await expect(runChartReport(root, join(directory, 'docs/GDD/chart-report.md'), [])).rejects.toThrow('Parent GDD run must be running')
    await expect(runChartReport(root, join(root, 'chart-report.md'), [])).rejects.toThrow()
    expect(readRunManifest(directory).status).toBe('allocated')
  })
})
