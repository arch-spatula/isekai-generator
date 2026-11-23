import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pipelineStatus, type StepId } from './pipeline-status'
import { combatBrief, integratedInterpretation, pipelineGdd, worldBrief, interpretation, syntheticReport } from '../fixtures/pipeline-documents'

const EMPTY_REGISTRY = JSON.stringify({ schemaVersion: 1, entries: [] })

function versionDir(version = 'v0.5.1', root = mkdtempSync(join(tmpdir(), 'artifact-status-'))): string {
  const dir = join(root, 'artifacts', version)
  mkdirSync(dir, { recursive: true })
  return dir
}

function write(dir: string, path: string, text: string): void {
  mkdirSync(dirname(join(dir, path)), { recursive: true })
  writeFileSync(join(dir, path), text)
}

function stateOf(dir: string, id: StepId) {
  return pipelineStatus(dir).steps.find(step => step.id === id)!
}

/** 생성 시도와 통과한 편집 시도를 남기고 정식 문서를 게시한다. */
function publishEdited(dir: string, id: StepId, output: string, text: string): void {
  write(dir, `garbage/${id}/generate-1/candidate.md`, text)
  write(dir, `garbage/${id}/edit-1/candidate.md`, text)
  write(dir, `garbage/${id}/edit-1/result.md`, '상태: passed\nscope: sentence\n')
  write(dir, output, text)
}

function publishSelected(dir: string, id: StepId, output: string, text: string, registry = EMPTY_REGISTRY): void {
  write(dir, `garbage/${id}/generate-1/candidate.md`, text)
  write(dir, `garbage/${id}/generate-1/registry.json`, registry)
  write(dir, output, text)
}

function throughIntegration(dir: string): void {
  write(dir, 'charts/chart-report.md', syntheticReport)
  for (const system of ['saju', 'ziwei', 'natal'] as const) publishEdited(dir, system, `interpretation/${system}-interpretation.md`, interpretation(system))
  publishEdited(dir, 'integration', 'interpretation/chart-interpretation.md', integratedInterpretation)
}

function completeRun(dir: string): void {
  throughIntegration(dir)
  publishSelected(dir, 'selection', 'design-rationale/gameplay-concept-brief.md', combatBrief())
  publishSelected(dir, 'world-selection', 'design-rationale/world-concept-brief.md', worldBrief())
  write(dir, 'game/personalized-action-rpg-concept.md', pipelineGdd())
}

