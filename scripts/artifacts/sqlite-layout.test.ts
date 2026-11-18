import { expectDesignEquivalent } from '../fixtures/design-assembly'
import { expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { runChartReport } from '../../.agents/skills/generate-chart-report/scripts/run-chart-report'
import { beforeFinalize, publish } from '../fixtures/sqlite-pipeline-runtime'
import { combatBrief, integratedInterpretation, pipelineGdd, worldBrief } from '../fixtures/sqlite-pipeline'
import { makeRepository, commitFixture } from './test-fixtures'
import { allocate, call, interpretation, ok, read, request, sha256, start, syntheticReport, tree } from './sqlite-test-fixtures'

// Contract literals come from artifact-directory-layout.md, independently of product mapping.
const publications = [
  ['chart-report', 'charts/chart-report.md', syntheticReport],
  ['saju', 'interpretation/saju-interpretation.md', interpretation('saju')],
  ['ziwei', 'interpretation/ziwei-interpretation.md', interpretation('ziwei')],
  ['natal', 'interpretation/natal-interpretation.md', interpretation('natal')],
  ['integration', 'interpretation/chart-interpretation.md', integratedInterpretation],
  ['selection', 'design-rationale/gameplay-concept-brief.md', combatBrief()],
  ['world-selection', 'design-rationale/world-concept-brief.md', worldBrief()],
  ['gdd', 'game/personalized-action-rpg-concept.md', pipelineGdd()],
]

for (const legacy of [false, true]) {
  test(`${legacy ? 'markerless existing' : 'new'} run publishes all eight exact bodies and recorded hashes in its own layout`, () => {
    const root = makeRepository(), allocated = allocate(root), run = allocated.data.runId
    if (legacy) {
      // Simulate a pre-change allocation, before any stage has been prepared.
      const db = new Database(join(root, 'artifacts/state.sqlite'))
      try {
        const row = db.query('SELECT config FROM runs WHERE id=?').get(run) as { config: string }
        const config = JSON.parse(row.config)
        delete config.artifactLayout
        db.query('UPDATE runs SET config=? WHERE id=?').run(JSON.stringify(config), run)
      } finally { db.close() }
    }
    start(root, run)
    publish(root, run, 'chart-report', syntheticReport)
    // Runtime helpers submit synthetic candidates through public CLI boundaries.
    const { directory } = beforeFinalize({ root, run, directory: allocated.data.directory })
    const summary = read(root, 'summary', run)
    const db = new Database(join(root, 'artifacts/state.sqlite'), { readonly: true })
    try {
      for (const [stage, relative, body] of publications) {
        const expected = join(directory, legacy ? 'docs/GDD/' + relative.split('/').at(-1) : relative)
        const published = readFileSync(expected, 'utf8')
        if (['selection', 'world-selection', 'gdd'].includes(stage)) expectDesignEquivalent(published, body)
        else expect(published).toBe(body)
        const document = db.query('SELECT d.* FROM stages s JOIN documents d ON d.id=s.accepted_document WHERE s.run_id=? AND s.stage=?').get(run, stage) as any
        expect(resolve(root, document.final_path)).toBe(expected)
        expect(document.sha256).toBe(sha256(published))
        expect(readFileSync(resolve(root, document.path), 'utf8')).toBe(published)
        expect(summary.data.stages.find((row: any) => row.stage === stage).path).toBe(document.final_path)
      }
    } finally { db.close() }
    expect(tree(directory).filter(path => !path.startsWith('garbage/')).sort()).toEqual(publications.map(([, path]) => legacy ? 'docs/GDD/' + path.split('/').at(-1) : path).sort())
    expect(ok(call(root, ['resume', '--run', run, '--request', request()])).outcome).toBeTruthy()
  }, 15000)
}

for (const legacy of [false, true]) {
test(`standalone chart runner preserves ${legacy ? 'markerless legacy' : 'new'} layout and calculator bytes`, async () => {
  const root = makeRepository()
  mkdirSync(join(root, 'scripts'))
  writeFileSync(join(root, 'scripts/chart-report.ts'), `process.stdout.write(${JSON.stringify(syntheticReport)})`)
  commitFixture(root)
  const allocated = allocate(root, 'chart-report'), directory = allocated.data.directory
  if (legacy) {
    const db = new Database(join(root, 'artifacts/state.sqlite'))
    try {
      const config = JSON.parse((db.query('SELECT config FROM runs WHERE id=?').get(allocated.data.runId) as any).config)
      delete config.artifactLayout
      db.query('UPDATE runs SET config=? WHERE id=?').run(JSON.stringify(config), allocated.data.runId)
    } finally { db.close() }
  }
  const relative = legacy ? 'docs/GDD/chart-report.md' : 'charts/chart-report.md'
  await runChartReport(root, join(directory, relative), [])
  expect(readFileSync(join(directory, relative), 'utf8')).toBe(syntheticReport)
  expect(readdirSync(directory).sort()).toEqual(legacy ? ['docs', 'garbage'] : ['charts', 'garbage'])
  expect(tree(directory).filter(path => !path.startsWith('garbage/'))).toEqual([relative])
  expect(existsSync(join(directory, legacy ? 'charts' : 'docs'))).toBe(false)
  expect(read(root, 'summary', allocated.data.runId).data.run.status).toBe('succeeded')
})

}
