import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { writeJsonAtomic } from '../../../../scripts/artifacts/artifact-run'
import { ensure, parseWorldBrief, parseWorldRegistry, selectedWorld, type WorldEntry, type WorldRegistry } from './world-contract'

export function loadWorldRegistry(path: string): WorldRegistry {
  return parseWorldRegistry(JSON.parse(readFileSync(path, 'utf8')))
}
export function initializeWorldRegistry(path: string): void {
  mkdirSync(dirname(path), { recursive: true })
  if (existsSync(path)) { loadWorldRegistry(path); return }
  try { writeFileSync(path, JSON.stringify({ schemaVersion: 1, entries: [] }, null, 2) + '\n', { flag: 'wx' }) } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    loadWorldRegistry(path)
  }
}
export function registerWorldFingerprint(path: string, entry: WorldEntry): void {
  // An existing lock is an explicit failure; do not guess whether another writer died.
  const lock = `${path}.lock`
  const fd = openSync(lock, 'wx')
  try {
    const registry = loadWorldRegistry(path)
    const next = parseWorldRegistry({ schemaVersion: 1, entries: [...registry.entries, entry] })
    writeJsonAtomic(path, next)
  } finally { closeSync(fd); unlinkSync(lock) }
}
if (import.meta.main) {
  try {
    const [command, path, version, briefPath, ...extra] = process.argv.slice(2)
    ensure(path && extra.length === 0, 'Usage: bun manage-world-registry.ts init <registry> | register <registry> <version> <world-brief>')
    if (command === 'init' && version == null) initializeWorldRegistry(path)
    else {
      ensure(command === 'register' && version && briefPath, 'register requires a version and world brief')
      const selected = selectedWorld(parseWorldBrief(readFileSync(briefPath, 'utf8')))
      registerWorldFingerprint(path, { version, candidateId: selected.id, fingerprint: selected.fingerprint, spatialPlay: selected.spatialPlay })
    }
    console.log(`World registry ${command} complete.`)
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1 }
}
