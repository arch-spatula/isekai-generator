import { randomUUID } from 'node:crypto'
import { existsSync, linkSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { diagnoseSystemInterpretation, type ChartSystem, type InterpretationDiagnostic } from '../../.agents/skills/interpret-chart-system/scripts/validate-system-interpretation'
import type { ChartEvidenceManifest } from '../../.agents/skills/generate-chart-report/scripts/chart-evidence'
import { appendArtifactEvent } from './artifact-events'
import { readRunManifest } from './artifact-run'
import { recordStageProgress } from './artifact-progress'

export const MAX_SPECIALIST_ATTEMPTS = 3
export type AttemptInput = {
  system: ChartSystem; attempt: number; mode: 'generate' | 'repair'; startedAt: string
  output: string; previous?: { output: string; result: string }
}
export type AttemptResult = {
  system: ChartSystem; attempt: number; mode: AttemptInput['mode']; finishedAt: string
  status: 'editing-required' | 'validation-failed' | 'execution-failed'; output: string
  errors: InterpretationDiagnostic[]
}

function requireRunning(run: string): void {
  if (readRunManifest(run).status !== 'running') throw new Error('Specialist attempts require a running run')
}

function systemDirectory(run: string, system: ChartSystem): string {
  if (!['saju', 'ziwei', 'natal'].includes(system)) throw new Error('Invalid chart system')
  return join(run, 'garbage', 'attempts', system)
}

/** Each system has one writer; an interrupted lock requires manual investigation. */
function withLock<T>(run: string, system: ChartSystem, action: (directory: string) => T): T {
  requireRunning(run)
  const directory = systemDirectory(run, system)
  mkdirSync(directory, { recursive: true })
  const lock = join(directory, '.lock')
  mkdirSync(lock)
  try { return action(directory) } finally { rmSync(lock, { recursive: true }) }
}

/** Publish a complete file without replacing an existing attempt or final document. */
function publishOnce(path: string, content: string): void {
  const temp = join(dirname(path), `.${randomUUID()}.tmp`)
  try {
    writeFileSync(temp, content, { flag: 'wx' })
    linkSync(temp, path)
  } finally { rmSync(temp, { force: true }) }
}

function writeRecord(path: string, value: unknown): void {
  publishOnce(path, `${JSON.stringify(value, null, 2)}\n`)
}

function finalPath(run: string, system: ChartSystem): string {
  return join(run, 'docs', 'GDD', `${system}-interpretation.md`)
}

/** Allocate only after the preceding failure has a durable result record. */
export function prepareSpecialistAttempt(runDirectory: string, system: ChartSystem): AttemptInput {
  const run = resolve(runDirectory)
  return withLock(run, system, directory => {
    if (existsSync(finalPath(run, system)) || existsSync(join(directory, 'accepted.json'))) throw new Error('Specialist already has a final document')
    const attempts = readdirSync(directory).filter(name => /^\d{3}$/.test(name)).sort()
    let previous: AttemptInput['previous']
    let mode: AttemptInput['mode'] = 'generate'
    let priorResult: AttemptResult | undefined
    if (attempts.length > 0) {
      const prior = join(directory, attempts.at(-1)!)
      // Missing or incomplete records block another agent from starting.
      const result = JSON.parse(readFileSync(join(prior, 'result.json'), 'utf8')) as AttemptResult
      priorResult = result
      if (!['validation-failed', 'execution-failed'].includes(result.status)) throw new Error('Previous attempt is not a recorded failure')
      if (result.status === 'validation-failed') {
        mode = 'repair'
        previous = { output: relative(run, join(prior, 'interpretation.md')), result: relative(run, join(prior, 'result.json')) }
      }
    }
    if (attempts.length >= MAX_SPECIALIST_ATTEMPTS) {
      appendArtifactEvent(run, { event: 'stage_stopped', stage: system, attempt: attempts.length, operation: 'prepare-specialist-attempt', reason: 'Specialist attempt limit exhausted (3 total)', issues: priorResult?.errors.map(({ itemId, line, ...issue }) => ({ ...issue, ...(line != null && line > 0 ? { line } : {}), ...(itemId ? { item: itemId } : {}) })) })
      throw new Error('Specialist attempt limit exhausted (3 total)')
    }
    const attempt = attempts.length + 1
    if (priorResult) appendArtifactEvent(run, { event: 'retry_scheduled', stage: system, attempt, operation: 'prepare-specialist-attempt', reason: priorResult.status, issues: priorResult.errors.map(({ itemId, line, ...issue }) => ({ ...issue, ...(line != null && line > 0 ? { line } : {}), ...(itemId ? { item: itemId } : {}) })) })
    const target = join(directory, String(attempt).padStart(3, '0'))
    mkdirSync(target)
    const input: AttemptInput = { system, attempt, mode, startedAt: new Date().toISOString(), output: relative(run, join(target, 'interpretation.md')), ...(previous ? { previous } : {}) }
    writeRecord(join(target, 'input.json'), input)
    recordStageProgress(run, readRunManifest(run), system, 'running', { attempt })
    return input
  })
}

/** Record validation before any retry or final publication; never log agent stderr. */
export function finishSpecialistAttempt(runDirectory: string, system: ChartSystem, attempt: number, executionFailed = false): AttemptResult {
  const run = resolve(runDirectory)
  return withLock(run, system, directory => {
    if (!Number.isInteger(attempt) || attempt < 1 || attempt > MAX_SPECIALIST_ATTEMPTS) throw new Error('Invalid attempt number')
    const target = join(directory, String(attempt).padStart(3, '0'))
    if (existsSync(join(target, 'result.json'))) throw new Error('Attempt already completed')
    const input = JSON.parse(readFileSync(join(target, 'input.json'), 'utf8')) as AttemptInput
    const output = join(target, 'interpretation.md')
    let markdown: string | undefined
    let errors: InterpretationDiagnostic[]
    if (executionFailed || !existsSync(output)) {
      errors = [{ code: 'agent-execution', message: 'Agent execution failed or produced no document; generate again from source.' }]
    } else {
      markdown = readFileSync(output, 'utf8')
      const manifest = JSON.parse(readFileSync(join(run, 'docs', 'GDD', 'chart-evidence.json'), 'utf8')) as ChartEvidenceManifest
      errors = diagnoseSystemInterpretation(system, markdown, manifest)
    }
    const result: AttemptResult = {
      system, attempt, mode: input.mode, finishedAt: new Date().toISOString(), output: relative(run, output),
      status: executionFailed || markdown == null ? 'execution-failed' : errors.some(error => error.code !== 'responsibility-avoidance') ? 'validation-failed' : 'editing-required', errors,
    }
    appendArtifactEvent(run, { event: result.status === 'passed' ? 'validation_succeeded' : result.status === 'execution-failed' ? 'execution_failed' : 'validation_failed', stage: system, attempt, operation: 'validate-system-interpretation', output: result.output, ...(errors.length ? { reason: result.status === 'execution-failed' ? 'Specialist execution failed or produced no document.' : 'Specialist document failed validation.', issues: errors.map(({ itemId, line, ...issue }) => ({ ...issue, ...(line != null && line > 0 ? { line } : {}), ...(itemId ? { item: itemId } : {}) })) } : {}) })
    writeRecord(join(target, 'result.json'), result)
    recordStageProgress(run, readRunManifest(run), system, result.status === 'editing-required' ? 'running' : 'failed', { attempt })
    return result
  })
}
