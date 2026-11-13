import { execFileSync } from 'node:child_process'
import { readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { ArtifactState, StateError } from './artifact-state-store'

export const PURPOSES = ['experiment', 'regression', 'new-profile', 'incident-reproduction', 'release-candidate'] as const
export const MODES = ['light', 'deep'] as const
export const KINDS = ['chart-report', 'personalized-gdd'] as const
export const STATUSES = ['allocated', 'running', 'blocked', 'succeeded', 'failed', 'cancelled'] as const
export type RunStatus = typeof STATUSES[number]
export type RunOptions = { purpose?: typeof PURPOSES[number]; mode?: typeof MODES[number] }
export type SeriesConfig = {
  schemaVersion: 1; activeSeries: string; baselineRevision: string; promotedAt: string
  decision: string; knownIssues: string[]
}
export type RunManifest = {
  schemaVersion: 1; artifactVersion: string; series: string
  artifactKind: typeof KINDS[number]; purpose: typeof PURPOSES[number]; mode: typeof MODES[number]
  baselineRevision: string; sourceRevision: string; workingTreeDirty: boolean; status: RunStatus
  allocatedAt: string; startedAt: string | null; finishedAt: string | null
  failure: { stage: string; summary: string } | null
}
const SERIES = /^0\.(0|[1-9]\d*)$/
const VERSION = /^v(0\.(?:0|[1-9]\d*))\.(0|[1-9]\d*)$/
const HASH = /^[0-9a-f]{40}$/

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function object(value: unknown): Record<string, unknown> {
  requireCondition(value != null && typeof value === 'object' && !Array.isArray(value), 'Expected an object')
  return value as Record<string, unknown>
}

function exactKeys(value: Record<string, unknown>, keys: string[]): void {
  requireCondition(Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)), 'Unexpected or missing fields')
}

function iso(value: unknown): boolean {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
}

function series(value: unknown): value is string {
  return typeof value === 'string' && SERIES.test(value) && Number.isSafeInteger(Number(value.split('.')[1]))
}

export function validateSeriesConfig(value: unknown): SeriesConfig {
  const c = object(value)
  exactKeys(c, ['schemaVersion', 'activeSeries', 'baselineRevision', 'promotedAt', 'decision', 'knownIssues'])
  requireCondition(c.schemaVersion === 1 && series(c.activeSeries), 'Invalid artifact series configuration')
  requireCondition(typeof c.baselineRevision === 'string' && HASH.test(c.baselineRevision), 'Invalid baselineRevision')
  requireCondition(iso(c.promotedAt), 'Invalid promotedAt')
  requireCondition(typeof c.decision === 'string' && c.decision.length > 0, 'Invalid decision')
  requireCondition(Array.isArray(c.knownIssues) && c.knownIssues.every(p => typeof p === 'string' && p.length > 0), 'Invalid knownIssues')
  return c as SeriesConfig
}

