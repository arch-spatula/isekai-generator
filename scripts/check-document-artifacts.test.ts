import { expect, test } from 'bun:test'
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkDocument, checkRepositoryDocuments } from './check-document-artifacts'
import { makeRepository } from './artifacts/test-fixtures'

const root = '/workspace/project'
const errors = (source: string) => checkDocument('docs/incident.md', source, root).filter(item => item.severity === 'error')

test('rejects inline, image, reference, HTML, encoded and absolute local artifact links', () => {
  for (const source of [
    '[proof](../artifacts/v0.9.2/docs/report.md#L3)',
    '![proof](<../artifacts/v0.9.2/hero.png>)',
    '[proof]: ../artifacts/registries/world.json',
    '<a href="../artifacts/v0.9.2/report.md">proof</a>',
    '<img src=../artifacts/v0.9.2/hero.png>',
    '[proof](../artifacts%2Fv0.9.2/report.md)',
    '[proof](/home/example/project/artifacts/v0.9.2/report.md)',
    '<file:///home/example/project/artifacts/v0.9.2/report.md>',
    '[proof](C:\\project\\artifacts\\v0.9.2\\report.md)',
    '[proof](\n ../artifacts/v0.9.2/report.md\n)',
    '<a\n href="../artifacts/v0.9.2/report.md">proof</a>',
  ]) expect(errors(source)).toHaveLength(1)
})

test('allows source links, runtime path contracts and explicitly fictional syntax examples', () => {
  const source = '[source](../scripts/artifacts/artifact-run.ts)\n`artifacts/<version>/TODO.md`\n[external](https://example.invalid/artifacts/report.md)\n```markdown\n[fictional syntax](../artifacts/v0.9.2/example.md)\n```'
  expect(errors(source)).toHaveLength(0)
  expect(errors('[source](/workspace/project/scripts/artifacts/artifact-run.ts)')).toHaveLength(0)
})

test('historical versions are review candidates, not failures', () => {
  expect(checkDocument('docs/history.md', '가상 버전 v0.9.2의 예시다.', root)).toMatchObject([{ severity: 'review', line: 1 }])
})

test('repository scan includes new docs but never opens artifacts, legacy or symlink targets', () => {
  const repository = makeRepository()
  mkdirSync(join(repository, 'docs/legacy'), { recursive: true })
  mkdirSync(join(repository, 'artifacts'), { recursive: true })
  symlinkSync('/missing/legacy-target', join(repository, 'docs/legacy/forbidden.md'))
  symlinkSync('/missing/artifact-target', join(repository, 'artifacts/local.md'))
  writeFileSync(join(repository, 'docs/new.md'), '[proof](../artifacts/v0.9.2/file.md)')
  symlinkSync('/missing/other-target', join(repository, 'docs/linked.md'))
  const findings = checkRepositoryDocuments(repository)
  expect(findings.filter(item => item.severity === 'error').map(item => item.file).sort()).toEqual(['docs/linked.md', 'docs/new.md'])
})

test('CLI runs in an artifact-free repository and fails when a persistent local link is added', () => {
  const repository = makeRepository()
  const command = ['bun', join(import.meta.dir, 'check-document-artifacts.ts')]
  expect(Bun.spawnSync(command, { cwd: repository }).exitCode).toBe(0)
  writeFileSync(join(repository, 'README.md'), '[proof](artifacts/v0.9.2/report.md)')
  expect(Bun.spawnSync(command, { cwd: repository }).exitCode).toBe(1)
})
