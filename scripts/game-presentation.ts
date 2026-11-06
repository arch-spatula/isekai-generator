import { readFileSync } from 'node:fs'

/** Machine schema for the shared prompt; prose consistency still requires semantic review. */
export const GAME_PRESENTATION = {
  schemaVersion: 1,
  dimension: '2d',
  view: 'top-down',
  artStyle: 'pixel-art',
  productionScale: 'indie',
  settingGenre: 'otherworld-fantasy',
  gameGenre: 'action-rpg',
} as const

export function parseGamePresentation(markdown: string): typeof GAME_PRESENTATION {
  const openings = [...markdown.matchAll(/^```game-presentation[^\r\n]*$/gm)]
  const blocks = [...markdown.matchAll(/^```game-presentation[ \t]*\r?\n([\s\S]*?)\r?\n```[ \t]*$/gm)]
  if (openings.length !== 1 || blocks.length !== 1) throw new Error('Expected exactly one complete game-presentation JSON block.')
  const value: unknown = JSON.parse(blocks[0][1])
  if (value == null || typeof value !== 'object' || Array.isArray(value)) throw new Error('game-presentation must be an object.')
  const item = value as Record<string, unknown>
  const keys = Object.keys(GAME_PRESENTATION) as Array<keyof typeof GAME_PRESENTATION>
  if (Object.keys(item).length !== keys.length || keys.some(key => item[key] !== GAME_PRESENTATION[key])) {
    throw new Error('game-presentation must match the shared 2D top-down pixel-art contract exactly.')
  }
  return item as typeof GAME_PRESENTATION
}

export function hasGamePresentation(markdown: string): boolean {
  try { parseGamePresentation(markdown); return true } catch { return false }
}

/** Validate the explicit shared input before starting a design stage, including standalone calls. */
export function readGamePresentationContract(path: string): string {
  const markdown = readFileSync(path, 'utf8')
  parseGamePresentation(markdown)
  return markdown
}

if (import.meta.main) {
  const [path, ...extra] = process.argv.slice(2)
  if (path == null || extra.length > 0) {
    console.error('Usage: bun scripts/game-presentation.ts <game-presentation-contract.md>')
    process.exitCode = 2
  } else {
    try {
      readGamePresentationContract(path)
      console.log('Validated shared game presentation input; prose consistency requires semantic review.')
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    }
  }
}
