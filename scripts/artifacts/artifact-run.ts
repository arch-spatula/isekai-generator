import { execFileSync } from 'node:child_process'
import { readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

export const PURPOSES = ['experiment', 'regression', 'new-profile', 'incident-reproduction', 'release-candidate'] as const
export const MODES = ['light', 'deep'] as const
export const KINDS = ['chart-report', 'personalized-gdd'] as const
export type SeriesConfig = {
  schemaVersion: 1; activeSeries: string; baselineRevision: string; promotedAt: string
  decision: string; knownIssues: string[]
}
const SERIES = /^0\.(0|[1-9]\d*)$/
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
