import { expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { failRun } from './artifact-run'
import { chartFixture, prepare, call, ok, request, submit, read, interpretation, sha256, tree } from './sqlite-test-fixtures'

function db(root: string) { return new Database(join(root, 'artifacts/state.sqlite')) }
function rejectedIntegrity(result: ReturnType<typeof call>) {
  expect(result.code).toBe(1)
  expect(JSON.parse(result.stderr).error.code).toMatch(/integrity|snapshot/)
}

test('original exception and terminal recording failure both reach caller with no private log fallback', () => {
  const fixture = chartFixture(), store = db(fixture.root)
  store.exec("CREATE TRIGGER reject_failure_event BEFORE INSERT ON events WHEN NEW.event='failed' BEGIN SELECT RAISE(ABORT,'synthetic recording failure'); END")
  store.close()
  const files = () => tree(join(fixture.root, 'artifacts')).filter(path => !/^state\.sqlite-(wal|shm)$/.test(path))
  const beforeFiles = files()
  let failure: unknown
  try { failRun(fixture.directory, 'saju', 'Safe synthetic failure summary', new Error('PRIVATE_ORIGINAL_EXCEPTION_SENTINEL')) } catch (error) { failure = error }
  expect(failure).toBeInstanceOf(AggregateError)
  const errors = (failure as AggregateError).errors.map(error => String(error))
  expect(errors[0]).toContain('PRIVATE_ORIGINAL_EXCEPTION_SENTINEL')
  expect(errors[1]).toContain('synthetic recording failure')
  expect(read(fixture.root, 'summary', fixture.run).data.run.status).toBe('running')
  expect(JSON.stringify(read(fixture.root, 'summary', fixture.run))).not.toContain('PRIVATE_ORIGINAL_EXCEPTION_SENTINEL')
  expect(JSON.stringify(read(fixture.root, 'events', fixture.run))).not.toContain('PRIVATE_ORIGINAL_EXCEPTION_SENTINEL')
  expect(files()).toEqual(beforeFiles)
  expect(beforeFiles.some(path => /\.jsonl?$|\.log$/.test(path))).toBe(false)
})

test('tampered prepared document hash cannot become a new accepted input', () => {
  const { root, run, directory } = chartFixture(), attempt = prepare(root, run, 'saju').data
  const store = db(root), original = store.query('SELECT input FROM attempts WHERE id=?').get(attempt.attemptId) as { input: string }
  const input = JSON.parse(original.input)
  input.documents[0].sha256 = '0'.repeat(64)
  store.query('UPDATE attempts SET input=? WHERE id=?').run(JSON.stringify(input), attempt.attemptId)
  store.close()
  const result = call(root, ['input', '--attempt', attempt.attemptId, '--claim', attempt.claim], { read: true })
  rejectedIntegrity(result)
  writeFileSync(attempt.output, interpretation())
  rejectedIntegrity(call(root, ['submit', '--attempt', attempt.attemptId, '--claim', attempt.claim, '--request', request()], { stdin: '{}' }))
  expect(existsSync(join(directory, 'docs/GDD/saju-interpretation.md'))).toBe(false)
  expect(read(root, 'summary', run).data.run.status).toBe('blocked')
  expect(call(root, ['prepare', '--run', run, '--stage', 'integration', '--kind', 'generate', '--request', request()]).code).toBe(1)
})

for (const field of ['chart_hash', 'text']) {
  test(`report and stored evidence ${field} mismatch is rejected instead of trusted`, () => {
    const { root, run, directory } = chartFixture(), store = db(root)
    store.query(`UPDATE evidence SET ${field}=? WHERE system='saju'`).run(field === 'chart_hash' ? 'f'.repeat(64) : 'TAMPERED_EVIDENCE_TEXT')
    store.close()
    const prepared = call(root, ['prepare', '--run', run, '--stage', 'saju', '--kind', 'generate', '--request', request()])
    if (prepared.code === 0) {
      const attempt = ok(prepared).data
      rejectedIntegrity(call(root, ['input', '--attempt', attempt.attemptId, '--claim', attempt.claim], { read: true }))
      writeFileSync(attempt.output, interpretation())
      rejectedIntegrity(call(root, ['submit', '--attempt', attempt.attemptId, '--claim', attempt.claim, '--request', request()], { stdin: '{}' }))
    } else rejectedIntegrity(prepared)
    expect(existsSync(join(directory, 'docs/GDD/saju-interpretation.md'))).toBe(false)
  expect(read(root, 'summary', run).data.run.status).toBe('blocked')
  })
}

test('submitted candidate bytes are immutable and never published after mutation', () => {
  const { root, run, directory } = chartFixture(), attempt = prepare(root, run, 'saju').data
  writeFileSync(attempt.output, interpretation())
  submit(root, attempt, { path: attempt.output, sha256: sha256(interpretation()) })
  writeFileSync(attempt.output, interpretation() + '\nchanged after submit')
  rejectedIntegrity(call(root, ['finish', '--attempt', attempt.attemptId, '--claim', attempt.claim, '--request', request()]))
  expect(existsSync(join(directory, 'docs/GDD/saju-interpretation.md'))).toBe(false)
  expect(read(root, 'summary', run).data.run.status).toBe('blocked')
  expect(call(root, ['prepare', '--run', run, '--stage', 'saju', '--kind', 'generate', '--request', request()]).code).toBe(1)
})
