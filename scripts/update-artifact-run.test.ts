import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { allocateRun, readRunManifest } from './artifacts/artifact-run'
import { makeRepository } from './artifacts/test-fixtures'

test('status CLI records running, failure and cancellation while rejecting invalid transitions', () => {
  const root = makeRepository()
  const directory = allocateRun(root, 'personalized-gdd')
  const cli = join(import.meta.dir, 'update-artifact-run.ts')
  const run = (...args: string[]) => Bun.spawnSync(['bun', cli, directory, ...args])
  expect(run('succeeded').exitCode).toBe(1)
  expect(readRunManifest(directory).status).toBe('allocated')
  expect(run('running').exitCode).toBe(0)
  expect(run('failed', 'specialist', 'Specialist validation failed.').exitCode).toBe(0)
  expect(readRunManifest(directory)).toMatchObject({ status: 'failed', failure: { stage: 'specialist', summary: 'Specialist validation failed.' } })
  expect(run('running').exitCode).toBe(1)
  const next = allocateRun(root, 'chart-report')
  expect(next).toEndWith('/v0.1.1')
  expect(Bun.spawnSync(['bun', cli, next, 'cancelled']).exitCode).toBe(0)
  expect(readRunManifest(next).finishedAt).not.toBeNull()
})
