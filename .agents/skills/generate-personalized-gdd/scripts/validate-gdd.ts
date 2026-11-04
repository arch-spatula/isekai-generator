import { readFile } from 'node:fs/promises'

import { isValidGdd } from '../../generate-gdd-from-interpretation/scripts/validate-gdd'

export { isValidGdd }

if (import.meta.main) {
  const [gddPath, chartReportPath, interpretationPath, conceptBriefPath, worldBriefPath] = process.argv.slice(2)
  if (gddPath == null || chartReportPath == null || interpretationPath == null || conceptBriefPath == null || worldBriefPath == null) {
    console.error('Usage: bun validate-gdd.ts <gdd.md> <chart-report.md> <chart-interpretation.md> <gameplay-concept-brief.md> <world-concept-brief.md>')
    process.exitCode = 2
  } else {
    try {
      const [gdd, chartReport, interpretation, conceptBrief, worldBrief] = await Promise.all([
        readFile(gddPath, 'utf8'),
        readFile(chartReportPath, 'utf8'),
        readFile(interpretationPath, 'utf8'),
        readFile(conceptBriefPath, 'utf8'),
        readFile(worldBriefPath, 'utf8'),
      ])
      if (!isValidGdd(gdd, chartReport, interpretation, conceptBrief, worldBrief)) {
        console.error('Invalid GDD: empty or embedded sources, untraceable motifs, combat fingerprint mismatch, or missing/mismatched world structure.')
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
