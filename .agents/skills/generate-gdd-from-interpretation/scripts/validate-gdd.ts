import { readFile } from 'node:fs/promises'

/** Return whether the GDD preserves its source report and traces each design motif to interpretation items. */
export function isValidGdd(markdown: string, chartReport: string, interpretation: string): boolean {
  const normalizedReport = chartReport.trim()
  const interpretationIds = new Set(
    [...interpretation.matchAll(/^### (I-\d{2})\s*$/gm)].map(match => match[1]),
  )
  const motifs = [...markdown.matchAll(/^설계 모티프:\s*(.+)$/gm)]
  const motifsAreTraceable = motifs.length > 0 && motifs.every((match, index) => {
    const blockStart = match.index + match[0].length
    const blockEnd = motifs[index + 1]?.index ?? markdown.length
    const evidenceLine = markdown.slice(blockStart, blockEnd).match(/^해석 근거:\s*(.+)$/m)
    const citedIds = evidenceLine?.[1].match(/I-\d{2}/g) ?? []
    return citedIds.length > 0 && citedIds.every(id => interpretationIds.has(id))
  })
  return markdown.trim().length > 0
    && normalizedReport.length > 0
    && interpretation.trim().length > 0
    && markdown.includes(normalizedReport)
    && motifsAreTraceable
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
        console.error('GDD or source input is empty, the report appendix is incomplete, or a design motif lacks valid interpretation item IDs.')
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
