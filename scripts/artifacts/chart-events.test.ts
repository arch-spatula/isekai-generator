import { expect, test } from 'bun:test'
import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { runChartReport } from '../../.agents/skills/generate-chart-report/scripts/run-chart-report'
import { allocateRun, readRunManifest } from './artifact-run'
import { makeRepository } from './test-fixtures'

const report = '四柱八字\n甲子\n紫微斗數 命盤\n命宮 子\nNatal Chart\nSun Aries\n'
function fixture(source?: string): { root: string; run: string; output: string } {
  const root = makeRepository()
  mkdirSync(join(root, 'scripts'))
  if (source == null) symlinkSync(join(import.meta.dir, '../chart-report.ts'), join(root, 'scripts/chart-report.ts'))
  else writeFileSync(join(root, 'scripts/chart-report.ts'), source)
  const run = allocateRun(root, 'chart-report')
  return { root, run, output: join(run, 'docs/GDD/chart-report.md') }
}
function events(run: string): any[] {
  return readFileSync(join(run, 'events.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line))
}
test('real calculator missing-option error retains its safe field and exit while withholding birth arguments', async () => {
  const { root, run, output } = fixture()
  await expect(runChartReport(root, output, ['--gender', 'M', '--month', '3', '--day', '12', '--timezone', 'PRIVATE_BIRTH_LOCATION_SENTINEL'])).rejects.toThrow('Missing required option: --year')
  const all = events(run)
  expect(all.find(event => event.event === 'execution_failed')).toMatchObject({ stage: 'chart-report', exitCode: 1, issues: [{ code: 'calculator-exit', message: 'Missing required option: --year', field: 'year' }] })
  expect(all.filter(event => event.event === 'run_started')).toHaveLength(1)
  expect(all.at(-1)).toMatchObject({ event: 'run_failed', stage: 'chart-report', reason: 'Chart calculation or evidence validation failed.' })
  for (const filename of ['events.jsonl', 'artifact-run.json', 'TODO.md']) expect(readFileSync(join(run, filename), 'utf8')).not.toContain('PRIVATE_BIRTH_LOCATION_SENTINEL')
})
test('unknown raw calculator stderr is withheld while its failure category and exit remain', async () => {
  const { root, run, output } = fixture("console.error('PRIVATE_RAW_CHART_STDERR_SENTINEL'); process.exit(9)")
  await expect(runChartReport(root, output, [])).rejects.toThrow('PRIVATE_RAW_CHART_STDERR_SENTINEL')
  expect(events(run).find(event => event.event === 'execution_failed')).toMatchObject({ stage: 'chart-report', exitCode: 9, issues: [expect.objectContaining({ code: 'calculator-exit' })] })
  for (const filename of ['events.jsonl', 'artifact-run.json', 'TODO.md']) expect(readFileSync(join(run, filename), 'utf8')).not.toContain('PRIVATE_RAW_CHART_STDERR_SENTINEL')
})
test('chart publication infrastructure failure retains safe phase and errno', async () => {
  const { root, run, output } = fixture(`process.stdout.write(${JSON.stringify(report)})`)
  mkdirSync(join(run, 'docs/GDD'), { recursive: true })
  writeFileSync(output, 'existing chart must remain')
  await expect(runChartReport(root, output, [])).rejects.toThrow()
  expect(events(run).find(event => event.event === 'execution_failed')).toMatchObject({ issues: [{ code: 'chart-execution', message: 'chart-report-publication failed (EEXIST).' }] })
  expect(readFileSync(output, 'utf8')).toBe('existing chart must remain')
  expect(readRunManifest(run).status).toBe('failed')
})
test('successful chart runner records validated chart stage and final success without logging chart contents', async () => {
  const { root, run, output } = fixture(`process.stdout.write(${JSON.stringify(report)})`)
  await runChartReport(root, output, [])
  const all = events(run)
  expect(all.filter(event => event.event === 'run_started')).toHaveLength(1)
  expect(all.find(event => event.event === 'validation_succeeded')).toMatchObject({ stage: 'chart-report' })
  expect(all.at(-1).event).toBe('run_succeeded')
  expect(readFileSync(output, 'utf8')).toBe(report)
  expect(readFileSync(join(run, 'events.jsonl'), 'utf8')).not.toContain('Sun Aries')
})
