import { expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { join } from 'node:path'
import { writeFileSync } from 'node:fs'
import { chartFixture, prepare, call, ok, request, read, specialist, interpretation, allocate, start, submit, finish } from './sqlite-test-fixtures'

function dispatch(root: string, attempt: Record<string, any>) {
  ok(call(root, ['dispatch', '--attempt', attempt.attemptId, '--claim', attempt.claim, '--request', request()]))
  ok(call(root, ['bind-worker', '--attempt', attempt.attemptId, '--claim', attempt.claim, '--agent', 'synthetic-worker', '--request', request()]))
}
function observe(root: string, run: string, attempt: Record<string, any>, status: string) {
  return ok(call(root, ['resume', '--run', run, '--request', request()], { stdin: JSON.stringify({ workers: [{ attemptId: attempt.attemptId, status, observer: 'synthetic-worker-api', reference: `observed-${status}` }] }) }))
}

test('alive waits and unknown blocks without allocating or treating time elapsed as termination', () => {
  const { root, run } = chartFixture(), attempt = prepare(root, run, 'saju').data
  dispatch(root, attempt)
  expect(JSON.stringify(observe(root, run, attempt, 'alive'))).toContain('wait')
  const unknown = observe(root, run, attempt, 'unknown')
  expect(JSON.stringify(unknown)).toMatch(/verify-worker|unknown/)
  expect(read(root, 'summary', run).data.run.status).toBe('blocked')
  expect(call(root, ['prepare', '--run', run, '--stage', 'saju', '--kind', 'generate', '--request', request()]).code).toBe(1)
  const db = new Database(join(root, 'artifacts/state.sqlite'), { readonly: true })
  try { expect(db.query("SELECT count(*) AS count FROM attempts WHERE stage='saju'").get()).toEqual({ count: 1 }) } finally { db.close() }
})

test('observed termination permits remaining-budget retries and invalidates all previous claims', () => {
  const { root, run } = chartFixture()
  for (let number = 1; number <= 3; number++) {
    const attempt = prepare(root, run, 'saju').data
    expect(attempt.number).toBe(number)
    dispatch(root, attempt)
    observe(root, run, attempt, 'terminated')
    for (const command of ['submit', 'finish']) {
      const result = call(root, [command, '--attempt', attempt.attemptId, '--claim', attempt.claim, '--request', request()], { stdin: '{}' })
      expect(result.code).toBe(1)
      expect(JSON.parse(result.stderr).error.code).toBe('stale-claim')
    }
  }
  const exhausted = call(root, ['prepare', '--run', run, '--stage', 'saju', '--kind', 'generate', '--request', request()])
  expect(exhausted.code).toBe(1)
  expect(JSON.parse(exhausted.stderr).error.code).toBe('attempt-budget-exhausted')
})

test('operational editing retry consumes three-call budget while retaining sentence scope', () => {
  const { root, run } = chartFixture()
  expect(specialist(root, run, interpretation()).result.outcome).toBe('editing-required')
  for (let number = 1; number <= 3; number++) {
    const attempt = prepare(root, run, 'saju', 'edit').data
    expect(attempt.number).toBe(number)
    expect(attempt.scope).toBe('sentence')
    dispatch(root, attempt)
    observe(root, run, attempt, 'terminated')
  }
  expect(call(root, ['prepare', '--run', run, '--stage', 'saju', '--kind', 'edit', '--request', request()]).code).toBe(1)
})

test('worker observation from another run cannot interrupt its attempt or consume retry budget', () => {
  const first = chartFixture(), second = allocate(first.root)
  start(first.root, second.data.runId)
  const attempt = prepare(first.root, first.run, 'saju').data
  dispatch(first.root, attempt)
  const result = call(first.root, ['resume', '--run', second.data.runId, '--request', request()], { stdin: JSON.stringify({ workers: [{ attemptId: attempt.attemptId, status: 'terminated', observer: 'synthetic', reference: 'different-run' }] }) })
  expect(result.code).toBe(1)
  expect(JSON.parse(result.stderr).error.code).toBe('invalid-observation')
  // first worker's claim and current attempt remain usable.
  ok(call(first.root, ['input', '--attempt', attempt.attemptId, '--claim', attempt.claim], { read: true }))
  expect(read(first.root, 'next', first.run).data.actions).toContainEqual(expect.objectContaining({ action: 'wait', attemptId: attempt.attemptId }))
})

test('a fresh next query after specialist validation returns editing work rather than generation', () => {
  const { root, run } = chartFixture()
  const generated = specialist(root, run, interpretation())
  expect(generated.result.outcome).toBe('editing-required')
  const actions = read(root, 'next', run).data.actions
  const saju = actions.filter((action: any) => action.stage === 'saju')
  expect(saju).toHaveLength(1)
  expect(saju[0]).toMatchObject({ action: 'prepare-retry', kind: 'edit' })
  expect(call(root, ['prepare', '--run', run, '--stage', 'saju', '--kind', 'generate', '--request', request()]).code).toBe(1)
})

// A new context keeps only the run ID. Prior request IDs and claims are deliberately scoped inside setup.
test('explicit resume restores prepared and submitted work without old claims or another reservation', () => {
  for (const state of ['prepared', 'submitted']) {
    const { root, run } = chartFixture()
    const setupPriorContext = () => {
      const attempt = prepare(root, run, 'saju').data
      if (state === 'submitted') {
        writeFileSync(attempt.output, interpretation())
        submit(root, attempt)
      }
    }
    setupPriorContext()
    const resumed = ok(call(root, ['resume', '--run', run, '--request', request()]))
    const attempts = resumed.data.resumedAttempts.filter((attempt: any) => attempt.stage === 'saju')
    expect(attempts).toHaveLength(1)
    const current = attempts[0]
    expect(current.status).toBe(state)
    expect(current.number).toBe(1)
    expect(typeof current.claim).toBe('string')
    expect(current.claim.length).toBeGreaterThan(0)
    ok(call(root, ['input', '--attempt', current.attemptId, '--claim', current.claim], { read: true }))
    if (state === 'prepared') {
      writeFileSync(current.output, interpretation())
      submit(root, current)
    }
    expect(finish(root, current).outcome).toBe('editing-required')
    for (const command of ['summary', 'events']) expect(JSON.stringify(read(root, command, run))).not.toContain(current.claim)
    const database = new Database(join(root, 'artifacts/state.sqlite'), { readonly: true })
    try {
      expect(database.query("SELECT id,number,status FROM attempts WHERE run_id=? AND stage='saju'").all(run)).toEqual([{ id: current.attemptId, number: 1, status: 'completed' }])
    } finally { database.close() }
  }
})

test('observed worker termination resumes its existing Markdown in the same invocation', () => {
  const { root, run } = chartFixture()
  const setupPriorContext = () => {
    const attempt = prepare(root, run, 'saju').data
    dispatch(root, attempt)
    writeFileSync(attempt.output, interpretation())
  }
  setupPriorContext()
  const unobserved = ok(call(root, ['resume', '--run', run, '--request', request()]))
  expect(unobserved.data.resumedAttempts ?? []).toEqual([])
  const worker = read(root, 'next', run).data.actions.find((action: any) => action.stage === 'saju')
  expect(worker.action).toBe('wait')
  const resumed = ok(call(root, ['resume', '--run', run, '--request', request()], { stdin: JSON.stringify({ workers: [{ attemptId: worker.attemptId, status: 'terminated', observer: 'synthetic-worker-api', reference: 'verified-worker-ended' }] }) }))
  const current = resumed.data.resumedAttempts.find((attempt: any) => attempt.stage === 'saju')
  expect(current.attemptId).toBe(worker.attemptId)
  expect(current.status).toBe('submitted')
  expect(current.number).toBe(1)
  expect(finish(root, current).outcome).toBe('editing-required')
  const database = new Database(join(root, 'artifacts/state.sqlite'), { readonly: true })
  try { expect(database.query("SELECT count(*) AS count FROM attempts WHERE run_id=? AND stage='saju'").get(run)).toEqual({ count: 1 }) } finally { database.close() }
})
