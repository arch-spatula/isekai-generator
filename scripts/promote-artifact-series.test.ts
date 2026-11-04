import { expect, test } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { allocateRun, git, readSeriesConfig } from './artifacts/artifact-run'
import { commitFixture, makeRepository } from './artifacts/test-fixtures'
import { promoteArtifactSeries } from './promote-artifact-series'

test('promotion only changes config; after committing, the first run is new series .0', () => {
  const root = makeRepository()
  const old = allocateRun(root, 'chart-report')
  const original = readFileSync(join(old, 'artifact-run.json'), 'utf8')
  const head = git(root, ['rev-parse', 'HEAD'])
  promoteArtifactSeries(root, '0.2', 'decision.md', ['incident.md'])
  expect(readSeriesConfig(root)).toMatchObject({ activeSeries: '0.2', baselineRevision: head, knownIssues: ['incident.md'] })
  expect(existsSync(join(root, 'artifacts', 'v0.2.0'))).toBe(false)
  expect(readFileSync(join(old, 'artifact-run.json'), 'utf8')).toBe(original)
  commitFixture(root)
  expect(allocateRun(root, 'personalized-gdd', { purpose: 'release-candidate' })).toEndWith('/v0.2.0')
})

test('rejects skipped minor, changed major, existing series and dirty working tree without changing config', () => {
  const root = makeRepository(), path = join(root, '.agents', 'artifact-series.json'), original = readFileSync(path, 'utf8')
  for (const next of ['0.1', '0.3', '1.0', '0.02']) expect(() => promoteArtifactSeries(root, next, 'decision.md')).toThrow()
  mkdirSync(join(root, 'artifacts', 'v0.2.8'), { recursive: true })
  expect(() => promoteArtifactSeries(root, '0.2', 'decision.md')).toThrow('already has artifacts')
  writeFileSync(join(root, 'dirty'), 'change')
  expect(() => promoteArtifactSeries(root, '0.2', 'decision.md')).toThrow('clean working tree')
  expect(readFileSync(path, 'utf8')).toBe(original)
})

test('promotion rejects missing, absolute, escaping and symlink-escaping document paths', () => {
  const root = makeRepository(), other = makeRepository()
  symlinkSync(join(other, 'decision.md'), join(root, 'outside.md'))
  commitFixture(root)
  for (const document of ['missing.md', root, '../decision.md', 'outside.md', '.agents']) expect(() => promoteArtifactSeries(root, '0.2', document)).toThrow()
  expect(() => promoteArtifactSeries(root, '0.2', 'decision.md', ['missing.md'])).toThrow()
  expect(readSeriesConfig(root).activeSeries).toBe('0.1')
})
