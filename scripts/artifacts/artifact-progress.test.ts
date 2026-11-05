import { expect, test, spyOn } from 'bun:test'
import * as fs from 'node:fs'
import { join } from 'node:path'
import { allocateRun, readRunManifest, updateRun } from './artifact-run'
import { PROGRESS_STAGES, readStageProgress, recordStageProgress, refreshProgress, type ProgressStage } from './artifact-progress'
import { makeRepository } from './test-fixtures'

function setup(kind: 'personalized-gdd' | 'chart-report' = 'personalized-gdd'): string {
  const run = allocateRun(makeRepository(), kind, { mode: 'deep' })
  updateRun(run, 'running')
  return run
}

function todo(run: string): string { return fs.readFileSync(join(run, 'TODO.md'), 'utf8') }
function mark(run: string, stage: ProgressStage, status: 'running' | 'succeeded' | 'failed'): void {
  recordStageProgress(run, readRunManifest(run), stage, status)
}

test('allocation creates progress without reading or rewriting prior artifacts', () => {
  const root = makeRepository()
  fs.mkdirSync(join(root, 'artifacts/v0.1.8'), { recursive: true })
  fs.writeFileSync(join(root, 'artifacts/v0.1.8/TODO.md'), 'old progress')
  const run = allocateRun(root, 'personalized-gdd')
  expect(todo(run)).toContain('실행 상태: allocated')
  expect(todo(run)).toContain('차트 보고서와 근거 검증 — pending')
  expect(todo(run)).toContain('지문 등록이 중단됐다면')
  expect(fs.readFileSync(join(root, 'artifacts/v0.1.8/TODO.md'), 'utf8')).toBe('old progress')
})

test('an interrupted active stage retains agent and next action without guessing failure', () => {
  const run = setup()
  recordStageProgress(run, readRunManifest(run), 'chart-report', 'running', { agentId: '/root/chart' })
  expect(todo(run)).toContain('에이전트: /root/chart')
  refreshProgress(run, readRunManifest(run))
  expect(todo(run)).toContain('에이전트·프로세스가 실제로 살아 있는지 먼저 확인')
  expect(readRunManifest(run).status).toBe('running')
  expect(() => mark(run, 'integration', 'running')).toThrow('dependencies')
  mark(run, 'chart-report', 'succeeded')
  expect(todo(run)).toContain('다음 작업 후보: saju, ziwei, natal')
  expect(() => mark(run, 'chart-report', 'running')).toThrow('Completed')
})

test('parallel checkpoint processes preserve all specialist completions', async () => {
  const run = setup()
  mark(run, 'chart-report', 'succeeded')
  const cli = join(import.meta.dir, '../update-artifact-progress.ts')
  const processes = ['saju', 'ziwei', 'natal'].map(stage => Bun.spawn(['bun', cli, 'done', run, stage], { stdout: 'pipe', stderr: 'pipe' }))
  expect(await Promise.all(processes.map(process => process.exited))).toEqual([0, 0, 0])
  const progress = readStageProgress(run, readRunManifest(run))
  for (const stage of ['saju', 'ziwei', 'natal'] as const) {
    expect(progress[stage]?.status).toBe('succeeded')
    expect(todo(run)).toContain(`— succeeded (${stage})`)
  }
  expect(todo(run)).toContain('다음 작업 후보: integration')
})

test('terminal state sync records failure and never authorizes reopening a run', () => {
  const run = setup()
  mark(run, 'chart-report', 'succeeded')
  mark(run, 'saju', 'running')
  updateRun(run, 'failed', { stage: 'saju', summary: 'Specialist validation failed' })
  expect(todo(run)).toContain('실행 상태: failed')
  expect(todo(run)).toContain('— failed (saju)')
  expect(todo(run)).toContain('종료된 run을 다시 열거나')
  expect(() => mark(run, 'saju', 'running')).toThrow('running run')
  const cancelled = setup()
  updateRun(cancelled, 'cancelled')
  expect(todo(cancelled)).toContain('실행 상태: cancelled')
})

test('partial registration leaves a specific pending registration instead of rerunning the first', () => {
  const run = setup()
  for (const stage of Object.keys(PROGRESS_STAGES) as ProgressStage[]) {
    if (stage === 'world-registration') break
    mark(run, stage, 'succeeded')
  }
  expect(todo(run)).toContain('다음 작업 후보: world-registration')
  expect(todo(run)).toContain('같은 run을 다시 등록하지 않는다')
  mark(run, 'world-registration', 'succeeded')
  expect(todo(run)).toContain('부모 run을 succeeded로 기록')
  updateRun(run, 'succeeded')
  expect(todo(run)).toContain('추가 생성 작업은 없다')
})

test('a failed TODO render preserves the stage checkpoint and sync reconstructs the handoff', () => {
  const run = setup()
  const before = todo(run)
  const rename = fs.renameSync
  const failure = spyOn(fs, 'renameSync').mockImplementation((from, to) => {
    if (String(to) === join(run, 'TODO.md')) throw new Error('TODO write failed')
    rename(from, to)
  })
  try { expect(() => mark(run, 'chart-report', 'succeeded')).toThrow('TODO write failed') } finally { failure.mockRestore() }
  expect(todo(run)).toBe(before)
  expect(readStageProgress(run, readRunManifest(run))['chart-report']?.status).toBe('succeeded')
  refreshProgress(run, readRunManifest(run))
  expect(todo(run)).toContain('— succeeded (chart-report)')
})

test('standalone chart checklist and CLI input boundaries are preserved', () => {
  const run = setup('chart-report')
  expect(todo(run)).not.toContain('(integration)')
  const cli = join(import.meta.dir, '../update-artifact-progress.ts')
  const call = (...args: string[]) => Bun.spawnSync(['bun', cli, ...args])
  expect(call('start', run, 'chart-report', '/root/chart').exitCode).toBe(0)
  expect(call('start', run, 'integration').exitCode).toBe(1)
  expect(call('start', run, 'chart-report', 'private birth arguments').exitCode).toBe(1)
  expect(call('done', run, 'chart-report').exitCode).toBe(0)
  expect(call('sync', run).exitCode).toBe(0)
  expect(todo(run)).not.toContain('private birth arguments')
})
