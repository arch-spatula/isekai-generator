import { expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createAttempt, publishStep } from './pipeline-actions'
import { allocateRun, attemptInput, finishEdit } from './pipeline-run'
import { pipelineStatus, type StepId } from './pipeline-status'
import { combatBrief, integratedInterpretation, interpretation, pipelineGdd, syntheticReport, worldBrief } from '../fixtures/pipeline-documents'
import { makeRepository } from './test-fixtures'

const editCLI = join(import.meta.dir, '../artifact-edit.ts')
const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex')
type Edit = { id: string, target: string, original: string, replacement: string, diagnosticCode?: string, reviewTargetId?: string }
function write(directory: string, path: string, text: string): void {
  mkdirSync(dirname(join(directory, path)), { recursive: true })
  writeFileSync(join(directory, path), text)
}
function stateOf(directory: string, id: StepId) {
  return pipelineStatus(directory).steps.find(step => step.id === id)!
}
/** 세 체계를 편집까지 마쳐 게시하고, 통합 생성 후보를 남겨 통합 편집 단계로 만든다. */
function setup(text = integratedInterpretation) {
  const directory = allocateRun(makeRepository(), 'personalized-gdd', 'light', 'experiment').directory
  const chart = createAttempt(directory, 'chart-report')
  write(directory, chart.candidate, syntheticReport)
  publishStep(directory, 'chart-report')
  for (const system of ['saju', 'ziwei', 'natal'] as const) {
    write(directory, createAttempt(directory, system).candidate, interpretation(system))
    const edit = createAttempt(directory, system), input = attemptInput(directory, edit.attempt) as any
    expect(finishEdit(directory, edit.attempt, { sourceSha256: input.source.sha256, edits: [], review: { system, attempt: input.number, scope: input.scope, primary: [], secondary: [], preservationConfirmed: true, unresolved: [] }, reviewMarkdown: '근거를 보존했다.' }).status).toBe('passed')
    publishStep(directory, system)
  }
  const source = createAttempt(directory, 'integration')
  write(directory, source.candidate, text)
  expect(stateOf(directory, 'integration').state).toBe('edit')
  return { directory, text, source: { output: source.candidate } }
}
function editor(fixture: ReturnType<typeof setup>): Record<string, any> {
  const attempt = createAttempt(fixture.directory, 'integration')
  return { ...attemptInput(fixture.directory, attempt.attempt), attempt: attempt.attempt, output: attempt.candidate }
}
function proposal(input: Record<string, any>, edits: Edit[] = [], review: Record<string, any> = {}) {
  return { sourceSha256: input.source.sha256, edits, review: {
    system: 'integration', attempt: input.number, scope: input.scope,
    primary: input.diagnostics.map((diagnostic: any, diagnosticIndex: number) => ({ diagnosticIndex, status: 'fixed', reason: '불필요한 면책 절만 제거하고 근거와 해석을 보존했다.', editIds: edits.filter(edit => edit.diagnosticCode === diagnostic.code).map(edit => edit.id) })),
    secondary: edits.filter(edit => edit.reviewTargetId).map(edit => ({ id: edit.reviewTargetId, target: edit.target, status: 'fixed', reason: '방어문구만 국소 제거했다.', editIds: [edit.id] })),
    preservationConfirmed: true, unresolved: [], ...review,
  }, reviewMarkdown: '통합 항목과 체계별 고유 통찰을 보존하고 전체 문서를 검토했다.' }
}
/** 편집을 판정하고 통과하면 게시한다. */
function complete(fixture: ReturnType<typeof setup>, input: Record<string, any>, payload: unknown) {
  const result = finishEdit(fixture.directory, input.attempt, payload as any)
  if (result.status === 'passed') publishStep(fixture.directory, 'integration')
  return { outcome: result.status, data: { result: { errors: result.errors } } }
}
const finalPath = (fixture: ReturnType<typeof setup>) => join(fixture.directory, 'interpretation/chart-interpretation.md')
/** 선택·세계·GDD를 게시해 run 전체가 완료되는지 확인한다. */
function downstream(fixture: ReturnType<typeof setup>) {
  for (const [id, text] of [['selection', combatBrief()], ['world-selection', worldBrief()], ['gdd', pipelineGdd()]] as const) {
    write(fixture.directory, createAttempt(fixture.directory, id).candidate, text)
    publishStep(fixture.directory, id)
  }
  expect(pipelineStatus(fixture.directory).steps.every(step => step.state === 'done')).toBe(true)
}
function failed(fixture: ReturnType<typeof setup>, input: Record<string, any>, payload: unknown, reason?: RegExp) {
  const result = complete(fixture, input, payload)
  expect(result.outcome).toBe('editing-failed')
  if (reason) expect(JSON.stringify(result)).toMatch(reason)
  expect(readFileSync(join(fixture.directory, fixture.source.output), 'utf8')).toBe(fixture.text)
  expect(existsSync(finalPath(fixture))).toBe(false)
  return result
}


