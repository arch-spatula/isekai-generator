import { validateWorldBrief } from './validate-world-brief'
import { hasGamePresentation } from '../../../../scripts/game-presentation'
import { gddTemplateFixture } from '../../../../scripts/fixtures/gdd-template'
import { expect, test } from 'bun:test'
import { presentationFixture } from '../../../../scripts/fixtures/game-presentation'
import { hasGddTemplateStructure, isValidGdd } from '../../generate-gdd-from-interpretation/scripts/validate-gdd'
import { closestWorldEntries, selectedWorld } from './world-contract'
import { fixtureCombat, fixtureInterpretation, serializeWorldBrief, worldBriefFixture, worldStructureFixture } from './world-fixtures'

const combatFingerprint = { combatRange: 'long', powerMedium: 'spell', initiative: 'reactive', spaceUse: 'swap', combatRhythm: 'cycle', mastery: 'aim', risk: 'focus_break' }
const combatBrief = fixtureCombat + '\n\n## Final Fingerprint\n\n' + Object.entries(combatFingerprint).map(([key, value]) => `- ${key}: ${value}`).join('\n')
const chart = '四柱八字\n원본 보고서\n紫微斗數 命盤\nNatal Chart'
function gdd(): string {
  return gddTemplateFixture('설계 모티프: 우회로의 개방\n해석 근거: I-01\n\n```combat-fingerprint\n' + JSON.stringify(combatFingerprint) + '\n```' + worldStructureFixture() + presentationFixture)
}

test('final GDD validation requires a world contract and preserves combat', () => {
  expect(isValidGdd(gdd(), chart, fixtureInterpretation, combatBrief, serializeWorldBrief())).toBe(true)
  expect(isValidGdd(gdd(), chart, fixtureInterpretation, combatBrief, undefined)).toBe(false)
  expect(isValidGdd(gdd().replace('"long"', '"close"'), chart, fixtureInterpretation, combatBrief, serializeWorldBrief())).toBe(false)
  expect(isValidGdd(gdd().replace('continental', 'archipelago'), chart, fixtureInterpretation, combatBrief, serializeWorldBrief())).toBe(false)
  const embeddedWorld = gdd().replace(presentationFixture, '') + '\n````markdown\n' + serializeWorldBrief() + '\n````\n'
  expect(hasGddTemplateStructure(embeddedWorld)).toBe(true)
  expect(hasGamePresentation(embeddedWorld)).toBe(true)
  expect(isValidGdd(embeddedWorld, chart, fixtureInterpretation, combatBrief, serializeWorldBrief())).toBe(false)
  const wrongCombat = worldBriefFixture(); wrongCombat.combatCandidateId = 'C-02'
  expect(isValidGdd(gdd(), chart, fixtureInterpretation, combatBrief, serializeWorldBrief(wrongCombat))).toBe(false)
})

test('world selection validates structurally distinct inputs against successive snapshots', () => {
  const first = worldBriefFixture()
  expect(validateWorldBrief(serializeWorldBrief(first), fixtureInterpretation, fixtureCombat, { schemaVersion: 1, entries: [] })).toEqual([])
  const interpretation = '### I-01\n해석: 위계 속 자율성\n### I-02\n해석: 되돌아볼 수 있는 단계적 도전'
  const second = worldBriefFixture(2)
  second.candidates[2].causalChain = '위계 속 자율성을 수직 성채의 선택적 승강로와 층별 귀환으로 표현한다.'
  const previous = [{ version: 'v0.1.30', candidateId: first.selected, fingerprint: selectedWorld(first).fingerprint, spatialPlay: selectedWorld(first).spatialPlay }]
  second.registryReview = { comparedEntries: 1, initialClosest: closestWorldEntries(selectedWorld(second).fingerprint, previous), finalClosest: closestWorldEntries(selectedWorld(second).fingerprint, previous), similarityDifferences: [] }
  expect(validateWorldBrief(serializeWorldBrief(second), interpretation, fixtureCombat, { schemaVersion: 1, entries: previous })).toEqual([])
})
