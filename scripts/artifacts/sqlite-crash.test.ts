import { expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { makeRepository } from './test-fixtures'
import { allocate, call, ok, prepare, read, request, sha256, start, submit, syntheticReport } from './sqlite-test-fixtures'

const child = join(import.meta.dir, '../fixtures/sqlite-crash-worker.ts')
async function crash(phase: string, root: string, attempt = '', claim = '', id = request()) {
  const process = Bun.spawn(['bun', child, phase, root, attempt, claim, id], { stdout: 'pipe', stderr: 'pipe' })
  const [code, stdout, stderr] = await Promise.all([process.exited, new Response(process.stdout).text(), new Response(process.stderr).text()])
  expect(code).not.toBe(0)
  expect(stdout).toBe('')
  expect(stderr).toBe('')
  expect(process.signalCode).toBe('SIGKILL')
}

test('process death after allocation commit recovers same reservation without reusing its number', async () => {
  const root = makeRepository(), id = request()
  await crash('after-reservation', root, '', '', id)
  const runs = ok(call(root, ['runs', '--unfinished'], { read: true }))
  const text = JSON.stringify(runs)
  expect(text).toContain('v0.1.0')
  expect(existsSync(join(root, 'artifacts/v0.1.0'))).toBe(false)
  const recovered = allocate(root, 'chart-report', id)
  expect(recovered.data.version).toBe('v0.1.0')
  expect(existsSync(join(root, 'artifacts/v0.1.0'))).toBe(true)
  expect(allocate(root).data.version).toBe('v0.1.1')
})

for (const phase of ['before-publish', 'after-publish']) {
  test(`process death ${phase} leaves recoverable publication intent without duplicate attempts`, async () => {
    const root = makeRepository(), allocated = allocate(root), run = allocated.data.runId
    start(root, run)
    const attempt = prepare(root, run).data
    writeFileSync(resolve(root, attempt.output), syntheticReport)
    submit(root, attempt, { path: attempt.output, sha256: sha256(syntheticReport) })
    await crash(phase, root, attempt.attemptId, attempt.claim)
    const db = new Database(join(root, 'artifacts/state.sqlite'), { readonly: true })
    try {
      expect(db.query('SELECT status FROM documents').all()).toEqual([{ status: 'ready-to-publish' }])
      expect(db.query('SELECT count(*) AS count FROM attempts').get()).toEqual({ count: 1 })
    } finally { db.close() }
    const final = join(allocated.data.directory, 'docs/GDD/chart-report.md')
    expect(existsSync(final)).toBe(phase === 'after-publish')
    const next = read(root, 'next', run)
    expect(JSON.stringify(next)).toContain('reconcile-publication')
    ok(call(root, ['reconcile', '--run', run, '--request', request()]))
    expect(readFileSync(final, 'utf8')).toBe(syntheticReport)
    const reopened = new Database(join(root, 'artifacts/state.sqlite'), { readonly: true })
    try {
      expect(reopened.query('SELECT status FROM documents').all()).toEqual([{ status: 'published' }])
      expect(reopened.query('SELECT count(*) AS count FROM attempts').get()).toEqual({ count: 1 })
    } finally { reopened.close() }
    expect(read(root, 'summary', run).data.stages.find((stage: any) => stage.stage === 'chart-report').status).toBe('succeeded')
  })
}


test('another owner claiming a committed reservation blocks recovery without renumbering or overwriting', async () => {
  const root = makeRepository(), id = request()
  await crash('after-reservation', root, '', '', id)
  const target = join(root, 'artifacts/v0.1.0')
  mkdirSync(target)
  writeFileSync(join(target, 'foreign.md'), 'other owner document')
  const result = call(root, ['allocate', '--kind', 'chart-report', '--mode', 'deep', '--purpose', 'new-profile', '--request', id])
  expect(result.code).toBe(1)
  expect(JSON.parse(result.stderr).error.code).toBe('output-path-conflict')
  expect(readFileSync(join(target, 'foreign.md'), 'utf8')).toBe('other owner document')
  expect(allocate(root).data.version).toBe('v0.1.1')
})

for (const target of ['validated-candidate', 'foreign-final-path']) {
  test(`publication recovery blocks ${target} mutation without adopting or overwriting it`, async () => {
    const root = makeRepository(), allocated = allocate(root), run = allocated.data.runId
    start(root, run)
    const attempt = prepare(root, run).data
    writeFileSync(attempt.output, syntheticReport)
    submit(root, attempt)
    await crash('before-publish', root, attempt.attemptId, attempt.claim)
    const final = join(allocated.data.directory, 'docs/GDD/chart-report.md')
    const path = target === 'validated-candidate' ? attempt.output : final
    writeFileSync(path, 'FOREIGN_MUTATED_BYTES_SENTINEL')
    const result = call(root, ['reconcile', '--run', run, '--request', request()])
    expect(result.code).toBe(1)
    expect(JSON.parse(result.stderr).error.code).toBe('integrity-error')
    expect(readFileSync(path, 'utf8')).toBe('FOREIGN_MUTATED_BYTES_SENTINEL')
    if (target === 'validated-candidate') expect(existsSync(final)).toBe(false)
    const summary = read(root, 'summary', run)
    expect(summary.data.run.status).toBe('blocked')
    expect(summary.data.stages.find((stage: any) => stage.stage === 'chart-report').status).not.toBe('succeeded')
    expect(call(root, ['prepare', '--run', run, '--stage', 'saju', '--kind', 'generate', '--request', request()]).code).toBe(1)
  })
}
