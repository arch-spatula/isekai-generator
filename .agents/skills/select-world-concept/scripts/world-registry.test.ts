import { expect, test } from 'bun:test'
import { parseWorldRegistry, closestWorldEntries } from './world-contract'
import { worldFingerprints } from './world-fixtures'
const entry = { version: 'v0.1.30', candidateId: 'W-01', fingerprint: worldFingerprints[0], spatialPlay: '연속된 숲의 관문을 열고 고정 도시로 귀환한다.' }
// Persistence, insert failure and completion are tested through SQLite finalize, not a second file backend.
test('world snapshots reject duplicate versions, unknown axes and corrupt input', () => {
  expect(parseWorldRegistry({ schemaVersion: 1, entries: [entry] }).entries).toEqual([entry])
  expect(() => parseWorldRegistry({ schemaVersion: 1, entries: [entry, entry] })).toThrow()
  expect(() => parseWorldRegistry({ schemaVersion: 1, entries: [{ ...entry, fingerprint: { ...entry.fingerprint, extra: true } }] })).toThrow('fields')
  expect(() => parseWorldRegistry('broken JSON')).toThrow()
})
test('world comparison keeps all nearest ties and uses its own six-axis contract', () => {
  const entries = [entry, { ...entry, version: 'v0.1.31', candidateId: 'W-02' }, { ...entry, version: 'v0.1.32', fingerprint: worldFingerprints[1] }]
  expect(closestWorldEntries(worldFingerprints[0], entries)).toEqual([{ version: 'v0.1.30', candidateId: 'W-01', equalAxes: 6 }, { version: 'v0.1.31', candidateId: 'W-02', equalAxes: 6 }])
})
