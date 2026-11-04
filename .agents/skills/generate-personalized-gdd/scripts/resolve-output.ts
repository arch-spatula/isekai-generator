import { join } from 'node:path'
import { allocateRun, parseRunOptions, type RunOptions } from '../../../../scripts/artifacts/artifact-run'

/** Reserve a new run in the active series before returning its output path. */
export function resolveOutput(repositoryRoot: string, options: RunOptions = {}): string {
  return join(allocateRun(repositoryRoot, 'personalized-gdd', options), 'docs', 'GDD', 'personalized-action-rpg-concept.md')
}

if (import.meta.main) {
  try {
    const [root, ...args] = process.argv.slice(2)
    if (!root) throw new Error('Usage: bun resolve-output.ts <repository-root> [--purpose <purpose>] [--mode <mode>]')
    console.log(resolveOutput(root, parseRunOptions(args)))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
