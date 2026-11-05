import { execFileSync } from 'node:child_process'
import { lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { initializeProgress, refreshProgress } from './artifact-progress'

export const PURPOSES = ['experiment', 'regression', 'new-profile', 'incident-reproduction', 'release-candidate'] as const
export const MODES = ['light', 'deep'] as const
export const KINDS = ['chart-report', 'personalized-gdd'] as const
export const STATUSES = ['allocated', 'running', 'succeeded', 'failed', 'cancelled'] as const
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
  const manifest = validateRunManifest(JSON.parse(readFileSync(join(runDirectory, 'artifact-run.json'), 'utf8')))
  requireCondition(resolve(runDirectory).endsWith(`/artifacts/${manifest.artifactVersion}`), 'Manifest does not match its run directory')
  return manifest
}

/** Directory creation reserves a patch even if the process dies before writing JSON. */
export function allocateRun(repositoryRoot: string, artifactKind: RunManifest['artifactKind'], options: RunOptions = {}): string {
  const root = resolve(repositoryRoot)
  const config = readSeriesConfig(root)
  const state = repositoryState(root)
  const purpose = options.purpose ?? 'experiment'
  const mode = options.mode ?? 'light'
  requireCondition(Object.keys(object(options)).every(key => ['purpose', 'mode'].includes(key)), 'Unexpected allocation option')
  requireCondition(PURPOSES.includes(purpose) && MODES.includes(mode) && KINDS.includes(artifactKind), 'Invalid allocation options')
  requireCondition(purpose !== 'release-candidate' || !state.dirty, 'release-candidate requires a clean working tree')
  const artifacts = join(root, 'artifacts')
  mkdirSync(artifacts, { recursive: true })
  for (;;) {
    let max = -1
    for (const entry of readdirSync(artifacts, { withFileTypes: true })) {
      const match = VERSION.exec(entry.name)
      if (entry.isDirectory() && match?.[1] === config.activeSeries) {
        const patch = Number(match[2])
        requireCondition(Number.isSafeInteger(patch), 'Artifact patch exceeds safe integer range')
        max = Math.max(max, patch)
      }
    }
    const patch = max + 1
    requireCondition(Number.isSafeInteger(patch), 'Artifact patch exceeds safe integer range')
    const artifactVersion = `v${config.activeSeries}.${patch}`
    const directory = join(artifacts, artifactVersion)
    try { mkdirSync(directory) } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST' && lstatSync(directory).isDirectory()) continue
      throw error
    }
    const manifest = validateRunManifest({ schemaVersion: 1, artifactVersion, series: config.activeSeries, artifactKind, purpose, mode, baselineRevision: config.baselineRevision, sourceRevision: state.revision, workingTreeDirty: state.dirty, status: 'allocated', allocatedAt: new Date().toISOString(), startedAt: null, finishedAt: null, failure: null })
    writeFileSync(join(directory, 'artifact-run.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' })
    initializeProgress(directory, manifest)
    return directory
  }
}

export function updateRun(runDirectory: string, status: RunStatus, failure: RunManifest['failure'] = null): RunManifest {
  const current = readRunManifest(runDirectory)
  const allowed: Record<RunStatus, RunStatus[]> = { allocated: ['running', 'failed', 'cancelled'], running: ['succeeded', 'failed', 'cancelled'], succeeded: [], failed: [], cancelled: [] }
  requireCondition(allowed[current.status].includes(status), `Invalid run transition: ${current.status} -> ${status}`)
  const now = new Date().toISOString()
  const updated = validateRunManifest({ ...current, status, startedAt: status === 'running' ? now : current.startedAt, finishedAt: status === 'running' ? null : now, failure })
  writeJsonAtomic(join(runDirectory, 'artifact-run.json'), updated)
  refreshProgress(runDirectory, updated)
  return updated
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
