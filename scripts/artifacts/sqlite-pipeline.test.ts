import { buildEvidenceManifest } from '../../.agents/skills/generate-chart-report/scripts/chart-evidence'
import { expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { readFileSync, writeFileSync, cpSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { integratedInterpretation, combatBrief, worldBrief, pipelineGdd, revisedCombatBrief, revisedWorldBrief } from '../fixtures/sqlite-pipeline'
import { chartFixture, interpretation, specialist, prepare, call, ok, submit, finish, request, read, sha256, tree, allocate, start, syntheticReport, parallelCall } from './sqlite-test-fixtures'

import { publish, acceptedSpecialists, beforeFinalize } from '../fixtures/sqlite-pipeline-runtime'

test('synthetic full DAG publishes Markdown then atomically registers two fingerprints and completes', () => {
  const { root, run, directory } = beforeFinalize()
  const id = request(), args = ['finalize', '--run', run, '--request', id]
  const completed = ok(call(root, args))
  const snapshot = (): string => {
    const db = new Database(join(root, 'artifacts/state.sqlite'), { readonly: true })
    try { return JSON.stringify(['runs','stages','fingerprints','events'].map(table => db.query(`SELECT * FROM ${table} ORDER BY rowid`).all())) } finally { db.close() }
  }
  const completedState = snapshot()
  expect(completed.outcome).toBe('succeeded')
  expect(ok(call(root, args))).toEqual(completed)
  expect(snapshot()).toBe(completedState)
  const resumed = call(root, ['resume', '--run', run, '--request', request()])
  expect(resumed.code).toBe(1)
  expect(JSON.parse(resumed.stderr).error.code).toBe('run-terminal')
  expect(snapshot()).toBe(completedState)
  expect(read(root, 'summary', run).data.run.status).toBe('succeeded')
  expect(readFileSync(join(directory, 'docs/GDD/personalized-action-rpg-concept.md'), 'utf8')).toBe(pipelineGdd())
  const db = new Database(join(root, 'artifacts/state.sqlite'), { readonly: true })
  try { expect(db.query('SELECT kind FROM fingerprints ORDER BY kind').all()).toEqual([{ kind: 'combat' }, { kind: 'world' }]) } finally { db.close() }
  expect(tree(join(root, 'artifacts')).filter(path => /\.jsonl?$|TODO\.md$|\.lock/.test(path))).toEqual([])
})

test('failure inserting the second fingerprint rolls back first fingerprint and terminal run state', () => {
  const { root, run } = beforeFinalize()
  const db = new Database(join(root, 'artifacts/state.sqlite'))
  db.exec("CREATE TRIGGER reject_world BEFORE INSERT ON fingerprints WHEN NEW.kind='world' BEGIN SELECT RAISE(ABORT,'synthetic second insert failure'); END")
  db.close()
  const result = call(root, ['finalize', '--run', run, '--request', request()])
  expect(result.code).toBe(1)
  expect(JSON.parse(result.stderr).error.code).toBe('state-error')
  const reopened = new Database(join(root, 'artifacts/state.sqlite'))
  try {
    expect(reopened.query('SELECT count(*) AS count FROM fingerprints').get()).toEqual({ count: 0 })
    expect(reopened.query("SELECT count(*) AS count FROM events WHERE event='succeeded'").get()).toEqual({ count: 0 })
    expect(reopened.query("SELECT count(*) AS count FROM stages WHERE stage='fingerprint-registration' AND status='succeeded'").get()).toEqual({ count: 0 })
    reopened.exec('DROP TRIGGER reject_world')
  } finally { reopened.close() }
  expect(read(root, 'summary', run).data.run.status).not.toBe('succeeded')
  expect(ok(call(root, ['finalize', '--run', run, '--request', request()])).outcome).toBe('succeeded')
})

// Each CLI opens a new process/connection: no conversation or in-memory checkpoint is used.
test('a fresh process rejects adopted document hash mutation on resume', () => {
  const { root, run, directory } = beforeFinalize()
  const gdd = join(directory, 'docs/GDD/personalized-action-rpg-concept.md')
  const original = readFileSync(gdd, 'utf8')
  writeFileSync(gdd, original + '\nchanged after adoption')
  const result = call(root, ['resume', '--run', run, '--request', request()])
  expect(result.code).toBe(1)
  expect(JSON.parse(result.stderr).error.code).toMatch(/integrity/)
  expect(read(root, 'summary', run).data.run.status).not.toBe('succeeded')
  expect(readFileSync(gdd, 'utf8')).toBe(original + '\nchanged after adoption')
})

function anotherChart(root: string) {
  const allocated = allocate(root), run = allocated.data.runId
  start(root, run)
  publish(root, run, 'chart-report', syntheticReport)
  return { root, run, directory: allocated.data.directory }
}

test('another successful run makes the prepared selection snapshot stale without partial registration', () => {
  const first = beforeFinalize()
  const second = beforeFinalize(anotherChart(first.root))
  expect(ok(call(first.root, ['finalize', '--run', first.run, '--request', request()])).outcome).toBe('succeeded')
  const result = call(second.root, ['finalize', '--run', second.run, '--request', request()])
  expect(result.code).toBe(1)
  expect(JSON.parse(result.stderr).error.code).toBe('registry-stale')
  const db = new Database(join(first.root, 'artifacts/state.sqlite'), { readonly: true })
  try {
    expect(db.query('SELECT count(*) AS count FROM fingerprints WHERE run_id=?').get(second.run)).toEqual({ count: 0 })
    expect(db.query('SELECT count(*) AS count FROM fingerprints WHERE run_id=?').get(first.run)).toEqual({ count: 2 })
  } finally { db.close() }
  expect(read(second.root, 'summary', second.run).data.run.status).not.toBe('succeeded')
  expect(readFileSync(join(second.directory, 'docs/GDD/personalized-action-rpg-concept.md'), 'utf8')).toBe(pipelineGdd())
}, 15000)

test('unrelated document changes permit resume, dirty validator code changes block it', () => {
  const { root, run } = beforeFinalize()
  // Run the real runtime from a synthetic checkout so shared product code is never modified.
  cpSync(join(import.meta.dir, '..'), join(root, 'scripts'), { recursive: true })
  cpSync(resolve(import.meta.dir, '../../.agents/skills'), join(root, '.agents/skills'), { recursive: true })
  cpSync(resolve(import.meta.dir, '../../docs/prompts'), join(root, 'docs/prompts'), { recursive: true })
  const cli = join(root, 'scripts/artifact-state.ts')
  const resume = () => Bun.spawnSync(['bun', cli, 'resume', '--root', root, '--run', run, '--request', request()])
  writeFileSync(join(root, 'unrelated.md'), 'An unrelated documentation edit.')
  expect(resume().exitCode).toBe(0)
  const validator = join(root, '.agents/skills/interpret-chart-system/scripts/validate-system-interpretation.ts')
  writeFileSync(validator, readFileSync(validator, 'utf8') + '\n// synthetic dirty validator revision\n')
  const result = resume()
  expect(result.exitCode).toBe(1)
  expect(JSON.parse(result.stderr.toString()).error.code).toBe('validator-revision-mismatch')
  expect(read(root, 'summary', run).data.run.status).not.toBe('succeeded')
  // Prompt/input contract content is also part of the prepared revision, not just validator code.
  writeFileSync(validator, readFileSync(resolve(import.meta.dir, '../../.agents/skills/interpret-chart-system/scripts/validate-system-interpretation.ts'), 'utf8'))
  expect(resume().exitCode).toBe(0)
  const contract = join(root, 'docs/prompts/saju-interpretation.md')
  writeFileSync(contract, readFileSync(contract, 'utf8') + '\nSynthetic input contract revision.\n')
  const inputChanged = resume()
  expect(inputChanged.exitCode).toBe(1)
  expect(JSON.parse(inputChanged.stderr.toString()).error.code).toBe('validator-revision-mismatch')
})

test('limited domain input is available only to its system and never copied into summaries or events', () => {
  const { root, run } = chartFixture()
  const markers = { saju: 'SAJU_PRIVATE_DOMAIN_SENTINEL', ziwei: 'ZIWEI_PRIVATE_DOMAIN_SENTINEL', natal: 'NATAL_PRIVATE_DOMAIN_SENTINEL' }
  for (const system of ['saju', 'ziwei', 'natal'] as const) {
    const result = specialist(root, run, interpretation(system) + `\n${markers[system]}`, system)
    expect(result.result.outcome).toBe('editing-required')
  }
  for (const system of ['saju', 'ziwei', 'natal'] as const) {
    const attempt = prepare(root, run, system, 'edit').data
    const input = ok(call(root, ['input', '--attempt', attempt.attemptId, '--claim', attempt.claim], { read: true }))
    expect(JSON.stringify(input)).toContain(markers[system])
    for (const other of ['saju', 'ziwei', 'natal'] as const) if (other !== system) expect(JSON.stringify(input)).not.toContain(markers[other])
    for (const command of ['summary', 'events']) expect(JSON.stringify(read(root, command, run))).not.toContain(markers[system])
    expect(call(root, ['fingerprints', '--attempt', attempt.attemptId, '--kind', 'combat'], { read: true }).code).toBe(1)
  }
})

test('fingerprint reads filter unfinished history, retain all nearest ties, and enforce kind isolation', () => {
  const { root, run } = chartFixture()
  acceptedSpecialists(root, run)
  publish(root, run, 'integration', integratedInterpretation)
  const db = new Database(join(root, 'artifacts/state.sqlite'))
  const axes = { combatRange: 'close', powerMedium: 'weapon', initiative: 'direct', spaceUse: 'pursuit', combatRhythm: 'pressure', mastery: 'timing', risk: 'health' }
  try {
    const original = db.query('SELECT * FROM runs WHERE id=?').get(run) as Record<string, any>
    for (const [index, status] of ['succeeded', 'succeeded', 'failed', 'running'].entries()) {
      const historical = { ...original, id: `synthetic-history-${index}`, version: `v0.1.${90 + index}`, status, finished_at: status === 'running' ? null : '2026-01-01T00:00:00.000Z' }
      const keys = Object.keys(historical)
      db.query(`INSERT INTO runs(${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`).run(...keys.map(key => historical[key]))
      db.query('INSERT INTO fingerprints VALUES(?,?,?,?,?)').run(historical.id, 'combat', 'C-01', JSON.stringify(axes), 0)
    }
  } finally { db.close() }
  const attempt = prepare(root, run, 'selection').data
  const result = ok(call(root, ['fingerprints', '--attempt', attempt.attemptId, '--kind', 'combat', '--candidate', JSON.stringify(axes)], { read: true }))
  expect(result.data.comparedEntries).toBe(2)
  expect(result.data.closest.map((match: any) => [match.version, match.equalAxes])).toEqual([['v0.1.90', 7], ['v0.1.91', 7]])
  expect(result.data.requiresChallenger).toBe(true)
  const other = call(root, ['fingerprints', '--attempt', attempt.attemptId, '--kind', 'world'], { read: true })
  expect(other.code).toBe(1)
  expect(JSON.parse(other.stderr).error.code).toBe('input-not-allowed')
})

test('three specialist processes finish independently and keep their exact system evidence', async () => {
  const { root, run } = chartFixture(), attempts = []
  for (const system of ['saju', 'ziwei', 'natal'] as const) {
    const attempt = prepare(root, run, system).data
    const input = ok(call(root, ['input', '--attempt', attempt.attemptId, '--claim', attempt.claim], { read: true })).data
    expect(input.evidence.systems).toEqual({ [system]: buildEvidenceManifest(syntheticReport).systems[system] })
    const chartText = input.documents.map((document: any) => document.text).join('\n')
    if (system !== 'saju') expect(chartText).not.toContain('甲子')
    if (system !== 'ziwei') expect(chartText).not.toContain('命宮 子')
    if (system !== 'natal') expect(chartText).not.toContain('Sun Aries')
    const text = interpretation(system)
    writeFileSync(resolve(root, attempt.output), text)
    submit(root, attempt, { path: attempt.output, sha256: sha256(text) })
    attempts.push(attempt)
  }
  const replies = (await Promise.all(attempts.map(attempt => parallelCall(root, ['finish', '--attempt', attempt.attemptId, '--claim', attempt.claim, '--request', request()])))).map(ok)
  expect(replies.map(reply => reply.outcome)).toEqual(['editing-required', 'editing-required', 'editing-required'])
  for (const attempt of attempts) expect(ok(call(root, ['issues', '--attempt', attempt.attemptId], { read: true })).data.result.status).toBe('editing-required')
})

test('general stage repair has one correction budget and never reopens successful specialists', () => {
  const { root, run } = chartFixture()
  acceptedSpecialists(root, run)
  for (let number = 1; number <= 2; number++) {
    const attempt = prepare(root, run, 'integration').data
    expect(attempt.number).toBe(number)
    writeFileSync(resolve(root, attempt.output), '# malformed integrated interpretation')
    submit(root, attempt)
    expect(finish(root, attempt).outcome).toBe('validation-failed')
  }
  const exhausted = call(root, ['prepare', '--run', run, '--stage', 'integration', '--kind', 'generate', '--request', request()])
  expect(exhausted.code).toBe(1)
  expect(JSON.parse(exhausted.stderr).error.code).toBe('attempt-budget-exhausted')
  for (const system of ['saju', 'ziwei', 'natal']) expect(read(root, 'summary', run).data.stages.find((stage: any) => stage.stage === system).status).toBe('succeeded')
})

test('explicit stale review uses remaining attempts and revision paths while preserving prior publications', () => {
  const first = beforeFinalize(), second = beforeFinalize(anotherChart(first.root)), { root, run, directory } = second
  const firstVersion = read(root, 'summary', first.run).data.run.version
  const originalPaths = ['gameplay-concept-brief.md', 'world-concept-brief.md', 'personalized-action-rpg-concept.md'].map(name => join(directory, 'docs/GDD', name))
  const originals = originalPaths.map(path => readFileSync(path, 'utf8'))
  const dbBefore = new Database(join(root, 'artifacts/state.sqlite'), { readonly: true })
  let validations: any[], events: any[]
  try {
    validations = dbBefore.query('SELECT * FROM validations ORDER BY rowid').all()
    events = dbBefore.query('SELECT * FROM events ORDER BY id').all()
  } finally { dbBefore.close() }
  ok(call(root, ['finalize', '--run', first.run, '--request', request()]))
  const stale = call(root, ['finalize', '--run', run, '--request', request()])
  expect(stale.code).toBe(1)
  expect(JSON.parse(stale.stderr).error.code).toBe('registry-stale')
  ok(call(root, ['resume', '--run', run, '--request', request()]))
  expect(read(root, 'next', run).data.actions).toContainEqual(expect.objectContaining({ stage: 'selection', action: 'prepare-retry' }))
  const selection = publish(root, run, 'selection', revisedCombatBrief(firstVersion))
  expect(selection.number).toBe(2)
  const publishWithLatestInput = (stage: string, text: string, upstream: string, upstreamText: string) => {
    const attempt = prepare(root, run, stage).data
    const input = ok(call(root, ['input', '--attempt', attempt.attemptId, '--claim', attempt.claim], { read: true })).data
    expect(input.documents.find((document: any) => document.stage === upstream)).toMatchObject({ text: upstreamText, sha256: sha256(upstreamText) })
    const database = new Database(join(root, 'artifacts/state.sqlite'), { readonly: true })
    try {
      const adopted = database.query('SELECT accepted_document FROM stages WHERE run_id=? AND stage=?').get(run, upstream) as any
      const prepared = database.query('SELECT input FROM attempts WHERE id=?').get(attempt.attemptId) as any
      expect(JSON.parse(prepared.input).documents.find((document: any) => document.stage === upstream).id).toBe(adopted.accepted_document)
    } finally { database.close() }
    writeFileSync(attempt.output, text); submit(root, attempt); expect(finish(root, attempt).outcome).toMatch(/passed|published|succeeded/)
    return attempt
  }
  const world = publishWithLatestInput('world-selection', revisedWorldBrief(firstVersion), 'selection', revisedCombatBrief(firstVersion))
  expect(world.number).toBe(2)
  const gdd = publishWithLatestInput('gdd', pipelineGdd(), 'world-selection', revisedWorldBrief(firstVersion))
  expect(gdd.number).toBe(2)
  for (const [index, stage] of ['selection', 'world-selection', 'gdd'].entries()) {
    const expectedPath = join(directory, 'docs/GDD/revisions', [selection, world, gdd][index].attemptId, originalPaths[index].split('/').at(-1)!)
    expect(readFileSync(originalPaths[index], 'utf8')).toBe(originals[index])
    const summary = read(root, 'summary', run).data.stages.find((row: any) => row.stage === stage)
    expect(resolve(root, summary.path)).toBe(expectedPath)
    const database = new Database(join(root, 'artifacts/state.sqlite'), { readonly: true })
    try {
      const adopted = database.query('SELECT d.id,d.final_path FROM stages s JOIN documents d ON d.id=s.accepted_document WHERE s.run_id=? AND s.stage=?').get(run, stage) as any
      expect(resolve(root, adopted.final_path)).toBe(expectedPath)
      const attempts = database.query('SELECT count(*) AS count FROM attempts WHERE run_id=? AND stage=?').get(run, stage)
      expect(attempts).toEqual({ count: 2 })
    } finally { database.close() }
  }
  ok(call(root, ['finalize', '--run', run, '--request', request()]))
  const reopened = new Database(join(root, 'artifacts/state.sqlite'), { readonly: true })
  try {
    expect(reopened.query('SELECT * FROM validations ORDER BY rowid LIMIT ?').all(validations!.length)).toEqual(validations!)
    expect(reopened.query('SELECT * FROM events ORDER BY id LIMIT ?').all(events!.length)).toEqual(events!)
    expect(reopened.query('SELECT count(*) AS count FROM fingerprints').get()).toEqual({ count: 4 })
  } finally { reopened.close() }
}, 20000)
