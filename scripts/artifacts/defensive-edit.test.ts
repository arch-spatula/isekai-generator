import { expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createAttempt, publishStep } from './pipeline-actions'
import { allocateRun, attemptInput, finishEdit } from './pipeline-run'
import { pipelineStatus } from './pipeline-status'
import { interpretation, syntheticReport } from '../fixtures/pipeline-documents'
import { makeRepository } from './test-fixtures'

const editCLI = join(import.meta.dir, '../artifact-edit.ts')
const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex')
function write(directory: string, path: string, text: string): void {
  mkdirSync(dirname(join(directory, path)), { recursive: true })
  writeFileSync(join(directory, path), text)
}
function sajuState(directory: string) {
  return pipelineStatus(directory).steps.find(step => step.id === 'saju')!
}
type Edit = { id: string, target: string, original: string, replacement: string, diagnosticCode?: string, reviewTargetId?: string }
/** 차트를 게시하고 사주 생성 후보를 남겨 편집 단계로 만든다. */
function setup(text = interpretation()) {
  const directory = allocateRun(makeRepository(), 'personalized-gdd', 'light', 'experiment').directory
  const chart = createAttempt(directory, 'chart-report')
  write(directory, chart.candidate, syntheticReport)
  publishStep(directory, 'chart-report')
  const generation = createAttempt(directory, 'saju')
  write(directory, generation.candidate, text)
  expect(sajuState(directory).state).toBe('edit')
  return { directory, text, source: { output: generation.candidate } }
}
/** 다음 편집 시도를 만들고 그 시도의 입력을 돌려준다. */
function editor(directory: string): Record<string, any> {
  const attempt = createAttempt(directory, 'saju')
  return { ...attemptInput(directory, attempt.attempt), attempt: attempt.attempt, output: attempt.candidate }
}
function proposal(input: Record<string, any>, edits: Edit[] = [], extra: Record<string, any> = {}) {
  return { sourceSha256: input.source.sha256, edits, review: {
    system: 'saju', attempt: input.number, scope: input.scope,
    primary: input.diagnostics.map((_: any, diagnosticIndex: number) => ({ diagnosticIndex, status: 'fixed', reason: '예측 부정 절만 제거하고 해석을 유지한다.', editIds: edits.map(edit => edit.id) })),
    secondary: [...new Set(edits.filter(edit => edit.reviewTargetId).map(edit => edit.reviewTargetId))].map(id => ({ id, target: edits.find(edit => edit.reviewTargetId === id)!.target, status: 'fixed', reason: '기존 근거와 조건 설명을 유지한다.', editIds: edits.filter(edit => edit.reviewTargetId === id).map(edit => edit.id) })),
    preservationConfirmed: true, unresolved: [], ...extra,
  }, reviewMarkdown: '계산 범위와 조건부 발현 설명을 보존하고 문서 전체의 추가 방어문구를 검토했다.' }
}
const semantic = (target: string, original: string, replacement: string): Edit => ({ id: 'e1', target, original, replacement, reviewTargetId: 'secondary1' })
/** 편집을 판정하고 통과하면 게시한다. */
function complete(directory: string, input: Record<string, any>, payload: any) {
  const result = finishEdit(directory, input.attempt, payload)
  if (result.status === 'passed') publishStep(directory, 'saju')
  return { outcome: result.status, data: { result: { errors: result.errors } } }
}
function finalPath(directory: string) { return join(directory, 'interpretation/saju-interpretation.md') }
function recoverable(fixture: ReturnType<typeof setup>, input: Record<string, any>, payload: any, reason?: RegExp) {
  const result = complete(fixture.directory, input, payload)
  expect(result.outcome).toBe('editing-failed')
  if (reason) expect(JSON.stringify(result.data.result.errors)).toMatch(reason)
  expect(readFileSync(join(fixture.directory, input.output), 'utf8')).toBe(fixture.text)
  expect(existsSync(finalPath(fixture.directory))).toBe(false)
  expect(readFileSync(join(fixture.directory, fixture.source.output), 'utf8')).toBe(fixture.text)
  return result
}
function expand(fixture: ReturnType<typeof setup>, scope = 'item') {
  let input = editor(fixture.directory)
  while (input.scope !== scope) {
    recoverable(fixture, input, proposal(input, [], { secondary: [{ id: 'pending', target: 'S-01', status: 'needs-expansion', reason: '관련 문맥을 함께 검토해야 한다.', editIds: [] }], unresolved: ['pending'], nextScopeReason: 'S-01 문맥 편집이 필요하다.' }))
    input = editor(fixture.directory)
  }
  return input
}

