import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { failRun, readRunManifest, updateRun } from '../../../../scripts/artifacts/artifact-run'

import { appendArtifactEvent } from '../../../../scripts/artifacts/artifact-events'
import { recordStageProgress } from '../../../../scripts/artifacts/artifact-progress'

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
    recordStageProgress(runDirectory, readRunManifest(runDirectory), 'chart-report', 'running')
    await calculateChartReport(root, outputPath, chartArguments, runDirectory)
    appendArtifactEvent(runDirectory, { event: 'validation_succeeded', stage: 'chart-report', operation: 'chart-calculation-and-evidence' })
    recordStageProgress(runDirectory, readRunManifest(runDirectory), 'chart-report', 'succeeded')
    if (standalone) updateRun(runDirectory, 'succeeded')
  } catch (error) {
    try { recordStageProgress(runDirectory, readRunManifest(runDirectory), 'chart-report', 'failed') } catch (progressError) {
      const combined = new AggregateError([error, progressError], 'Chart failed; recording progress also failed')
      if (standalone) failRun(runDirectory, 'chart-report', 'Chart calculation or progress recording failed.', combined)
      throw combined
    }
    if (standalone) failRun(runDirectory, 'chart-report', 'Chart calculation or evidence validation failed.', error)
    throw error
  }
}

async function calculateChartReport(root: string, outputPath: string, chartArguments: string[], run: string): Promise<void> {
  let classified = false
  let phase = 'calculator-spawn'
  const recordFailure = (error: unknown, code: string, message: string, exitCode?: number, field?: string): never => {
    classified = true
    try { appendArtifactEvent(run, { event: ['chart-execution', 'calculator-exit'].includes(code) ? 'execution_failed' : 'validation_failed', stage: 'chart-report', operation: 'chart-calculation-and-evidence', issues: [{ code, message, ...(field ? { field } : {}) }], ...(exitCode == null ? {} : { exitCode }) }) }
    catch (loggingError) { throw new AggregateError([error, loggingError], 'Chart failed; recording diagnostic also failed') }
    throw error
  }
  try {
    const processResult = Bun.spawn(
      ['bun', join(root, 'scripts', 'chart-report.ts'), ...chartArguments],
      { cwd: root, stdout: 'pipe', stderr: 'pipe' },
    )
    const [exitCode, stdout, stderr] = await Promise.all([
      processResult.exited,
      new Response(processResult.stdout).text(),
      new Response(processResult.stderr).text(),
    ])
    if (exitCode !== 0) {
      const firstLine = stderr.trim().split('\n')[0]
      const known = /^(?:Missing required option: --(year|month|day|hour|minute|gender|latitude|longitude|timezone)|--(year|month|day|hour|minute|latitude|longitude|flow-year) must be a number|--(gender) must be M or F|--(jasi-method) must be unified or split)$/.exec(firstLine)
      recordFailure(new Error(stderr.trim() || `Chart calculator exited with code ${exitCode}`), 'calculator-exit', known ? firstLine : `Chart calculator exited with code ${exitCode}; raw diagnostics withheld or unavailable.`, exitCode, known?.slice(1).find(Boolean))
    }
    if (!isCompleteChartReport(stdout)) recordFailure(new Error('Chart report is empty or missing a supported chart section.'), 'chart-sections', `Missing chart systems: ${REQUIRED_SECTIONS.filter(section => !stdout.includes(section)).join(', ')}`)

    phase = 'chart-report-publication'
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, stdout, { encoding: 'utf8', flag: 'wx' })
    phase = 'evidence-validation'
    let evidence
    try { evidence = buildEvidenceManifest(stdout) } catch (error) { recordFailure(error, 'chart-evidence', 'Calculated chart evidence failed structural validation.') }
    phase = 'evidence-publication'
    await writeFile(
      join(dirname(outputPath), 'chart-evidence.json'),
      `${JSON.stringify(evidence, null, 2)}\n`,
      { encoding: 'utf8', flag: 'wx' },
    )
  } catch (error) {
    // Already classified failures retain their diagnostic; infrastructure errors get a safe category.
    if (classified) throw error
    const systemCode = (error as NodeJS.ErrnoException)?.code
    recordFailure(error, 'chart-execution', `${phase} failed${typeof systemCode === 'string' && /^[A-Z][A-Z0-9_]+$/.test(systemCode) ? ` (${systemCode})` : '; safe system diagnostic unavailable'}.`)
  }
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
