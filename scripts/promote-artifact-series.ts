import { readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { readSeriesConfig, repositoryDocument, repositoryState, validateSeriesConfig, writeJsonAtomic } from './artifacts/artifact-run'

export function promoteArtifactSeries(repositoryRoot: string, nextSeries: string, decision: string, knownIssues: string[] = []): void {
  const root = resolve(repositoryRoot)
  const current = readSeriesConfig(root)
  const state = repositoryState(root)
  if (state.dirty) throw new Error('Promotion requires a clean working tree')
  if (nextSeries !== `0.${Number(current.activeSeries.split('.')[1]) + 1}`) throw new Error('Promotion requires exactly the next minor in the same major')
  repositoryDocument(root, decision)
  knownIssues.forEach(path => repositoryDocument(root, path))
  let entries
  try { entries = readdirSync(join(root, 'artifacts'), { withFileTypes: true }) } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    entries = []
  }
  if (entries.some(entry => entry.isDirectory() && entry.name.startsWith(`v${nextSeries}.`) && /^v0\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(entry.name))) throw new Error('Target series already has artifacts')
  const updated = validateSeriesConfig({ schemaVersion: 1, activeSeries: nextSeries, baselineRevision: state.revision, promotedAt: new Date().toISOString(), decision, knownIssues })
  writeJsonAtomic(join(root, '.agents', 'artifact-series.json'), updated)
}

if (import.meta.main) {
  try {
    const [root, nextSeries, decision, ...knownIssues] = process.argv.slice(2)
    if (!root || !nextSeries || !decision) throw new Error('Usage: bun promote-artifact-series.ts <repository-root> <next-series> <decision-path> [known-issue-path ...]')
    promoteArtifactSeries(root, nextSeries, decision, knownIssues)
    console.log(`Promoted artifact series to ${nextSeries}; commit the configuration before allocating a run.`)
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1 }
}
