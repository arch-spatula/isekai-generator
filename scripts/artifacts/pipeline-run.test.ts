import { describe, expect, test } from 'bun:test'
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { createAttempt, publishStep } from './pipeline-actions'
import { compareFingerprint } from './pipeline-fingerprints'
import { allocateRun, attemptInput, finishEdit } from './pipeline-run'
import { pipelineStatus, type StepId } from './pipeline-status'
import { combatBrief, integratedInterpretation, pipelineGdd, worldBrief, interpretation, syntheticReport } from '../fixtures/pipeline-documents'
import { makeRepository } from './test-fixtures'

function write(dir: string, path: string, text: string): void {
  mkdirSync(dirname(join(dir, path)), { recursive: true })
  writeFileSync(join(dir, path), text)
}

function stateOf(dir: string, id: StepId) {
  return pipelineStatus(dir).steps.find(step => step.id === id)!
}

function newRun(mode = 'light'): string {
  return allocateRun(makeRepository(), 'personalized-gdd', mode, 'experiment').directory
}

function withChart(mode = 'light'): string {
  const dir = newRun(mode)
  const chart = createAttempt(dir, 'chart-report')
  write(dir, chart.candidate, syntheticReport)
  publishStep(dir, 'chart-report')
  return dir
}

/** 편집 에이전트가 돌려줄 제안. 진단이 있으면 모두 같은 결정으로 처리한다. */
function proposal(input: any, options: { status?: string; reason?: string; unresolved?: string[]; preserved?: boolean } = {}) {
  return {
    sourceSha256: input.source.sha256,
    edits: [],
    review: {
      system: input.step, attempt: input.number, scope: input.scope,
      primary: input.diagnostics.map((_: unknown, diagnosticIndex: number) => ({ diagnosticIndex, status: options.status ?? 'fixed', reason: options.reason ?? '근거를 보존했다.', editIds: [] })),
      secondary: [], preservationConfirmed: options.preserved ?? true, unresolved: options.unresolved ?? [],
      ...(options.unresolved?.length ? { nextScopeReason: '더 넓은 범위에서 다시 검토해야 한다.' } : {}),
    },
    reviewMarkdown: '근거와 조건부 표현을 보존했는지 검토했다.',
  }
}

/** 생성 → 편집 → 게시를 상태 명령의 안내대로 진행한다. */
function generateAndEdit(dir: string, id: StepId, text: string): void {
  const generation = createAttempt(dir, id)
  write(dir, generation.candidate, text)
  const edit = createAttempt(dir, id)
  expect(finishEdit(dir, edit.attempt, proposal(attemptInput(dir, edit.attempt))).status).toBe('passed')
  publishStep(dir, id)
}

describe('allocateRun', () => {
  test('creates the next version folder with a write-once run.md and no database', () => {
    const root = makeRepository()
    const first = allocateRun(root, 'personalized-gdd', 'deep', 'regression')
    expect(first.version).toBe('v0.1.0')
    const run = readFileSync(join(first.directory, 'run.md'), 'utf8')
    expect(run).toContain('종류: personalized-gdd')
    expect(run).toContain('모드: deep')
    expect(run).toContain('목적: regression')
    expect(run).toMatch(/source revision: [0-9a-f]{40}/)
    expect(allocateRun(root, 'chart-report', 'light', 'experiment').version).toBe('v0.1.1')
    expect(readdirSync(join(root, 'artifacts')).sort()).toEqual(['v0.1.0', 'v0.1.1'])
  })

  test('rejects unknown options and a dirty release candidate', () => {
    const root = makeRepository()
    expect(() => allocateRun(root, 'novel', 'light', 'experiment')).toThrow()
    writeFileSync(join(root, 'untracked.txt'), 'dirty')
    expect(() => allocateRun(root, 'personalized-gdd', 'light', 'release-candidate')).toThrow('clean working tree')
  })

  test('a chart-only run has only the chart step', () => {
    const dir = allocateRun(makeRepository(), 'chart-report', 'light', 'experiment').directory
    expect(pipelineStatus(dir).steps.map(step => step.id)).toEqual(['chart-report'])
  })
})

