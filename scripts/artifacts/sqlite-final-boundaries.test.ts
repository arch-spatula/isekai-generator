import { expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { makeRepository, commitFixture } from './test-fixtures'
import { beforeFinalize, publish } from '../fixtures/sqlite-pipeline-runtime'
import { allocate, call, ok, parallelCall, read, request, start, syntheticReport } from './sqlite-test-fixtures'

// §§9/12: two real processes contend over the same registry revision; a prepared reader retains its snapshot.
test('concurrent finalizers register exactly one run while prepared registry reads remain unchanged', async () => {
  const first = beforeFinalize(), root = first.root
  const allocated = allocate(root), run = allocated.data.runId
  start(root, run)
  publish(root, run, 'chart-report', syntheticReport)
  const second = beforeFinalize({ root, run, directory: allocated.data.directory })
  const db = new Database(join(root, 'artifacts/state.sqlite'), { readonly: true })
  let selectionId: string
  try { selectionId = (db.query("SELECT accepted_attempt FROM stages WHERE run_id=? AND stage='selection'").get(second.run) as { accepted_attempt: string }).accepted_attempt } finally { db.close() }
  const args = ['fingerprints', '--attempt', selectionId!, '--kind', 'combat', '--candidate', JSON.stringify({ combatRange: 'close', powerMedium: 'weapon', initiative: 'direct', spaceUse: 'pursuit', combatRhythm: 'pressure', mastery: 'timing', risk: 'health' })]
  const snapshot = ok(call(root, args, { read: true }))
  expect(snapshot.data.comparedEntries).toBe(0)
  const results = await Promise.all([first.run, second.run].map(id => parallelCall(root, ['finalize', '--run', id, '--request', request()])))
  expect(results.filter(result => result.code === 0)).toHaveLength(1)
  expect(results.filter(result => result.code === 1)).toHaveLength(1)
  for (const result of results) {
    if (result.code === 0) expect(ok(result).outcome).toBe('succeeded')
    else expect(JSON.parse(result.stderr).error.code).toBe('registry-stale')
  }
  expect(ok(call(root, args, { read: true }))).toEqual(snapshot)
  const reopened = new Database(join(root, 'artifacts/state.sqlite'), { readonly: true })
  try {
    for (const [index, id] of [first.run, second.run].entries()) {
      const succeeded = results[index].code === 0
      expect(reopened.query('SELECT count(*) AS count FROM fingerprints WHERE run_id=?').get(id)).toEqual({ count: succeeded ? 2 : 0 })
      const stored = reopened.query('SELECT status,finished_at FROM runs WHERE id=?').get(id) as { status: string, finished_at: string | null }
      expect(stored.status).toBe(succeeded ? 'succeeded' : 'blocked')
      if (!succeeded) expect(stored.finished_at).toBeNull()
      expect(reopened.query("SELECT count(*) AS count FROM events WHERE run_id=? AND event='succeeded'").get(id)).toEqual({ count: succeeded ? 1 : 0 })
    }
  } finally { reopened.close() }
}, 15000)