// Existing semantic, protected-structure and false-positive policies are unchanged; only durable submission transport changes (§§5.3,7,12).
test('fully reviewed clean source is published unchanged with one hash and no JSON files', () => {
  const fixture = setup(), input = editor(fixture.directory)
  expect(input.scope).toBe('sentence')
  expect(input.source.sha256).toBe(sha256(fixture.text))
  const payload = proposal(input)
  expect(Object.hasOwn(payload.review, 'inputSha256')).toBe(false)
  expect(complete(fixture.directory, input, payload).outcome).toMatch(/passed|published|succeeded/)
  expect(readFileSync(finalPath(fixture.directory), 'utf8')).toBe(fixture.text)
  expect(readdirSync(fixture.directory, { recursive: true }).map(String).filter(path => /\.(jsonl?|sqlite)$|TODO\.md$|\.lock/.test(path))).toEqual([])
  expect(sajuState(fixture.directory).state).toBe('done')
  expect(() => createAttempt(fixture.directory, 'saju')).toThrow()
})

test('automatic and additional semantic targets remove only their local clause', () => {
  for (const [phrase, automatic] of [['단정하지 않는다.', true], ['이 문서가 미래의 결과를 보장해 주지는 않는다.', false]] as const) {
    const text = interpretation().replace('### S-02', `${phrase}\n### S-02`), fixture = setup(text), input = editor(fixture.directory)
    expect(input.diagnostics.length > 0).toBe(automatic)
    const edit: Edit = { id: 'e1', target: 'S-01', original: phrase, replacement: '', ...(automatic ? { diagnosticCode: 'responsibility-avoidance' } : { reviewTargetId: 'secondary1' }) }
    expect(complete(fixture.directory, input, proposal(input, [edit])).outcome).toMatch(/passed|published|succeeded/)
    expect(readFileSync(finalPath(fixture.directory), 'utf8')).toBe(text.replace(phrase, ''))
    expect(readFileSync(join(fixture.directory, fixture.source.output), 'utf8')).toBe(text)
  }
})

test('semantic failures alone expand sentence to item to system and exhaust three calls', () => {
  const fixture = setup()
  for (const [index, scope] of ['sentence', 'item', 'system'].entries()) {
    const input = editor(fixture.directory)
    expect(input.number).toBe(index + 1); expect(input.scope).toBe(scope)
    expect(() => createAttempt(fixture.directory, 'saju')).toThrow('Unfinished')
    recoverable(fixture, input, proposal(input, [], { secondary: [{ id: 'pending', target: 'S-01', status: 'needs-expansion', reason: '관련 조건을 함께 검토해야 한다.', editIds: [] }], unresolved: ['pending'], nextScopeReason: '주변 문맥 검토 필요' }))
  }
  expect(sajuState(fixture.directory).state).toBe('exhausted')
  expect(() => createAttempt(fixture.directory, 'saju')).toThrow()
})