// §§1–3: generation alone never authorizes consumption, including diagnostics-free sources.
test('clean integration requires review, isolates editor input and exposes actual stable targets', () => {
  const fixture = setup()
  expect(existsSync(finalPath(fixture))).toBe(false)
  expect(stateOf(fixture.directory, 'selection').state).toBe('wait')
  expect(() => createAttempt(fixture.directory, 'selection')).toThrow()
  expect(stateOf(fixture.directory, 'integration').action).toMatchObject({ action: 'edit' })
  const input = editor(fixture)
  expect(input.diagnostics).toEqual([])
  expect(input.scope).toBe('sentence')
  expect(input.source.sha256).toBe(sha256(fixture.text))
  expect(input.allowedTargets).toContainEqual(expect.objectContaining({ target: 'I-01', startLine: expect.any(Number), endLine: expect.any(Number) }))
  expect(input.allowedTargets.some((target: any) => !/^I-\d+$/.test(target.target))).toBe(true)
  expect(input.allowedTargets.some((target: any) => target.target.startsWith('#'))).toBe(false)
  const serialized = JSON.stringify(input)
  expect(serialized).toContain('사주팔자 심층 해석')
  expect(serialized).toContain('자미두수 심층 해석')
  expect(serialized).toContain('네이탈 차트 심층 해석')
  expect(serialized).not.toContain('Sun Aries')
  expect(serialized).not.toContain('四柱八字')
  expect(complete(fixture, input, proposal(input)).outcome).toBe('passed')
  expect(readFileSync(finalPath(fixture), 'utf8')).toBe(fixture.text)
  downstream(fixture)
  expect(readdirSync(fixture.directory, { recursive: true }).map(String).filter(path => /\.(jsonl|sqlite)$/.test(path))).toEqual([])
})

for (const automatic of [true, false]) test(`integration locally edits ${automatic ? 'automatic diagnostic' : 'additional semantic target'}`, () => {
  const phrase = automatic ? '단정하지 않는다.' : '이 문서가 미래의 결과를 보장해 주지는 않는다.'
  const text = integratedInterpretation.replace('### I-02', `${phrase}\n### I-02`)
  const fixture = setup(text), input = editor(fixture)
  expect(input.diagnostics.length > 0).toBe(automatic)
  const edit: Edit = { id: 'local', target: 'I-01', original: phrase, replacement: '', ...(automatic ? { diagnosticCode: input.diagnostics[0].code } : { reviewTargetId: 'additional' }) }
  expect(complete(fixture, input, proposal(input, [edit])).outcome).toBe('passed')
  expect(readFileSync(finalPath(fixture), 'utf8')).toBe(text.replace(phrase, ''))
  expect(readFileSync(join(fixture.directory, fixture.source.output), 'utf8')).toBe(text)
})

