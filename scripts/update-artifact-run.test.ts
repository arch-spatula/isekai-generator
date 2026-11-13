import { expect, test } from 'bun:test'
import { makeRepository } from './artifacts/test-fixtures'
import { allocate, call, ok, read, request, start } from './artifacts/sqlite-test-fixtures'

test('purpose CLI preserves terminal history and cannot mark an unvalidated run successful', () => {
  const root = makeRepository(), run = allocate(root).data.runId
  expect(call(root, ['finalize', '--run', run, '--request', request()]).code).toBe(1)
  expect(read(root, 'summary', run).data.run.status).toBe('allocated')
  start(root, run)
  ok(call(root, ['fail', '--run', run, '--reason', 'Synthetic specialist validation failed', '--request', request()]))
  expect(read(root, 'summary', run).data.run.status).toBe('failed')
  expect(call(root, ['start', '--run', run, '--request', request()]).code).toBe(1)
  expect(call(root, ['resume', '--run', run, '--request', request()]).code).toBe(1)
  const next = allocate(root, 'chart-report')
  expect(next.data.version).toBe('v0.1.1')
  ok(call(root, ['cancel', '--run', next.data.runId, '--reason', 'Synthetic cancellation', '--request', request()]))
  expect(read(root, 'summary', next.data.runId).data.run.status).toBe('cancelled')
})
