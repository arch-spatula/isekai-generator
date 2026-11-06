import { afterEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { presentationFixture } from '../../../../scripts/fixtures/game-presentation'
import { isValidGdd } from '../../generate-gdd-from-interpretation/scripts/validate-gdd'
import { closestWorldEntries, selectedWorld } from './world-contract'
import { fixtureCombat, fixtureInterpretation, serializeWorldBrief, worldBriefFixture, worldStructureFixture } from './world-fixtures'

const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })
const combatFingerprint = { combatRange: 'long', powerMedium: 'spell', initiative: 'reactive', spaceUse: 'swap', combatRhythm: 'cycle', mastery: 'aim', risk: 'focus_break' }
const combatBrief = fixtureCombat + '\n\n## Final Fingerprint\n\n' + Object.entries(combatFingerprint).map(([key, value]) => `- ${key}: ${value}`).join('\n')
const presentationPath = resolve(import.meta.dir, '../../../../docs/prompts/game-presentation-contract.md')
const chart = '四柱八字\n원본 보고서\n紫微斗數 命盤\nNatal Chart'
function gdd(): string {
  return '# 독립 세계\n\n설계 모티프: 우회로의 개방\n해석 근거: I-01\n\n```combat-fingerprint\n' + JSON.stringify(combatFingerprint) + '\n```' + worldStructureFixture() + presentationFixture
}

test('world contract is required by both final GDD CLIs and preserves combat', () => {
  const root = mkdtempSync(join(tmpdir(), 'world-pipeline-')); roots.push(root)
  const files = ['gdd.md', 'chart.md', 'interpretation.md', 'combat.md', 'world.md'].map(name => join(root, name))
  const sources = [gdd(), chart, fixtureInterpretation, combatBrief, serializeWorldBrief()]
  files.forEach((path, index) => writeFileSync(path, sources[index]))
  for (const skill of ['generate-gdd-from-interpretation', 'generate-personalized-gdd']) {
    const cli = join(import.meta.dir, `../../${skill}/scripts/validate-gdd.ts`)
    expect(Bun.spawnSync(['bun', cli, ...files, presentationPath]).exitCode).toBe(0)
    expect(Bun.spawnSync(['bun', cli, ...files.slice(0, 4)]).exitCode).not.toBe(0)
  }
  expect(isValidGdd(gdd().replace('"long"', '"close"'), chart, fixtureInterpretation, combatBrief, serializeWorldBrief())).toBe(false)
  expect(isValidGdd(gdd().replace('continental', 'archipelago'), chart, fixtureInterpretation, combatBrief, serializeWorldBrief())).toBe(false)
  expect(isValidGdd(gdd() + serializeWorldBrief(), chart, fixtureInterpretation, combatBrief, serializeWorldBrief())).toBe(false)
  const wrongCombat = worldBriefFixture(); wrongCombat.combatCandidateId = 'C-02'
  expect(isValidGdd(gdd(), chart, fixtureInterpretation, combatBrief, serializeWorldBrief(wrongCombat))).toBe(false)
})

test('world selection CLI and registration roundtrip across structurally different synthetic inputs', () => {
  const root = mkdtempSync(join(tmpdir(), 'world-cli-')); roots.push(root)
  const registry = join(root, 'registry.json'), world = join(root, 'world.md'), combat = join(root, 'combat.md'), interpretation = join(root, 'interpretation.md')
  const manager = join(import.meta.dir, 'manage-world-registry.ts'), validator = join(import.meta.dir, 'validate-world-brief.ts')
  expect(Bun.spawnSync(['bun', manager, 'init', registry]).exitCode).toBe(0)
  writeFileSync(combat, fixtureCombat); writeFileSync(interpretation, fixtureInterpretation)
  const first = worldBriefFixture()
  writeFileSync(world, serializeWorldBrief(first))
  expect(Bun.spawnSync(['bun', validator, world, interpretation, combat, registry, presentationPath]).exitCode).toBe(0)
  expect(Bun.spawnSync(['bun', manager, 'register', registry, 'v0.1.30', world]).exitCode).toBe(0)
  expect(Bun.spawnSync(['bun', manager, 'register', registry, 'v0.1.30', world]).exitCode).toBe(1)
  // A different interpretation fixture selects a vertical structure against the first run's registry.
  writeFileSync(interpretation, '### I-01\n해석: 위계 속 자율성\n### I-02\n해석: 되돌아볼 수 있는 단계적 도전')
  const second = worldBriefFixture(2)
  second.candidates[2].causalChain = '위계 속 자율성을 수직 성채의 선택적 승강로와 층별 귀환으로 표현한다.'
  const previous = [{ version: 'v0.1.30', candidateId: first.selected, fingerprint: selectedWorld(first).fingerprint, spatialPlay: selectedWorld(first).spatialPlay }]
  second.registryReview = { comparedEntries: 1, initialClosest: closestWorldEntries(selectedWorld(second).fingerprint, previous), finalClosest: closestWorldEntries(selectedWorld(second).fingerprint, previous), similarityDifferences: [] }
  writeFileSync(world, serializeWorldBrief(second))
  expect(Bun.spawnSync(['bun', validator, world, interpretation, combat, registry, presentationPath]).exitCode).toBe(0)
  expect(Bun.spawnSync(['bun', manager, 'register', registry, 'v0.1.31', world]).exitCode).toBe(0)
})
