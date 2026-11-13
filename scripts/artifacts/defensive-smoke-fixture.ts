/** Manual model acceptance fixture. Creates only synthetic data under /tmp; never calls an LLM. */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { allocateRun, git, updateRun } from './artifact-run'
import { ArtifactState } from './artifact-state-store'
import {randomUUID} from 'node:crypto'
import { syntheticSajuInterpretation } from './defensive-test-fixtures'

export function createDefensiveSmokeFixture(): {run:string;repository:string;attemptId:string;claim:string;inputCommand:string[]} {
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
  const state=new ArtifactState(repository)
  try {
    const id=state.run(run.split('/').at(-1)!).id
    const chart=state.prepare(id,'chart-report','generate',randomUUID()).data
    writeFileSync(chart.output,'四柱八字\n합성 원국: 관계의 긴장을 집중과 우선순위 선택에 연결한다. 실제 출생정보가 아니다.\n紫微斗數 命盤\nsynthetic\nNatal Chart\nsynthetic')
    state.submit(chart.attemptId,chart.claim,{},randomUUID());state.finish(chart.attemptId,chart.claim,randomUUID())
    const specialist=state.prepare(id,'saju','generate',randomUUID()).data
    const evidence=state.evidence(id).systems.saju[0].id
    writeFileSync(specialist.output,syntheticSajuInterpretation.replaceAll('S-E0000000000000001',evidence).replace('### S-02','단정하지 않는다.\n### S-02'))
    state.submit(specialist.attemptId,specialist.claim,{},randomUUID());state.finish(specialist.attemptId,specialist.claim,randomUUID())
    const prepared=state.prepare(id,'saju','edit',randomUUID()).data
    return {run,repository,attemptId:prepared.attemptId,claim:prepared.claim,inputCommand:['bun','scripts/read-artifact-state.ts','input','--root',repository,'--attempt',prepared.attemptId,'--claim',prepared.claim]}
  }finally{state.close()}
}
if(import.meta.main)console.log(JSON.stringify(createDefensiveSmokeFixture()))
