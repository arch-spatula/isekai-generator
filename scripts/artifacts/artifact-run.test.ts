import { describe, expect, test } from 'bun:test'
import * as fs from 'node:fs'
import { join } from 'node:path'
import { allocateRun, git, parseRunOptions, readRunManifest, readSeriesConfig } from './artifact-run'
import { makeRepository } from './test-fixtures'

describe('shared DB patch reservation', () => {
  test('starts at zero and chart and GDD share one sequence', () => {
    const root = makeRepository()
    const chart = allocateRun(root, 'chart-report')
    const gdd = allocateRun(root, 'personalized-gdd', { purpose: 'new-profile', mode: 'deep' })
    expect(chart).toEndWith('/artifacts/v0.1.0')
    expect(gdd).toEndWith('/artifacts/v0.1.1')
    expect(readRunManifest(gdd)).toMatchObject({ status: 'allocated', purpose: 'new-profile', mode: 'deep', sourceRevision: git(root, ['rev-parse', 'HEAD']), baselineRevision: readSeriesConfig(root).baselineRevision, workingTreeDirty: false })
  })

  test('uses active series only and preserves abandoned directories', () => {
    const root = makeRepository()
    for (const name of ['v0.1.9', 'v0.2.100', 'v1.2.3', 'v0.1.010', 'registries', 'invalid']) fs.mkdirSync(join(root, 'artifacts', name), { recursive: true })
    expect(allocateRun(root, 'chart-report')).toEndWith('/v0.1.10')
    expect(allocateRun(root, 'personalized-gdd')).toEndWith('/v0.1.11')
    expect(fs.readdirSync(join(root, 'artifacts', 'v0.1.9'))).toEqual([])
  })

  test('processes racing for the same patch each reserve a distinct directory', async () => {
    const root = makeRepository()
    const script = join(import.meta.dir, '../../.agents/skills/generate-chart-report/scripts/resolve-chart-output.ts')
    const processes = Array.from({ length: 8 }, () => Bun.spawn(['bun', script, root], { stdout: 'pipe', stderr: 'pipe' }))
    const results = await Promise.all(processes.map(async p => ({ code: await p.exited, out: await new Response(p.stdout).text(), err: await new Response(p.stderr).text() })))
    expect(results.map(result => [result.code, result.err])).toEqual(Array.from({ length: 8 }, () => [0, '']))
    expect(new Set(results.map(result => result.out)).size).toBe(8)
    for (let i = 0; i < 8; i++) expect(readRunManifest(join(root, 'artifacts', `v0.1.${i}`)).status).toBe('allocated')
  })

  test('rejects missing or invalid configuration and unknown commits before reserving', () => {
    const root = makeRepository(), path = join(root, '.agents', 'artifact-series.json')
    const original = readSeriesConfig(root)
    for (const change of [{ activeSeries: '1.0' }, { schemaVersion: 2 }, { baselineRevision: 'f'.repeat(40) }, { promotedAt: 'yesterday' }]) {
      fs.writeFileSync(path, JSON.stringify({ ...original, ...change }))
      expect(() => allocateRun(root, 'chart-report')).toThrow()
      expect(fs.existsSync(join(root, 'artifacts'))).toBe(false)
    }
    fs.unlinkSync(path)
    expect(() => allocateRun(root, 'chart-report')).toThrow()
    expect(fs.existsSync(join(root, 'artifacts'))).toBe(false)
  })

  test('dirty experiments are recorded; dirty release candidates consume no patch', () => {
    const root = makeRepository()
    fs.writeFileSync(join(root, 'uncommitted.md'), 'experiment')
    expect(() => allocateRun(root, 'personalized-gdd', { purpose: 'release-candidate' })).toThrow('dirty-release-candidate')
    expect(fs.existsSync(join(root, 'artifacts'))).toBe(false)
    expect(readRunManifest(allocateRun(root, 'chart-report')).workingTreeDirty).toBe(true)
  })

  test('rejects explicit versions and malformed or duplicate options', () => {
    expect(parseRunOptions(['--purpose', 'regression', '--mode', 'deep'])).toEqual({ purpose: 'regression', mode: 'deep' })
    for (const args of [['v0.2.0'], ['--version', 'v0.2.0'], ['--mode'], ['--mode', 'other'], ['--purpose', 'other'], ['--mode', 'deep', '--mode', 'light']]) expect(() => parseRunOptions(args)).toThrow()
    const root = makeRepository()
    expect(() => allocateRun(root, 'chart-report', { version: 'v0.2.0' } as never)).toThrow()
    expect(() => allocateRun(root, 'chart-report', 'v0.2.0' as never)).toThrow()
    expect(fs.existsSync(join(root, 'artifacts'))).toBe(false)
  })
})
