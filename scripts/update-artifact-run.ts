import { STATUSES, updateRun, type RunStatus } from './artifacts/artifact-run'

if (import.meta.main) {
  try {
    const [directory, status, stage, summary, ...extra] = process.argv.slice(2)
    if (!directory || !STATUSES.includes(status as RunStatus) || (status === 'failed' ? !stage || !summary || extra.length > 0 : stage != null)) throw new Error('Usage: bun update-artifact-run.ts <run-directory> <running|succeeded|failed|cancelled> [failure-stage failure-summary]')
    const manifest = updateRun(directory, status as RunStatus, status === 'failed' ? { stage, summary } : null)
    console.log(`${manifest.artifactVersion}: ${manifest.status}`)
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1 }
}