for (const mode of ['secondary-target', 'deferred', 'review-report', 'preservation-false', 'preservation-prose', 'review-system', 'review-attempt', 'review-scope']) {
  test(`semantic contract rejects ${mode} while preserving source and permitting next scope`, () => {
    const fixture = setup(), input = editor(fixture.directory), payload = proposal(input)
    if (mode === 'secondary-target') payload.review.secondary = [{ id: 'invalid', target: 'S-99', status: 'preserved', reason: '존재하지 않는 항목', editIds: [] }] as any
    if (mode === 'deferred') Object.assign(payload.review, { secondary: [{ id: 'deferred', target: 'S-01', status: 'deferred', reason: '의미 판단 보류', editIds: [] }], unresolved: ['deferred'], nextScopeReason: '조건 확인 필요' })
    if (mode === 'review-report') payload.reviewMarkdown = ''
    if (mode === 'preservation-false') (payload.review as any).preservationConfirmed = false
    if (mode === 'preservation-prose') (payload.review as any).preservationConfirmed = '보존했다'
    if (mode === 'review-system') payload.review.system = 'natal'
    if (mode === 'review-attempt') payload.review.attempt += 1
    if (mode === 'review-scope') payload.review.scope = 'system'
    recoverable(fixture, input, payload)
    expect(editor(fixture.directory).scope).toBe('item')
  })
}

for (const mode of ['omitted', 'unresolved', 'false-positive']) {
  test(`automatic diagnostic ${mode} does not become automatic semantic approval`, () => {
    const fixture = setup(interpretation() + '\n단정하지 않는다.'), input = editor(fixture.directory)
    expect(input.diagnostics.length).toBeGreaterThan(0)
    const payload = proposal(input, [], { primary: mode === 'omitted' ? [] : input.diagnostics.map((_: any, diagnosticIndex: number) => ({ diagnosticIndex, status: mode, reason: '원문 유지 판단', editIds: [] })), nextScopeReason: '진단 문맥 재검토 필요' })
    const result = recoverable(fixture, input, payload)
    expect(JSON.stringify(result.data.result)).toContain(mode === 'omitted' ? 'editing-contract' : 'responsibility-avoidance')
  })
}

test('malformed stdin JSON is recorded as an editing contract failure rather than losing the attempt', () => {
  const fixture = setup(), input = editor(fixture.directory)
  const response = Bun.spawnSync(['bun', editCLI, fixture.directory, input.attempt], { stdin: Buffer.from('{') })
  // A recorded domain outcome is exit zero; malformed editor output consumes its existing invocation.
  expect(response.exitCode).toBe(0)
  expect(JSON.parse(response.stdout.toString()).status).toBe('editing-failed')
  expect(readFileSync(join(fixture.directory, input.attempt, 'result.md'), 'utf8')).toContain('editing-contract')
  expect(editor(fixture.directory).scope).toBe('item')
})

// Without a stored submission there is no separate hard-block state: a proposal for a different source is an editing contract failure.
test('source hash mismatch and source mutation are editing contract failures that never publish', () => {
  for (const mode of ['payload-hash', 'source-bytes']) {
    const fixture = setup(), input = editor(fixture.directory), payload = proposal(input)
    if (mode === 'payload-hash') payload.sourceSha256 = '0'.repeat(64)
    else writeFileSync(join(fixture.directory, fixture.source.output), fixture.text + '\n새 문장.')
    const result = finishEdit(fixture.directory, input.attempt, payload)
    expect(result.status).toBe('editing-failed')
    expect(JSON.stringify(result.errors)).toMatch(/hash/i)
    expect(existsSync(finalPath(fixture.directory))).toBe(false)
    expect(sajuState(fixture.directory).state).not.toBe('publish')
  }
})

for (const mode of ['id', 'evidence', 'heading', 'item-order']) {
  test(`item scope preserves protected ${mode} metadata and order`, () => {
    const fixture = setup(), input = expand(fixture)
    const first = fixture.text.slice(fixture.text.indexOf('### S-01'), fixture.text.indexOf('### S-02'))
    const second = fixture.text.slice(fixture.text.indexOf('### S-02'), fixture.text.indexOf('### S-03'))
    const evidence = first.match(/근거: .+/)![0]
    const edit = mode === 'id' ? semantic('S-01', '### S-01', '### S-09') : mode === 'evidence' ? semantic('S-01', evidence, '근거: S-E9999999999999999') : mode === 'heading' ? semantic('## 원국과 십신 구조', '## 원국과 십신 구조', '## 다른 구조') : semantic('S-01', first + second, second + first)
    recoverable(fixture, input, proposal(input, [edit]), /protected|preserv|보존|target|scope/i)
  })
}

