/** Manual model acceptance fixture. Creates only synthetic data under /tmp; never calls an LLM. */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { allocateRun, git, readRunManifest, updateRun } from './artifact-run'
import { recordStageProgress } from './artifact-progress'
import { prepareSpecialistAttempt, finishSpecialistAttempt } from './specialist-attempt'
import { prepareDefensiveEdit } from './defensive-edit'
import { syntheticSajuInterpretation } from './defensive-test-fixtures'

export function createDefensiveSmokeFixture(): { run: string; input: string; chart: string; evidence: string; source: string; edits: string; review: string } {
  const repository = mkdtempSync('/tmp/defensive-model-smoke-')
  git(repository, ['init', '--quiet'])
  mkdirSync(join(repository, '.agents'))
  writeFileSync(join(repository, '.gitignore'), '/artifacts/\n')
  writeFileSync(join(repository, 'decision.md'), '# Synthetic baseline\n')
  const commit = (): void => { git(repository, ['add', '.']); git(repository, ['-c', 'user.name=Smoke Fixture', '-c', 'user.email=smoke@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'synthetic fixture']) }
  commit()
  writeFileSync(join(repository, '.agents/artifact-series.json'), JSON.stringify({ schemaVersion: 1, activeSeries: '0.1', baselineRevision: git(repository, ['rev-parse', 'HEAD']), promotedAt: '2026-11-10T00:00:00.000Z', decision: 'decision.md', knownIssues: [] }))
  commit()
  const run = allocateRun(repository, 'personalized-gdd')
  updateRun(run, 'running')
  mkdirSync(join(run, 'docs/GDD'), { recursive: true })
  writeFileSync(join(run, 'docs/GDD/chart-report.md'), '四柱八字\n합성 원국: 관계의 긴장을 집중과 우선순위 선택에 연결한다. 실제 출생정보가 아니다.\n紫微斗數 命盤\nsynthetic\nNatal Chart\nsynthetic')
  writeFileSync(join(run, 'docs/GDD/chart-evidence.json'), JSON.stringify({ version: 1, systems: { saju: [{ id: 'S-E0000000000000001', text: '합성 원국의 관계와 선택 조건' }], ziwei: [], natal: [] } }))
  recordStageProgress(run, readRunManifest(run), 'chart-report', 'succeeded')
  const specialist = prepareSpecialistAttempt(run, 'saju')
  // The defensive clause is separate from the valid reading, so its removal preserves that reading.
  writeFileSync(join(run, specialist.output), syntheticSajuInterpretation.replace('### S-02', '단정하지 않는다.\n### S-02'))
  if (finishSpecialistAttempt(run, 'saju', specialist.attempt).status !== 'editing-required') throw new Error('Synthetic source did not reach editing')
  const prepared = prepareDefensiveEdit(run, 'saju')
  if (prepared.diagnostics.length !== 1 || prepared.diagnostics[0].code !== 'responsibility-avoidance') throw new Error('Expected one synthetic defensive diagnostic')
  return { run, input: join(run, prepared.input), chart: join(run, prepared.chart), evidence: join(run, prepared.evidence), source: join(run, prepared.source.output), edits: join(run, prepared.edits), review: join(run, prepared.review) }
}

if (import.meta.main) console.log(JSON.stringify(createDefensiveSmokeFixture(), null, 2))
