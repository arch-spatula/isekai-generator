import { readFile } from 'node:fs/promises'

const REQUIRED_SECTIONS = [
  'I. Astrology Analysis',
  'II. Core Fantasy',
  'III. Character Concept',
  'IV. Birth & Early Life',
  'V. Life Fantasy',
  'VI. Appearance',
  'VII. Personality & Life Conflict',
  'VIII. World',
  'IX. Power Expression Architecture',
  'X. Gameplay Identity',
  'XI. Growth & Build',
  'XII. Starting → Mythic Fantasy',
  'XIII. Adventure',
  'XIV. Relationships',
  'XV. Factions & Society',
  'XVI. Story',
  'XVII. Chapter Progression',
  'XVIII. Passage of Time',
  'XIX. Progression Table',
  'XX. Branching Routes',
  'XXI. Potential Endings',
  'XXII. Final Character Summary',
] as const

/** Escape text for use in a regular expression. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Return required sections that are absent or have no content. */
export function findInvalidSections(markdown: string): string[] {
  const invalid: string[] = []

  for (let index = 0; index < REQUIRED_SECTIONS.length; index += 1) {
    const section = REQUIRED_SECTIONS[index]
    const nextSection = REQUIRED_SECTIONS[index + 1]
    const end = nextSection == null
      ? '(?=\\n##?\\s|$)'
      : `(?=^##\\s+${escapeRegExp(nextSection)}\\s*$)`
    const pattern = new RegExp(
      `^##\\s+${escapeRegExp(section)}\\s*$\\n([\\s\\S]*?)${end}`,
      'm',
    )
    const match = markdown.match(pattern)

    if (match == null || match[1].trim() === '') invalid.push(section)
  }

  return invalid
}

if (import.meta.main) {
  const path = process.argv[2]
  if (path == null) {
    console.error('Usage: bun validate-gdd.ts <gdd.md>')
    process.exitCode = 2
  } else {
    try {
      const invalid = findInvalidSections(await readFile(path, 'utf8'))
      if (invalid.length > 0) {
        console.error(`Missing or empty sections:\n${invalid.map(section => `- ${section}`).join('\n')}`)
        process.exitCode = 1
      } else {
        console.log(`Validated ${REQUIRED_SECTIONS.length} GDD sections.`)
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    }
  }
}
