import { readFile } from 'node:fs/promises'

import { AXIS_KEYS } from '../../select-gameplay-concept/scripts/fingerprint-registry'
import { parseFinalFingerprint } from '../../select-gameplay-concept/scripts/validate-concept-brief'

/** Return whether the GDD stays separate from its source report and traces each design motif to interpretation items. */
export function isValidGdd(markdown: string, chartReport: string, interpretation: string, conceptBrief: string): boolean {
  const normalizedReport = chartReport.trim()
  const normalizedBrief = conceptBrief.trim()
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
  const expectedFingerprint = parseFinalFingerprint(conceptBrief)
  const fingerprintBlocks = [...markdown.matchAll(/^```combat-fingerprint\s*\n([\s\S]*?)\n```\s*$/gm)]
  let fingerprintMatches = false
  if (expectedFingerprint != null && fingerprintBlocks.length === 1) {
    try {
      const parsed: unknown = JSON.parse(fingerprintBlocks[0][1])
      fingerprintMatches = typeof parsed === 'object'
        && parsed != null
        && !Array.isArray(parsed)
        && Object.keys(parsed).length === AXIS_KEYS.length
        && AXIS_KEYS.every(key => (parsed as Record<string, unknown>)[key] === expectedFingerprint[key])
    } catch {
      fingerprintMatches = false
    }
  }
  return markdown.trim().length > 0
    && normalizedReport.length > 0
    && interpretation.trim().length > 0
    && normalizedBrief.length > 0
    && !markdown.includes(normalizedReport)
    && !markdown.includes(normalizedBrief)
    && motifsAreTraceable
    && fingerprintMatches
}

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
