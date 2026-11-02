import { describe, expect, test } from 'bun:test'

import { findInvalidSections } from './validate-gdd'

const SECTIONS = [
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

function makeGdd(emptySection?: string): string {
  return SECTIONS
    .map(section => `## ${section}\n\n${section === emptySection ? '' : `Content for ${section}`}\n`)
    .join('\n')
}

describe('findInvalidSections', () => {
  test('accepts a document with all 22 populated sections', () => {
    expect(findInvalidSections(makeGdd())).toEqual([])
  })

  test('reports an empty required section', () => {
    expect(findInvalidSections(makeGdd('XIV. Relationships'))).toContain('XIV. Relationships')
  })

  test('reports a missing required section', () => {
    const markdown = makeGdd().replace(/## VIII\. World\n\nContent for VIII\. World\n\n/, '')
    expect(findInvalidSections(markdown)).toContain('VIII. World')
  })
})
