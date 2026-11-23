import { describe, expect, test } from 'bun:test'
import * as fs from 'node:fs'
import { join } from 'node:path'
import { git, readSeriesConfig } from './artifact-run'
import { allocateRun } from './pipeline-run'
import { makeRepository } from './test-fixtures'

const allocateCLI = join(import.meta.dir, '../artifact-allocate.ts')

function runConfig(directory: string): string {
  return fs.readFileSync(join(directory, 'run.md'), 'utf8')
}

describe('version folder allocation', () => {
  test('starts at zero, chart and GDD share one sequence, and run.md records the revisions', () => {
    const root = makeRepository()
    const chart = allocateRun(root, 'chart-report', 'light', 'experiment')
    const gdd = allocateRun(root, 'personalized-gdd', 'deep', 'new-profile')
    expect(chart.directory).toEndWith('/artifacts/v0.1.0')
    expect(gdd.directory).toEndWith('/artifacts/v0.1.1')
    const config = runConfig(gdd.directory)
    expect(config).toContain('목적: new-profile')
    expect(config).toContain('모드: deep')
    expect(config).toContain(`source revision: ${git(root, ['rev-parse', 'HEAD'])}`)
    expect(config).toContain(`기준선 revision: ${readSeriesConfig(root).baselineRevision}`)
    expect(config).toContain('dirty: 아니오')
  })

  test('uses the active series only and preserves abandoned directories', () => {
    const root = makeRepository()
    for (const name of ['v0.1.9', 'v0.2.100', 'v1.2.3', 'v0.1.010', 'registries', 'invalid']) fs.mkdirSync(join(root, 'artifacts', name), { recursive: true })
    expect(allocateRun(root, 'chart-report', 'light', 'experiment').directory).toEndWith('/v0.1.10')
    expect(allocateRun(root, 'personalized-gdd', 'light', 'experiment').directory).toEndWith('/v0.1.11')
    expect(fs.readdirSync(join(root, 'artifacts', 'v0.1.9'))).toEqual([])
  })

  test('processes racing for the same patch each reserve a distinct directory', async () => {
    const root = makeRepository()
    const processes = Array.from({ length: 8 }, () => Bun.spawn(['bun', allocateCLI, 'chart-report', 'light', 'experiment', root], { stdout: 'pipe', stderr: 'pipe' }))
    const results = await Promise.all(processes.map(async p => ({ code: await p.exited, out: await new Response(p.stdout).text(), err: await new Response(p.stderr).text() })))
    expect(results.map(result => [result.code, result.err])).toEqual(Array.from({ length: 8 }, () => [0, '']))
    expect(new Set(results.map(result => JSON.parse(result.out).version)).size).toBe(8)
    for (let i = 0; i < 8; i++) expect(runConfig(join(root, 'artifacts', `v0.1.${i}`))).toContain('종류: chart-report')
  })

  test('rejects missing or invalid configuration and unknown commits before reserving', () => {
    const root = makeRepository(), path = join(root, '.agents', 'artifact-series.json')
    const original = readSeriesConfig(root)
    for (const change of [{ activeSeries: '1.0' }, { schemaVersion: 2 }, { baselineRevision: 'f'.repeat(40) }, { promotedAt: 'yesterday' }]) {
      fs.writeFileSync(path, JSON.stringify({ ...original, ...change }))
      expect(() => allocateRun(root, 'chart-report', 'light', 'experiment')).toThrow()
      expect(fs.existsSync(join(root, 'artifacts'))).toBe(false)
    }
    fs.unlinkSync(path)
    expect(() => allocateRun(root, 'chart-report', 'light', 'experiment')).toThrow()
    expect(fs.existsSync(join(root, 'artifacts'))).toBe(false)
  })

  test('dirty experiments are recorded; dirty release candidates consume no patch', () => {
    const root = makeRepository()
    fs.writeFileSync(join(root, 'uncommitted.md'), 'experiment')
    expect(() => allocateRun(root, 'personalized-gdd', 'light', 'release-candidate')).toThrow('clean working tree')
    expect(fs.existsSync(join(root, 'artifacts'))).toBe(false)
    expect(runConfig(allocateRun(root, 'chart-report', 'light', 'experiment').directory)).toContain('dirty: 예')
  })

  test('rejects unknown kinds, modes and purposes without reserving', () => {
    const root = makeRepository()
    for (const [kind, mode, purpose] of [['novel', 'light', 'experiment'], ['chart-report', 'other', 'experiment'], ['chart-report', 'light', 'other']]) {
      expect(() => allocateRun(root, kind, mode, purpose)).toThrow()
    }
    expect(fs.existsSync(join(root, 'artifacts'))).toBe(false)
  })
})
