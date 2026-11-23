import { existsSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createAttempt, publishStep } from '../../../../scripts/artifacts/pipeline-actions'

class ChartCalculationError extends Error {}
const REQUIRED_SECTIONS = ['四柱八字', '紫微斗數 命盤', 'Natal Chart'] as const

/** Return whether calculator output contains all supported chart systems. */
export function isCompleteChartReport(report: string): boolean {
  return report.trim().length > 0 && REQUIRED_SECTIONS.every(section => report.includes(section))
}

/**
 * Run the repository calculator into the version folder's next chart attempt and publish it unchanged.
 * A failed calculation leaves result.md with execution-failed; raw calculator output is not written to files.
 */
export async function runChartReport(repositoryRoot: string, versionDir: string, chartArguments: string[]): Promise<string> {
  const root = resolve(repositoryRoot), dir = resolve(versionDir)
  if (!existsSync(join(dir, 'run.md'))) throw new Error('Version folder must be allocated with run.md')
  const attempt = createAttempt(dir, 'chart-report')
  const child = Bun.spawn(['bun', join(root, 'scripts/chart-report.ts'), ...chartArguments], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
  const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  if (exitCode !== 0 || !isCompleteChartReport(stdout)) {
    writeFileSync(join(dir, attempt.attempt, 'result.md'), '상태: execution-failed\n\n## 오류\n- chart-calculation-failed: Chart calculation or evidence validation failed.\n', { flag: 'wx' })
    throw new ChartCalculationError(exitCode !== 0 ? stderr.trim() || 'Chart calculator failed' : 'Chart calculator returned incomplete output')
  }
  writeFileSync(join(dir, attempt.candidate), stdout, { flag: 'wx' })
  return join(dir, publishStep(dir, 'chart-report').output)
}

if (import.meta.main) {
  const separator = process.argv.indexOf('--', 2)
  const repositoryRoot = process.argv[2]
  const versionDir = process.argv[3]
  if (repositoryRoot == null || versionDir == null || separator !== 4) {
    console.error('Usage: bun run-chart-report.ts <repository-root> <version-dir> -- <chart flags>')
    process.exitCode = 2
  } else {
    try {
      console.log(await runChartReport(repositoryRoot, versionDir, process.argv.slice(separator + 1)))
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      if (error instanceof AggregateError) {
        for (const cause of error.errors) console.error(cause instanceof Error ? cause.message : String(cause))
      }
      process.exitCode = 1
    }
  }
}
