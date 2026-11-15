import { Database } from 'bun:sqlite'
import { beforeGdd, beforeFinalize } from './fixtures/sqlite-pipeline-runtime'
import { pipelineGdd as fullPipelineGdd } from './fixtures/sqlite-pipeline'
import { prepare, submit, finish, call, request } from './artifacts/sqlite-test-fixtures'
import { gddTemplateFixture } from './fixtures/gdd-template'
import { afterEach, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { hasGamePresentation, parseGamePresentation } from './game-presentation'
import { presentationFixture } from './fixtures/game-presentation'
import { isValidGdd } from '../.agents/skills/generate-gdd-from-interpretation/scripts/validate-gdd'
import { validateWorldBrief } from '../.agents/skills/select-world-concept/scripts/validate-world-brief'
import { fixtureCombat, fixtureInterpretation, serializeWorldBrief, worldStructureFixture } from '../.agents/skills/select-world-concept/scripts/world-fixtures'

const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })
const prompt = resolve(import.meta.dir, '../docs/prompts/game-presentation-contract.md')
const emptyRegistry = { schemaVersion: 1 as const, entries: [] }
const fingerprint = { combatRange: 'long', powerMedium: 'spell', initiative: 'reactive', spaceUse: 'swap', combatRhythm: 'cycle', mastery: 'aim', risk: 'focus_break' }
const combat = fixtureCombat + '\n\n## Final Fingerprint\n\n' + Object.entries(fingerprint).map(([key, value]) => `- ${key}: ${value}`).join('\n')
const chart = '합성 원본 차트'
const world = serializeWorldBrief()
const gdd = gddTemplateFixture('설계 모티프: 우회와 반격\n해석 근거: I-01\n\n```combat-fingerprint\n' + JSON.stringify(fingerprint) + '\n```\n' + worldStructureFixture() + presentationFixture)

test('the shared prompt and independent fixture declare the same presentation', () => {
  expect(parseGamePresentation(readFileSync(prompt, 'utf8'))).toEqual(parseGamePresentation(presentationFixture))
  expect(hasGamePresentation(presentationFixture.replaceAll('\n', '\r\n'))).toBe(true)
})

test('rejects incomplete, duplicate, malformed and incompatible presentation declarations', () => {
  for (const invalid of [
    '', ' \n\t', presentationFixture + presentationFixture,
    presentationFixture + '\n```game-presentation\n{}',
    presentationFixture.replace('game-presentation', 'game-presentation extra'),
    presentationFixture.replace('{', '{broken'),
    presentationFixture.replace(/\{.*\}/, '[]'),
    presentationFixture.replace(/\{.*\}/, 'null'),
    presentationFixture.replace('"schemaVersion":1', '"schemaVersion":"1"'),
    presentationFixture.replace('"dimension":"2d"', '"dimension":"3d"'),
    presentationFixture.replace('"view":"top-down",', ''),
    presentationFixture.replace('"top-down"', '"side-scrolling"'),
    presentationFixture.replace('"pixel-art"', '"painted"'),
    presentationFixture.replace('"indie"', '"aaa"'),
    presentationFixture.replace('"otherworld-fantasy"', '"science-fiction"'),
    presentationFixture.replace('"action-rpg"', '"turn-based-rpg"'),
    presentationFixture.replace('{', '{"extra":true,'),
  ]) expect(hasGamePresentation(invalid)).toBe(false)
})

test('input preflight rejects missing paths, absent and empty files before any design output', () => {
  const root = mkdtempSync(join(tmpdir(), 'presentation-input-')); roots.push(root)
  const cli = resolve(import.meta.dir, 'game-presentation.ts')
  const empty = join(root, 'empty.md'); writeFileSync(empty, ' \n\t')
  expect(Bun.spawnSync(['bun', cli, prompt]).exitCode).toBe(0)
  expect(Bun.spawnSync(['bun', cli]).exitCode).toBe(2)
  expect(Bun.spawnSync(['bun', cli, join(root, 'absent.md')]).exitCode).toBe(1)
  expect(Bun.spawnSync(['bun', cli, empty]).exitCode).toBe(1)
})

test('world and final GDD validation require matching presentation in every upstream artifact', () => {
  expect(validateWorldBrief(world, fixtureInterpretation, combat, emptyRegistry)).toEqual([])
  expect(isValidGdd(gdd, chart, fixtureInterpretation, combat, world)).toBe(true)
  for (const replacement of ['', presentationFixture + presentationFixture, presentationFixture.replace('top-down', 'side-scrolling')]) {
    const invalid = (source: string) => source.replace(presentationFixture, replacement)
    expect(validateWorldBrief(invalid(world), fixtureInterpretation, combat, emptyRegistry).length).toBeGreaterThan(0)
    expect(validateWorldBrief(world, fixtureInterpretation, invalid(combat), emptyRegistry).length).toBeGreaterThan(0)
    expect(isValidGdd(invalid(gdd), chart, fixtureInterpretation, combat, world)).toBe(false)
    expect(isValidGdd(gdd, chart, fixtureInterpretation, invalid(combat), world)).toBe(false)
    expect(isValidGdd(gdd, chart, fixtureInterpretation, combat, invalid(world))).toBe(false)
  }
})

test('public finish rejects a GDD missing its shared presentation and cannot register it', () => {
  const { root, run } = beforeGdd()
  const attempt = prepare(root, run, 'gdd').data
  writeFileSync(attempt.output, fullPipelineGdd().replace(presentationFixture, ''))
  submit(root, attempt)
  expect(finish(root, attempt).outcome).toBe('validation-failed')
  const result = call(root, ['finalize', '--run', run, '--request', request()])
  expect(result.code).toBe(1)
  const db = new Database(join(root, 'artifacts/state.sqlite'), { readonly: true })
  try { expect(db.query('SELECT count(*) AS count FROM fingerprints').get()).toEqual({ count: 0 }) } finally { db.close() }
})

test('invalid presentation never overwrites an already accepted GDD', () => {
  const { root, run, directory } = beforeFinalize()
  const path = join(directory, 'docs/GDD/personalized-action-rpg-concept.md')
  const before = readFileSync(path, 'utf8')
  const attempted = call(root, ['prepare', '--run', run, '--stage', 'gdd', '--kind', 'generate', '--request', request()])
  expect(attempted.code).toBe(1)
  expect(JSON.parse(attempted.stderr).error.code).toBe('stage-not-available')
  expect(readFileSync(path, 'utf8')).toBe(before)
})

test('declaration validation does not pretend to judge prose semantics or ban negative mentions', () => {
  expect(hasGamePresentation(presentationFixture + '\n3D 카메라를 사용하지 않는다.')).toBe(true)
  // Intentionally passes the machine layer; the semantic acceptance fixture must reject this design.
  expect(hasGamePresentation(presentationFixture + '\n어깨 너머 카메라로 깊이 방향을 자유 조준한다.')).toBe(true)
})
