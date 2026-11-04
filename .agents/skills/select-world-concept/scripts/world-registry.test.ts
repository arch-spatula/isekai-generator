import { afterEach, expect, spyOn, test } from 'bun:test'
import * as fs from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { initializeWorldRegistry, loadWorldRegistry, registerWorldFingerprint } from './manage-world-registry'
import { worldFingerprints } from './world-fixtures'
const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }) })
function registryPath(): string {
  const root = fs.mkdtempSync(join(tmpdir(), 'world-registry-')); roots.push(root)
  return join(root, 'worlds.json')
}
const entry = { version: 'v0.1.30', candidateId: 'W-01', fingerprint: worldFingerprints[0], spatialPlay: '연속된 숲의 관문을 열고 고정 도시로 귀환한다.' }
test('initializes independently and refuses duplicate versions and unknown axes', () => {
  const path = registryPath()
  initializeWorldRegistry(path)
  registerWorldFingerprint(path, entry)
  const original = fs.readFileSync(path, 'utf8')
  initializeWorldRegistry(path)
  expect(() => registerWorldFingerprint(path, entry)).toThrow('duplicate')
  expect(() => registerWorldFingerprint(path, { ...entry, version: 'v0.1.31', fingerprint: { ...entry.fingerprint, extra: true } as never })).toThrow('fields')
  expect(fs.readFileSync(path, 'utf8')).toBe(original)
  expect(loadWorldRegistry(path).entries).toEqual([entry])
})
test('preserves valid JSON and cleans temporary files and lock if atomic rename fails', () => {
  const path = registryPath()
  initializeWorldRegistry(path)
  const original = fs.readFileSync(path, 'utf8')
  const rename = spyOn(fs, 'renameSync').mockImplementation(() => { throw new Error('rename failed') })
  try { expect(() => registerWorldFingerprint(path, entry)).toThrow('rename failed') } finally { rename.mockRestore() }
  expect(fs.readFileSync(path, 'utf8')).toBe(original)
  expect(fs.readdirSync(roots[0])).toEqual(['worlds.json'])
})
test('fails on corrupt input or an existing writer lock without changing registry data', () => {
  const path = registryPath()
  fs.writeFileSync(path, 'broken JSON')
  expect(() => initializeWorldRegistry(path)).toThrow()
  expect(fs.readFileSync(path, 'utf8')).toBe('broken JSON')
  fs.writeFileSync(path, '{"schemaVersion":1,"entries":[]}')
  fs.writeFileSync(`${path}.lock`, '')
  expect(() => registerWorldFingerprint(path, entry)).toThrow()
  expect(loadWorldRegistry(path).entries).toEqual([])
})
