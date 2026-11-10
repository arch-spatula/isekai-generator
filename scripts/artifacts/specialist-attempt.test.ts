import { expect, test } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { allocateRun, readRunManifest, updateRun } from './artifact-run'
import { makeRepository } from './test-fixtures'
import { finishSpecialistAttempt, prepareSpecialistAttempt } from './specialist-attempt'
import { recordStageProgress } from './artifact-progress'

const evidence = { version: 1, systems: { saju: [{ id: 'S-E0000000000000001', text: 'fixture' }], ziwei: [], natal: [] } }
const domains = ['성격과 기질', '직업과 적성', '재물', '연애와 배우자', '가족과 대인관계', '건강과 생활 리듬', '시기운']
const headings = ['# 사주팔자 심층 해석', '## 계산 전제', '## 원국과 십신 구조', '## 팔자 관계', '## 신살', '## 좌법과 인종법', '## 대운', '## 전문 해석 항목']
const valid = headings.join('\n') + '\n' + domains.map((domain, index) => `### S-0${index + 1}\n영역: ${domain}\n해상도: ${['원국 구조', '관계 작용', '운의 변화'][index % 3]}\n해석: ${'이 차트의 근거를 실제 생활의 선택과 반응 방식에 연결하여 강점과 마찰의 조건을 구체적으로 설명한다. '.repeat(2)}\n근거: S-E0000000000000001`).join('\n')

function setup(): string {
  const run = allocateRun(makeRepository(), 'personalized-gdd')
  updateRun(run, 'running')
  mkdirSync(join(run, 'docs/GDD'), { recursive: true })
  writeFileSync(join(run, 'docs/GDD/chart-evidence.json'), JSON.stringify(evidence))
  recordStageProgress(run, readRunManifest(run), 'chart-report', 'succeeded')
  return run
}

test('defensive-only and clean outputs require editing before publication and block regeneration', () => {
  for (const suffix of ['', '\n단정하지 않는다.']) {
    const run = setup()
    const first = prepareSpecialistAttempt(run, 'saju')
    const source = valid + suffix
    writeFileSync(join(run, first.output), source)
    const result = finishSpecialistAttempt(run, 'saju', 1)
    expect(result.status).toBe('editing-required')
    expect(result.errors.length).toBe(suffix ? 1 : 0)
    if (suffix) expect(result.errors).toContainEqual(expect.objectContaining({ code: 'responsibility-avoidance' }))
    expect(existsSync(join(run, 'docs/GDD/saju-interpretation.md'))).toBe(false)
    expect(existsSync(join(run, 'garbage/attempts/saju/accepted.json'))).toBe(false)
    expect(readFileSync(join(run, first.output), 'utf8')).toBe(source)
    expect(() => prepareSpecialistAttempt(run, 'saju')).toThrow()
    expect(() => finishSpecialistAttempt(run, 'saju', 1)).toThrow('already completed')
  }
})

test('repair is fully revalidated and both generation and repair share a three-attempt budget', () => {
  const run = setup()
  const first = prepareSpecialistAttempt(run, 'saju')
  expect(first.mode).toBe('generate')
  expect(finishSpecialistAttempt(run, 'saju', 1).status).toBe('execution-failed')
  const second = prepareSpecialistAttempt(run, 'saju')
  expect(second.mode).toBe('generate')
  expect(second.previous).toBeUndefined()
  writeFileSync(join(run, second.output), valid.replaceAll('근거:', '출처:') + '\n단정하지')
  finishSpecialistAttempt(run, 'saju', 2)
  const third = prepareSpecialistAttempt(run, 'saju')
  expect(third.mode).toBe('repair')
  writeFileSync(join(run, third.output), valid.replaceAll('근거:', '출처:'))
  const result = finishSpecialistAttempt(run, 'saju', 3)
  expect(result.errors.some(error => error.code === 'item-evidence')).toBe(true)
  expect(() => prepareSpecialistAttempt(run, 'saju')).toThrow('limit exhausted')
  expect(readRunManifest(run).status).toBe('running')
  updateRun(run, 'failed', { stage: 'saju', summary: 'Specialist attempt limit exhausted' })
  expect(readRunManifest(run).status).toBe('failed')
})