describe('pipelineStatus', () => {
  test('empty version folder asks for birth input and every later step waits', () => {
    const steps = pipelineStatus(versionDir()).steps
    expect(steps.map(step => [step.id, step.state])).toEqual([
      ['chart-report', 'input'], ['saju', 'wait'], ['ziwei', 'wait'], ['natal', 'wait'],
      ['integration', 'wait'], ['selection', 'wait'], ['world-selection', 'wait'], ['gdd', 'wait'],
    ])
  })

  test('published chart report makes the three systems ready in parallel with their own attempt folders', () => {
    const dir = versionDir()
    write(dir, 'charts/chart-report.md', syntheticReport)
    const steps = pipelineStatus(dir).steps
    expect(steps[0].state).toBe('done')
    for (const system of ['saju', 'ziwei', 'natal']) {
      const step = steps.find(s => s.id === system)!
      expect(step.state).toBe('ready')
      expect(step.action).toMatchObject({ action: 'generate', attempt: `garbage/${system}/generate-1`, inputs: ['charts/chart-report.md'] })
    }
    expect(steps.find(s => s.id === 'integration')!.state).toBe('wait')
  })

  test('valid generation candidate needs a defensive edit before publication', () => {
    const dir = versionDir()
    write(dir, 'charts/chart-report.md', syntheticReport)
    write(dir, 'garbage/saju/generate-1/candidate.md', interpretation('saju'))
    expect(stateOf(dir, 'saju')).toMatchObject({ state: 'edit', action: { attempt: 'garbage/saju/edit-1', scope: 'sentence', source: 'garbage/saju/generate-1/candidate.md' } })
  })

  test('passed edit with a valid candidate is ready to publish', () => {
    const dir = versionDir()
    write(dir, 'charts/chart-report.md', syntheticReport)
    write(dir, 'garbage/saju/generate-1/candidate.md', interpretation('saju'))
    write(dir, 'garbage/saju/edit-1/candidate.md', interpretation('saju'))
    write(dir, 'garbage/saju/edit-1/result.md', '상태: passed\n')
    expect(stateOf(dir, 'saju')).toMatchObject({ state: 'publish', action: { candidate: 'garbage/saju/edit-1/candidate.md', output: 'interpretation/saju-interpretation.md' } })
  })

  test('published system interpretation equal to the passed edit is done', () => {
    const dir = versionDir()
    write(dir, 'charts/chart-report.md', syntheticReport)
    publishEdited(dir, 'saju', 'interpretation/saju-interpretation.md', interpretation('saju'))
    expect(stateOf(dir, 'saju').state).toBe('done')
  })

  test('half-written published file needs repair instead of a new generation', () => {
    const dir = versionDir()
    write(dir, 'charts/chart-report.md', syntheticReport)
    publishEdited(dir, 'saju', 'interpretation/saju-interpretation.md', interpretation('saju'))
    write(dir, 'interpretation/saju-interpretation.md', interpretation('saju').slice(0, 200))
    const step = stateOf(dir, 'saju')
    expect(step.state).toBe('repair')
    expect(step.diagnostics!.length).toBeGreaterThan(0)
  })

  test('published file without a passed defensive edit needs repair', () => {
    const dir = versionDir()
    write(dir, 'charts/chart-report.md', syntheticReport)
    write(dir, 'interpretation/saju-interpretation.md', interpretation('saju'))
    expect(stateOf(dir, 'saju')).toMatchObject({ state: 'repair', diagnostics: ['Published without a passed defensive edit'] })
  })

  test('invalid generation candidate leads to a repair attempt with the next number', () => {
    const dir = versionDir()
    write(dir, 'charts/chart-report.md', syntheticReport)
    write(dir, 'garbage/saju/generate-1/candidate.md', '# 사주팔자 심층 해석\n')
    expect(stateOf(dir, 'saju')).toMatchObject({ state: 'ready', generationAttempts: 1, action: { action: 'repair', attempt: 'garbage/saju/repair-2' } })
  })

  test('three failed specialist generations exhaust the budget', () => {
    const dir = versionDir()
    write(dir, 'charts/chart-report.md', syntheticReport)
    write(dir, 'garbage/saju/generate-1/candidate.md', 'broken')
    write(dir, 'garbage/saju/repair-2/candidate.md', 'broken')
    mkdirSync(join(dir, 'garbage/saju/repair-3'), { recursive: true })
    expect(stateOf(dir, 'saju')).toMatchObject({ state: 'exhausted', generationAttempts: 3 })
  })

  test('failed edits widen the scope from sentence to item to system', () => {
    const dir = versionDir()
    write(dir, 'charts/chart-report.md', syntheticReport)
    write(dir, 'garbage/saju/generate-1/candidate.md', interpretation('saju'))
    write(dir, 'garbage/saju/edit-1/result.md', '상태: editing-failed\n')
    expect(stateOf(dir, 'saju').action).toMatchObject({ attempt: 'garbage/saju/edit-2', scope: 'item' })
    write(dir, 'garbage/saju/edit-2/result.md', '상태: editing-failed\n')
    expect(stateOf(dir, 'saju').action).toMatchObject({ attempt: 'garbage/saju/edit-3', scope: 'system' })
    write(dir, 'garbage/saju/edit-3/result.md', '상태: editing-failed\n')
    expect(stateOf(dir, 'saju')).toMatchObject({ state: 'exhausted', editAttempts: 3 })
  })

  test('integration edit failures widen the scope only for semantic failures', () => {
    const dir = versionDir()
    write(dir, 'charts/chart-report.md', syntheticReport)
    for (const system of ['saju', 'ziwei', 'natal'] as const) publishEdited(dir, system, `interpretation/${system}-interpretation.md`, interpretation(system))
    write(dir, 'garbage/integration/generate-1/candidate.md', integratedInterpretation)
    write(dir, 'garbage/integration/edit-1/result.md', '상태: editing-failed\n실패 종류: format\n')
    expect(stateOf(dir, 'integration').action).toMatchObject({ attempt: 'garbage/integration/edit-2', scope: 'sentence' })
    write(dir, 'garbage/integration/edit-2/result.md', '상태: editing-failed\n실패 종류: semantic\n')
    expect(stateOf(dir, 'integration').action).toMatchObject({ attempt: 'garbage/integration/edit-3', scope: 'item' })
  })

  test('edit attempt without result.md is resumed instead of starting a new one', () => {
    const dir = versionDir()
    write(dir, 'charts/chart-report.md', syntheticReport)
    write(dir, 'garbage/saju/generate-1/candidate.md', interpretation('saju'))
    mkdirSync(join(dir, 'garbage/saju/edit-1'), { recursive: true })
    expect(stateOf(dir, 'saju')).toMatchObject({ state: 'edit', action: { resume: 'garbage/saju/edit-1' } })
  })

  test('selection candidate without its registry snapshot is not accepted', () => {
    const dir = versionDir()
    throughIntegration(dir)
    write(dir, 'garbage/selection/generate-1/candidate.md', combatBrief())
    expect(stateOf(dir, 'selection')).toMatchObject({ state: 'ready', action: { action: 'repair' } })
    write(dir, 'garbage/selection/generate-1/registry.json', EMPTY_REGISTRY)
    expect(stateOf(dir, 'selection').state).toBe('publish')
  })

  test('finished selection stays done after another run publishes its GDD', () => {
    const root = mkdtempSync(join(tmpdir(), 'artifact-status-'))
    const first = versionDir('v0.5.1', root)
    completeRun(first)
    expect(pipelineStatus(first).steps.every(step => step.state === 'done')).toBe(true)

    const second = versionDir('v0.5.2', root)
    completeRun(second)
    expect(pipelineStatus(first).steps.every(step => step.state === 'done')).toBe(true)

    const third = versionDir('v0.5.3', root)
    throughIntegration(third)
    const registry = stateOf(third, 'selection').action!.registry as { entries: { version: string }[] }
    expect(registry.entries.map(entry => entry.version)).toEqual(['v0.5.1', 'v0.5.2'])
  })

  test('registry ignores runs of another series and runs without a published GDD', () => {
    const root = mkdtempSync(join(tmpdir(), 'artifact-status-'))
    completeRun(versionDir('v0.4.9', root))
    throughIntegration(versionDir('v0.5.1', root))
    const current = versionDir('v0.5.2', root)
    throughIntegration(current)
    expect((stateOf(current, 'selection').action!.registry as { entries: unknown[] }).entries).toEqual([])
  })

  test('status computation does not create or change files', () => {
    const dir = versionDir()
    write(dir, 'charts/chart-report.md', syntheticReport)
    const before = readdirSync(dir, { recursive: true }).sort()
    pipelineStatus(dir)
    expect(readdirSync(dir, { recursive: true }).sort()).toEqual(before)
  })
})
