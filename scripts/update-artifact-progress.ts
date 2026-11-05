import { readRunManifest } from './artifacts/artifact-run'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { recordStageProgress, refreshProgress, type ProgressStage } from './artifacts/artifact-progress'

if (import.meta.main) {
  try {
    const [action, run, stage, agentId, ...extra] = process.argv.slice(2)
    if (!run || extra.length || (action === 'sync' ? stage != null : !['start', 'done', 'fail'].includes(action) || !stage || (action !== 'start' && agentId != null))) {
      throw new Error('Usage: bun scripts/update-artifact-progress.ts <sync|start|done|fail> <run-directory> [stage] [agent-id for start]')
    }
    const manifest = readRunManifest(run)
    if (!existsSync(join(run, 'TODO.md'))) throw new Error('Run has no TODO.md; do not backfill existing versions automatically')
    if (action === 'sync') refreshProgress(run, manifest)
    else recordStageProgress(run, manifest, stage as ProgressStage, action === 'start' ? 'running' : action === 'done' ? 'succeeded' : 'failed', agentId ? { agentId } : {})
    console.log(`${manifest.artifactVersion}: TODO.md updated`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
