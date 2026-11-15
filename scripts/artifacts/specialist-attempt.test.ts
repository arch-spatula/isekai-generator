import { expect, test } from 'bun:test'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { makeRepository } from './test-fixtures'
import { allocate, call, finish, ok, prepare, read, request, sha256, start, submit, syntheticReport, chartFixture, interpretation, specialist } from './sqlite-test-fixtures'

// §§5.3,12: structural validity never bypasses semantic editing, and both repair/generate consume one shared budget.
test('clean and defensive-only specialists require editing without publishing or regenerating', () => {
  for (const suffix of ['', '\n단정하지 않는다.']) {
    const { root, run } = chartFixture()
    const text = interpretation() + suffix, { attempt, result } = specialist(root, run, text)
    expect(result.outcome).toBe('editing-required')
    expect(readFileSync(resolve(root, attempt.output), 'utf8')).toBe(text)
    const issues = ok(call(root, ['issues', '--attempt', attempt.attemptId], { read: true }))
    if (suffix) expect(JSON.stringify(issues)).toContain('responsibility-avoidance')
    expect(call(root, ['prepare', '--run', run, '--stage', 'saju', '--kind', 'generate', '--request', request()]).code).toBe(1)
    expect(JSON.stringify(read(root, 'summary', run))).not.toContain('saju-interpretation.md')
  }
})

test('mixed structural and defensive errors retain repair mode and exact diagnostics before retry', () => {
  const { root, run } = chartFixture()
  const { attempt, result } = specialist(root, run, interpretation().replaceAll('근거:', '출처:') + '\n단정하지 않는다.')
  expect(result.outcome).toBe('validation-failed')
  const issues = JSON.stringify(ok(call(root, ['issues', '--attempt', attempt.attemptId], { read: true })))
  expect(issues).toContain('item-evidence')
  expect(issues).toContain('responsibility-avoidance')
  expect(JSON.stringify(read(root, 'events', run))).toContain('item-evidence')
  const next = prepare(root, run, 'saju').data
  expect(next.mode).toBe('repair')
  expect(next.number).toBe(2)
})

test('generation and repair share total three reservations and kind aliases cannot reset it', () => {
  const { root, run } = chartFixture()
  for (let index = 1; index <= 3; index++) {
    const { attempt, result } = specialist(root, run, interpretation().replaceAll('근거:', '출처:'))
    expect(attempt.number).toBe(index)
    expect(result.outcome).toBe('validation-failed')
  }
  for (const kind of ['generate', 'repair', 'regenerate', 'other']) expect(call(root, ['prepare', '--run', run, '--stage', 'saju', '--kind', kind, '--request', request()]).code).not.toBe(0)
  expect(read(root, 'summary', run).data.run.status).not.toBe('succeeded')
})

test('completed submission is immutable, and replay cannot replace its payload', () => {
  const { root, run } = chartFixture()
  const { attempt } = specialist(root, run, interpretation())
  const before = ok(call(root, ['issues', '--attempt', attempt.attemptId], { read: true }))
  expect(call(root, ['submit', '--attempt', attempt.attemptId, '--claim', attempt.claim, '--request', request()], { stdin: JSON.stringify({ path: attempt.output, sha256: 'f'.repeat(64) }) }).code).toBe(1)
  expect(ok(call(root, ['issues', '--attempt', attempt.attemptId], { read: true }))).toEqual(before)
})
