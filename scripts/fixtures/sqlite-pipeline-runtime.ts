import { expect } from 'bun:test'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { integratedInterpretation, combatBrief, worldBrief, pipelineGdd } from './sqlite-pipeline'
import { chartFixture, interpretation, specialist, prepare, call, ok, submit, finish, request, sha256 } from '../artifacts/sqlite-test-fixtures'
export function publish(root: string, run: string, stage: string, markdown: string) {
  const attempt = prepare(root, run, stage).data
  writeFileSync(resolve(root, attempt.output), markdown)
  submit(root, attempt, { path: attempt.output, sha256: sha256(markdown) })
  expect(finish(root, attempt).outcome).toMatch(/passed|published|succeeded/)
  return attempt
}
export function acceptedSpecialists(root: string, run: string) {
  for (const system of ['saju', 'ziwei', 'natal']) {
    expect(specialist(root, run, interpretation(system), system).result.outcome).toBe('editing-required')
    const attempt = prepare(root, run, system, 'edit').data
    const input = ok(call(root, ['input', '--attempt', attempt.attemptId, '--claim', attempt.claim], { read: true })).data
    submit(root, attempt, { sourceSha256: input.source.sha256, edits: [], review: { system, attempt: attempt.number, scope: attempt.scope, primary: [], secondary: [], preservationConfirmed: true, unresolved: [] }, reviewMarkdown: '조건부 설명과 근거를 보존했으며 전체 문서의 방어문구를 검토했다.' })
    expect(finish(root, attempt).outcome).toMatch(/passed|published|succeeded/)
  }
}
export function beforeGdd(fixture = chartFixture()) {
  const { root, run } = fixture
  acceptedSpecialists(root, run)
  publish(root, run, 'integration', integratedInterpretation)
  publish(root, run, 'selection', combatBrief())
  publish(root, run, 'world-selection', worldBrief())
  return fixture
}
export function beforeFinalize(fixture = chartFixture()) {
  const prepared = beforeGdd(fixture)
  publish(prepared.root, prepared.run, 'gdd', pipelineGdd())
  return prepared
}

