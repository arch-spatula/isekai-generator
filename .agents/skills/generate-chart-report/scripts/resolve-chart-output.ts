import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)$/

type Version = [major: number, minor: number, patch: number]

/** Parse a semantic artifact version. */
function parseVersion(value: string): Version | null {
  const match = VERSION_PATTERN.exec(value)
  if (match == null) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

/** Resolve a new standalone chart-report path without reading artifact content. */
export function resolveChartOutput(repositoryRoot: string, requestedVersion?: string): string {
  const artifactsRoot = join(resolve(repositoryRoot), 'artifacts')
  let version: Version

  if (requestedVersion != null) {
    const parsed = parseVersion(requestedVersion)
    if (parsed == null) throw new Error(`Invalid semantic version: ${requestedVersion}`)
    version = parsed
  } else {
    const existing = existsSync(artifactsRoot)
      ? readdirSync(artifactsRoot, { withFileTypes: true })
          .filter(entry => entry.isDirectory())
          .map(entry => parseVersion(entry.name))
          .filter((entry): entry is Version => entry != null)
          .sort((left, right) => left[0] - right[0] || left[1] - right[1] || left[2] - right[2])
      : []
    const latest = existing.at(-1)
    version = latest == null ? [0, 1, 0] : [latest[0], latest[1], latest[2] + 1]
  }

  const versionDirectory = join(artifactsRoot, `v${version.join('.')}`)
  if (existsSync(versionDirectory)) throw new Error(`Artifact version already exists: v${version.join('.')}`)
  return join(versionDirectory, 'docs', 'GDD', 'chart-report.md')
}

if (import.meta.main) {
  const [repositoryRoot, requestedVersion] = process.argv.slice(2)
  if (repositoryRoot == null) {
    console.error('Usage: bun resolve-chart-output.ts <repository-root> [version]')
    process.exitCode = 1
  } else {
    try {
      console.log(resolveChartOutput(repositoryRoot, requestedVersion))
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    }
  }
}