export function validateRunManifest(value: unknown): RunManifest {
  const m = object(value)
  exactKeys(m, ['schemaVersion', 'artifactVersion', 'series', 'artifactKind', 'purpose', 'mode', 'baselineRevision', 'sourceRevision', 'workingTreeDirty', 'status', 'allocatedAt', 'startedAt', 'finishedAt', 'failure'])
  const version = typeof m.artifactVersion === 'string' ? VERSION.exec(m.artifactVersion) : null
  requireCondition(m.schemaVersion === 1 && series(m.series) && version?.[1] === m.series && Number.isSafeInteger(Number(version?.[2])), 'Invalid artifact version or series')
  requireCondition(KINDS.includes(m.artifactKind as never) && PURPOSES.includes(m.purpose as never) && MODES.includes(m.mode as never) && STATUSES.includes(m.status as never), 'Invalid run enumeration')
  requireCondition(typeof m.baselineRevision === 'string' && HASH.test(m.baselineRevision) && typeof m.sourceRevision === 'string' && HASH.test(m.sourceRevision), 'Invalid run revision')
  requireCondition(typeof m.workingTreeDirty === 'boolean' && !(m.purpose === 'release-candidate' && m.workingTreeDirty), 'Invalid working tree metadata')
  requireCondition(iso(m.allocatedAt) && (m.startedAt === null || iso(m.startedAt)) && (m.finishedAt === null || iso(m.finishedAt)), 'Invalid run timestamps')
  const terminal = ['succeeded', 'failed', 'cancelled'].includes(m.status as string)
  requireCondition(terminal === (m.finishedAt !== null), 'Terminal status requires finishedAt')
  requireCondition(m.status !== 'allocated' || m.startedAt === null, 'Allocated run cannot have startedAt')
  requireCondition(!['running', 'succeeded'].includes(m.status as string) || m.startedAt !== null, 'Started run requires startedAt')
  requireCondition((m.startedAt === null || String(m.startedAt) >= String(m.allocatedAt)) && (m.finishedAt === null || String(m.finishedAt) >= String(m.startedAt ?? m.allocatedAt)), 'Run timestamps are out of order')
  if (m.status === 'failed') {
    const f = object(m.failure)
    exactKeys(f, ['stage', 'summary'])
    requireCondition(typeof f.stage === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(f.stage), 'Invalid failure stage')
    requireCondition(typeof f.summary === 'string' && f.summary.trim().length > 0 && f.summary.length <= 240 && !/[\r\n]/.test(f.summary), 'Invalid failure summary')
  } else requireCondition(m.failure === null, 'Only failed runs can contain failure')
  return m as RunManifest
}

