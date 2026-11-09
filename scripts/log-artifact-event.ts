import { appendArtifactEvent, validateArtifactEvent } from './artifacts/artifact-events'
import { readRunManifest } from './artifacts/artifact-run'

if (import.meta.main) {
  try {
    const [run, json, ...extra] = process.argv.slice(2)
    if (!run || !json || extra.length) throw new Error('Usage: bun scripts/log-artifact-event.ts <run> <JSON-event>')
    if (readRunManifest(run).status !== 'running') throw new Error('Events require a running run')
    appendArtifactEvent(run, validateArtifactEvent(JSON.parse(json)))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
