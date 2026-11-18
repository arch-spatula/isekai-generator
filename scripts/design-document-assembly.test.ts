import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { assembleDesignDocument } from './design-document-assembly'
import { combatBrief, worldBrief, pipelineGdd, integratedInterpretation } from './fixtures/sqlite-pipeline'
import { designDraft } from './fixtures/design-assembly'
import { serializeWorldBrief, worldBriefFixture } from '../.agents/skills/select-world-concept/scripts/world-fixtures'
import { presentationFixture } from './fixtures/game-presentation'
import { parseGamePresentation } from './game-presentation'
import { isValidGdd, hasGddTemplateStructure } from '../.agents/skills/generate-gdd-from-interpretation/scripts/validate-gdd'
import { validateConceptBrief } from '../.agents/skills/select-gameplay-concept/scripts/validate-concept-brief'
import { validateWorldBrief } from '../.agents/skills/select-world-concept/scripts/validate-world-brief'

const contract = readFileSync(new URL('../docs/prompts/game-presentation-contract.md', import.meta.url), 'utf8')
const combatAxes = { combatRange: 'close', powerMedium: 'weapon', initiative: 'direct', spaceUse: 'pursuit', combatRhythm: 'pressure', mastery: 'timing', risk: 'health' }
const worldAxes = { topology: 'continental', ecology: 'forest', traversal: 'overland', settlement: 'fixed-cities', hazard: 'collapse', spatialLogic: 'borders' }
const input = () => ({ stage: 'gdd' as const, draft: designDraft('gdd', pipelineGdd()), presentationContract: contract, combatBrief: combatBrief(), worldBrief: worldBrief() })
const jsonBlock = (text: string, kind: string): any => JSON.parse(text.match(new RegExp('^```' + kind + '\\s*\\n([\\s\\S]*?)\\n```', 'm'))![1])
function rejects(value: Parameters<typeof assembleDesignDocument>[0], code: string): void {
  let failure: any
  try { assembleDesignDocument(value) } catch (error) { failure = error }
  expect(failure).toBeInstanceOf(Error)
  expect(failure.code).toBe(code)
}

test('selection and world drafts omit presentation yet assemble once and satisfy canonical validators', () => {
  const registry = { schemaVersion: 1 as const, entries: [] }
  const selectionDraft = designDraft('selection', combatBrief())
  const selection = assembleDesignDocument({ stage: 'selection', draft: selectionDraft, presentationContract: contract })
  expect(selection.startsWith(selectionDraft)).toBe(true)
  expect(selection.match(/^```game-presentation/gm)).toHaveLength(1)
  expect(parseGamePresentation(selection)).toEqual(JSON.parse(presentationFixture.match(/\{.*\}/)![0]))
  expect(validateConceptBrief(selection, integratedInterpretation, registry)).toEqual([])
  const worldDraft = designDraft('world-selection', worldBrief())
  const world = assembleDesignDocument({ stage: 'world-selection', draft: worldDraft, presentationContract: contract, combatBrief: selection })
  expect(world.startsWith(worldDraft)).toBe(true)
  expect(world.match(/^```game-presentation/gm)).toHaveLength(1)
  expect(validateWorldBrief(world, integratedInterpretation, selection, registry)).toEqual([])
})

