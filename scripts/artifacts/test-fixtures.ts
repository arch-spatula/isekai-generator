import { afterEach } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { git, type SeriesConfig } from './artifact-run'

const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

export function commitFixture(root: string): string {
  git(root, ['add', '.'])
  git(root, ['-c', 'user.name=Artifact Test', '-c', 'user.email=artifact@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'fixture'])
  return git(root, ['rev-parse', 'HEAD'])
}

export function makeRepository(): string {
  const root = mkdtempSync(join(tmpdir(), 'artifact-run-'))
  roots.push(root)
  git(root, ['init', '--quiet'])
  mkdirSync(join(root, '.agents'))
  writeFileSync(join(root, '.gitignore'), '/artifacts/\n')
  writeFileSync(join(root, 'decision.md'), '# Accepted baseline\n')
  writeFileSync(join(root, 'incident.md'), '# Known issue\n')
  const baselineRevision = commitFixture(root)
  const config: SeriesConfig = { schemaVersion: 1, activeSeries: '0.1', baselineRevision, promotedAt: '2026-11-04T00:00:00.000Z', decision: 'decision.md', knownIssues: ['incident.md'] }
  writeFileSync(join(root, '.agents', 'artifact-series.json'), JSON.stringify(config))
  commitFixture(root)
  return root
}