test('nonunique source, overlapping edits and review target borrowing fail for their contract reason', () => {
  for (const mode of ['unique', 'overlap', 'target-borrow']) {
    const fixture = setup(), input = editor(fixture.directory)
    const edits = mode === 'unique' ? [semantic('S-01', '근거 없음', '대체')] : mode === 'overlap' ? [semantic('S-01', '영역: 성격과 기질', '영역: 성격과 기질 '), { ...semantic('S-01', '성격과 기질', '성격과 기질 '), id: 'e2' }] : [semantic('S-01', '영역: 성격과 기질', '영역: 성격과 기질')]
    const payload = proposal(input, edits)
    if (mode === 'target-borrow') payload.review.secondary.push({ id: 'different', target: 'S-02', status: 'fixed', reason: '다른 항목에 연결할 수 없다.', editIds: ['e1'] })
    recoverable(fixture, input, payload, mode === 'unique' ? /exactly once|unique|유일/i : mode === 'overlap' ? /overlap|중첩/i : /link|target|연결|위치/i)
  }
})

test('sentence edits preserve decimal and abbreviation clauses but reject multi-sentence expansion', () => {
  const original = '조건이 맞으면 1.5배의 집중과 e.g. 짧은 반응으로 나타날 수 있다.'
  const fixture = setup(interpretation().replace('## 계산 전제', '## 계산 전제\n' + original)), input = editor(fixture.directory)
  const replacement = original.replace('짧은', '빠른')
  expect(complete(fixture.directory, input, proposal(input, [semantic('## 계산 전제', original, replacement)])).outcome).toMatch(/passed|published|succeeded/)
  expect(readFileSync(finalPath(fixture.directory), 'utf8')).toBe(fixture.text.replace(original, replacement))
  for (const replacement of ['제공 자료가 있다. 다른 주제를 설명한다.', '제공 자료가 있다.\n\n새 문단을 추가한다.']) {
    const fixture = setup(interpretation().replace('## 계산 전제', '## 계산 전제\n계산 자료가 있다.')), input = editor(fixture.directory)
    recoverable(fixture, input, proposal(input, [semantic('## 계산 전제', '계산 자료가 있다.', replacement)]), /sentence|scope|문장|범위/i)
  }
})

test('item and system scopes permit related complete interpretation edits after valid escalation', () => {
  for (const scope of ['item', 'system']) {
    const fixture = setup(), input = expand(fixture, scope)
    const original = fixture.text.match(/해석: (.+)/)![1], replacement = original.replace('실제 생활의 선택', '생활에서의 선택')
    expect(complete(fixture.directory, input, proposal(input, [semantic('S-01', original, replacement)])).outcome).toMatch(/passed|published|succeeded/)
    expect(readFileSync(finalPath(fixture.directory), 'utf8')).toBe(fixture.text.replace(original, replacement))
  }
})

test('publication I/O failure preserves source and is not recorded as a recoverable editing failure', () => {
  const fixture = setup(), input = editor(fixture.directory)
  mkdirSync(finalPath(fixture.directory), { recursive: true })
  expect(finishEdit(fixture.directory, input.attempt, proposal(input)).status).toBe('passed')
  expect(() => publishStep(fixture.directory, 'saju')).toThrow()
  expect(readFileSync(join(fixture.directory, fixture.source.output), 'utf8')).toBe(fixture.text)
  expect(readFileSync(join(fixture.directory, input.attempt, 'result.md'), 'utf8')).not.toContain('editing-contract')
  expect(sajuState(fixture.directory).state).toBe('publish')
})
