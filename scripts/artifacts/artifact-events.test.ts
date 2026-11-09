import { expect, test } from 'bun:test'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { allocateRun, readRunManifest, updateRun } from './artifact-run'
import { makeRepository } from './test-fixtures'
import { appendArtifactEvent } from './artifact-events'

const logger = join(import.meta.dir, '../log-artifact-event.ts')
const wrapper = join(import.meta.dir, '../run-logged-step.ts')
function running(): string {
  const run = allocateRun(makeRepository(), 'personalized-gdd')
  updateRun(run, 'running')
  return run
}
function events(run: string): any[] {
  return readFileSync(join(run, 'events.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
}
async function execute(args: string[]) {
  const child = Bun.spawn([Bun.argv[0], ...args], { stdout: 'pipe', stderr: 'pipe' })
  const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  return { exitCode, stdout, stderr }
}

test('allocation creates an empty log; concurrent processes append complete lines preserving prior bytes', async () => {
  const run = allocateRun(makeRepository(), 'personalized-gdd')
  expect(readFileSync(join(run, 'events.jsonl'), 'utf8')).toBe('')
  updateRun(run, 'running')
  appendArtifactEvent(run, { event: 'validation_failed', stage: 'integration', attempt: 1, operation: 'validate', reason: 'Missing required field', issues: [{ code: 'missing-field', message: 'Required field absent', item: 'I-01', field: '조건', line: 42 }] })
  const before = readFileSync(join(run, 'events.jsonl'), 'utf8')
  const results = await Promise.all(Array.from({ length: 16 }, (_, index) => execute([logger, run, JSON.stringify({ event: 'validation_failed', stage: `worker-${index}`, attempt: 1, operation: 'validate', reason: `failure-${index}` })])))
  for (const result of results) expect(result).toEqual({ exitCode: 0, stdout: '', stderr: '' })
  expect(readFileSync(join(run, 'events.jsonl'), 'utf8').startsWith(before)).toBe(true)
  const appended = events(run).slice(before.trim().split('\n').length)
  expect(appended).toHaveLength(16)
  expect(new Set(appended.map(event => event.stage)).size).toBe(16)
  for (const event of appended) {
    expect(event.reason).toBe(`failure-${event.stage.slice('worker-'.length)}`)
    expect(new Date(event.timestamp).toISOString()).toBe(event.timestamp)
  }
})

test('event CLI rejects invalid schema and terminal runs without changing bytes', async () => {
  const run = running()
  for (const event of [ { event: 'unknown', stage: 'integration', operation: 'validate' }, { event: 'validation_failed', stage: '', operation: 'validate' }, { event: 'validation_failed', stage: 'integration', operation: 'validate', attempt: 0 } ]) {
    const before = readFileSync(join(run, 'events.jsonl'), 'utf8')
    expect((await execute([logger, run, JSON.stringify(event)])).exitCode).not.toBe(0)
    expect(readFileSync(join(run, 'events.jsonl'), 'utf8')).toBe(before)
  }
  updateRun(run, 'cancelled')
  const before = readFileSync(join(run, 'events.jsonl'), 'utf8')
  expect((await execute([logger, run, JSON.stringify({ event: 'validation_failed', stage: 'integration', operation: 'validate', reason: 'late' })])).exitCode).not.toBe(0)
  expect(readFileSync(join(run, 'events.jsonl'), 'utf8')).toBe(before)
})

test('wrapper executes once, mirrors output and preserves failure diagnostics without logging stdout or argv', async () => {
  const run = running()
  const counter = join(run, 'invocations.txt')
  const issue = { code: 'item-field', message: 'Required field absent', item: 'I-03', field: '조건', line: 73 }
  const script = join(run, 'validator.ts')
  writeFileSync(script, `import { appendFileSync } from 'node:fs'; appendFileSync(${JSON.stringify(counter)}, 'called\\n'); console.log('PRIVATE_STDOUT_SENTINEL'); console.error(${JSON.stringify(JSON.stringify({ issues: [issue] }))}); process.exit(7)`)
  const result = await execute([wrapper, run, 'integration', '2', '--', Bun.argv[0], script, 'PRIVATE_ARGV_SENTINEL'])
  expect(result).toEqual({ exitCode: 7, stdout: 'PRIVATE_STDOUT_SENTINEL\n', stderr: JSON.stringify({ issues: [issue] }) + '\n' })
  expect(readFileSync(counter, 'utf8')).toBe('called\n')
  const event = events(run).at(-1)
  expect(event).toMatchObject({ event: 'validation_failed', stage: 'integration', attempt: 2, exitCode: 7, issues: [issue] })
  expect(Boolean(event.reason?.trim()) || event.issues?.length > 0).toBe(true)
  expect(event.operation).toContain('validator.ts')
  const log = readFileSync(join(run, 'events.jsonl'), 'utf8')
  expect(log).not.toContain('PRIVATE_STDOUT_SENTINEL')
  expect(log).not.toContain('PRIVATE_ARGV_SENTINEL')
  expect(log).not.toContain(script)
})

test('wrapper retains real unstructured validator stderr and logs success and spawn failure separately', async () => {
  const run = running()
  const failed = await execute([wrapper, run, 'gameplay', '1', '--', Bun.argv[0], '-e', "console.error('Missing combat loop: recovery'); process.exit(3)"])
  expect(failed.exitCode).toBe(3)
  expect(events(run).at(-1)).toMatchObject({ event: 'validation_failed', exitCode: 3 })
  expect(JSON.stringify(events(run).at(-1))).toContain('Missing combat loop: recovery')
  const passed = await execute([wrapper, run, 'gameplay', '2', '--', Bun.argv[0], '-e', "console.log('ok')"])
  expect(passed).toEqual({ exitCode: 0, stdout: 'ok\n', stderr: '' })
  expect(events(run).at(-1)).toMatchObject({ event: 'validation_succeeded', stage: 'gameplay', attempt: 2 })
  const spawn = await execute([wrapper, run, 'world', '1', '--', join(run, 'nonexistent-executable')])
  expect(spawn.exitCode).not.toBe(0)
  expect(events(run).at(-1)).toMatchObject({ event: 'execution_failed', stage: 'world', attempt: 1 })
  expect(events(run).at(-1).reason).toBeTruthy()
})

test('log write failure is visible even when the child succeeds', async () => {
  const run = running()
  renameSync(join(run, 'events.jsonl'), join(run, 'previous-events.jsonl'))
  mkdirSync(join(run, 'events.jsonl'))
  expect(() => appendArtifactEvent(run, { event: 'validation_failed', stage: 'integration', operation: 'validate', reason: 'failure' })).toThrow()
  const result = await execute([wrapper, run, 'integration', '1', '--', Bun.argv[0], '-e', "console.log('child finished')"])
  expect(result.exitCode).not.toBe(0)
  expect(result.stderr).not.toBe('')
  expect(readRunManifest(run).status).toBe('running')
})

test('terminal transitions append outcomes while preserving checkpoint and output bytes', () => {
  for (const status of ['succeeded', 'failed', 'cancelled'] as const) {
    const run = running()
    const checkpoint = join(run, 'checkpoint.json'), output = join(run, 'result.md')
    writeFileSync(checkpoint, '{"accepted":["saju"]}\n')
    writeFileSync(output, 'accepted output\n')
    const before = readFileSync(join(run, 'events.jsonl'), 'utf8')
    updateRun(run, status, status === 'failed' ? { stage: 'integration', summary: 'Required evidence missing' } : undefined)
    expect(events(run).filter(event => event.event === 'run_started')).toHaveLength(1)
    expect(events(run).at(-1).event).toBe(`run_${status}`)
    if (status === 'failed') expect(events(run).at(-1)).toMatchObject({ stage: 'integration', reason: 'Required evidence missing' })
    expect(readFileSync(join(run, 'events.jsonl'), 'utf8').startsWith(before)).toBe(true)
    expect(readFileSync(checkpoint, 'utf8')).toBe('{"accepted":["saju"]}\n')
    expect(readFileSync(output, 'utf8')).toBe('accepted output\n')
  }
})

test('empty structured failure issues still leave a diagnostic reason', async () => {
  const run = running()
  const result = await execute([wrapper, run, 'integration', '1', '--', Bun.argv[0], '-e', "console.error(JSON.stringify({issues: []})); process.exit(1)"])
  expect(result.exitCode).toBe(1)
  const failed = events(run).at(-1)
  expect(failed.event).toBe('validation_failed')
  expect(Boolean(failed.reason?.trim()) || failed.issues?.some((issue: any) => issue.code === 'diagnostic-unavailable' && issue.message.trim())).toBe(true)
})

test('status updates cannot advance a manifest when appending its outcome fails', () => {
  for (const transition of ['running', 'succeeded', 'failed', 'cancelled'] as const) {
    const run = allocateRun(makeRepository(), 'personalized-gdd')
    if (transition !== 'running') updateRun(run, 'running')
    const original = readFileSync(join(run, 'artifact-run.json'), 'utf8')
    renameSync(join(run, 'events.jsonl'), join(run, 'previous-events.jsonl'))
    mkdirSync(join(run, 'events.jsonl'))
    expect(() => updateRun(run, transition, transition === 'failed' ? { stage: 'integration', summary: 'Evidence absent' } : undefined)).toThrow()
    expect(readFileSync(join(run, 'artifact-run.json'), 'utf8')).toBe(original)
    expect(readRunManifest(run).status).toBe(transition === 'running' ? 'allocated' : 'running')
  }
})
