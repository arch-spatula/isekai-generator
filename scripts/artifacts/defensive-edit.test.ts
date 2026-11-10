import { expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { allocateRun, readRunManifest, updateRun } from './artifact-run'
import { makeRepository } from './test-fixtures'
import { finishSpecialistAttempt, prepareSpecialistAttempt } from './specialist-attempt'
import { seedDefensiveAcceptances } from './defensive-test-fixtures'
import { recordStageProgress } from './artifact-progress'
import { prepareDefensiveEdit, finishDefensiveEdit } from './defensive-edit'

const evidence = { version: 1, systems: { saju: [{ id: 'S-E0000000000000001', text: 'fixture' }], ziwei: [], natal: [] } }
const domains = ['성격과 기질', '직업과 적성', '재물', '연애와 배우자', '가족과 대인관계', '건강과 생활 리듬', '시기운']
const headings = ['# 사주팔자 심층 해석', '## 계산 전제', '## 원국과 십신 구조', '## 팔자 관계', '## 신살', '## 좌법과 인종법', '## 대운', '## 전문 해석 항목']
const valid = headings.join('\n') + '\n' + domains.map((domain, index) => `### S-0${index + 1}\n영역: ${domain}\n해상도: ${['원국 구조', '관계 작용', '운의 변화'][index % 3]}\n해석: ${'이 차트의 근거를 실제 생활의 선택과 반응 방식에 연결하여 강점과 마찰의 조건을 구체적으로 설명한다. '.repeat(2)}\n근거: S-E0000000000000001`).join('\n')

function setup(): string {
  const run = allocateRun(makeRepository(), 'personalized-gdd')
  updateRun(run, 'running')
  mkdirSync(join(run, 'docs/GDD'), { recursive: true })
  writeFileSync(join(run, 'docs/GDD/chart-evidence.json'), JSON.stringify(evidence))
  writeFileSync(join(run, 'docs/GDD/chart-report.md'), '四柱八字\nsynthetic saju\n紫微斗數 命盤\nsynthetic ziwei\nNatal Chart\nsynthetic natal')
  recordStageProgress(run, readRunManifest(run), 'chart-report', 'succeeded')
  return run
}

const hash = (text: string): string => createHash('sha256').update(text).digest('hex')
function source(run: string, text = valid): void {
  const input = prepareSpecialistAttempt(run, 'saju')
  writeFileSync(join(run, input.output), text)
  expect(finishSpecialistAttempt(run, 'saju', input.attempt).status).toBe('editing-required')
}
function proposal(run: string, input: ReturnType<typeof prepareDefensiveEdit>, edits: any[] = [], extra: Record<string, unknown> = {}): void {
  writeFileSync(join(run, input.edits), JSON.stringify({ sourceSha256: input.source.sha256, edits, review: {
    system: 'saju', attempt: input.attempt, scope: input.scope,
    primary: input.diagnostics.map((_: unknown, diagnosticIndex: number) => ({ diagnosticIndex, status: 'fixed', reason: '불필요한 예측 부정 절을 제거함', editIds: edits.map(edit => edit.id) })),
    secondary: [...new Set(edits.filter(edit => edit.reviewTargetId).map(edit => edit.reviewTargetId))].map(id => ({ id, target: edits.find(edit => edit.reviewTargetId === id).target, status: 'fixed', reason: '기존 근거와 관계 설명을 유지함', editIds: edits.filter(edit => edit.reviewTargetId === id).map(edit => edit.id) })),
    preservationConfirmed: true, unresolved: [], ...extra,
  } }))
  writeFileSync(join(run, input.review), '전체 문서의 계산 범위와 조건부 발현 설명을 보존하고 추가 방어문구를 검토했다.')
}
const final = (run: string): string => join(run, 'docs/GDD/saju-interpretation.md')

test('one top-level source hash binds review without a review hash and publishes the unchanged source', () => {
  const run = setup()
  source(run)
  const input = prepareDefensiveEdit(run, 'saju')
  expect(input.attempt).toBe(1)
  expect(input.scope).toBe('sentence')
  expect(input.source.sha256).toBe(hash(valid))
  expect(input.source.attempt).toBe(1)
  for (const path of [input.input, input.edits, input.review, input.candidate, input.result, input.source.output]) expect(isAbsolute(path)).toBe(false)
  proposal(run, input)
  const submission = JSON.parse(readFileSync(join(run, input.edits), 'utf8'))
  expect(submission.sourceSha256).toBe(hash(valid))
  expect(Object.hasOwn(submission.review, 'inputSha256')).toBe(false)
  expect(finishDefensiveEdit(run, 'saju', 1).status).toBe('passed')
  expect(readFileSync(final(run), 'utf8')).toBe(valid)
  expect(readFileSync(join(run, input.candidate), 'utf8')).toBe(valid)
  const accepted = JSON.parse(readFileSync(join(run, 'garbage/defensive-editing/saju/accepted.json'), 'utf8'))
  expect(JSON.stringify(accepted)).toContain(hash(valid))
  expect(() => prepareDefensiveEdit(run, 'saju')).toThrow()
  expect(() => prepareSpecialistAttempt(run, 'saju')).toThrow()
})

test('automatic diagnostic and additional semantic target use local edits without rewriting source', () => {
  for (const [phrase, automatic] of [['단정하지 않는다.', true], ['이 문서가 미래의 결과를 보장해 주지는 않는다.', false]] as const) {
    const run = setup()
    const text = valid.replace('## 계산 전제', '## 계산 전제\n제공된 자료의 범위 안에서 원국을 계산했다.').replace('### S-02', `${phrase}\n### S-02`)
    source(run, text)
    const input = prepareDefensiveEdit(run, 'saju')
    expect(input.diagnostics.length > 0).toBe(automatic)
    proposal(run, input, [{ id: 'edit-1', target: 'S-01', original: phrase, replacement: '', ...(automatic ? { diagnosticCode: 'responsibility-avoidance' } : { reviewTargetId: 'semantic-1' }) }])
    expect(finishDefensiveEdit(run, 'saju', 1).status).toBe('passed')
    expect(readFileSync(final(run), 'utf8')).toBe(text.replace(phrase, ''))
    expect(readFileSync(join(run, input.source.output), 'utf8')).toBe(text)
  }
})

test('unresolved semantic targets expand scope only after recorded failure and stop at three calls', () => {
  const run = setup(); source(run)
  for (const [index, scope] of ['sentence', 'item', 'system'].entries()) {
    const input = prepareDefensiveEdit(run, 'saju')
    expect(input.attempt).toBe(index + 1); expect(input.scope).toBe(scope)
    expect(() => prepareDefensiveEdit(run, 'saju')).toThrow()
    proposal(run, input, [], { secondary: [{ id: 'pending-1', target: 'S-01', status: 'needs-expansion', reason: '주변 문맥과 항목의 관계를 함께 수정해야 함', editIds: [] }], unresolved: ['pending-1'], nextScopeReason: 'S-01의 주변 관계 설명까지 편집 필요' })
    expect(finishDefensiveEdit(run, 'saju', index + 1).status).toBe('editing-failed')
    expect(existsSync(join(run, input.result))).toBe(true)
    expect(existsSync(final(run))).toBe(false)
  }
  expect(() => prepareDefensiveEdit(run, 'saju')).toThrow()
  expect(() => prepareSpecialistAttempt(run, 'saju')).toThrow()
})

test('execution errors, recording failure and cancellation block additional editing while preserving siblings', () => {
  for (const mode of ['execution', 'record', 'cancel']) {
    const run = setup(); source(run)
    writeFileSync(join(run, 'docs/GDD/ziwei-interpretation.md'), 'accepted sibling')
    const input = prepareDefensiveEdit(run, 'saju')
    if (mode === 'execution') expect(finishDefensiveEdit(run, 'saju', 1, true).status).toBe('execution-failed')
    if (mode === 'record') {
      proposal(run, input); mkdirSync(join(run, input.result))
      expect(() => finishDefensiveEdit(run, 'saju', 1)).toThrow()
    }
    if (mode === 'cancel') {
      updateRun(run, 'cancelled')
      expect(() => finishDefensiveEdit(run, 'saju', 1)).toThrow()
    }
    expect(() => prepareDefensiveEdit(run, 'saju')).toThrow()
    expect(existsSync(final(run))).toBe(false)
    expect(readFileSync(join(run, 'docs/GDD/ziwei-interpretation.md'), 'utf8')).toBe('accepted sibling')
  }
})

test('deferred review, missing review report and unconfirmed preservation cannot be accepted', () => {
  for (const mode of ['deferred', 'report', 'preservation']) {
    const run = setup(); source(run)
    const input = prepareDefensiveEdit(run, 'saju')
    proposal(run, input, [], mode === 'deferred' ? { secondary: [{ id: 'uncertain', target: 'S-01', status: 'deferred', reason: '판단 보류', editIds: [] }], unresolved: ['uncertain'] } : mode === 'preservation' ? { preservationConfirmed: false } : {})
    if (mode === 'report') writeFileSync(join(run, input.review), '')
    let rejected = false
    try { rejected = finishDefensiveEdit(run, 'saju', 1).status !== 'passed' } catch { rejected = true }
    expect(rejected).toBe(true)
    expect(existsSync(final(run))).toBe(false)
  }
})

test('public CLI prepares semantic review and records execution error without expanding scope', () => {
  const run = setup(); source(run)
  const cli = join(import.meta.dir, '../manage-defensive-edit.ts')
  const call = (...args: string[]) => Bun.spawnSync(['bun', cli, ...args])
  const prepared = call('prepare', run, 'saju')
  expect(prepared.exitCode).toBe(0)
  expect(JSON.parse(prepared.stdout.toString()).scope).toBe('sentence')
  const failed = call('error', run, 'saju', '1')
  expect(failed.exitCode).toBe(0)
  expect(JSON.parse(failed.stdout.toString()).status).toBe('execution-failed')
  expect(call('prepare', run, 'saju').exitCode).toBe(1)
  expect(call('finish', run, 'invalid', '1').exitCode).toBe(1)
})

test('automatic diagnostics cannot be silently omitted from review or left in a candidate', () => {
  for (const mode of ['omitted', 'unresolved', 'false-positive']) {
    const run = setup(); source(run, valid + '\n단정하지 않는다.')
    const input = prepareDefensiveEdit(run, 'saju')
    expect(input.diagnostics.length).toBeGreaterThan(0)
    proposal(run, input, [], { primary: mode === 'omitted' ? [] : input.diagnostics.map((_: unknown, diagnosticIndex: number) => ({ diagnosticIndex, status: mode, reason: '원문 유지', editIds: [] })) })
    let rejected = false
    try { rejected = finishDefensiveEdit(run, 'saju', 1).status !== 'passed' } catch { rejected = true }
    expect(rejected).toBe(true)
    expect(existsSync(final(run))).toBe(false)
  }
})

test('changed source invalidates a prepared edit even if proposal hash is unchanged', () => {
  const run = setup(); source(run)
  const input = prepareDefensiveEdit(run, 'saju'); proposal(run, input)
  writeFileSync(join(run, input.source.output), valid + '\n새 문장.')
  let rejected = false
  try { rejected = finishDefensiveEdit(run, 'saju', 1).status !== 'passed' } catch { rejected = true }
  expect(rejected).toBe(true)
  expect(existsSync(final(run))).toBe(false)
})

function expand(run: string): ReturnType<typeof prepareDefensiveEdit> {
  const first = prepareDefensiveEdit(run, 'saju')
  proposal(run, first, [], { secondary: [{ id: 'pending', target: 'S-01', status: 'needs-expansion', reason: 'S-01 문맥 편집 필요', editIds: [] }], unresolved: ['pending'], nextScopeReason: 'S-01 문맥 편집 필요' })
  expect(finishDefensiveEdit(run, 'saju', first.attempt).status).toBe('editing-failed')
  return prepareDefensiveEdit(run, 'saju')
}
function semanticEdit(target: string, original: string, replacement: string): any {
  return { id: 'edit-1', target, original, replacement, reviewTargetId: 'semantic-1' }
}
function expectProposalError(run: string, input: ReturnType<typeof prepareDefensiveEdit>, expected: RegExp): void {
  expect(() => finishDefensiveEdit(run, 'saju', input.attempt)).toThrow(expected)
  expect(existsSync(final(run))).toBe(false)
  expect(existsSync(join(run, input.candidate))).toBe(false)
  expect(existsSync(join(run, 'garbage/defensive-editing/saju/accepted.json'))).toBe(false)
}

test('item scope rejects independent protected metadata changes after a valid escalation', () => {
  const firstItem = valid.slice(valid.indexOf('### S-01'), valid.indexOf('### S-02'))
  const secondItem = valid.slice(valid.indexOf('### S-02'), valid.indexOf('### S-03'))
  const cases = [
    semanticEdit('S-01', '### S-01', '### S-09'),
    semanticEdit('S-01', '근거: S-E0000000000000001', '근거: S-E9999999999999999'),
    semanticEdit('S-01', firstItem, secondItem),
    semanticEdit('## 원국과 십신 구조', '## 원국과 십신 구조', '## 다른 구조'),
  ]
  for (const edit of cases) {
    const run = setup(); source(run)
    const input = expand(run)
    expect(input.scope).toBe('item')
    proposal(run, input, [edit])
    expectProposalError(run, input, /Protected|preserv|보존/i)
    expect(readFileSync(join(run, input.source.output), 'utf8')).toBe(valid)
  }
})

test('unique original, overlap and source hash are rejected for their own contract reason', () => {
  const cases = [
    { edits: [semanticEdit('S-01', '이 차트의 근거를', '이 원국의 근거를')], error: /exactly once|unique|유일/i },
    { edits: [semanticEdit('S-01', '영역: 성격과 기질', '영역: 성격과 기질 '), { ...semanticEdit('S-01', '성격과 기질', '성격과 기질 '), id: 'edit-2' }], error: /overlap|중첩/i },
  ]
  for (const entry of cases) {
    const run = setup(); source(run); const input = prepareDefensiveEdit(run, 'saju')
    proposal(run, input, entry.edits)
    expectProposalError(run, input, entry.error)
  }
  const run = setup(); source(run); const input = prepareDefensiveEdit(run, 'saju'); proposal(run, input)
  const data = JSON.parse(readFileSync(join(run, input.edits), 'utf8')); data.sourceSha256 = '0'.repeat(64)
  writeFileSync(join(run, input.edits), JSON.stringify(data))
  expectProposalError(run, input, /hash/i)
})

test('a clause replacement preserves surrounding conditional explanation including decimals and abbreviations', () => {
  const clause = '조건이 맞으면 1.5배의 집중과 e.g. 짧은 반응으로 나타날 수 있다.'
  const text = valid.replace('## 계산 전제', '## 계산 전제\n' + clause)
  const run = setup(); source(run, text)
  const input = prepareDefensiveEdit(run, 'saju')
  proposal(run, input, [semanticEdit('## 계산 전제', clause, '조건이 맞으면 1.5배의 집중과 e.g. 빠른 반응으로 나타날 수 있다.')])
  expect(finishDefensiveEdit(run, 'saju', 1).status).toBe('passed')
  expect(readFileSync(final(run), 'utf8')).toBe(text.replace('짧은 반응', '빠른 반응'))
})

test('sentence scope rejects expanding a short clause into multiple sentences or paragraphs', () => {
  for (const replacement of ['제공 자료가 있다. 다른 주제를 설명한다.', '제공 자료가 있다.\n\n새 문단을 추가한다.']) {
    const run = setup(); source(run, valid.replace('## 계산 전제', '## 계산 전제\n계산 자료가 있다.'))
    const input = prepareDefensiveEdit(run, 'saju')
    proposal(run, input, [semanticEdit('## 계산 전제', '계산 자료가 있다.', replacement)])
    expectProposalError(run, input, /sentence|scope|문장|범위/i)
  }
})

test('item and system scopes allow related multi-sentence edits after escalation', () => {
  for (const desired of [2, 3]) {
    const run = setup(); source(run)
    let input = expand(run)
    if (desired === 3) {
      proposal(run, input, [], { secondary: [{ id: 'pending', target: 'S-01', status: 'needs-expansion', reason: '관련 항목 연결 편집 필요', editIds: [] }], unresolved: ['pending'], nextScopeReason: '관련 항목 연결 편집 필요' })
      expect(finishDefensiveEdit(run, 'saju', 2).status).toBe('editing-failed')
      input = prepareDefensiveEdit(run, 'saju')
    }
    const original = valid.slice(valid.indexOf('해석: ') + 4, valid.indexOf('\n근거:'))
    const replacement = original.replaceAll('실제 생활의 선택', '생활에서의 선택')
    proposal(run, input, [semanticEdit('S-01', original, replacement)])
    expect(finishDefensiveEdit(run, 'saju', desired).status).toBe('passed')
    expect(readFileSync(final(run), 'utf8')).toBe(valid.replace(original, replacement))
  }
})

test('review links cannot claim a diagnostic at another location or a different semantic target', () => {
  for (const mode of ['diagnostic-location', 'reverse-link']) {
    const run = setup(); source(run, valid + '\n단정하지 않는다.')
    const input = prepareDefensiveEdit(run, 'saju')
    const edit = { id: 'e', target: 'S-01', original: '실제 생활의 선택', replacement: '생활의 선택', diagnosticCode: 'responsibility-avoidance' }
    // Unique local clause avoids a duplicate-match rejection hiding the link check.
    edit.original = '영역: 성격과 기질'; edit.replacement = '영역: 성격과 기질'
    proposal(run, input, [edit], mode === 'reverse-link' ? { secondary: [{ id: 'other', target: 'S-02', status: 'fixed', reason: '다른 항목은 이 편집과 연결되지 않음', editIds: ['e'] }] } : {})
    expectProposalError(run, input, /diagnostic|location|link|target|연결|위치/i)
  }
})

test('CLI finish publishes a fully reviewed clean source', () => {
  const run = setup(); source(run)
  const cli = join(import.meta.dir, '../manage-defensive-edit.ts')
  const prepared = Bun.spawnSync(['bun', cli, 'prepare', run, 'saju'])
  expect(prepared.exitCode).toBe(0)
  const input = JSON.parse(prepared.stdout.toString()); proposal(run, input)
  const finished = Bun.spawnSync(['bun', cli, 'finish', run, 'saju', '1'])
  expect(finished.exitCode).toBe(0)
  expect(JSON.parse(finished.stdout.toString()).status).toBe('passed')
  expect(readFileSync(final(run), 'utf8')).toBe(valid)
})

test('integration requires three matching accepted documents and rejects final hash mutation', () => {
  for (const mode of ['missing', 'mutated', 'accepted']) {
    const run = setup()
    seedDefensiveAcceptances(run)
    for (const system of ['saju', 'ziwei', 'natal'] as const) recordStageProgress(run, readRunManifest(run), system, 'succeeded')
    if (mode === 'missing') writeFileSync(join(run, 'garbage/defensive-editing/natal/accepted.json'), '{}')
    if (mode === 'mutated') writeFileSync(join(run, 'docs/GDD/saju-interpretation.md'), 'tampered')
    if (mode === 'accepted') expect(() => recordStageProgress(run, readRunManifest(run), 'integration', 'running')).not.toThrow()
    else expect(() => recordStageProgress(run, readRunManifest(run), 'integration', 'running')).toThrow()
  }
})

test('a second editing attempt rechecks the original specialist source before publication', () => {
  const run = setup(); source(run)
  const first = prepareDefensiveEdit(run, 'saju')
  proposal(run, first, [], { secondary: [{ id: 'pending', target: 'S-01', status: 'needs-expansion', reason: '관련 문맥 편집 필요', editIds: [] }], unresolved: ['pending'], nextScopeReason: '관련 문맥 편집 필요' })
  expect(finishDefensiveEdit(run, 'saju', 1).status).toBe('editing-failed')
  const second = prepareDefensiveEdit(run, 'saju'); proposal(run, second)
  writeFileSync(join(run, first.source.output), valid + '\n최초 원문 변조.')
  expect(() => finishDefensiveEdit(run, 'saju', 2)).toThrow(/source|hash|원문/i)
  expect(existsSync(final(run))).toBe(false)
})

test('a fixed secondary decision cannot borrow an edit linked only to another reviewed target', () => {
  const run = setup(); source(run)
  const input = prepareDefensiveEdit(run, 'saju')
  const edit = { ...semanticEdit('S-02', '영역: 직업과 적성', '영역: 직업과 적성'), reviewTargetId: 'B' }
  proposal(run, input, [edit], { secondary: [
    { id: 'A', target: 'S-01', status: 'fixed', reason: 'A 수정 주장', editIds: ['edit-1'] },
    { id: 'B', target: 'S-02', status: 'fixed', reason: 'B와 연결된 제안', editIds: ['edit-1'] },
  ] })
  expectProposalError(run, input, /link|target|연결|대상/i)
})

test('item order cannot be permuted even when the set of IDs remains identical', () => {
  const run = setup(); source(run)
  const input = expand(run)
  proposal(run, input, [semanticEdit('S-01', '### S-01', '### S-02'), { ...semanticEdit('S-02', '### S-02', '### S-01'), id: 'edit-2', reviewTargetId: 'semantic-2' }])
  expectProposalError(run, input, /Protected|preserv|보존/i)
})

test('integration independently checks original source, candidate and editing result provenance', () => {
  for (const mode of ['source', 'candidate', 'result-status', 'result-hash']) {
    const run = setup(); seedDefensiveAcceptances(run)
    for (const system of ['saju', 'ziwei', 'natal'] as const) recordStageProgress(run, readRunManifest(run), system, 'succeeded')
    const accepted = JSON.parse(readFileSync(join(run, 'garbage/defensive-editing/saju/accepted.json'), 'utf8'))
    if (mode === 'source') writeFileSync(join(run, accepted.source), valid + '\n원문 변경.')
    if (mode === 'candidate') writeFileSync(join(run, accepted.candidate), valid + '\n후보 변경.')
    if (mode.startsWith('result-')) {
      const path = join(run, 'garbage/defensive-editing/saju/001/result.json')
      const result = JSON.parse(readFileSync(path, 'utf8'))
      if (mode === 'result-status') result.status = 'editing-failed'
      else result.sha256 = '0'.repeat(64)
      writeFileSync(path, JSON.stringify(result))
    }
    expect(() => recordStageProgress(run, readRunManifest(run), 'integration', 'running')).toThrow(/hash|validation|source|candidate|원문|검증/i)
    expect(existsSync(join(run, 'garbage/progress/integration.json'))).toBe(false)
  }
})

test('integration revalidates structure even when all acceptance records and hashes agree', () => {
  const run = setup(); seedDefensiveAcceptances(run)
  for (const system of ['saju', 'ziwei', 'natal'] as const) recordStageProgress(run, readRunManifest(run), system, 'succeeded')
  const acceptedPath = join(run, 'garbage/defensive-editing/saju/accepted.json')
  const accepted = JSON.parse(readFileSync(acceptedPath, 'utf8'))
  const invalid = valid.replace('## 원국과 십신 구조', '## 삭제된 필수 구조')
  const invalidHash = hash(invalid)
  for (const path of [accepted.source, accepted.candidate, accepted.output]) writeFileSync(join(run, path), invalid)
  accepted.sha256 = invalidHash; accepted.sourceSha256 = invalidHash
  writeFileSync(acceptedPath, JSON.stringify(accepted))
  writeFileSync(join(run, 'garbage/attempts/saju/accepted.json'), JSON.stringify(accepted))
  const resultPath = join(run, 'garbage/defensive-editing/saju/001/result.json')
  const result = JSON.parse(readFileSync(resultPath, 'utf8'))
  result.sha256 = invalidHash; result.sourceSha256 = invalidHash
  writeFileSync(resultPath, JSON.stringify(result))
  expect(() => recordStageProgress(run, readRunManifest(run), 'integration', 'running')).toThrow(/validation|검증/i)
  expect(existsSync(join(run, 'garbage/progress/integration.json'))).toBe(false)
})

test('editing-induced reading validation failure remains recoverable at the next editing scope', () => {
  // Exercise the existing validator contract, rather than adding a new semantic length policy.
  const removed = '관계의 긴장을 작업의 우선순위로 옮기고 환경이 맞을 때 집중력을 높이는 조건을 설명한다. '
  const retained = '원국의 관계를 근거로 생활의 선택과 반응을 설명하며 환경에 따른 발현 차이를 살핀다.'
  const firstReading = valid.slice(valid.indexOf('해석: ') + 4, valid.indexOf('\n근거:'))
  const text = valid.replace(firstReading, removed + retained)
  const run = setup(); source(run, text)
  const first = prepareDefensiveEdit(run, 'saju')
  proposal(run, first, [semanticEdit('S-01', removed, '')])
  const result = finishDefensiveEdit(run, 'saju', 1)
  expect(result.status).toBe('editing-failed')
  expect(result.errors.some(error => error.code === 'item-reading')).toBe(true)
  expect(existsSync(final(run))).toBe(false)
  const second = prepareDefensiveEdit(run, 'saju')
  expect(second.scope).toBe('item')
  expect(readFileSync(join(run, second.source.output), 'utf8')).toBe(text.replace(removed, ''))
  proposal(run, second, [{ ...semanticEdit('S-01', retained, removed + retained), diagnosticCode: 'item-reading' }])
  expect(finishDefensiveEdit(run, 'saju', 2).status).toBe('passed')
  expect(readFileSync(final(run), 'utf8')).toBe(text)
})


test('review system, attempt and scope independently bind the prepared input without a review hash', () => {
  for (const identity of [{ system: 'ziwei' }, { attempt: 2 }, { scope: 'item' }]) {
    const run = setup(); source(run)
    const input = prepareDefensiveEdit(run, 'saju')
    proposal(run, input, [], identity)
    const submission = JSON.parse(readFileSync(join(run, input.edits), 'utf8'))
    expect(submission.sourceSha256).toBe(hash(valid))
    expect(Object.hasOwn(submission.review, 'inputSha256')).toBe(false)
    expectProposalError(run, input, /Review input mismatch/i)
    expect(existsSync(join(run, 'garbage/defensive-editing/saju/accepted.json'))).toBe(false)
  }
})

test('preservation confirmation requires a boolean rather than explanatory prose', () => {
  const run = setup(); source(run)
  const input = prepareDefensiveEdit(run, 'saju')
  proposal(run, input, [], { preservationConfirmed: '기존 근거와 해석을 보존했다.' })
  expectProposalError(run, input, /Incomplete review/i)
})

test('sentence deletion rejects a trailing newline in original despite a valid diagnostic link', () => {
  const phrase = '단정하지 않는다.'
  const run = setup(); source(run, valid.replace('### S-02', `${phrase}\n### S-02`))
  const input = prepareDefensiveEdit(run, 'saju')
  expect(input.diagnostics).toHaveLength(1)
  expect(input.diagnostics[0].code).toBe('responsibility-avoidance')
  proposal(run, input, [{ id: 'delete-defense', target: 'S-01', original: `${phrase}\n`, replacement: '', diagnosticCode: 'responsibility-avoidance' }])
  expectProposalError(run, input, /Sentence scope exceeded/i)
})
