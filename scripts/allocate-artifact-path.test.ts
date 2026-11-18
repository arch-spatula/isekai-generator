import { expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { allocateArtifactPath } from './allocate-artifact-path.ts'

function makeRoot(activeSeries: unknown, existing: string[] = []): string {
  const root = mkdtempSync(join(tmpdir(), 'allocate-artifact-'))
  mkdirSync(join(root, '.agents'))
  writeFileSync(join(root, '.agents', 'artifact-series.json'), JSON.stringify({ schemaVersion: 1, activeSeries }))
  for (const name of existing) mkdirSync(join(root, 'artifacts', name), { recursive: true })
  return root
}

test('starts the active series at patch 0 and creates the chart directory', () => {
  const root = makeRoot('0.4')
  const result = allocateArtifactPath(root)
  expect(result).toEqual({
    version: 'v0.4.0',
    directory: 'artifacts/v0.4.0',
    chartDir: 'artifacts/v0.4.0/docs/GDD',
  })
  expect(existsSync(join(root, 'artifacts/v0.4.0/docs/GDD'))).toBe(true)
})

test('picks the numerically next patch, ignoring other series and non-version names', () => {
  // 사전순이면 v0.4.9가 최대처럼 보이지만 숫자로는 12가 최대다.
  const root = makeRoot('0.4', ['v0.4.2', 'v0.4.9', 'v0.4.12', 'v0.3.40', 'v0.4.07', 'registries'])
  expect(allocateArtifactPath(root).version).toBe('v0.4.13')
})

test('consecutive allocations never reuse a version', () => {
  const root = makeRoot('0.4', ['v0.4.0'])
  expect(allocateArtifactPath(root).version).toBe('v0.4.1')
  expect(allocateArtifactPath(root).version).toBe('v0.4.2')
})

test('parallel processes each get a distinct version', async () => {
  const root = makeRoot('0.4')
  const script = join(import.meta.dir, 'allocate-artifact-path.ts')
  const runs = Array.from({ length: 8 }, () => Bun.spawn(['bun', script], { cwd: root, stdout: 'pipe' }))
  const versions = await Promise.all(runs.map(async (run) => {
    expect(await run.exited).toBe(0)
    return JSON.parse(await new Response(run.stdout).text()).version as string
  }))
  expect(new Set(versions).size).toBe(8)
  expect([...versions].sort()).toEqual(['v0.4.0', 'v0.4.1', 'v0.4.2', 'v0.4.3', 'v0.4.4', 'v0.4.5', 'v0.4.6', 'v0.4.7'])
})

test('rejects a malformed activeSeries instead of guessing', () => {
  expect(() => allocateArtifactPath(makeRoot('0.4.1'))).toThrow('Invalid activeSeries')
  expect(() => allocateArtifactPath(makeRoot(undefined))).toThrow('Invalid activeSeries')
})
