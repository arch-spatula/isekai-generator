import { expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { acceptedSpecialists, publish } from '../fixtures/sqlite-pipeline-runtime'
import { integratedInterpretation, combatBrief, worldBrief, pipelineGdd } from '../fixtures/sqlite-pipeline'
import { chartFixture, prepare, call, ok, submit, finish, request, read, sha256, tree } from './sqlite-test-fixtures'

type Edit = { id: string, target: string, original: string, replacement: string, diagnosticCode?: string, reviewTargetId?: string }
function setup(text = integratedInterpretation) {
  const fixture = chartFixture()
  acceptedSpecialists(fixture.root, fixture.run)
  const source = prepare(fixture.root, fixture.run, 'integration').data
  writeFileSync(resolve(fixture.root, source.output), text)
  submit(fixture.root, source, { path: source.output, sha256: sha256(text) })
  expect(finish(fixture.root, source).outcome).toBe('editing-required')
  return { ...fixture, text, source }
}
function editor(fixture: ReturnType<typeof setup>) {
  const attempt = prepare(fixture.root, fixture.run, 'integration', 'edit').data
  const input = ok(call(fixture.root, ['input', '--attempt', attempt.attemptId, '--claim', attempt.claim], { read: true })).data
  return { ...attempt, ...input }
}
function proposal(input: Record<string, any>, edits: Edit[] = [], review: Record<string, any> = {}) {
  return { sourceSha256: input.source.sha256, edits, review: {
    system: 'integration', attempt: input.number, scope: input.scope,
    primary: input.diagnostics.map((diagnostic: any, diagnosticIndex: number) => ({ diagnosticIndex, status: 'fixed', reason: '불필요한 면책 절만 제거하고 근거와 해석을 보존했다.', editIds: edits.filter(edit => edit.diagnosticCode === diagnostic.code).map(edit => edit.id) })),
    secondary: edits.filter(edit => edit.reviewTargetId).map(edit => ({ id: edit.reviewTargetId, target: edit.target, status: 'fixed', reason: '방어문구만 국소 제거했다.', editIds: [edit.id] })),
    preservationConfirmed: true, unresolved: [], ...review,
  }, reviewMarkdown: '통합 항목과 체계별 고유 통찰을 보존하고 전체 문서를 검토했다.' }
}
function complete(fixture: ReturnType<typeof setup>, input: Record<string, any>, payload: unknown) {
  submit(fixture.root, input, payload)
  return finish(fixture.root, input)
}
const finalPath = (fixture: ReturnType<typeof setup>) => join(fixture.directory, 'docs/GDD/chart-interpretation.md')
function downstream(fixture: ReturnType<typeof setup>) {
  publish(fixture.root, fixture.run, 'selection', combatBrief())
  publish(fixture.root, fixture.run, 'world-selection', worldBrief())
  publish(fixture.root, fixture.run, 'gdd', pipelineGdd())
}
function failed(fixture: ReturnType<typeof setup>, input: Record<string, any>, payload: unknown, reason?: RegExp) {
  const result = complete(fixture, input, payload)
  expect(result.outcome).toBe('editing-failed')
  if (reason) expect(JSON.stringify(result)).toMatch(reason)
  expect(readFileSync(resolve(fixture.root, fixture.source.output), 'utf8')).toBe(fixture.text)
  expect(existsSync(finalPath(fixture))).toBe(false)
  return result
}

// §§1–3: generation alone never authorizes consumption, including diagnostics-free sources.
test('clean integration requires review, isolates editor input and exposes actual stable targets', () => {
  const fixture = setup()
  expect(existsSync(finalPath(fixture))).toBe(false)
  const blocked = call(fixture.root, ['prepare', '--run', fixture.run, '--stage', 'selection', '--kind', 'generate', '--request', request()])
  expect(blocked.code).toBe(1)
  expect(JSON.parse(blocked.stderr).error.code).toBe('prerequisite-incomplete')
  expect(read(fixture.root, 'next', fixture.run).data.actions).toContainEqual(expect.objectContaining({ stage: 'integration', kind: 'edit' }))
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
  expect(complete(fixture, input, proposal(input)).outcome).toMatch(/passed|published|succeeded/)
  expect(readFileSync(finalPath(fixture), 'utf8')).toBe(fixture.text)
  downstream(fixture)
  expect(ok(call(fixture.root, ['finalize', '--run', fixture.run, '--request', request()])).outcome).toBe('succeeded')
  expect(tree(join(fixture.root, 'artifacts')).filter(path => /\.jsonl?$/.test(path))).toEqual([])
})

for (const automatic of [true, false]) test(`integration locally edits ${automatic ? 'automatic diagnostic' : 'additional semantic target'}`, () => {
  const phrase = automatic ? '단정하지 않는다.' : '이 문서가 미래의 결과를 보장해 주지는 않는다.'
  const text = integratedInterpretation.replace('### I-02', `${phrase}\n### I-02`)
  const fixture = setup(text), input = editor(fixture)
  expect(input.diagnostics.length > 0).toBe(automatic)
  const edit: Edit = { id: 'local', target: 'I-01', original: phrase, replacement: '', ...(automatic ? { diagnosticCode: input.diagnostics[0].code } : { reviewTargetId: 'additional' }) }
  expect(complete(fixture, input, proposal(input, [edit])).outcome).toMatch(/passed|published|succeeded/)
  expect(readFileSync(finalPath(fixture), 'utf8')).toBe(text.replace(phrase, ''))
  expect(readFileSync(resolve(fixture.root, fixture.source.output), 'utf8')).toBe(text)
})

// §2: this checks delivery and durable acceptance of a supplied semantic judgment, not its quality.
test('justified limitation false positive remains unchanged through finalization', () => {
  const limitation = '출생 시각 자료가 없어 하우스 위치를 확정하지 않는다.'
  const fixture = setup(integratedInterpretation.replace('## 해석 원칙', `## 해석 원칙\n${limitation}`)), input = editor(fixture)
  expect(input.diagnostics.length).toBeGreaterThan(0)
  const primary = input.diagnostics.map((_: any, diagnosticIndex: number) => ({ diagnosticIndex, status: 'false-positive', reason: '실제 출생 시각 부재에 따른 자료 해상도 설명이므로 보존한다.', editIds: [] }))
  expect(complete(fixture, input, proposal(input, [], { primary })).outcome).toMatch(/passed|published|succeeded/)
  expect(readFileSync(finalPath(fixture), 'utf8')).toBe(fixture.text)
  downstream(fixture)
  expect(ok(call(fixture.root, ['finalize', '--run', fixture.run, '--request', request()])).outcome).toBe('succeeded')
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
  const exhausted = call(fixture.root, ['prepare', '--run', fixture.run, '--stage', 'integration', '--kind', 'edit', '--request', request()])
  expect(JSON.parse(exhausted.stderr).error.code).toBe('attempt-budget-exhausted')
})

test('unresolved semantics alone expand sentence to item to system and exhaust three calls', () => {
  const fixture = setup()
  for (const [index, scope] of ['sentence', 'item', 'system'].entries()) {
    const input = editor(fixture)
    expect(input.number).toBe(index + 1); expect(input.scope).toBe(scope)
    failed(fixture, input, proposal(input, [], { secondary: [{ id: 'pending', target: 'I-01', status: 'needs-expansion', reason: '관련 문맥이 필요하다.', editIds: [] }], unresolved: ['pending'], nextScopeReason: '항목의 조건과 함께 검토해야 한다.' }))
  }
  expect(call(fixture.root, ['prepare', '--run', fixture.run, '--stage', 'integration', '--kind', 'edit', '--request', request()]).code).toBe(1)
})

for (const mode of ['payload-hash', 'source-bytes', 'accepted-source-bytes', 'candidate-bytes', 'review-payload']) test(`integration refuses stale hash linkage: ${mode}`, () => {
  const fixture = setup(), input = editor(fixture), payload = proposal(input)
  if (mode === 'payload-hash') payload.sourceSha256 = '0'.repeat(64)
  if (mode === 'source-bytes') writeFileSync(resolve(fixture.root, fixture.source.output), fixture.text + '\n변조')
  if (['accepted-source-bytes', 'candidate-bytes', 'review-payload'].includes(mode)) {
    expect(complete(fixture, input, payload).outcome).toMatch(/passed|published|succeeded/)
    downstream(fixture)
    if (mode === 'candidate-bytes') writeFileSync(finalPath(fixture), fixture.text + '\n변조')
    if (mode === 'accepted-source-bytes') writeFileSync(resolve(fixture.root, fixture.source.output), fixture.text + '\n변조')
    if (mode === 'review-payload') {
      const db = new Database(join(fixture.root, 'artifacts/state.sqlite'))
      try {
        const altered = proposal(input, [], { preservationConfirmed: false })
        db.query('UPDATE attempts SET payload=? WHERE id=?').run(JSON.stringify(altered), input.attemptId)
      } finally { db.close() }
    }
    const result = call(fixture.root, ['finalize', '--run', fixture.run, '--request', request()])
    expect(result.code).toBe(1)
    expect(JSON.parse(result.stderr).error.code).toMatch(/integrity|hash|artifact/)
  } else {
    const submitted = call(fixture.root, ['submit', '--attempt', input.attemptId, '--claim', input.claim, '--request', request()], { stdin: JSON.stringify(payload) })
    const result = submitted.code ? submitted : call(fixture.root, ['finish', '--attempt', input.attemptId, '--claim', input.claim, '--request', request()])
    expect(result.code).toBe(1)
    expect(JSON.parse(result.stderr).error.code).toMatch(/integrity|hash/)
    expect(existsSync(finalPath(fixture))).toBe(false)
  }
})

for (const [original, replacement] of [['### I-01', '### I-09'], ['영역: 성격과 기질', '영역: 재물'], ['관계: 일관', '관계: 상충'], ['근거: S-01, Z-01, N-01', '근거: S-02, Z-01, N-01']]) test(`integration protects item metadata ${original}`, () => {
  const fixture = setup()
  const sentence = editor(fixture)
  failed(fixture, sentence, proposal(sentence, [], { secondary: [{ id: 'context', target: 'I-01', status: 'needs-expansion', reason: '항목 문맥이 필요하다.', editIds: [] }], unresolved: ['context'], nextScopeReason: '항목 검토 필요' }))
  const input = editor(fixture)
  expect(input.scope).toBe('item')
  failed(fixture, input, proposal(input, [{ id: 'protected', target: 'I-01', original, replacement, reviewTargetId: 'protected' }]), /protected|preserv|보존|target|scope/i)
})

test('terminated integration editor retains scope and invalidates its old claim', () => {
  const fixture = setup(), input = editor(fixture)
  ok(call(fixture.root, ['dispatch', '--attempt', input.attemptId, '--claim', input.claim, '--request', request()]))
  ok(call(fixture.root, ['bind-worker', '--attempt', input.attemptId, '--claim', input.claim, '--agent', 'synthetic-editor', '--request', request()]))
  ok(call(fixture.root, ['resume', '--run', fixture.run, '--request', request()], { stdin: JSON.stringify({ workers: [{ attemptId: input.attemptId, status: 'terminated', observer: 'synthetic-worker-api', reference: 'ended' }] }) }))
  const stale = call(fixture.root, ['submit', '--attempt', input.attemptId, '--claim', input.claim, '--request', request()], { stdin: JSON.stringify(proposal(input)) })
  expect(JSON.parse(stale.stderr).error.code).toBe('stale-claim')
  const retry = editor(fixture)
  expect(retry.number).toBe(2); expect(retry.scope).toBe('sentence')
  expect(complete(fixture, retry, proposal(retry)).outcome).toMatch(/passed|published|succeeded/)
})

test('malformed integration JSON spends an invocation while retaining sentence scope', () => {
  const fixture = setup(), input = editor(fixture)
  ok(call(fixture.root, ['submit', '--attempt', input.attemptId, '--claim', input.claim, '--request', request()], { stdin: '{' }))
  const result = finish(fixture.root, input)
  expect(result.outcome).toBe('editing-failed')
  expect(JSON.stringify(result)).toContain('editing-contract')
  const retry = editor(fixture)
  expect(retry.number).toBe(2); expect(retry.scope).toBe('sentence')
  expect(complete(fixture, retry, proposal(retry)).outcome).toMatch(/passed|published|succeeded/)
})

test('generated non-item target permits a local disclaimer edit', () => {
  const phrase = '이 문서가 미래의 결과를 보장해 주지는 않는다.'
  const fixture = setup(integratedInterpretation.replace('## 해석 원칙', `## 해석 원칙\n${phrase}`)), input = editor(fixture)
  const line = fixture.text.split('\n').indexOf(phrase) + 1
  const target = input.allowedTargets.find((target: any) => target.startLine <= line && target.endLine >= line)
  expect(target).toBeDefined()
  expect(target.target).not.toMatch(/^I-\d+$/)
  expect(complete(fixture, input, proposal(input, [{ id: 'local', target: target.target, original: phrase, replacement: '', reviewTargetId: 'local' }])).outcome).toMatch(/passed|published|succeeded/)
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

test('explicit resume rotates integration claim without reserving another edit', () => {
  const fixture = setup(), previous = editor(fixture)
  const resumed = ok(call(fixture.root, ['resume', '--run', fixture.run, '--request', request()]))
  const current = resumed.data.resumedAttempts.find((attempt: any) => attempt.stage === 'integration')
  expect(current.attemptId).toBe(previous.attemptId)
  expect(current.number).toBe(1)
  expect(current.scope).toBe('sentence')
  expect(current.claim).not.toBe(previous.claim)
  const stale = call(fixture.root, ['finish', '--attempt', previous.attemptId, '--claim', previous.claim, '--request', request()])
  expect(JSON.parse(stale.stderr).error.code).toBe('stale-claim')
  const input = { ...current, ...ok(call(fixture.root, ['input', '--attempt', current.attemptId, '--claim', current.claim], { read: true })).data }
  expect(complete(fixture, input, proposal(input)).outcome).toMatch(/passed|published|succeeded/)
})

// §4: the candidate differs from the immutable source; each retry component has its own assertion.
test('semantic retry exposes prior candidate, proposal, review and diagnostics separately', () => {
  const phrase = '단정하지 않는다.'
  const fixture = setup(integratedInterpretation.replace('### I-02', `${phrase}\n### I-02`)), input = editor(fixture)
  const payload = proposal(input, [{ id: 'local', target: 'I-01', original: phrase, replacement: '', diagnosticCode: input.diagnostics[0].code }], {
    secondary: [{ id: 'pending', target: 'I-02', status: 'needs-expansion', reason: '항목의 조건을 함께 검토해야 한다.', editIds: [] }], unresolved: ['pending'], nextScopeReason: '관련 항목의 문맥이 필요하다.',
  })
  const result = failed(fixture, input, payload)
  const retry = editor(fixture), candidate = fixture.text.replace(phrase, '')
  expect(retry.scope).toBe('item')
  expect(retry.previous.candidate).toEqual({ text: candidate, sha256: sha256(candidate) })
  expect(retry.previous.payload.edits).toEqual(payload.edits)
  expect(retry.previous.payload.sourceSha256).toBe(sha256(fixture.text))
  expect(retry.previous.payload.review).toEqual(payload.review)
  expect(retry.previous.payload.reviewMarkdown).toBe(payload.reviewMarkdown)
  expect(retry.previous.result.errors).toEqual(result.data.result.errors)
  expect(retry.previous.result.errors.length).toBeGreaterThan(0)
})

test('integration publication I/O recovery adopts the same editor without another invocation', () => {
  const fixture = setup(), input = editor(fixture)
  mkdirSync(finalPath(fixture), { recursive: true })
  submit(fixture.root, input, proposal(input))
  const failedPublication = call(fixture.root, ['finish', '--attempt', input.attemptId, '--claim', input.claim, '--request', request()])
  expect(failedPublication.code).toBe(1)
  expect(readFileSync(resolve(fixture.root, fixture.source.output), 'utf8')).toBe(fixture.text)
  expect(JSON.stringify(read(fixture.root, 'events', fixture.run))).not.toContain('editing-contract')
  expect(call(fixture.root, ['prepare', '--run', fixture.run, '--stage', 'integration', '--kind', 'edit', '--request', request()]).code).toBe(1)
  rmdirSync(finalPath(fixture))
  ok(call(fixture.root, ['resume', '--run', fixture.run, '--request', request()]))
  expect(readFileSync(finalPath(fixture), 'utf8')).toBe(fixture.text)
  const db = new Database(join(fixture.root, 'artifacts/state.sqlite'), { readonly: true })
  try {
    expect(db.query("SELECT kind,number FROM attempts WHERE run_id=? AND stage='integration' ORDER BY kind").all(fixture.run)).toEqual([{ kind: 'edit', number: 1 }, { kind: 'generate', number: 1 }])
  } finally { db.close() }
  expect(prepare(fixture.root, fixture.run, 'selection').data.stage).toBe('selection')
})

for (const change of ['new-position', 'changed-source', 'accepted-review']) test(`false-positive approval is bound to its source and location: ${change}`, () => {
  const phrase = '출생 시각 자료가 없어 하우스 위치를 확정하지 않는다.'
  const fixture = setup(integratedInterpretation.replace('## 해석 원칙', `## 해석 원칙\n${phrase}`)), input = editor(fixture)
  expect(input.diagnostics.length).toBeGreaterThan(0)
  const payload = proposal(input, [], { primary: input.diagnostics.map((_: any, diagnosticIndex: number) => ({ diagnosticIndex, status: 'false-positive', reason: '실제 자료 부재의 해상도 설명이다.', editIds: [] })) })
  expect(complete(fixture, input, payload).outcome).toMatch(/passed|published|succeeded/)
  if (change === 'accepted-review') {
    downstream(fixture)
    const db = new Database(join(fixture.root, 'artifacts/state.sqlite'))
    try {
      // Even a coherently rehashed payload must not replace the review bound at adoption.
      payload.review.primary[0].diagnosticIndex += 1
      const encoded = JSON.stringify(payload)
      db.query('UPDATE attempts SET payload=?,payload_hash=? WHERE id=?').run(encoded, sha256(encoded), input.attemptId)
    } finally { db.close() }
    const result = call(fixture.root, ['finalize', '--run', fixture.run, '--request', request()])
    expect(result.code).toBe(1)
    expect(JSON.parse(result.stderr).error.code).toMatch(/integrity|review|adoption/)
  } else {
    const altered = change === 'new-position'
      ? fixture.text.replace(`${phrase}\n`, '').replace('### I-02', `${phrase}\n### I-02`)
      : fixture.text.replace(phrase, `실제 자료의 해상도가 부족하다. ${phrase}`)
    writeFileSync(resolve(fixture.root, fixture.source.output), altered)
    writeFileSync(finalPath(fixture), altered)
    const result = call(fixture.root, ['prepare', '--run', fixture.run, '--stage', 'selection', '--kind', 'generate', '--request', request()])
    expect(result.code).toBe(1)
    expect(JSON.parse(result.stderr).error.code).toMatch(/integrity|hash|review|adoption/)
  }
})
