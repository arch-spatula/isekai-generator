import { expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { makeRepository } from './test-fixtures'
import { allocate, call, rejected, request } from './sqlite-test-fixtures'

test('unsupported schema fails explicitly and cannot initialize over stored state', () => {
  const root = makeRepository()
  allocate(root)
  const db = new Database(join(root, 'artifacts/state.sqlite'))
  db.exec('UPDATE store_meta SET schema_version=99')
  db.close()
  rejected(call(root, ['runs', '--unfinished'], { read: true }), 'schema-version-mismatch')
  rejected(call(root, ['allocate', '--kind', 'chart-report', '--mode', 'deep', '--purpose', 'new-profile', '--request', request()]), 'schema-version-mismatch')
  const reopened = new Database(join(root, 'artifacts/state.sqlite'), { readonly: true })
  try { expect(reopened.query('SELECT count(*) AS count FROM runs').get()).toEqual({ count: 1 }) } finally { reopened.close() }
})

test('a copied DB cannot be silently adopted under another repository root', () => {
  const first = makeRepository(), second = makeRepository()
  allocate(first)
  const db = new Database(join(first, 'artifacts/state.sqlite'))
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
  db.close()
  mkdirSync(join(second, 'artifacts'))
  cpSync(join(first, 'artifacts/state.sqlite'), join(second, 'artifacts/state.sqlite'))
  rejected(call(second, ['runs', '--unfinished'], { read: true }), 'repository-mismatch')
})

test('later allocations preserve documents in a previously reserved directory', () => {
  const root = makeRepository()
  const allocated = allocate(root)
  const path = join(allocated.data.directory, 'foreign.md')
  writeFileSync(path, 'another owner bytes')
  // A reserved directory is established at allocation; later files cannot be rewritten by another allocation.
  expect(allocate(root).data.version).toBe('v0.1.1')
  expect(readFileSync(path, 'utf8')).toBe('another owner bytes')
})
