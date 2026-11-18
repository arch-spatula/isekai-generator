import { expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, cpSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { beforeGdd } from '../fixtures/sqlite-pipeline-runtime'
import { pipelineGdd, combatBrief, worldBrief, integratedInterpretation } from '../fixtures/sqlite-pipeline'
import { designDraft } from '../fixtures/design-assembly'
import { prepare, call, ok, submit, finish, request, sha256, read } from './sqlite-test-fixtures'
import { isValidGdd } from '../../.agents/skills/generate-gdd-from-interpretation/scripts/validate-gdd'

function database(root: string): Database { return new Database(join(root, 'artifacts/state.sqlite')) }
function stageAttempt() {
  const fixture = beforeGdd(), attempt = prepare(fixture.root, fixture.run, 'gdd').data
  const draft = designDraft('gdd', pipelineGdd())
  writeFileSync(attempt.output, draft)
  return { ...fixture, attempt, draft }
}
function failure(result: ReturnType<typeof call>, code: string): void {
  expect(result.code).toBe(1)
  expect(result.stdout).toBe('')
  expect(JSON.parse(result.stderr).error.code).toBe(code)
}
function row(root: string, attemptId: string): any {
  const db = database(root)
  try { return db.query('SELECT * FROM design_assemblies WHERE attempt_id=?').get(attemptId) } finally { db.close() }
}
function complete(root: string, attempt: any, id = request()) { return call(root, ['finish', '--attempt', attempt.attemptId, '--claim', attempt.claim, '--request', id]) }
function unpublished(root: string, run: string): void {
  const db = database(root)
  try {
    expect(db.query("SELECT count(*) AS n FROM documents WHERE run_id=? AND role='gdd' AND status='published'").get(run)).toEqual({ n: 0 })
    expect(db.query("SELECT count(*) AS n FROM attempts WHERE run_id=? AND stage='gdd'").get(run)).toEqual({ n: 1 })
  } finally { db.close() }
}

test('CLI submission binds immutable draft, pinned sources, final candidate, validation and subsequent publication hashes', () => {
  const { root, run, directory, attempt, draft } = stageAttempt()
  const input = ok(call(root, ['input', '--attempt', attempt.attemptId, '--claim', attempt.claim], { read: true })).data
  expect(input.assembly.format).toBe('design-assembly-v1')
  const contract = input.assembly.presentationContract
  expect(contract.sha256).toBe(sha256(contract.text))
  expect(input.documents.map((doc: any) => doc.stage)).toEqual(['chart-report', 'integration', 'selection', 'world-selection'])
  expect(input.documents.find((doc: any) => doc.stage === 'selection').text).toContain('```game-presentation')
  const submitted = request(), args = ['submit', '--attempt', attempt.attemptId, '--claim', attempt.claim, '--request', submitted]
  const body = JSON.stringify({ path: attempt.output, sha256: sha256(draft) })
  const first = ok(call(root, args, { stdin: body }))
  expect(ok(call(root, args, { stdin: body }))).toEqual(first)
  const finished = request(), accepted = ok(complete(root, attempt, finished))
  expect(accepted.outcome).toMatch(/passed|published|succeeded/)
  expect(ok(complete(root, attempt, finished))).toEqual(accepted)
  const binding = row(root, attempt.attemptId)
  expect(binding.draft_hash).toBe(sha256(draft))
  expect(resolve(root, binding.draft_path)).toBe(attempt.output)
  expect(binding.candidate_path).not.toBe(binding.draft_path)
  expect(dirname(binding.candidate_path)).toBe(dirname(binding.draft_path))
  expect(binding.source_hash).toMatch(/^[a-f0-9]{64}$/)
  const candidate = readFileSync(resolve(root, binding.candidate_path), 'utf8')
  expect(binding.candidate_hash).toBe(sha256(candidate))
  expect(readFileSync(attempt.output, 'utf8')).toBe(draft)
  expect(candidate).not.toBe(draft)
  expect(isValidGdd(candidate, '합성 차트', integratedInterpretation, input.documents.find((doc: any) => doc.stage === 'selection').text, input.documents.find((doc: any) => doc.stage === 'world-selection').text)).toBe(true)
  expect(readFileSync(join(directory, 'game/personalized-action-rpg-concept.md'), 'utf8')).toBe(candidate)
  const db = database(root)
  try {
    const doc = db.query("SELECT d.* FROM stages s JOIN documents d ON d.id=s.accepted_document WHERE s.run_id=? AND s.stage='gdd'").get(run) as any
    expect(doc.path).toBe(binding.candidate_path)
    expect(doc.sha256).toBe(binding.candidate_hash)
    expect(db.query('SELECT sha256,result FROM validations WHERE document_id=?').all(doc.id)).toContainEqual({ sha256: sha256(candidate), result: 'passed' })
    expect(db.query("SELECT count(*) AS n FROM attempts WHERE run_id=? AND stage='gdd'").get(run)).toEqual({ n: 1 })
  } finally { db.close() }
  expect(ok(call(root, ['finalize', '--run', run, '--request', request()])).outcome).toBe('succeeded')
})

test('submitted resume reuses a separate candidate and one attempt while retaining original draft', () => {
  const { root, run, attempt, draft } = stageAttempt()
  submit(root, attempt)
  const resumed = ok(call(root, ['resume', '--run', run, '--request', request()])).data.resumedAttempts.find((item: any) => item.stage === 'gdd')
  expect(resumed.attemptId).toBe(attempt.attemptId)
  expect(resumed.number).toBe(1)
  expect(finish(root, resumed).outcome).toMatch(/passed|published|succeeded/)
  const binding = row(root, attempt.attemptId)
  const candidate = readFileSync(resolve(root, binding.candidate_path), 'utf8')
  expect(candidate.match(/^```game-presentation/gm)).toHaveLength(1)
  expect(candidate.match(/^```combat-fingerprint/gm)).toHaveLength(1)
  expect(readFileSync(attempt.output, 'utf8')).toBe(draft)
})

test('terminated-worker recovery submits its draft into the same assembly route without a new model attempt', () => {
  const { root, run, attempt, draft } = stageAttempt()
  ok(call(root, ['dispatch', '--attempt', attempt.attemptId, '--claim', attempt.claim, '--request', request()]))
  ok(call(root, ['bind-worker', '--attempt', attempt.attemptId, '--claim', attempt.claim, '--agent', 'synthetic-worker', '--request', request()]))
  const recovered = ok(call(root, ['resume', '--run', run, '--request', request()], { stdin: JSON.stringify({ workers: [{ attemptId: attempt.attemptId, status: 'terminated', observer: 'synthetic-worker-api', reference: 'worker-ended' }] }) })).data.resumedAttempts.find((item: any) => item.stage === 'gdd')
  expect(recovered.attemptId).toBe(attempt.attemptId)
  expect(recovered.status).toBe('submitted')
  expect(finish(root, recovered).outcome).toMatch(/passed|published|succeeded/)
  expect(readFileSync(attempt.output, 'utf8')).toBe(draft)
  expect(row(root, attempt.attemptId).candidate_hash).not.toBe(sha256(draft))
})

test('publication conflict and reconcile preserve foreign bytes and publish the persisted candidate only', () => {
  const { root, run, directory, attempt, draft } = stageAttempt()
  submit(root, attempt)
  const final = join(directory, 'game/personalized-action-rpg-concept.md')
  mkdirSync(dirname(final), { recursive: true }); writeFileSync(final, 'foreign bytes')
  failure(complete(root, attempt), 'integrity-error')
  expect(readFileSync(final, 'utf8')).toBe('foreign bytes')
  const binding = row(root, attempt.attemptId), candidate = readFileSync(resolve(root, binding.candidate_path), 'utf8')
  expect(candidate).not.toBe(draft)
  rmSync(final)
  ok(call(root, ['reconcile', '--run', run, '--request', request()]))
  expect(readFileSync(final, 'utf8')).toBe(candidate)
  expect(row(root, attempt.attemptId)).toEqual(binding)
  expect(readFileSync(attempt.output, 'utf8')).toBe(draft)
})

for (const boundary of ['draft', 'source', 'candidate'] as const) test(`${boundary} byte tampering blocks acceptance and leaves original reserved draft evidence`, () => {
  const { root, run, attempt, draft } = stageAttempt()
  submit(root, attempt)
  if (boundary === 'candidate') {
    // Hold publication at the real destination, after candidate creation.
    const db = database(root)
    let version: string
    try { version = (db.query('SELECT version FROM runs WHERE id=?').get(run) as any).version } finally { db.close() }
    const destination = join(root, 'artifacts', version!, 'game/personalized-action-rpg-concept.md')
    mkdirSync(dirname(destination), { recursive: true }); writeFileSync(destination, 'foreign')
    failure(complete(root, attempt), 'integrity-error')
    const binding = row(root, attempt.attemptId)
    writeFileSync(resolve(root, binding.candidate_path), 'tampered candidate')
    rmSync(destination)
    failure(call(root, ['reconcile', '--run', run, '--request', request()]), 'integrity-error')
    expect(existsSync(destination)).toBe(false)
  } else if (boundary === 'draft') {
    writeFileSync(attempt.output, draft + '\nchanged')
    failure(complete(root, attempt), 'integrity-error')
  } else {
    const db = database(root)
    let source: string
    try { source = JSON.parse((db.query('SELECT input FROM attempts WHERE id=?').get(attempt.attemptId) as any).input).documents.find((doc: any) => doc.stage === 'selection').path } finally { db.close() }
    writeFileSync(resolve(root, source!), combatBrief() + '\nchanged after prepare')
    failure(complete(root, attempt), 'integrity-error')
  }
  unpublished(root, run)
  if (boundary !== 'draft') expect(readFileSync(attempt.output, 'utf8')).toBe(draft)
})

test('ambiguous insertion is an assembly failure, keeps attempt retryable, and never advertises generation repair', () => {
  const { root, run, attempt, draft } = stageAttempt()
  writeFileSync(attempt.output, draft.replace('<!-- design-assembly:production -->', ''))
  submit(root, attempt)
  failure(complete(root, attempt), 'assembly-production-marker')
  unpublished(root, run)
  const actions = read(root, 'next', run).data.actions.filter((action: any) => action.stage === 'gdd')
  expect(actions.some((action: any) => action.action === 'prepare-retry')).toBe(false)
  const db = database(root)
  try {
    const state = db.query('SELECT status,result FROM attempts WHERE id=?').get(attempt.attemptId) as any
    expect(state.status).toBe('submitted')
    expect(state.result).toBeNull()
  } finally { db.close() }
})

test('final candidate evidence validation fails through the existing validator rather than assembly or a missing declaration', () => {
  const { root, run, attempt, draft } = stageAttempt()
  writeFileSync(attempt.output, draft.replace('해석 근거: I-01', '해석 근거: I-99'))
  submit(root, attempt)
  const rejected = finish(root, attempt)
  expect(rejected.outcome).toBe('validation-failed')
  expect(rejected.data.result.errors).toContainEqual({ code: 'validation', message: 'Invalid GDD' })
  const candidate = readFileSync(resolve(root, row(root, attempt.attemptId).candidate_path), 'utf8')
  expect(candidate).toContain('```game-presentation')
  expect(candidate).toContain('해석 근거: I-99')
  unpublished(root, run)
})

for (const mismatch of ['legacy-format', 'revision', 'foreign-source'] as const) test(`${mismatch} snapshot is blocked explicitly without publishing or reinterpreting draft`, () => {
  const { root, run, attempt, draft } = stageAttempt()
  const db = database(root)
  try {
    const snapshot = JSON.parse((db.query('SELECT input FROM attempts WHERE id=?').get(attempt.attemptId) as any).input)
    if (mismatch === 'legacy-format') delete snapshot.assembly
    if (mismatch === 'revision') snapshot.validatorRevision = 'old-validator'
    if (mismatch === 'foreign-source') snapshot.documents.find((doc: any) => doc.stage === 'selection').id = 'unaccepted-foreign-document'
    db.query('UPDATE attempts SET input=? WHERE id=?').run(JSON.stringify(snapshot), attempt.attemptId)
  } finally { db.close() }
  const submitted = call(root, ['submit', '--attempt', attempt.attemptId, '--claim', attempt.claim, '--request', request()], { stdin: '{}' })
  const result = submitted.code ? submitted : complete(root, attempt)
  failure(result, mismatch === 'legacy-format' ? 'assembly-format-mismatch' : mismatch === 'revision' ? 'validator-revision-mismatch' : 'integrity-error')
  expect(readFileSync(attempt.output, 'utf8')).toBe(draft)
  unpublished(root, run)
})

for (const missing of ['draft', 'accepted-source'] as const) test(`missing ${missing} bytes produce assembly I/O diagnostics and cannot consume another generation attempt`, () => {
  const { root, run, attempt, draft } = stageAttempt()
  submit(root, attempt)
  let path = attempt.output
  if (missing === 'accepted-source') {
    const db = database(root)
    try { path = resolve(root, JSON.parse((db.query('SELECT input FROM attempts WHERE id=?').get(attempt.attemptId) as any).input).documents.find((doc: any) => doc.stage === 'world-selection').path) } finally { db.close() }
  }
  const original = readFileSync(path, 'utf8')
  rmSync(path)
  failure(complete(root, attempt), 'assembly-io')
  unpublished(root, run)
  // Tool repair restores the same immutable source; it needs no new reservation or model call.
  writeFileSync(path, original)
  expect(finish(root, attempt).outcome).toMatch(/passed|published|succeeded/)
  expect(readFileSync(attempt.output, 'utf8')).toBe(draft)
})

test('tampered pinned contract hash cannot be accepted or replaced by an unpinned contract', () => {
  const { root, run, attempt, draft } = stageAttempt()
  const db = database(root)
  try {
    const snapshot = JSON.parse((db.query('SELECT input FROM attempts WHERE id=?').get(attempt.attemptId) as any).input)
    snapshot.assembly.presentationContract.sha256 = sha256('different contract')
    db.query('UPDATE attempts SET input=? WHERE id=?').run(JSON.stringify(snapshot), attempt.attemptId)
  } finally { db.close() }
  failure(call(root, ['submit', '--attempt', attempt.attemptId, '--claim', attempt.claim, '--request', request()], { stdin: '{}' }), 'integrity-error')
  unpublished(root, run)
  expect(readFileSync(attempt.output, 'utf8')).toBe(draft)
})


test('a pinned brief that is no longer accepted blocks assembly even when its bytes are unchanged', () => {
  const { root, run, attempt, draft } = stageAttempt()
  const db = database(root)
  try { db.query("UPDATE stages SET accepted_document=NULL WHERE run_id=? AND stage='selection'").run(run) } finally { db.close() }
  failure(call(root, ['submit', '--attempt', attempt.attemptId, '--claim', attempt.claim, '--request', request()], { stdin: '{}' }), 'input-revision-mismatch')
  unpublished(root, run)
  expect(readFileSync(attempt.output, 'utf8')).toBe(draft)
})

test('candidate I/O failure reports assembly-io and recovery preserves draft and the bound candidate hash', () => {
  const { root, run, directory, attempt, draft } = stageAttempt()
  submit(root, attempt)
  const destination = join(directory, 'game/personalized-action-rpg-concept.md')
  mkdirSync(dirname(destination), { recursive: true }); writeFileSync(destination, 'foreign')
  failure(complete(root, attempt), 'integrity-error')
  const binding = row(root, attempt.attemptId), candidatePath = resolve(root, binding.candidate_path)
  const candidate = readFileSync(candidatePath, 'utf8')
  rmSync(candidatePath); mkdirSync(candidatePath)
  failure(complete(root, attempt), 'assembly-io')
  unpublished(root, run)
  expect(readFileSync(destination, 'utf8')).toBe('foreign')
  rmSync(candidatePath, { recursive: true }); writeFileSync(candidatePath, candidate)
  rmSync(destination)
  ok(call(root, ['reconcile', '--run', run, '--request', request()]))
  expect(row(root, attempt.attemptId)).toEqual(binding)
  expect(readFileSync(destination, 'utf8')).toBe(candidate)
  expect(readFileSync(attempt.output, 'utf8')).toBe(draft)
})


for (const boundary of ['submit', 'finish'] as const) test(`physical presentation contract mutation blocks ${boundary} in an isolated runtime without replacing draft or attempt`, () => {
  const { root, run, directory } = beforeGdd()
  // Clone only runtime inputs; the authoritative contract inside the shared worktree is never edited.
  cpSync(resolve(import.meta.dir, '..'), join(root, 'scripts'), { recursive: true })
  cpSync(resolve(import.meta.dir, '../../.agents/skills'), join(root, '.agents/skills'), { recursive: true })
  cpSync(resolve(import.meta.dir, '../../docs/prompts'), join(root, 'docs/prompts'), { recursive: true })
  const invoke = (args: string[], stdin?: string, reading = false) => {
    const result = Bun.spawnSync(['bun', join(root, reading ? 'scripts/read-artifact-state.ts' : 'scripts/artifact-state.ts'), ...args, '--root', root], { stdin: stdin === undefined ? undefined : Buffer.from(stdin) })
    return { code: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() }
  }
  const attempt = ok(invoke(['prepare', '--run', run, '--stage', 'gdd', '--kind', 'generate', '--request', request()])).data
  const draft = designDraft('gdd', pipelineGdd())
  writeFileSync(attempt.output, draft)
  const contractPath = join(root, 'docs/prompts/game-presentation-contract.md')
  const pinned = ok(invoke(['input', '--attempt', attempt.attemptId, '--claim', attempt.claim], undefined, true)).data.assembly.presentationContract
  expect(resolve(pinned.path)).toBe(contractPath)
  const originalContract = readFileSync(contractPath, 'utf8')
  expect(pinned.sha256).toBe(sha256(originalContract))
  const submission = ['submit', '--attempt', attempt.attemptId, '--claim', attempt.claim, '--request', request()]
  const payload = JSON.stringify({ path: attempt.output, sha256: sha256(draft) })
  if (boundary === 'finish') ok(invoke(submission, payload))
  writeFileSync(contractPath, originalContract + '\nSynthetic presentation contract revision.\n')
  const blocked = boundary === 'submit' ? invoke(submission, payload) : invoke(['finish', '--attempt', attempt.attemptId, '--claim', attempt.claim, '--request', request()])
  failure(blocked, 'validator-revision-mismatch')
  expect(readFileSync(attempt.output, 'utf8')).toBe(draft)
  expect(existsSync(join(directory, 'game/personalized-action-rpg-concept.md'))).toBe(false)
  unpublished(root, run)
  const actions = ok(invoke(['next', '--run', run], undefined, true)).data.actions
  expect(actions.some((action: any) => action.stage === 'gdd' && action.action === 'prepare-retry')).toBe(false)
  const db = database(root)
  try {
    expect(db.query("SELECT id,number,status FROM attempts WHERE run_id=? AND stage='gdd'").all(run)).toEqual([{ id: attempt.attemptId, number: 1, status: boundary === 'submit' ? 'prepared' : 'submitted' }])
    expect(db.query("SELECT count(*) AS n FROM events WHERE run_id=? AND stage='gdd' AND event IN ('validation-failed','execution-failed')").get(run)).toEqual({ n: 0 })
  } finally { db.close() }
})