describe('attemptInput', () => {
  test('specialist generation receives only its own chart section, its evidence and the run mode', () => {
    const dir = withChart('deep')
    const attempt = createAttempt(dir, 'ziwei')
    const input = attemptInput(dir, attempt.attempt) as any
    expect(input).toMatchObject({ step: 'ziwei', kind: 'generate', number: 1, mode: 'deep', candidate: 'garbage/ziwei/generate-1/candidate.md' })
    expect(input.documents).toHaveLength(1)
    expect(input.documents[0].text).toContain('紫微斗數 命盤')
    expect(input.documents[0].text).not.toContain('四柱八字')
    expect(input.documents[0].text).not.toContain('Natal Chart')
    expect(input.evidence.length).toBeGreaterThan(0)
    expect(input.evidence.every((item: { id: string }) => item.id.startsWith('Z-'))).toBe(true)
  })

  test('repair attempt receives the previous candidate and its diagnostics', () => {
    const dir = withChart()
    const first = createAttempt(dir, 'saju')
    write(dir, first.candidate, '# 사주팔자 심층 해석\n')
    const repair = createAttempt(dir, 'saju')
    const input = attemptInput(dir, repair.attempt) as any
    expect(input.kind).toBe('repair')
    expect(input.previous.candidate).toBe('# 사주팔자 심층 해석\n')
    expect(input.previous.diagnostics.length).toBeGreaterThan(0)
  })

  test('selection attempt receives its registry snapshot and the integrated interpretation only', () => {
    const dir = withChart()
    for (const system of ['saju', 'ziwei', 'natal'] as const) generateAndEdit(dir, system, interpretation(system))
    generateAndEdit(dir, 'integration', integratedInterpretation)
    const attempt = createAttempt(dir, 'selection')
    const input = attemptInput(dir, attempt.attempt) as any
    expect(input.registry).toEqual({ schemaVersion: 1, entries: [] })
    expect(input.documents.map((doc: { step: string }) => doc.step)).toEqual(['integration'])
  })
})

