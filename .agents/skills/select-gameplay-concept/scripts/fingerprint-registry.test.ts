import { describe, expect, test } from 'bun:test'
import { mkdtemp, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import {
  closestEntries,
  initializeRegistry,
  loadRegistry,
  registerFingerprint,
  type Axes,
} from './fingerprint-registry'

const fingerprint: Axes = {
  combatRange: 'long',
  powerMedium: 'spell',
  initiative: 'reactive',
  spaceUse: 'swap',
  combatRhythm: 'cycle',
  mastery: 'aim',
  risk: 'focus_break',
}

describe('fingerprint registry', () => {
  test('initializes a missing registry', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fingerprint-registry-'))
    const path = join(root, 'registries', 'combat.json')
    await initializeRegistry(path)
    expect(await loadRegistry(path)).toEqual({ schemaVersion: 1, entries: [] })
  })

  test('registers only the version, candidate, and fingerprint', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fingerprint-registry-'))
    const path = join(root, 'combat.json')
    await registerFingerprint(path, { version: 'v0.1.0', candidateId: 'C-01', fingerprint })
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({
      schemaVersion: 1,
      entries: [{ version: 'v0.1.0', candidateId: 'C-01', fingerprint }],
    })
  })

  test('refuses to overwrite the same version', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fingerprint-registry-'))
    const path = join(root, 'combat.json')
    await registerFingerprint(path, { version: 'v0.1.0', candidateId: 'C-01', fingerprint })
    expect(registerFingerprint(path, { version: 'v0.1.0', candidateId: 'C-02', fingerprint }))
      .rejects.toThrow('Fingerprint already registered')
  })

  test('returns every entry tied for the closest fingerprint', () => {
    const entries = [
      { version: 'v0.1.0', candidateId: 'C-01', fingerprint },
      { version: 'v0.1.1', candidateId: 'C-02', fingerprint: { ...fingerprint, risk: 'health' } },
    ]
    expect(closestEntries(fingerprint, entries).map(entry => entry.equalAxes)).toEqual([7])
  })
})