// §2: this checks delivery and durable acceptance of a supplied semantic judgment, not its quality.
test('justified limitation false positive remains unchanged through the run and records its reason', () => {
  const limitation = '출생 시각 자료가 없어 하우스 위치를 확정하지 않는다.'
  const fixture = setup(integratedInterpretation.replace('## 해석 원칙', `## 해석 원칙\n${limitation}`)), input = editor(fixture)
  expect(input.diagnostics.length).toBeGreaterThan(0)
  const primary = input.diagnostics.map((_: any, diagnosticIndex: number) => ({ diagnosticIndex, status: 'false-positive', reason: '실제 출생 시각 부재에 따른 자료 해상도 설명이므로 보존한다.', editIds: [] }))
  expect(complete(fixture, input, proposal(input, [], { primary })).outcome).toBe('passed')
  expect(readFileSync(finalPath(fixture), 'utf8')).toBe(fixture.text)
  expect(readFileSync(join(fixture.directory, input.attempt, 'result.md'), 'utf8')).toContain('false-positive — 실제 출생 시각 부재에 따른 자료 해상도 설명이므로 보존한다.')
  downstream(fixture)
})

for (const mode of ['missing-review', 'empty-preservation-reason']) test(`automatic diagnostic requires explicit justified review: ${mode}`, () => {
  const fixture = setup(integratedInterpretation.replace('### I-02', '단정하지 않는다.\n### I-02')), input = editor(fixture)
  expect(input.diagnostics.length).toBeGreaterThan(0)
  failed(fixture, input, proposal(input, [], { primary: mode === 'missing-review' ? [] : input.diagnostics.map((_: any, diagnosticIndex: number) => ({ diagnosticIndex, status: 'false-positive', reason: '', editIds: [] })) }), /editing-contract|reason|primary/i)
})

test('invalid target spends budget without expanding scope', () => {
  const fixture = setup()
  for (let number = 1; number <= 3; number++) {
    const input = editor(fixture)
    expect(input.number).toBe(number); expect(input.scope).toBe('sentence')
    failed(fixture, input, proposal(input, [{ id: 'bad', target: 'I-99', original: '存在しない対象', replacement: '', reviewTargetId: 'invalid' }]), /target|대상/i)
  }
  expect(stateOf(fixture.directory, 'integration').state).toBe('exhausted')
  expect(() => createAttempt(fixture.directory, 'integration')).toThrow()
})

test('unresolved semantics alone expand sentence to item to system and exhaust three calls', () => {
  const fixture = setup()
  for (const [index, scope] of ['sentence', 'item', 'system'].entries()) {
    const input = editor(fixture)
    expect(input.number).toBe(index + 1); expect(input.scope).toBe(scope)
    failed(fixture, input, proposal(input, [], { secondary: [{ id: 'pending', target: 'I-01', status: 'needs-expansion', reason: '관련 문맥이 필요하다.', editIds: [] }], unresolved: ['pending'], nextScopeReason: '항목의 조건과 함께 검토해야 한다.' }))
  }
  expect(() => createAttempt(fixture.directory, 'integration')).toThrow()
})

// Without a stored submission there is no separate hard-block state; stale linkage fails the edit or reopens repair.
for (const mode of ['payload-hash', 'source-bytes', 'candidate-bytes']) test(`integration refuses stale hash linkage: ${mode}`, () => {
  const fixture = setup(), input = editor(fixture), payload = proposal(input)
  if (mode === 'candidate-bytes') {
    expect(complete(fixture, input, payload).outcome).toBe('passed')
    writeFileSync(finalPath(fixture), fixture.text + '\n변조')
    expect(stateOf(fixture.directory, 'integration').state).toBe('repair')
    expect(stateOf(fixture.directory, 'selection').state).toBe('wait')
    return
  }
  if (mode === 'payload-hash') payload.sourceSha256 = '0'.repeat(64)
  if (mode === 'source-bytes') writeFileSync(join(fixture.directory, fixture.source.output), fixture.text + '\n변조')
  const result = finishEdit(fixture.directory, input.attempt, payload)
  expect(result.status).toBe('editing-failed')
  expect(JSON.stringify(result.errors)).toMatch(/hash/i)
  expect(existsSync(finalPath(fixture))).toBe(false)
})