export function git(repositoryRoot: string, args: string[]): string {
  return execFileSync('git', ['-C', repositoryRoot, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

export function repositoryState(repositoryRoot: string): { revision: string; dirty: boolean } {
  requireCondition(realpathSync(git(repositoryRoot, ['rev-parse', '--show-toplevel'])) === realpathSync(repositoryRoot), 'Expected the repository root')
  const revision = git(repositoryRoot, ['rev-parse', '--verify', 'HEAD^{commit}'])
  requireCondition(HASH.test(revision), 'Expected a 40-character Git commit')
  return { revision, dirty: git(repositoryRoot, ['status', '--porcelain', '--untracked-files=all']).length > 0 }
}

export function repositoryDocument(repositoryRoot: string, path: string): void {
  requireCondition(!isAbsolute(path), 'Document must be repository-relative')
  const root = realpathSync(repositoryRoot)
  const target = realpathSync(resolve(root, path))
  const rel = relative(root, target)
  requireCondition(rel !== '' && rel !== '..' && !rel.startsWith('../') && !isAbsolute(rel) && statSync(target).isFile(), 'Document must be an existing file inside the repository')
}

export function readSeriesConfig(repositoryRoot: string): SeriesConfig {
  const config = validateSeriesConfig(JSON.parse(readFileSync(join(repositoryRoot, '.agents', 'artifact-series.json'), 'utf8')))
  git(repositoryRoot, ['cat-file', '-e', `${config.baselineRevision}^{commit}`])
  repositoryDocument(repositoryRoot, config.decision)
  config.knownIssues.forEach(path => repositoryDocument(repositoryRoot, path))
  return config
}

/** Complete a temporary file before replacing the original in the same directory. */
export function writeJsonAtomic(path: string, value: unknown): void {
  const temp = join(dirname(path), `.${randomUUID()}.tmp`)
  try {
    writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' })
    renameSync(temp, path)
  } finally {
    rmSync(temp, { force: true })
  }
}

export function readRunManifest(runDirectory: string): RunManifest {
  const root = resolve(runDirectory, '../..'), state = new ArtifactState(root, false, true)
  try { const run = state.run(runDirectory.split('/').at(-1)!); return { schemaVersion: 1, artifactVersion: run.version, series: JSON.parse(run.config).activeSeries, artifactKind: run.kind, purpose: run.purpose, mode: run.mode, baselineRevision: run.baseline_revision, sourceRevision: run.source_revision, workingTreeDirty: !!run.dirty, status: run.status, allocatedAt: run.created_at, startedAt: run.started_at, finishedAt: run.finished_at, failure: run.status === 'failed' ? { stage: run.failure_stage ?? 'generation', summary: run.reason } : null } } finally { state.close() }
}

export function allocateRun(repositoryRoot: string, artifactKind: RunManifest['artifactKind'], options: RunOptions = {}): string {
  requireCondition(Object.keys(options).every(key => ['mode','purpose'].includes(key)), 'Unexpected allocation option')
  readSeriesConfig(repositoryRoot)
  const revision = repositoryState(repositoryRoot)
  if(options.purpose === 'release-candidate' && revision.dirty) throw new StateError('dirty-release-candidate')
  const state = new ArtifactState(repositoryRoot, true)
  try { return state.allocate(artifactKind, options.mode ?? 'light', options.purpose ?? 'experiment', randomUUID()).data.directory } finally { state.close() }
}

export function updateRun(runDirectory: string, status: RunStatus, failure: RunManifest['failure'] = null): RunManifest {
  const state = new ArtifactState(resolve(runDirectory, '../..'))
  try {
    const id = runDirectory.split('/').at(-1)!, run = state.run(id)
    if (status === 'succeeded') state.finalize(id, randomUUID())
    else state.operation(randomUUID(), 'update-run', { id, status, failure }, () => {
      const allowed:Record<string,string[]>={allocated:['running','failed','cancelled'],running:['blocked','failed','cancelled'],blocked:['running','failed','cancelled']}
      requireCondition(allowed[run.status]?.includes(status), 'Invalid run transition')
      if(failure)requireCondition(/^[a-z][a-z0-9-]{0,63}$/.test(failure.stage)&&failure.summary.length<=240&&failure.summary.trim().length>0&&!/[\r\n]/.test(failure.summary),'Invalid failure')
      const started = status === 'running' ? run.started_at ?? new Date().toISOString() : run.started_at
      state.db.query('UPDATE runs SET status=?,started_at=?,finished_at=?,reason=?,failure_stage=? WHERE id=?').run(status, started, ['failed','cancelled'].includes(status) ? new Date().toISOString() : null, failure?.summary ?? null, failure?.stage ?? null, run.id)
      if(['failed','cancelled'].includes(status))state.db.query('UPDATE attempts SET claim=?,generation=generation+1 WHERE run_id=?').run(randomUUID(),run.id)
      state.event(run.id, status, 'update-run')
      return { schemaVersion: 1, outcome: status, data: { runId: run.id } }
    })
  } finally { state.close() }
  return readRunManifest(runDirectory)
}

/** Do not hide the original failure if recording the terminal state also fails. */
export function failRun(runDirectory: string, stage: string, summary: string, originalError: unknown): never {
  try { updateRun(runDirectory, 'failed', { stage, summary }) } catch (manifestError) {
    throw new AggregateError([originalError, manifestError], 'Generation failed; recording failed status also failed')
  }
  throw originalError
}

export function parseRunOptions(args: string[]): RunOptions {
  const options: RunOptions = {}
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i], value = args[i + 1]
    requireCondition((flag === '--purpose' || flag === '--mode') && value != null, 'Only --purpose <purpose> and --mode <mode> are accepted; explicit versions are not supported')
    const key = flag === '--purpose' ? 'purpose' : 'mode'
    requireCondition(!Object.hasOwn(options, key), `Duplicate option: ${flag}`)
    if (key === 'purpose') { requireCondition(PURPOSES.includes(value as never), 'Invalid purpose'); options.purpose = value as RunOptions['purpose'] }
    else { requireCondition(MODES.includes(value as never), 'Invalid mode'); options.mode = value as RunOptions['mode'] }
  }
  return options
}