test('completed sibling systems remain untouched and cancellation blocks further work', () => {
  const run = setup()
  writeFileSync(join(run, 'docs/GDD/ziwei-interpretation.md'), 'accepted sibling')
  const saju = prepareSpecialistAttempt(run, 'saju')
  const natal = prepareSpecialistAttempt(run, 'natal')
  finishSpecialistAttempt(run, 'saju', saju.attempt, true)
  finishSpecialistAttempt(run, 'natal', natal.attempt, true)
  expect(readFileSync(join(run, 'docs/GDD/ziwei-interpretation.md'), 'utf8')).toBe('accepted sibling')
  updateRun(run, 'cancelled')
  expect(() => prepareSpecialistAttempt(run, 'saju')).toThrow('running run')
  expect(() => finishSpecialistAttempt(run, 'natal', 1)).toThrow('running run')
})

test('an interrupted or unrecorded attempt blocks new execution', () => {
  const run = setup()
  const first = prepareSpecialistAttempt(run, 'saju')
  writeFileSync(join(run, first.output), valid)
  // Force recording failure without relying on host permission behavior.
  mkdirSync(join(run, 'garbage/attempts/saju/001/result.json'))
  expect(() => finishSpecialistAttempt(run, 'saju', 1)).toThrow()
  expect(() => prepareSpecialistAttempt(run, 'saju')).toThrow()
  expect(existsSync(join(run, 'docs/GDD/saju-interpretation.md'))).toBe(false)
})

test('mixed structural and defensive errors retain the specialist repair route', () => {
  const run = setup()
  const first = prepareSpecialistAttempt(run, 'saju')
  writeFileSync(join(run, first.output), valid.replaceAll('근거:', '출처:') + '\n단정하지 않는다.')
  const result = finishSpecialistAttempt(run, 'saju', 1)
  expect(result.status).toBe('validation-failed')
  expect(result.errors.some(error => error.code === 'item-evidence')).toBe(true)
  expect(result.errors.some(error => error.code === 'responsibility-avoidance')).toBe(true)
  const next = prepareSpecialistAttempt(run, 'saju')
  expect(next.mode).toBe('repair')
  expect(next.previous?.output).toBe(first.output)
  writeFileSync(join(run, next.output), valid)
  expect(finishSpecialistAttempt(run, 'saju', 2).status).toBe('editing-required')
  expect(existsSync(join(run, 'docs/GDD/saju-interpretation.md'))).toBe(false)
})

test('CLI records execution errors and returns the next allowed action', () => {
  const run = setup()
  const command = ['bun', join(import.meta.dir, '../manage-specialist-attempt.ts')]
  const prepare = Bun.spawnSync([...command, 'prepare', run, 'saju'])
  expect(prepare.exitCode).toBe(0)
  expect(JSON.parse(prepare.stdout.toString()).attempt).toBe(1)
  expect(Bun.spawnSync([...command, 'error', run, 'saju', '1']).exitCode).toBe(0)
  const next = Bun.spawnSync([...command, 'prepare', run, 'saju'])
  expect(JSON.parse(next.stdout.toString()).mode).toBe('generate')
  expect(Bun.spawnSync([...command, 'finish', run, 'invalid', '1']).exitCode).toBe(1)
})

test('fresh generations cannot exceed the shared limit and partial failed documents remain preserved', () => {
  const run = setup()
  for (let attempt = 1; attempt <= 3; attempt++) {
    const input = prepareSpecialistAttempt(run, 'saju')
    expect(input.mode).toBe('generate')
    writeFileSync(join(run, input.output), 'partial agent output')
    expect(finishSpecialistAttempt(run, 'saju', attempt, true).status).toBe('execution-failed')
    expect(readFileSync(join(run, input.output), 'utf8')).toBe('partial agent output')
  }
  expect(() => prepareSpecialistAttempt(run, 'saju')).toThrow('limit exhausted')
})

test('an active writer blocks only its own system', () => {
  const run = setup()
  mkdirSync(join(run, 'garbage/attempts/saju/.lock'), { recursive: true })
  expect(() => prepareSpecialistAttempt(run, 'saju')).toThrow()
  expect(prepareSpecialistAttempt(run, 'ziwei').attempt).toBe(1)
  expect(existsSync(join(run, 'garbage/attempts/saju/.lock'))).toBe(true)
})