test('GDD copies all seven combat and six selected world axes, preserves short creative text, and passes final validator', () => {
  const source = input()
  source.draft = source.draft.replace('게임명: 유리 숲의 문지기', '게임명: 청동 정원\n팔레트: 먹빛과 청동.\n실루엣: 둥근 망토.\n2D 평면의 관문을 연다.')
    .replace(/"manifestation":"[^"]*"/g, '"manifestation":"문을 연다."')
  const final = assembleDesignDocument(source)
  expect(final).toBe(assembleDesignDocument(source))
  expect(hasGddTemplateStructure(final)).toBe(true)
  expect(jsonBlock(final, 'combat-fingerprint')).toEqual(combatAxes)
  expect(jsonBlock(final, 'world-structure')).toEqual(Object.fromEntries(Object.entries(worldAxes).map(([key, value]) => [key, { value, manifestation: '문을 연다.' }])))
  for (const text of ['게임명: 청동 정원', '팔레트: 먹빛과 청동.', '실루엣: 둥근 망토.', '2D 평면의 관문을 연다.']) expect(final).toContain(text)
  expect(final).not.toContain('<!-- design-assembly:production -->')
  for (const kind of ['combat-fingerprint', 'world-structure', 'game-presentation']) expect(final.match(new RegExp('^```' + kind, 'gm'))).toHaveLength(1)
  expect(final.lastIndexOf('```combat-fingerprint')).toBeGreaterThan(final.indexOf('## 11. 구조화된 설계 선언'))
  expect(isValidGdd(final, '합성 차트', integratedInterpretation, combatBrief(), worldBrief())).toBe(true)
  const production = contract.split('<!-- design-production:start -->')[1].split('<!-- design-production:end -->')[0].trim()
  expect(production).not.toBe('')
  expect(final.split(production)).toHaveLength(2)
  expect(final.indexOf(production)).toBeLessThan(final.indexOf('## 2. 플레이어 경험과 핵심 재미'))
  const draftWorld = source.draft.match(/^```world-structure\s*\n[\s\S]*?\n```/m)![0]
  const restoredDraft = final.replace(production, '<!-- design-assembly:production -->')
    .replace(/^```world-structure\s*\n[\s\S]*?\n```/m, () => draftWorld)
    .replace(/^```(?:combat-fingerprint|game-presentation)\s*\n[\s\S]*?\n```[ \t]*\n?/gm, '')
  expect(restoredDraft.trimEnd()).toBe(source.draft.trimEnd())
})

test('a second creative palette and silhouette remain verbatim without a style word classifier', () => {
  const source = input()
  source.draft = source.draft.replace('게임명: 유리 숲의 문지기', '게임명: 붉은 길\n팔레트: 홍색.\n실루엣: 뾰족한 모자.\n자유 3D 조준은 사용하지 않는다.')
  const final = assembleDesignDocument(source)
  expect(final).toContain('팔레트: 홍색.\n실루엣: 뾰족한 모자.\n자유 3D 조준은 사용하지 않는다.')
})

for (const stage of ['selection', 'world-selection', 'gdd'] as const) {
  test(`${stage} explicitly rejects complete, duplicate, conflicting and malformed model presentation declarations`, () => {
    for (const block of [presentationFixture, presentationFixture + presentationFixture, presentationFixture.replace('top-down', 'side-scrolling'), '\n```game-presentation\n{']) {
      const source = input()
      rejects({ ...source, stage, draft: designDraft(stage, stage === 'gdd' ? pipelineGdd() : stage === 'selection' ? combatBrief() : worldBrief()) + block }, 'assembly-managed-field')
    }
  })
}

test('GDD rejects submitted combat declarations and world managed values even when equal to accepted source', () => {
  const source = input()
  rejects({ ...source, draft: source.draft + '\n```combat-fingerprint\n' + JSON.stringify(combatAxes) + '\n```' }, 'assembly-managed-field')
  rejects({ ...source, draft: source.draft.replace('"topology":{', '"topology":{"value":"continental",') }, 'assembly-managed-field')
  rejects({ ...source, draft: source.draft.replace('"topology":{', '"topology":{"value":"archipelago",') }, 'assembly-managed-field')
})

for (const [name, mutate] of [
  ['missing', (draft: string) => draft.replace('<!-- design-assembly:production -->', '')],
  ['duplicate', (draft: string) => draft.replace('<!-- design-assembly:production -->', '<!-- design-assembly:production -->\n<!-- design-assembly:production -->')],
  ['inline', (draft: string) => draft.replace('<!-- design-assembly:production -->', '설명 <!-- design-assembly:production -->')],
  ['section two', (draft: string) => draft.replace('<!-- design-assembly:production -->', '').replace('## 2. 플레이어 경험과 핵심 재미', '## 2. 플레이어 경험과 핵심 재미\n<!-- design-assembly:production -->')],
] as const) test(`GDD ${name} production insertion is an explicit assembly error`, () => rejects({ ...input(), draft: mutate(input().draft) }, 'assembly-production-marker'))

