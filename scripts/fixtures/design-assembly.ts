import { expect } from 'bun:test'
import { readFileSync } from 'node:fs'

/** Convert independently authored final-validator fixtures to the model's new draft contract. */
export function designDraft(stage: string, final: string): string {
  if (!['selection', 'world-selection', 'gdd'].includes(stage)) return final
  let draft = final.replace(/^```game-presentation[^\n]*\n[\s\S]*?\n```[ \t]*\n?/gm, '')
  if (stage !== 'gdd') return draft
  draft = draft.replace(/^```combat-fingerprint[^\n]*\n[\s\S]*?\n```[ \t]*\n?/gm, '')
    .replace(/(^```world-structure\s*\n)([\s\S]*?)(\n```)/m, (_, open, json, close) => {
      const structure = JSON.parse(json)
      for (const axis of Object.values(structure) as any[]) delete axis.value
      return open + JSON.stringify(structure) + close
    })
  return draft.replace('## 1. 게임 개요\n', '## 1. 게임 개요\n\n<!-- design-assembly:production -->\n')
}

/** Whitespace of managed JSON is not part of the final artifact contract. */
export function expectDesignEquivalent(actual: string, expected: string): void {
  for (const kind of ['game-presentation', 'combat-fingerprint', 'world-structure']) {
    const block = new RegExp('^```' + kind + '\\s*\\n([\\s\\S]*?)\\n```', 'm')
    const left = actual.match(block), right = expected.match(block)
    expect(left != null).toBe(right != null)
    if (right) expect(JSON.parse(left![1])).toEqual(JSON.parse(right[1]))
  }
  const stage = expected.includes('```world-structure') ? 'gdd' : expected.includes('```world-concept') ? 'world-selection' : 'selection'
  const expectedDraft = designDraft(stage, expected)
  let restored = actual.replace(/^```(?:game-presentation|combat-fingerprint)\s*\n[\s\S]*?\n```[ \t]*\n?/gm, '')
  if (stage === 'gdd') {
    const contract = readFileSync(new URL('../../docs/prompts/game-presentation-contract.md', import.meta.url), 'utf8')
    const production = contract.split('<!-- design-production:start -->')[1].split('<!-- design-production:end -->')[0].trim()
    expect(actual.split(production)).toHaveLength(2)
    restored = restored.replace(production, '<!-- design-assembly:production -->')
      .replace(/^```world-structure\s*\n[\s\S]*?\n```/m, () => expectedDraft.match(/^```world-structure\s*\n[\s\S]*?\n```/m)![0])
  }
  expect(restored.trimEnd()).toBe(expectedDraft.trimEnd())
}