for (const [original, replacement] of [['### I-01', '### I-09'], ['영역: 성격과 기질', '영역: 재물'], ['관계: 일관', '관계: 상충'], ['근거: S-01, Z-01, N-01', '근거: S-02, Z-01, N-01']]) test(`integration protects item metadata ${original}`, () => {
  const fixture = setup()
  const sentence = editor(fixture)
  failed(fixture, sentence, proposal(sentence, [], { secondary: [{ id: 'context', target: 'I-01', status: 'needs-expansion', reason: '항목 문맥이 필요하다.', editIds: [] }], unresolved: ['context'], nextScopeReason: '항목 검토 필요' }))
  const input = editor(fixture)
  expect(input.scope).toBe('item')
  failed(fixture, input, proposal(input, [{ id: 'protected', target: 'I-01', original, replacement, reviewTargetId: 'protected' }]), /protected|preserv|보존|target|scope/i)
})

test('unfinished integration editor is resumed in place and only replaced after confirmed termination', () => {
  const fixture = setup(), input = editor(fixture)
  expect(stateOf(fixture.directory, 'integration')).toMatchObject({ unfinished: [input.attempt], action: { resume: input.attempt } })
  expect(() => createAttempt(fixture.directory, 'integration')).toThrow('Unfinished')
  const retry = createAttempt(fixture.directory, 'integration', { replaceUnfinished: true })
  expect(retry.attempt).toBe('garbage/integration/edit-2')
  expect(retry.scope).toBe('sentence')
  expect(readFileSync(join(fixture.directory, input.attempt, 'result.md'), 'utf8')).toBe('상태: interrupted\n')
  expect(stateOf(fixture.directory, 'integration').unfinished).toEqual([retry.attempt])
  const retryInput = { ...attemptInput(fixture.directory, retry.attempt), attempt: retry.attempt } as Record<string, any>
  expect(complete(fixture, retryInput, proposal(retryInput)).outcome).toBe('passed')
  expect(readFileSync(finalPath(fixture), 'utf8')).toBe(fixture.text)
})

test('malformed integration JSON spends an invocation while retaining sentence scope', () => {
  const fixture = setup(), input = editor(fixture)
  const response = Bun.spawnSync(['bun', editCLI, fixture.directory, input.attempt], { stdin: Buffer.from('{') })
  expect(response.exitCode).toBe(0)
  expect(JSON.parse(response.stdout.toString()).status).toBe('editing-failed')
  expect(readFileSync(join(fixture.directory, input.attempt, 'result.md'), 'utf8')).toContain('editing-contract')
  const retry = editor(fixture)
  expect(retry.number).toBe(2); expect(retry.scope).toBe('sentence')
  expect(complete(fixture, retry, proposal(retry)).outcome).toBe('passed')
})

test('generated non-item target permits a local disclaimer edit', () => {
  const phrase = '이 문서가 미래의 결과를 보장해 주지는 않는다.'
  const fixture = setup(integratedInterpretation.replace('## 해석 원칙', `## 해석 원칙\n${phrase}`)), input = editor(fixture)
  const line = fixture.text.split('\n').indexOf(phrase) + 1
  const target = input.allowedTargets.find((target: any) => target.startLine <= line && target.endLine >= line)
  expect(target).toBeDefined()
  expect(target.target).not.toMatch(/^I-\d+$/)
  expect(complete(fixture, input, proposal(input, [{ id: 'local', target: target.target, original: phrase, replacement: '', reviewTargetId: 'local' }])).outcome).toBe('passed')
  expect(readFileSync(finalPath(fixture), 'utf8')).toBe(fixture.text.replace(phrase, ''))
})

test('item scope rejects deletion of a system-specific unique insight', () => {
  const fixture = setup(), first = editor(fixture)
  failed(fixture, first, proposal(first, [], { secondary: [{ id: 'context', target: 'I-01', status: 'needs-expansion', reason: '체계별 문맥이 필요하다.', editIds: [] }], unresolved: ['context'], nextScopeReason: '항목 문맥 검토 필요' }))
  const input = editor(fixture)
  expect(input.scope).toBe('item')
  const original = '- 사주 고유: 에너지 배분과 장기 변화의 관점에서 지속 가능한 선택 조건을 좁힌다. (근거: S-01)'
  const line = fixture.text.split('\n').indexOf(original) + 1
  const target = input.allowedTargets.find((target: any) => target.startLine <= line && target.endLine >= line)
  expect(target).toBeDefined()
  expect(target.target).not.toMatch(/^I-\d+$/)
  const result = failed(fixture, input, proposal(input, [{ id: 'unique', target: target.target, original, replacement: '', reviewTargetId: 'unique' }]))
  const errors = JSON.stringify(result.data.result.errors)
  expect(errors).toMatch(/unique|insight|고유/i)
  expect(errors).not.toMatch(/sentence|outside.*scope|unknown.*target/i)
})

