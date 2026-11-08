import { readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { hasGamePresentation, readGamePresentationContract } from '../../../../scripts/game-presentation'

import { AXIS_KEYS } from '../../select-gameplay-concept/scripts/fingerprint-registry'
import { parseFinalFingerprint, parseSelectedCandidateId } from '../../select-gameplay-concept/scripts/validate-concept-brief'
import { jsonBlock, parseWorldBrief, record, selectedWorld, WORLD_KEYS } from '../../select-world-concept/scripts/world-contract'

/** Read headings outside fenced code; keep section bodies for the nonempty check. */
function templateSections(markdown: string): { level: number; title: string; body: string }[] {
  const sections: { level: number; title: string; body: string }[] = []
  let fence: { marker: string; length: number } | undefined
  for (const line of markdown.replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/)) {
    const delimiter = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/)
    if (fence) {
      if (delimiter && delimiter[1][0] === fence.marker && delimiter[1].length >= fence.length && delimiter[2].trim() === '') fence = undefined
      else if (sections.length > 0 && line.trim()) sections[sections.length - 1].body += line + '\n'
      continue
    }
    if (delimiter) {
      fence = { marker: delimiter[1][0], length: delimiter[1].length }
      continue
    }
    const heading = line.match(/^ {0,3}(#{1,6})(?:[ \t]+(.*)|$)/)
    if (heading && heading[1].length <= 2) {
      sections.push({ level: heading[1].length, title: (heading[2] ?? '').replace(/[ \t]+#+[ \t]*$/, '').trim(), body: '' })
    } else if (!heading && sections.length > 0) sections[sections.length - 1].body += line + '\n'
  }
  return sections
}

/** Validate the output skeleton against the repository template, independently of cwd. */
export function hasGddTemplateStructure(markdown: string): boolean {
  try {
    const template = readFileSync(new URL('../../../../docs/prompts/personalized-action-rpg-concept.md', import.meta.url), 'utf8')
    const start = '<!-- gdd-template:start -->'
    const end = '<!-- gdd-template:end -->'
    if (template.split(start).length !== 2 || template.split(end).length !== 2) return false
    const startIndex = template.indexOf(start) + start.length
    const endIndex = template.indexOf(end)
    if (endIndex <= startIndex) return false
    const expected = templateSections(template.slice(startIndex, endIndex))
    if (expected.length < 2 || expected[0].level !== 1 || !expected[0].title
      || expected.slice(1).some(section => section.level !== 2 || !section.title)
      || new Set(expected.map(section => section.title)).size !== expected.length) return false
    const actual = templateSections(markdown)
    return actual.length === expected.length && actual.every((section, index) =>
      section.level === expected[index].level && section.title === expected[index].title
      && (index === 0 || section.body.trim().length > 0))
  } catch { return false }
}

/** Validate declared playable world structure, not the presence of maritime words. */
export function matchesWorldStructure(markdown: string, worldBrief: string): boolean {
  try {
    const expected = selectedWorld(parseWorldBrief(worldBrief)).fingerprint
    const structure = record(jsonBlock(markdown, 'world-structure'), WORLD_KEYS, 'GDD world structure')
    return WORLD_KEYS.every(key => {
      const axis = record(structure[key], ['value', 'manifestation'], `GDD ${key}`)
      return axis.value === expected[key] && typeof axis.manifestation === 'string' && axis.manifestation.trim().length > 0
    })
  } catch { return false }
}

/** Return whether the GDD stays separate from its source report and traces each design motif to interpretation items. */
export function isValidGdd(markdown: string, chartReport: string, interpretation: string, conceptBrief: string, worldBrief: string): boolean {
  const normalizedReport = chartReport.trim()
  const normalizedBrief = conceptBrief.trim()
  let worldCombatMatches = false
  try {
    worldCombatMatches = parseWorldBrief(worldBrief).combatCandidateId === parseSelectedCandidateId(conceptBrief)
  } catch { worldCombatMatches = false }
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
  return hasGddTemplateStructure(markdown)
    && markdown.trim().length > 0
    && [markdown, conceptBrief, worldBrief].every(hasGamePresentation)
    && normalizedReport.length > 0
    && interpretation.trim().length > 0
    && normalizedBrief.length > 0
    && !markdown.includes(normalizedReport)
    && !markdown.includes(normalizedBrief)
    && motifsAreTraceable
    && fingerprintMatches
    && worldCombatMatches
    && typeof worldBrief === 'string'
    && worldBrief.trim().length > 0
    && !markdown.includes(worldBrief.trim())
    && matchesWorldStructure(markdown, worldBrief)
}

if (import.meta.main) {
  const [gddPath, chartReportPath, interpretationPath, conceptBriefPath, worldBriefPath, presentationPath, ...extra] = process.argv.slice(2)
  if (gddPath == null || chartReportPath == null || interpretationPath == null || conceptBriefPath == null || worldBriefPath == null || presentationPath == null || extra.length > 0) {
    console.error('Usage: bun validate-gdd.ts <gdd.md> <chart-report.md> <chart-interpretation.md> <gameplay-concept-brief.md> <world-concept-brief.md> <game-presentation-contract.md>')
    process.exitCode = 2
  } else {
    try {
      readGamePresentationContract(presentationPath)
      const [gdd, chartReport, interpretation, conceptBrief, worldBrief] = await Promise.all([
        readFile(gddPath, 'utf8'),
        readFile(chartReportPath, 'utf8'),
        readFile(interpretationPath, 'utf8'),
        readFile(conceptBriefPath, 'utf8'),
        readFile(worldBriefPath, 'utf8'),
      ])
      if (!isValidGdd(gdd, chartReport, interpretation, conceptBrief, worldBrief)) {
        console.error('Invalid GDD: output template structure mismatch, game presentation mismatch, empty or embedded sources, untraceable motifs, combat fingerprint mismatch, or missing/mismatched world structure.')
        process.exitCode = 1
      } else {
        console.log('Validated GDD declarations and evidence; prose consistency requires semantic review.')
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    }
  }
}
