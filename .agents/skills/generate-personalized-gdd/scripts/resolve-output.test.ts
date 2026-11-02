import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { resolveOutput } from './resolve-output'

function makeRoot(): string {
  return mkdtempSync(join(tmpdir(), 'personalized-gdd-'))
}

describe('resolveOutput', () => {
  test('starts with the existing v0.1.0 layout', () => {
    const root = makeRoot()
    expect(resolveOutput(root)).toEndWith(
      '/artifacts/v0.1.0/docs/GDD/personalized-action-rpg-concept.md',
    )
  })

  test('increments the greatest semantic version patch', () => {
    const root = makeRoot()
    mkdirSync(join(root, 'artifacts', 'v0.1.9'), { recursive: true })
    mkdirSync(join(root, 'artifacts', 'v0.2.0'), { recursive: true })
    expect(resolveOutput(root)).toEndWith(
      '/artifacts/v0.2.1/docs/GDD/personalized-action-rpg-concept.md',
    )
  })

  test('refuses an existing requested version', () => {
    const root = makeRoot()
    mkdirSync(join(root, 'artifacts', 'v1.0.0'), { recursive: true })
    expect(() => resolveOutput(root, '1.0.0')).toThrow('Artifact version already exists: v1.0.0')
  })

  test('refuses a malformed requested version', () => {
    const root = makeRoot()
    expect(() => resolveOutput(root, 'next')).toThrow('Invalid semantic version: next')
  })
})
