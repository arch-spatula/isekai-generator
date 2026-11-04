import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { makeRepository } from '../../../../scripts/artifacts/test-fixtures'
import { readRunManifest } from '../../../../scripts/artifacts/artifact-run'
import { resolveOutput } from './resolve-output'

test('resolveOutput reserves a run and returns the existing output layout', () => {
  const root = makeRepository()
  const output = resolveOutput(root, { mode: 'deep', purpose: 'regression' })
  expect(output).toBe(join(root, 'artifacts/v0.1.0/docs/GDD/personalized-action-rpg-concept.md'))
  expect(readRunManifest(join(root, 'artifacts/v0.1.0'))).toMatchObject({ status: 'allocated', mode: 'deep', purpose: 'regression' })
  expect(resolveOutput(root)).toContain('/v0.1.1/')
})

test('resolveOutput refuses legacy explicit version arguments', () => {
  const root = makeRepository()
  expect(() => resolveOutput(root, 'v0.2.0' as never)).toThrow()
})
