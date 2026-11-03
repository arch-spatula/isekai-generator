import { readFile } from 'node:fs/promises'

/** Return whether the GDD preserves its source report and cites the interpretation handoff. */
export function isValidGdd(markdown: string, chartReport: string, interpretation: string): boolean {
  const normalizedReport = chartReport.trim()
  const citedMotifs = [...markdown.matchAll(/^해석 모티프:\s*(.+)$/gm)]
    .map(match => match[1].trim())
    .filter(motif => motif.length > 0)
  return markdown.trim().length > 0
    && normalizedReport.length > 0
    && interpretation.trim().length > 0
    && markdown.includes(normalizedReport)
    && citedMotifs.length > 0
    && citedMotifs.every(motif => interpretation.includes(motif))
}

if (import.meta.main) {
  const [gddPath, chartReportPath, interpretationPath] = process.argv.slice(2)
  if (gddPath == null || chartReportPath == null || interpretationPath == null) {
    console.error('Usage: bun validate-gdd.ts <gdd.md> <chart-report.md> <chart-interpretation.md>')
    process.exitCode = 2
  } else {
    try {
      const [gdd, chartReport, interpretation] = await Promise.all([
        readFile(gddPath, 'utf8'),
        readFile(chartReportPath, 'utf8'),
        readFile(interpretationPath, 'utf8'),
      ])
      if (!isValidGdd(gdd, chartReport, interpretation)) {
        console.error('GDD or source input is empty, the report appendix is incomplete, or no interpretation motif is traceable.')
        process.exitCode = 1
      } else {
        console.log('Validated interpretation-driven GDD with complete chart report.')
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    }
  }
}
