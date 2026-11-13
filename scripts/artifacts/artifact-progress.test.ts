import { expect, test } from 'bun:test'
import { allocate, call, ok, prepare, read, request, start } from './sqlite-test-fixtures'
import { makeRepository } from './test-fixtures'

// Replaces TODO rendering/checkpoint tests: DB next is the durable handoff (§§5,6,8).
test('standalone chart has no specialist or registration work', () => {
  const root = makeRepository(), run = allocate(root, 'chart-report').data.runId
  const summary = read(root, 'summary', run)
  const stages = Array.isArray(summary.data.stages) ? summary.data.stages.map((stage: any) => stage.stage) : Object.keys(summary.data.stages)
  expect(stages).toContain('chart-report')
  for (const stage of ['saju', 'integration', 'combat-registration', 'world-registration', 'fingerprint-registration']) expect(stages).not.toContain(stage)
})

test('GDD DAG exposes one atomic registration stage and preserves specialist independence', () => {
  const root = makeRepository(), run = allocate(root).data.runId
  const summary = read(root, 'summary', run)
  const stages = Array.isArray(summary.data.stages) ? summary.data.stages.map((stage: any) => stage.stage) : Object.keys(summary.data.stages)
  for (const stage of ['chart-report', 'saju', 'ziwei', 'natal', 'integration', 'selection', 'world-selection', 'gdd', 'final-validation', 'fingerprint-registration']) expect(stages).toContain(stage)
  expect(stages).not.toContain('combat-registration')
  expect(stages).not.toContain('world-registration')
})

test('missing birth input is requested without guessing another run input', () => {
  const root = makeRepository(), run = allocate(root).data.runId
  start(root, run)
  expect(read(root, 'next', run).data.actions).toContainEqual(expect.objectContaining({ action: 'request-input', stage: 'chart-report' }))
})

test('known prepared work remains dispatchable after reconciliation without another budget allocation', () => {
  const root = makeRepository(), run = allocate(root).data.runId
  start(root, run)
  const first = prepare(root, run).data
  ok(call(root, ['reconcile', '--run', run, '--request', request()]))
  const actions = read(root, 'next', run).data.actions
  expect(actions).toContainEqual(expect.objectContaining({ action: 'dispatch', attemptId: first.attemptId }))
  expect(actions.some((action: any) => action.action === 'prepare-retry')).toBe(false)
})
