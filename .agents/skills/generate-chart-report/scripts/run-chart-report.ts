import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { failRun, readRunManifest, updateRun } from '../../../../scripts/artifacts/artifact-run'

import { buildEvidenceManifest } from './chart-evidence'

const REQUIRED_SECTIONS = ['四柱八字', '紫微斗數 命盤', 'Natal Chart'] as const

/** Return whether calculator output contains all supported chart systems. */
export function isCompleteChartReport(report: string): boolean {
  return report.trim().length > 0 && REQUIRED_SECTIONS.every(section => report.includes(section))
}

/** Run the repository calculator and save its stdout without modification. */
export async function runChartReport(
  repositoryRoot: string,
  outputPath: string,
  chartArguments: string[],
): Promise<void> {
  const root = resolve(repositoryRoot)
  const runDirectory = resolve(dirname(outputPath), '..', '..')
  const manifest = readRunManifest(runDirectory)
  if (resolve(outputPath) !== join(root, 'artifacts', manifest.artifactVersion, 'docs', 'GDD', 'chart-report.md')) throw new Error('Chart output must belong to the reserved run')
  const standalone = manifest.artifactKind === 'chart-report'
  if (standalone) updateRun(runDirectory, 'running')
  else if (manifest.status !== 'running') throw new Error('Parent GDD run must be running before chart calculation')
  try {
    await calculateChartReport(root, outputPath, chartArguments)
    if (standalone) updateRun(runDirectory, 'succeeded')
  } catch (error) {
    if (standalone) failRun(runDirectory, 'chart-report', 'Chart calculation or evidence validation failed.', error)
    throw error
  }
}

async function calculateChartReport(root: string, outputPath: string, chartArguments: string[]): Promise<void> {
  const processResult = Bun.spawn(
    ['bun', join(root, 'scripts', 'chart-report.ts'), ...chartArguments],
    { cwd: root, stdout: 'pipe', stderr: 'pipe' },
  )
  const [exitCode, stdout, stderr] = await Promise.all([
    processResult.exited,
    new Response(processResult.stdout).text(),
    new Response(processResult.stderr).text(),
  ])
  if (exitCode !== 0) throw new Error(stderr.trim() || `Chart calculator exited with code ${exitCode}`)
  if (!isCompleteChartReport(stdout)) throw new Error('Chart report is empty or missing a supported chart section.')

  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, stdout, { encoding: 'utf8', flag: 'wx' })
  await writeFile(
    join(dirname(outputPath), 'chart-evidence.json'),
    `${JSON.stringify(buildEvidenceManifest(stdout), null, 2)}\n`,
    { encoding: 'utf8', flag: 'wx' },
  )
}

if (import.meta.main) {
  const separator = process.argv.indexOf('--', 2)
  const repositoryRoot = process.argv[2]
  const outputPath = process.argv[3]
  if (repositoryRoot == null || outputPath == null || separator !== 4) {
    console.error('Usage: bun run-chart-report.ts <repository-root> <output-path> -- <chart flags>')
    process.exitCode = 2
  } else {
    try {
      await runChartReport(repositoryRoot, outputPath, process.argv.slice(separator + 1))
      console.log(outputPath)
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      if (error instanceof AggregateError) {
        for (const cause of error.errors) console.error(cause instanceof Error ? cause.message : String(cause))
      }
      process.exitCode = 1
    }
  }
}