for (const [name, mutate] of [
  ['missing block', (draft: string) => draft.replace(/^```world-structure\n[\s\S]*?\n```/m, '')],
  ['malformed JSON', (draft: string) => draft.replace('```world-structure\n{', '```world-structure\n{broken')],
  ['extra axis', (draft: string) => draft.replace('```world-structure\n{', '```world-structure\n{"extra":{"manifestation":"문"},')],
  ['missing axis', (draft: string) => draft.replace(/"topology":\{[^}]*\},/, '')],
  ['empty manifestation', (draft: string) => draft.replace(/"manifestation":"[^"]*"/, '"manifestation":"  "')],
  ['missing manifestation', (draft: string) => draft.replace(/"manifestation":"[^"]*"/, '"other":"문"')],
] as const) test(`GDD ${name} rejects the exact world structure boundary`, () => rejects({ ...input(), draft: mutate(input().draft) }, 'assembly-world-structure'))

test('missing and invalid assembly originals fail explicitly without fabrication', () => {
  for (const change of [{ presentationContract: '' }, { presentationContract: contract + presentationFixture }, { combatBrief: undefined }, { combatBrief: '## Final Fingerprint\n- combatRange: invented' }, { worldBrief: undefined }, { worldBrief: '```world-concept\n{}\n```' }]) rejects({ ...input(), ...change }, 'assembly-source-invalid')
})

test('assembly preserves nonexistent evidence for rejection by the existing final validator', () => {
  const source = input()
  const final = assembleDesignDocument({ ...source, draft: source.draft.replace('해석 근거: I-01', '해석 근거: I-99') })
  expect(final).toContain('해석 근거: I-99')
  expect(isValidGdd(final, '합성 차트', integratedInterpretation, combatBrief(), worldBrief())).toBe(false)
})


test('nondefault accepted axes flow to the candidate and all unmanaged bytes retain their order and spacing', () => {
  const source = input()
  const alternateCombat = { combatRange: 'long', powerMedium: 'spell', initiative: 'reactive', spaceUse: 'swap', combatRhythm: 'cycle', mastery: 'aim', risk: 'focus_break' }
  const alternateWorld = { topology: 'vertical', ecology: 'urban', traversal: 'aerial', settlement: 'single-fortress', hazard: 'falling', spatialLogic: 'layers' }
  source.combatBrief = combatBrief().replace(/(## Final Fingerprint\n)[\s\S]*?(?=\n\n```game-presentation)/, '$1\n' + Object.entries(alternateCombat).map(([key, value]) => '- ' + key + ': ' + value).join('\n'))
  source.worldBrief = serializeWorldBrief(worldBriefFixture(2))
  source.draft = source.draft.replace('합성 설계 설명.', '  공백을  남긴다.\n\n\t탭도 남긴다.\n문장 A → 문장 B.')
  const final = assembleDesignDocument(source)
  expect(jsonBlock(final, 'combat-fingerprint')).toEqual(alternateCombat)
  const originalStructure = jsonBlock(source.draft, 'world-structure')
  expect(jsonBlock(final, 'world-structure')).toEqual(Object.fromEntries(Object.entries(alternateWorld).map(([key, value]) => [key, { value, manifestation: originalStructure[key].manifestation }])))
  const production = contract.split('<!-- design-production:start -->')[1].split('<!-- design-production:end -->')[0].trim()
  const restored = final.replace(production, '<!-- design-assembly:production -->')
    .replace(/^```world-structure\s*\n[\s\S]*?\n```/m, () => source.draft.match(/^```world-structure\s*\n[\s\S]*?\n```/m)![0])
    .replace(/^```(?:combat-fingerprint|game-presentation)\s*\n[\s\S]*?\n```[ \t]*\n?/gm, '')
  expect(restored.trimEnd()).toBe(source.draft.trimEnd())
})
