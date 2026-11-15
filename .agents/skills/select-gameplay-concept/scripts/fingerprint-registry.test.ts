import { describe, expect, test } from 'bun:test'
import { closestEntries, parseRegistry, type Axes } from './fingerprint-registry'
const fingerprint: Axes = { combatRange: 'long', powerMedium: 'spell', initiative: 'reactive', spaceUse: 'swap', combatRhythm: 'cycle', mastery: 'aim', risk: 'focus_break' }
// Runtime registration is covered through the atomic two-kind finalize in sqlite-pipeline.test.ts.
describe('combat registry pure comparison contract', () => {
  test('accepts an empty snapshot and rejects duplicate versions or malformed axes', () => {
    expect(parseRegistry('{"schemaVersion":1,"entries":[]}').entries).toEqual([])
    const entry = { version: 'v0.1.0', candidateId: 'C-01', fingerprint }
    expect(() => parseRegistry(JSON.stringify({ schemaVersion: 1, entries: [entry, entry] }))).toThrow('Duplicate')
    expect(() => parseRegistry(JSON.stringify({ schemaVersion: 1, entries: [{ ...entry, fingerprint: { ...fingerprint, extra: true } }] }))).toThrow('axes')
  })
  test('preserves every entry tied at the minimum distance rather than top one', () => {
    const entries = [
      { version: 'v0.1.0', candidateId: 'C-01', fingerprint },
      { version: 'v0.1.1', candidateId: 'C-02', fingerprint: { ...fingerprint } },
      { version: 'v0.1.2', candidateId: 'C-03', fingerprint: { ...fingerprint, risk: 'health' } },
    ]
    expect(closestEntries(fingerprint, entries).map(entry => [entry.version, entry.equalAxes])).toEqual([['v0.1.0', 7], ['v0.1.1', 7]])
  })
})
