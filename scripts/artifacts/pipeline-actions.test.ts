import { describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { ActionError, claimAttemptDir, createAttempt, publishStep } from './pipeline-actions'
import { pipelineStatus, type StepId } from './pipeline-status'
import { integratedInterpretation, interpretation, syntheticReport } from '../fixtures/pipeline-documents'

const attemptCLI = join(import.meta.dir, '../artifact-attempt.ts')

function versionDir(): string {
  const dir = join(mkdtempSync(join(tmpdir(), 'artifact-actions-')), 'artifacts', 'v0.5.1')
  mkdirSync(dir, { recursive: true })
  return dir
}

function write(dir: string, path: string, text: string): void {
  mkdirSync(dirname(join(dir, path)), { recursive: true })
  writeFileSync(join(dir, path), text)
}

function stateOf(dir: string, id: StepId) {
  return pipelineStatus(dir).steps.find(step => step.id === id)!
}

function rejectsWith(code: string, run: () => unknown): void {
  try {
    run()
  } catch (error) {
    expect(error).toBeInstanceOf(ActionError)
    expect((error as ActionError).code).toBe(code)
    return
  }
  throw new Error(`expected ${code}`)
}

function withChart(): string {
  const dir = versionDir()
  write(dir, 'charts/chart-report.md', syntheticReport)
  return dir
}

function throughSystems(): string {
  const dir = withChart()
  for (const system of ['saju', 'ziwei', 'natal'] as const) {
    const text = interpretation(system)
    write(dir, `garbage/${system}/generate-1/candidate.md`, text)
    write(dir, `garbage/${system}/edit-1/candidate.md`, text)
    write(dir, `garbage/${system}/edit-1/result.md`, '상태: passed\n')
    write(dir, `interpretation/${system}-interpretation.md`, text)
  }
  return dir
}

describe('claimAttemptDir', () => {
  test('skips numbers already taken by the same or the shared kind and stops at the limit', () => {
    const stage = join(versionDir(), 'garbage/saju')
    mkdirSync(join(stage, 'generate-1'), { recursive: true })
    mkdirSync(join(stage, 'repair-2'), { recursive: true })
    expect(claimAttemptDir(stage, 'generate', 1, 3, 'repair').number).toBe(3)
    rejectsWith('attempt-budget-exhausted', () => claimAttemptDir(stage, 'generate', 1, 3, 'repair'))
  })
})

describe('createAttempt', () => {
  test('creates the next generation attempt folder for a ready step', () => {
    const dir = withChart()
    expect(createAttempt(dir, 'saju')).toEqual({
      attempt: 'garbage/saju/generate-1', candidate: 'garbage/saju/generate-1/candidate.md', kind: 'generate', inputs: ['charts/chart-report.md'],
    })
    expect(existsSync(join(dir, 'garbage/saju/generate-1'))).toBe(true)
  })

  test('refuses a second attempt while the first has no candidate, and status reports it as unfinished', () => {
    const dir = withChart()
    createAttempt(dir, 'saju')
    expect(stateOf(dir, 'saju').unfinished).toEqual(['garbage/saju/generate-1'])
    rejectsWith('unfinished-attempt', () => createAttempt(dir, 'saju'))
    expect(createAttempt(dir, 'saju', { replaceUnfinished: true }).attempt).toBe('garbage/saju/generate-2')
    expect(readFileSync(join(dir, 'garbage/saju/generate-1/result.md'), 'utf8')).toBe('상태: interrupted\n')
    expect(stateOf(dir, 'saju')).toMatchObject({ generationAttempts: 2, unfinished: ['garbage/saju/generate-2'] })
  })

  test('creates a repair attempt after an invalid candidate', () => {
    const dir = withChart()
    write(dir, 'garbage/saju/generate-1/candidate.md', 'broken')
    expect(createAttempt(dir, 'saju')).toMatchObject({ attempt: 'garbage/saju/repair-2', kind: 'repair' })
  })

  test('refuses a step whose budget is exhausted or whose prerequisites are missing', () => {
    const dir = withChart()
    for (const name of ['generate-1', 'repair-2', 'repair-3']) write(dir, `garbage/saju/${name}/candidate.md`, 'broken')
    rejectsWith('step-not-ready', () => createAttempt(dir, 'saju'))
    rejectsWith('step-not-ready', () => createAttempt(dir, 'integration'))
  })

  test('creates an edit attempt with its source and scope once a generation candidate is valid', () => {
    const dir = withChart()
    write(dir, 'garbage/saju/generate-1/candidate.md', interpretation('saju'))
    expect(createAttempt(dir, 'saju')).toEqual({
      attempt: 'garbage/saju/edit-1', candidate: 'garbage/saju/edit-1/candidate.md', kind: 'edit',
      source: 'garbage/saju/generate-1/candidate.md', scope: 'sentence',
    })
  })

  test('selection attempt is created with a write-once registry snapshot', () => {
    const dir = throughSystems()
    write(dir, 'garbage/integration/generate-1/candidate.md', integratedInterpretation)
    write(dir, 'garbage/integration/edit-1/candidate.md', integratedInterpretation)
    write(dir, 'garbage/integration/edit-1/result.md', '상태: passed\n')
    write(dir, 'interpretation/chart-interpretation.md', integratedInterpretation)
    const expected = stateOf(dir, 'selection').action!.registry
    const created = createAttempt(dir, 'selection')
    expect(JSON.parse(readFileSync(join(dir, created.attempt, 'registry.json'), 'utf8'))).toEqual(expected)
  })

  test('parallel processes get distinct attempt numbers and never exceed the limit', async () => {
    const dir = withChart()
    const runs = await Promise.all(Array.from({ length: 4 }, async () => {
      const proc = Bun.spawn(['bun', attemptCLI, dir, 'saju', '--replace-unfinished'], { stdout: 'pipe', stderr: 'pipe' })
      const [stdout, code] = [await new Response(proc.stdout).text(), await proc.exited]
      return { code, stdout }
    }))
    const created = runs.filter(run => run.code === 0).map(run => JSON.parse(run.stdout).attempt).sort()
    expect(created).toEqual(['garbage/saju/generate-1', 'garbage/saju/generate-2', 'garbage/saju/generate-3'])
    expect(runs.filter(run => run.code !== 0)).toHaveLength(1)
    expect(readdirSync(join(dir, 'garbage/saju')).sort()).toEqual(['generate-1', 'generate-2', 'generate-3'])
  })
})

describe('publishStep', () => {
  test('publishes the passed edit candidate and the step becomes done', () => {
    const dir = withChart()
    write(dir, 'garbage/saju/generate-1/candidate.md', interpretation('saju'))
    write(dir, 'garbage/saju/edit-1/candidate.md', interpretation('saju'))
    write(dir, 'garbage/saju/edit-1/result.md', '상태: passed\n')
    expect(publishStep(dir, 'saju')).toEqual({ output: 'interpretation/saju-interpretation.md' })
    expect(readFileSync(join(dir, 'interpretation/saju-interpretation.md'), 'utf8')).toBe(interpretation('saju'))
    expect(stateOf(dir, 'saju').state).toBe('done')
    expect(readdirSync(join(dir, 'interpretation'))).toEqual(['saju-interpretation.md'])
  })

  test('publishing an already published step succeeds without changing the file', () => {
    const dir = withChart()
    write(dir, 'garbage/saju/generate-1/candidate.md', interpretation('saju'))
    write(dir, 'garbage/saju/edit-1/candidate.md', interpretation('saju'))
    write(dir, 'garbage/saju/edit-1/result.md', '상태: passed\n')
    publishStep(dir, 'saju')
    expect(publishStep(dir, 'saju')).toEqual({ output: 'interpretation/saju-interpretation.md' })
    expect(readFileSync(join(dir, 'interpretation/saju-interpretation.md'), 'utf8')).toBe(interpretation('saju'))
  })

  test('refuses a step that is not ready to publish and does not overwrite an existing different file', () => {
    const dir = withChart()
    rejectsWith('step-not-publishable', () => publishStep(dir, 'saju'))
    write(dir, 'garbage/saju/generate-1/candidate.md', interpretation('saju'))
    write(dir, 'garbage/saju/edit-1/candidate.md', interpretation('saju'))
    write(dir, 'garbage/saju/edit-1/result.md', '상태: passed\n')
    write(dir, 'interpretation/saju-interpretation.md', 'someone else wrote this')
    rejectsWith('step-not-publishable', () => publishStep(dir, 'saju'))
    expect(readFileSync(join(dir, 'interpretation/saju-interpretation.md'), 'utf8')).toBe('someone else wrote this')
  })
})
