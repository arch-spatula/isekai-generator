import { buildEvidenceManifest } from '../../.agents/skills/generate-chart-report/scripts/chart-evidence'
import { makeRepository } from './test-fixtures'
import { expect } from 'bun:test'
import { createHash, randomUUID } from 'node:crypto'
import { readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'

export const writeCLI = join(import.meta.dir, '../artifact-state.ts')
export const readCLI = join(import.meta.dir, '../read-artifact-state.ts')
export const request = (): string => randomUUID()
export const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex')
export type Reply = { schemaVersion: number, outcome: string, data: Record<string, any>, nextAction?: string }
export type Result = { code: number, stdout: string, stderr: string }
export function call(root: string, args: string[], options: { read?: boolean, stdin?: string } = {}): Result {
  const result = Bun.spawnSync(['bun', options.read ? readCLI : writeCLI, ...args, '--root', root], { stdin: options.stdin === undefined ? undefined : Buffer.from(options.stdin) })
  return { code: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() }
}
export async function parallelCall(root: string, args: string[]): Promise<Result> {
  const process = Bun.spawn(['bun', writeCLI, ...args, '--root', root], { stdout: 'pipe', stderr: 'pipe' })
  const [code, stdout, stderr] = await Promise.all([process.exited, new Response(process.stdout).text(), new Response(process.stderr).text()])
  return { code, stdout, stderr }
}
export function ok(result: Result): Reply {
  expect(result.stderr).toBe('')
  expect(result.code).toBe(0)
  const response = JSON.parse(result.stdout)
  expect(response.schemaVersion).toBe(1)
  expect(typeof response.outcome).toBe('string')
  expect(response.data !== null && typeof response.data === 'object').toBe(true)
  return response
}
export function rejected(result: Result, code: string, exitCode = 1): void {
  expect(result.code).toBe(exitCode)
  expect(result.stdout).toBe('')
  expect(JSON.parse(result.stderr)).toMatchObject({ schemaVersion: 1, error: { code, message: expect.stringMatching(/\S/) } })
}
export function allocate(root: string, kind = 'personalized-gdd', id = request()): Reply {
  return ok(call(root, ['allocate', '--kind', kind, '--mode', 'deep', '--purpose', 'new-profile', '--request', id]))
}
export function start(root: string, run: string): Reply {
  return ok(call(root, ['start', '--run', run, '--request', request()]))
}
export function prepare(root: string, run: string, stage = 'chart-report', kind = 'generate', id = request()): Reply {
  return ok(call(root, ['prepare', '--run', run, '--stage', stage, '--kind', kind, '--request', id]))
}
export function read(root: string, command: string, run: string): Reply {
  return ok(call(root, [command, '--run', run], { read: true }))
}
export function tree(root: string): string[] {
  return readdirSync(root, { recursive: true, withFileTypes: true }).filter(entry => entry.isFile()).map(entry => join(entry.parentPath, entry.name).slice(root.length + 1)).sort()
}

export const syntheticReport = '四柱八字\n甲子\n紫微斗數 命盤\n命宮 子\nNatal Chart\nSun Aries\n'
export function submit(root: string, attempt: Record<string, any>, payload: unknown = {}): Reply {
  return ok(call(root, ['submit', '--attempt', attempt.attemptId, '--claim', attempt.claim, '--request', request()], { stdin: JSON.stringify(payload) }))
}
export function finish(root: string, attempt: Record<string, any>, id = request()): Reply {
  return ok(call(root, ['finish', '--attempt', attempt.attemptId, '--claim', attempt.claim, '--request', id]))
}
export function chartFixture(): { root: string, run: string, directory: string } {
  const root = makeRepository(), allocated = allocate(root), run = allocated.data.runId
  start(root, run)
  const chart = prepare(root, run).data
  mkdirSync(dirname(resolve(root, chart.output)), { recursive: true })
  writeFileSync(resolve(root, chart.output), syntheticReport)
  submit(root, chart, { path: chart.output, sha256: sha256(syntheticReport) })
  expect(finish(root, chart).outcome).toMatch(/succeeded|published|passed/)
  return { root, run, directory: allocated.data.directory }
}
export function interpretation(system = 'saju'): string {
  const config = {
    saju: { prefix: 'S', headings: ['# 사주팔자 심층 해석', '## 계산 전제', '## 원국과 십신 구조', '## 팔자 관계', '## 신살', '## 좌법과 인종법', '## 대운'], resolutions: ['원국 구조', '관계 작용', '운의 변화'] },
    ziwei: { prefix: 'Z', headings: ['# 자미두수 심층 해석', '## 계산 전제', '## 명반 기본 구조', '## 십이궁과 성요', '## 본명 사화', '## 대한', '## 유년과 유월'], resolutions: ['궁위 역할', '성요 상태', '시간 층위'] },
    natal: { prefix: 'N', headings: ['# 네이탈 차트 심층 해석', '## 계산 전제', '## 앵글과 하우스', '## 행성 배치', '## 주요 애스펙트', '## 차트 내부 종합'], resolutions: ['심리 기능', '삶의 영역', '내적 역동'] },
  }[system]!
  const evidence = buildEvidenceManifest(syntheticReport).systems[system as 'saju'][0].id
  const domains = ['성격과 기질', '직업과 적성', '재물', '연애와 배우자', '가족과 대인관계', '건강과 생활 리듬', '시기운']
  return config.headings.join('\n') + '\n## 전문 해석 항목\n' + domains.map((domain, index) => `### ${config.prefix}-0${index + 1}\n영역: ${domain}\n해상도: ${config.resolutions[index % 3]}\n해석: 이 차트의 구조를 실제 생활의 선택과 반응 방식에 연결하여 강점이 발현되는 조건과 반복해서 마찰이 생기는 조건을 함께 구체적으로 설명한다. 그 조건이 직업과 관계 및 일상의 반복되는 의사 결정에서 어떤 방식으로 작용하는지를 설명한다.\n근거: ${evidence}`).join('\n')
}
export function specialist(root: string, run: string, text: string, system = 'saju'): { attempt: Record<string, any>, result: ReturnType<typeof finish> } {
  const attempt = prepare(root, run, system).data
  mkdirSync(dirname(resolve(root, attempt.output)), { recursive: true })
  writeFileSync(resolve(root, attempt.output), text)
  submit(root, attempt, { path: attempt.output, sha256: sha256(text) })
  return { attempt, result: finish(root, attempt) }
}

