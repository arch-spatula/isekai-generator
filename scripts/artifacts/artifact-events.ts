import { appendFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { readRunManifest } from './artifact-run'

export type ArtifactIssue = { code: string; message: string; item?: string; field?: string; line?: number }
export type ArtifactEventInput = {
  event: 'validation_failed' | 'validation_succeeded' | 'execution_failed' | 'retry_scheduled' | 'stage_stopped' | 'run_started' | 'run_succeeded' | 'run_failed' | 'run_cancelled'
  stage: string; attempt?: number; operation: string; reason?: string; issues?: ArtifactIssue[]; output?: string; exitCode?: number
}
const EVENTS = ['validation_failed', 'validation_succeeded', 'execution_failed', 'retry_scheduled', 'stage_stopped', 'run_started', 'run_succeeded', 'run_failed', 'run_cancelled']

export function validateArtifactEvent(value: unknown): ArtifactEventInput {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an event object')
  const e = value as Record<string, unknown>
  const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0
  if (Object.keys(e).some(key => !['event', 'stage', 'attempt', 'operation', 'reason', 'issues', 'output', 'exitCode'].includes(key)) || !EVENTS.includes(e.event as string) || !text(e.stage) || !text(e.operation)) throw new Error('Invalid artifact event')
  if (e.attempt !== undefined && (!Number.isInteger(e.attempt) || Number(e.attempt) < 1)) throw new Error('Invalid event attempt')
  for (const key of ['reason', 'output']) if (e[key] !== undefined && !text(e[key])) throw new Error(`Invalid event ${key}`)
  if (e.exitCode !== undefined && !Number.isInteger(e.exitCode)) throw new Error('Invalid event exit code')
  if (e.issues !== undefined && (!Array.isArray(e.issues) || e.issues.some(issue => {
    if (issue == null || typeof issue !== 'object' || Array.isArray(issue)) return true
    const i = issue as Record<string, unknown>
    return Object.keys(i).some(key => !['code', 'message', 'item', 'field', 'line'].includes(key)) || !text(i.code) || !text(i.message) || ['item', 'field'].some(key => i[key] !== undefined && !text(i[key])) || (i.line !== undefined && (!Number.isInteger(i.line) || Number(i.line) < 1))
  }))) throw new Error('Invalid event issues')
  if (['validation_failed', 'execution_failed', 'retry_scheduled', 'stage_stopped', 'run_failed', 'run_cancelled'].includes(e.event as string) && !text(e.reason) && !(Array.isArray(e.issues) && e.issues.length)) throw new Error('Failure, retry, or stop events require a reason or issues')
  return e as ArtifactEventInput
}

/** Append a whole line under the same bounded locking policy as progress writers. */
export function appendArtifactEvent(run: string, event: ArtifactEventInput): void {
  validateArtifactEvent(event)
  readRunManifest(run)
  const lock = join(run, '.events.lock')
  const deadline = Date.now() + 5000
  for (;;) {
    try { mkdirSync(lock); break } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      if (Date.now() >= deadline) throw new Error('Event writer lock remains; inspect .events.lock before continuing')
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10)
    }
  }
  try { appendFileSync(join(run, 'events.jsonl'), `${JSON.stringify({ ...event, timestamp: new Date().toISOString() })}\n`) }
  finally { rmSync(lock, { recursive: true }) }
}
