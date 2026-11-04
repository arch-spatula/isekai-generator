import { readFile } from 'node:fs/promises'

import { isValidGdd } from '../../generate-gdd-from-interpretation/scripts/validate-gdd'

export { isValidGdd }

if (import.meta.main) {
  const [gddPath, chartReportPath, interpretationPath, conceptBriefPath] = process.argv.slice(2)
  if (gddPath == null || chartReportPath == null || interpretationPath == null || conceptBriefPath == null) {
    console.error('Usage: bun validate-gdd.ts <gdd.md> <chart-report.md> <chart-interpretation.md> <gameplay-concept-brief.md>')
    process.exitCode = 2
  } else {
    try {
      const [gdd, chartReport, interpretation, conceptBrief] = await Promise.all([
        readFile(gddPath, 'utf8'),
        readFile(chartReportPath, 'utf8'),
        readFile(interpretationPath, 'utf8'),
        readFile(conceptBriefPath, 'utf8'),
      ])
      if (!isValidGdd(gdd, chartReport, interpretation, conceptBrief)) {
        console.error('GDD or source input is empty, source content is embedded, a motif lacks valid interpretation IDs, or the combat fingerprint differs from the selected concept.')
        process.exitCode = 1
      } else {
        console.log('Validated interpretation-driven GDD with separate source report.')
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    }
  }
}