describe('finishEdit', () => {
  test('passed edit writes the candidate and result, and the step becomes publishable', () => {
    const dir = withChart()
    const generation = createAttempt(dir, 'saju')
    write(dir, generation.candidate, interpretation('saju'))
    const edit = createAttempt(dir, 'saju')
    const input = attemptInput(dir, edit.attempt) as any
    expect(input).toMatchObject({ kind: 'edit', scope: 'sentence', source: { path: 'garbage/saju/generate-1/candidate.md' } })
    expect(input.allowedTargets.length).toBeGreaterThan(0)
    expect(finishEdit(dir, edit.attempt, proposal(input))).toEqual({ status: 'passed', errors: [] })
    expect(readFileSync(join(dir, edit.attempt, 'result.md'), 'utf8')).toContain('상태: passed')
    expect(stateOf(dir, 'saju').state).toBe('publish')
  })

  test('semantic failure widens the next scope and the next edit works on the previous edit candidate', () => {
    const dir = withChart()
    const generation = createAttempt(dir, 'saju')
    write(dir, generation.candidate, interpretation('saju'))
    const first = createAttempt(dir, 'saju')
    expect(finishEdit(dir, first.attempt, proposal(attemptInput(dir, first.attempt), { unresolved: ['S-01'] })).status).toBe('editing-failed')
    expect(readFileSync(join(dir, first.attempt, 'result.md'), 'utf8')).toContain('실패 종류: semantic')
    const second = createAttempt(dir, 'saju')
    const input = attemptInput(dir, second.attempt) as any
    expect(input).toMatchObject({ scope: 'item', source: { path: 'garbage/saju/edit-1/candidate.md' } })
    expect(input.previous.result['상태']).toBe('editing-failed')
  })

  test('malformed proposal keeps the source, records a format failure and does not widen the scope for integration', () => {
    const dir = withChart()
    for (const system of ['saju', 'ziwei', 'natal'] as const) generateAndEdit(dir, system, interpretation(system))
    const generation = createAttempt(dir, 'integration')
    write(dir, generation.candidate, integratedInterpretation)
    const edit = createAttempt(dir, 'integration')
    expect(finishEdit(dir, edit.attempt, { edits: null } as any).status).toBe('editing-failed')
    expect(readFileSync(join(dir, edit.attempt, 'candidate.md'), 'utf8')).toBe(integratedInterpretation)
    expect(readFileSync(join(dir, edit.attempt, 'result.md'), 'utf8')).toContain('실패 종류: format')
    expect(stateOf(dir, 'integration').action).toMatchObject({ scope: 'sentence', attempt: 'garbage/integration/edit-2' })
  })

  test('integration false-positive decisions are recorded with their reasons', () => {
    const dir = withChart()
    for (const system of ['saju', 'ziwei', 'natal'] as const) generateAndEdit(dir, system, interpretation(system))
    const text = integratedInterpretation.replace('## 해석 원칙', '## 해석 원칙\n출생 시각 자료가 없어 하우스 위치를 확정하지 않는다.')
    const generation = createAttempt(dir, 'integration')
    write(dir, generation.candidate, text)
    const edit = createAttempt(dir, 'integration')
    const input = attemptInput(dir, edit.attempt) as any
    expect(input.diagnostics.length).toBeGreaterThan(0)
    expect(finishEdit(dir, edit.attempt, proposal(input, { status: 'false-positive', reason: '실제 출생 시각 부재에 따른 자료 해상도 설명이다.' })).status).toBe('passed')
    const result = readFileSync(join(dir, edit.attempt, 'result.md'), 'utf8')
    expect(result).toContain('## 진단 처리')
    expect(result).toContain('- 진단 0: false-positive — 실제 출생 시각 부재에 따른 자료 해상도 설명이다.')
    expect(readFileSync(join(dir, edit.attempt, 'candidate.md'), 'utf8')).toBe(text)
  })

  test('execution failure is recorded without a candidate and a finished edit is not judged twice', () => {
    const dir = withChart()
    const generation = createAttempt(dir, 'saju')
    write(dir, generation.candidate, interpretation('saju'))
    const edit = createAttempt(dir, 'saju')
    expect(finishEdit(dir, edit.attempt, { executionFailed: true } as any).status).toBe('execution-failed')
    expect(existsSync(join(dir, edit.attempt, 'candidate.md'))).toBe(false)
    expect(finishEdit(dir, edit.attempt, { edits: [] } as any).status).toBe('execution-failed')
    expect(stateOf(dir, 'saju').action).toMatchObject({ attempt: 'garbage/saju/edit-2' })
  })

  test('refuses an edit attempt the status command does not expect', () => {
    const dir = withChart()
    const generation = createAttempt(dir, 'saju')
    write(dir, generation.candidate, interpretation('saju'))
    expect(() => finishEdit(dir, generation.attempt, proposal({ source: { sha256: '' }, step: 'saju', number: 1, scope: 'sentence', diagnostics: [] }))).toThrow('not an edit attempt')
  })
})

describe('file-based pipeline', () => {
  test('runs end to end by following only the status command and leaves no database or JSON state files', () => {
    const root = makeRepository()
    const dir = allocateRun(root, 'personalized-gdd', 'light', 'experiment').directory
    const chart = createAttempt(dir, 'chart-report')
    write(dir, chart.candidate, syntheticReport)
    publishStep(dir, 'chart-report')
    for (const system of ['saju', 'ziwei', 'natal'] as const) generateAndEdit(dir, system, interpretation(system))
    generateAndEdit(dir, 'integration', integratedInterpretation)
    for (const [id, text] of [['selection', combatBrief()], ['world-selection', worldBrief()], ['gdd', pipelineGdd()]] as const) {
      expect(stateOf(dir, id).state).toBe('ready')
      const attempt = createAttempt(dir, id)
      if (id !== 'gdd') expect(compareFingerprint(dir, attempt.attempt)).toMatchObject({ comparedEntries: 0 })
      write(dir, attempt.candidate, text)
      publishStep(dir, id)
    }
    expect(pipelineStatus(dir).steps.every(step => step.state === 'done')).toBe(true)
    const files = readdirSync(join(root, 'artifacts'), { recursive: true }).map(String)
    expect(files.filter(path => /\.(sqlite|sqlite-wal|sqlite-shm|jsonl)$|TODO\.md$/.test(path))).toEqual([])
    expect(files.filter(path => path.endsWith('.json')).sort()).toEqual(['v0.1.0/garbage/selection/generate-1/registry.json', 'v0.1.0/garbage/world-selection/generate-1/registry.json'])
  })
})