// §4: the proposal itself is not stored; the retry sees the previous edit candidate as its source and the previous result.
test('semantic retry works on the previous edit candidate and exposes its result', () => {
  const phrase = '단정하지 않는다.'
  const fixture = setup(integratedInterpretation.replace('### I-02', `${phrase}\n### I-02`)), input = editor(fixture)
  const payload = proposal(input, [{ id: 'local', target: 'I-01', original: phrase, replacement: '', diagnosticCode: input.diagnostics[0].code }], {
    secondary: [{ id: 'pending', target: 'I-02', status: 'needs-expansion', reason: '항목의 조건을 함께 검토해야 한다.', editIds: [] }], unresolved: ['pending'], nextScopeReason: '관련 항목의 문맥이 필요하다.',
  })
  const result = complete(fixture, input, payload)
  expect(result.outcome).toBe('editing-failed')
  const retry = editor(fixture), candidate = fixture.text.replace(phrase, '')
  expect(retry.scope).toBe('item')
  expect(retry.source).toEqual({ path: `${input.attempt}/candidate.md`, sha256: sha256(candidate), text: candidate })
  expect(retry.previous.candidate).toBe(candidate)
  expect(retry.previous.result['상태']).toBe('editing-failed')
  expect(retry.previous.result['실패 종류']).toBe('semantic')
  expect(result.data.result.errors.length).toBeGreaterThan(0)
  expect(readFileSync(join(fixture.directory, fixture.source.output), 'utf8')).toBe(fixture.text)
})

test('integration publication I/O failure keeps the passed edit and publishes later without another invocation', () => {
  const fixture = setup(), input = editor(fixture)
  mkdirSync(finalPath(fixture), { recursive: true })
  expect(finishEdit(fixture.directory, input.attempt, proposal(input)).status).toBe('passed')
  expect(() => publishStep(fixture.directory, 'integration')).toThrow()
  expect(readFileSync(join(fixture.directory, input.attempt, 'result.md'), 'utf8')).not.toContain('editing-contract')
  expect(stateOf(fixture.directory, 'integration').state).toBe('publish')
  rmdirSync(finalPath(fixture))
  publishStep(fixture.directory, 'integration')
  expect(readFileSync(finalPath(fixture), 'utf8')).toBe(fixture.text)
  expect(readdirSync(join(fixture.directory, 'garbage/integration')).sort()).toEqual(['edit-1', 'generate-1'])
  expect(stateOf(fixture.directory, 'selection').state).toBe('ready')
})

for (const change of ['new-position', 'changed-source']) test(`false-positive approval is bound to the published text: ${change}`, () => {
  const phrase = '출생 시각 자료가 없어 하우스 위치를 확정하지 않는다.'
  const fixture = setup(integratedInterpretation.replace('## 해석 원칙', `## 해석 원칙\n${phrase}`)), input = editor(fixture)
  expect(input.diagnostics.length).toBeGreaterThan(0)
  const payload = proposal(input, [], { primary: input.diagnostics.map((_: any, diagnosticIndex: number) => ({ diagnosticIndex, status: 'false-positive', reason: '실제 자료 부재의 해상도 설명이다.', editIds: [] })) })
  expect(complete(fixture, input, payload).outcome).toBe('passed')
  const altered = change === 'new-position'
    ? fixture.text.replace(`${phrase}\n`, '').replace('### I-02', `${phrase}\n### I-02`)
    : fixture.text.replace(phrase, `실제 자료의 해상도가 부족하다. ${phrase}`)
  writeFileSync(finalPath(fixture), altered)
  expect(stateOf(fixture.directory, 'integration').state).toBe('repair')
  expect(() => createAttempt(fixture.directory, 'selection')).toThrow()
})
