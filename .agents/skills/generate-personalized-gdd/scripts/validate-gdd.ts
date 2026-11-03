import { readFile } from 'node:fs/promises'

import { isValidGdd } from '../../generate-gdd-from-interpretation/scripts/validate-gdd'

export { isValidGdd }

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
