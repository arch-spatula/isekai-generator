import { describe, expect, test, spyOn } from 'bun:test'
import * as fs from 'node:fs'
import { join } from 'node:path'
import { allocateRun, failRun, git, parseRunOptions, readRunManifest, readSeriesConfig, updateRun, validateRunManifest, validateSeriesConfig } from './artifact-run'
import { makeRepository } from './test-fixtures'

describe('shared patch reservation', () => {
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

  test('retries after a directory is claimed between scanning and mkdir', () => {
    const root = makeRepository(), originalMkdir = fs.mkdirSync
    const target = join(root, 'artifacts', 'v0.1.0')
    let collided = false
    const mkdir = spyOn(fs, 'mkdirSync').mockImplementation(((path: fs.PathLike, options?: fs.MakeDirectoryOptions) => {
      if (String(path) === target && !collided) {
        collided = true
        originalMkdir(target)
        throw Object.assign(new Error('collision'), { code: 'EEXIST' })
      }
      return originalMkdir(path, options)
    }) as typeof fs.mkdirSync)
    try {
      expect(allocateRun(root, 'chart-report')).toEndWith('/v0.1.1')
      expect(collided).toBe(true)
      expect(fs.readdirSync(target)).toEqual([])
    } finally { mkdir.mockRestore() }
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
    expect(() => allocateRun(root, 'personalized-gdd', { purpose: 'release-candidate' })).toThrow('clean working tree')
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

describe('run manifest state and atomic updates', () => {
  test('success follows running; failures and cancellations consume their versions', () => {
    const root = makeRepository()
    const success = allocateRun(root, 'chart-report')
    expect(() => updateRun(success, 'succeeded')).toThrow('Invalid run transition')
    expect(updateRun(success, 'running').startedAt).not.toBeNull()
    expect(updateRun(success, 'succeeded').finishedAt).not.toBeNull()
    expect(() => updateRun(success, 'running')).toThrow()
    const failed = allocateRun(root, 'personalized-gdd')
    updateRun(failed, 'running')
    expect(() => failRun(failed, 'integration', 'Specialist integration failed.', new Error('original'))).toThrow('original')
    expect(readRunManifest(failed)).toMatchObject({ status: 'failed', failure: { stage: 'integration', summary: 'Specialist integration failed.' } })
    const cancelled = allocateRun(root, 'personalized-gdd')
    expect(updateRun(cancelled, 'cancelled').finishedAt).not.toBeNull()
    const abandoned = allocateRun(root, 'personalized-gdd')
    updateRun(abandoned, 'running')
    expect(allocateRun(root, 'chart-report')).toEndWith('/v0.1.4')
    expect(readRunManifest(abandoned).status).toBe('running')
    const failedBeforeStart = allocateRun(root, 'chart-report')
    expect(updateRun(failedBeforeStart, 'failed', { stage: 'chart-input', summary: 'Required input missing.' })).toMatchObject({ status: 'failed', startedAt: null })
    const cancelledAfterStart = allocateRun(root, 'chart-report')
    updateRun(cancelledAfterStart, 'running')
    expect(updateRun(cancelledAfterStart, 'cancelled').startedAt).not.toBeNull()
  })

  test('validates schema, enums, terminal timestamps, and only permits stage and summary in failure', () => {
    const root = makeRepository(), directory = allocateRun(root, 'chart-report'), m = readRunManifest(directory)
    for (const change of [{ schemaVersion: 2 }, { artifactKind: 'other' }, { purpose: 'other' }, { mode: 'other' }, { status: 'other' }, { sourceRevision: 'x' }, { workingTreeDirty: 'false' }, { allocatedAt: null }, { status: 'running' }, { status: 'failed', finishedAt: null }, { failure: { stage: 'chart', summary: 'Failed' } }]) expect(() => validateRunManifest({ ...m, ...change })).toThrow()
    expect(() => updateRun(directory, 'failed', { stage: 'chart', summary: 'Failed', birthDate: 'private' } as never)).toThrow('fields')
    expect(readRunManifest(directory).status).toBe('allocated')
    const config = readSeriesConfig(root)
    expect(() => validateSeriesConfig({ ...config, knownIssues: [1] })).toThrow()
  })

  test('rename failure preserves original JSON and reports both generation and manifest failures', () => {
    const root = makeRepository(), directory = allocateRun(root, 'chart-report')
    const path = join(directory, 'artifact-run.json'), original = fs.readFileSync(path, 'utf8')
    const rename = spyOn(fs, 'renameSync').mockImplementation(() => { throw new Error('rename failed') })
    try {
      expect(() => updateRun(directory, 'running')).toThrow('rename failed')
      expect(fs.readFileSync(path, 'utf8')).toBe(original)
      expect(fs.readdirSync(directory).sort()).toEqual(['TODO.md', 'artifact-run.json', 'garbage'])
      try { failRun(directory, 'chart-report', 'Chart failed.', new Error('original generation error')) } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        expect((error as AggregateError).errors.map(e => e.message)).toEqual(['original generation error', 'rename failed'])
      }
    } finally { rename.mockRestore() }
  })
})
