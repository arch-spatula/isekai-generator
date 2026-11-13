import { describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { makeRepository } from './test-fixtures'
import { allocate, call, ok, parallelCall, prepare, read, rejected, request, start, tree, chartFixture } from './sqlite-test-fixtures'

// sqlite-artifact-state §§2,3,6: only allocate may create a store; reads never migrate.
describe('SQLite allocation and public command boundary', () => {
  test('missing store reads and continuation fail without creating artifacts', () => {
    const root = makeRepository()
    for (const command of ['runs', 'summary', 'next', 'events']) {
      const args = command === 'runs' ? [command, '--unfinished'] : [command, '--run', 'not-managed']
      const result = call(root, args, { read: true })
      expect(result.code).toBe(1)
      expect(JSON.parse(result.stderr).error.code).toMatch(/state-missing|run-not-managed/)
      expect(existsSync(join(root, 'artifacts'))).toBe(false)
    }
    for (const command of ['resume', 'reconcile', 'finalize']) {
      expect(call(root, [command, '--run', 'not-managed', '--request', request()]).code).toBe(1)
      expect(existsSync(join(root, 'artifacts'))).toBe(false)
    }
  })

  test('chart and personalized GDD reserve one sequence and no machine JSON or TODO', () => {
    const root = makeRepository()
    const chart = allocate(root, 'chart-report'), gdd = allocate(root)
    expect(chart.data.version).toBe('v0.1.0')
    expect(gdd.data.version).toBe('v0.1.1')
    expect(chart.data.runId).not.toBe(chart.data.version)
    expect(gdd.data.runId).not.toBe(chart.data.runId)
    expect(existsSync(join(root, 'artifacts/state.sqlite'))).toBe(true)
    expect(read(root, 'summary', chart.data.runId).data.run.status).toBe('allocated')
    expect(tree(join(root, 'artifacts')).filter(path => /\.jsonl?$|TODO\.md$|\.lock/.test(path))).toEqual([])
  })

  test('old directories affect numbering only; malformed old contents are preserved', () => {
    const root = makeRepository()
    for (const name of ['v0.1.9', 'v0.2.100', 'v0.1.010', 'registries']) mkdirSync(join(root, 'artifacts', name), { recursive: true })
    const old = join(root, 'artifacts/v0.1.9/artifact-run.json')
    writeFileSync(old, 'not JSON and must never be imported')
    const fresh = allocate(root)
    expect(fresh.data.version).toBe('v0.1.10')
    expect(readFileSync(old, 'utf8')).toBe('not JSON and must never be imported')
    const runs = ok(call(root, ['runs', '--unfinished'], { read: true }))
    expect(JSON.stringify(runs)).not.toContain('v0.1.9')
    rejected(call(root, ['summary', '--version', 'v0.1.9'], { read: true }), 'run-not-managed')
  })

  test('separate first-allocation processes initialize once without losing reservations', async () => {
    const root = makeRepository()
    const results = await Promise.all(Array.from({ length: 8 }, () => parallelCall(root, ['allocate', '--kind', 'chart-report', '--mode', 'deep', '--purpose', 'new-profile', '--request', request()])))
    const replies = results.map(ok)
    expect(new Set(replies.map(reply => reply.data.runId)).size).toBe(8)
    expect(replies.map(reply => reply.data.version).sort()).toEqual(Array.from({ length: 8 }, (_, index) => `v0.1.${index}`))
    const db = new Database(join(root, 'artifacts/state.sqlite'), { readonly: true })
    try { expect(db.query('SELECT count(*) AS count FROM runs').get()).toEqual({ count: 8 }) } finally { db.close() }
  })

  test('identical request replay survives a process reopen and argument conflict preserves result', () => {
    const root = makeRepository(), id = request()
    const first = allocate(root, 'chart-report', id)
    expect(allocate(root, 'chart-report', id)).toEqual(first)
    rejected(call(root, ['allocate', '--kind', 'personalized-gdd', '--mode', 'deep', '--purpose', 'new-profile', '--request', id]), 'request-conflict')
    expect(allocate(root).data.version).toBe('v0.1.1')
    const db = new Database(join(root, 'artifacts/state.sqlite'), { readonly: true })
    try { expect(db.query('SELECT count(*) AS count FROM operations WHERE request_id = ?').get(id)).toEqual({ count: 1 }) } finally { db.close() }
  })

  test('invalid options reject before reservation rather than silently normalizing input', () => {
    const root = makeRepository()
    for (const args of [
      ['allocate', '--kind', 'chart-report'],
      ['allocate', '--kind', 'other', '--request', request()],
      ['allocate', '--kind', 'chart-report', '--request', request(), '--request', request()],
      ['allocate', '--kind', 'chart-report', '--version', 'v0.1.99', '--request', request()],
      ['patch', '--run', 'x', '--status', 'succeeded', '--request', request()],
    ]) {
      expect(call(root, args).code).toBe(2)
      expect(existsSync(join(root, 'artifacts'))).toBe(false)
    }
  })

  test('damaged store is never replaced with a blank database', () => {
    const root = makeRepository()
    mkdirSync(join(root, 'artifacts'))
    const path = join(root, 'artifacts/state.sqlite')
    writeFileSync(path, 'deliberately corrupt SQLite fixture')
    const before = readFileSync(path)
    expect(call(root, ['runs', '--unfinished'], { read: true }).code).toBe(1)
    expect(call(root, ['allocate', '--kind', 'chart-report', '--mode', 'deep', '--purpose', 'new-profile', '--request', request()]).code).toBe(1)
    expect(readFileSync(path)).toEqual(before)
  })
})

// §§5–8: prepared work may be dispatched, but unobserved external work cannot be regenerated.
describe('claims, stage prerequisites and resumable external execution', () => {
  test('integration requires all three adopted specialists after chart publication', () => {
    const { root, run } = chartFixture()
    const before = read(root, 'summary', run)
    rejected(call(root, ['prepare', '--run', run, '--stage', 'integration', '--kind', 'generate', '--request', request()]), 'prerequisite-incomplete')
    expect(call(root, ['done', '--run', run, '--stage', 'integration', '--request', request()]).code).toBe(2)
    expect(read(root, 'summary', run)).toEqual(before)
    const db = new Database(join(root, 'artifacts/state.sqlite'), { readonly: true })
    try { expect(db.query("SELECT count(*) AS count FROM attempts WHERE stage='integration'").get()).toEqual({ count: 0 }) } finally { db.close() }
  })

  test('simultaneous first prepares reserve exactly one active specialist invocation', async () => {
    const { root, run } = chartFixture()
    const rivals = await Promise.all(Array.from({ length: 6 }, () => parallelCall(root, ['prepare', '--run', run, '--stage', 'saju', '--kind', 'generate', '--request', request()])))
    expect(rivals.filter(result => result.code === 0)).toHaveLength(1)
    for (const result of rivals) {
      if (result.code === 0) expect(ok(result).data.number).toBe(1)
      else rejected(result, 'attempt-active')
    }
    const db = new Database(join(root, 'artifacts/state.sqlite'), { readonly: true })
    try {
      expect(db.query("SELECT count(*) AS count FROM attempts WHERE stage='saju'").get()).toEqual({ count: 1 })
      expect(db.query("SELECT count(*) AS count FROM attempts WHERE stage='saju' AND status='prepared'").get()).toEqual({ count: 1 })
    } finally { db.close() }
  })

  test('prepare replay does not consume a second attempt; competing new requests cannot allocate two', async () => {
    const root = makeRepository(), run = allocate(root).data.runId
    start(root, run)
    const id = request(), args = ['prepare', '--run', run, '--stage', 'chart-report', '--kind', 'generate', '--request', id]
    const first = ok(call(root, args))
    expect(ok(call(root, args))).toEqual(first)
    expect(first.data).toMatchObject({ attemptId: expect.any(String), claim: expect.any(String), number: 1 })
    const rivals = await Promise.all(Array.from({ length: 4 }, () => parallelCall(root, ['prepare', '--run', run, '--stage', 'chart-report', '--kind', 'generate', '--request', request()])))
    const successful = rivals.filter(result => result.code === 0).map(ok)
    expect(successful.every(reply => reply.data.attemptId === first.data.attemptId)).toBe(true)
    const db = new Database(join(root, 'artifacts/state.sqlite'), { readonly: true })
    try { expect(db.query('SELECT count(*) AS count FROM attempts').get()).toEqual({ count: 1 }) } finally { db.close() }
    expect(read(root, 'next', run).data.actions).toContainEqual(expect.objectContaining({ action: 'dispatch', attemptId: first.data.attemptId }))
  })

  test('dispatch before worker binding returns verify-worker after a new process opens the DB', () => {
    const root = makeRepository(), run = allocate(root).data.runId
    start(root, run)
    const attempt = prepare(root, run).data
    ok(call(root, ['dispatch', '--attempt', attempt.attemptId, '--claim', attempt.claim, '--request', request()]))
    const next = read(root, 'next', run)
    expect(next.data.actions).toContainEqual(expect.objectContaining({ action: 'verify-worker', attemptId: attempt.attemptId }))
    const resumed = ok(call(root, ['resume', '--run', run, '--request', request()]))
    expect(JSON.stringify(resumed)).toMatch(/verify-worker|unknown/)
    expect(call(root, ['prepare', '--run', run, '--stage', 'chart-report', '--kind', 'generate', '--request', request()]).code).toBe(1)
  })

  test('summary and events hide claims; only matching claim can read allocated input', () => {
    const root = makeRepository(), run = allocate(root).data.runId
    start(root, run)
    const attempt = prepare(root, run).data
    for (const command of ['summary', 'events']) expect(JSON.stringify(read(root, command, run))).not.toContain(attempt.claim)
    expect(call(root, ['input', '--attempt', attempt.attemptId, '--claim', 'wrong'], { read: true }).code).toBe(1)
    ok(call(root, ['input', '--attempt', attempt.attemptId, '--claim', attempt.claim], { read: true }))
    expect(call(root, ['finish', '--attempt', attempt.attemptId, '--claim', 'wrong', '--request', request()]).code).toBe(1)
  })

  test('terminal cancellation invalidates late submit, finish and resume without altering history', () => {
    const root = makeRepository(), run = allocate(root).data.runId
    start(root, run)
    const attempt = prepare(root, run).data
    ok(call(root, ['cancel', '--run', run, '--reason', 'synthetic cancellation', '--request', request()]))
    const snapshot = read(root, 'summary', run)
    const snapshotDB = (): string => {
      const db = new Database(join(root, 'artifacts/state.sqlite'), { readonly: true })
      try { return JSON.stringify(['attempts', 'documents', 'events'].map(table => db.query(`SELECT * FROM ${table} ORDER BY rowid`).all())) } finally { db.close() }
    }
    const history = snapshotDB()
    for (const command of ['submit', 'finish']) rejected(call(root, [command, '--attempt', attempt.attemptId, '--claim', attempt.claim, '--request', request()], { stdin: '{}' }), 'run-terminal')
    rejected(call(root, ['resume', '--run', run, '--request', request()]), 'run-terminal')
    expect(read(root, 'summary', run)).toEqual(snapshot)
    expect(snapshotDB()).toBe(history)
    expect(snapshot.data.run.status).toBe('cancelled')
  })

  test('a held SQLite writer lock produces bounded state-busy and no duplicate operation', () => {
    const root = makeRepository(), run = allocate(root).data.runId
    const db = new Database(join(root, 'artifacts/state.sqlite'))
    db.exec('BEGIN IMMEDIATE')
    try {
      const before = Date.now()
      rejected(call(root, ['start', '--run', run, '--request', request()]), 'state-busy')
      expect(Date.now() - before).toBeLessThan(9000)
    } finally { db.exec('ROLLBACK'); db.close() }
    expect(read(root, 'summary', run).data.run.status).toBe('allocated')
    start(root, run)
  }, 12000)
})
