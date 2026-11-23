/**
 * 개인화 GDD 생성의 단계표와, 버전 폴더의 파일만 보고 진행 상태를 계산하는 읽기 전용 함수.
 * 계약: docs/spec/remove-sqlite-state.md
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { buildEvidenceManifest, type ChartEvidenceManifest } from '../../.agents/skills/generate-chart-report/scripts/chart-evidence'
import { diagnoseSystemInterpretation } from '../../.agents/skills/interpret-chart-system/scripts/validate-system-interpretation'
import { isValidInterpretation } from '../../.agents/skills/interpret-chart-report/scripts/validate-interpretation'
import { parseFinalFingerprint, parseSelectedCandidateId, validateConceptBrief } from '../../.agents/skills/select-gameplay-concept/scripts/validate-concept-brief'
import type { FingerprintRegistry } from '../../.agents/skills/select-gameplay-concept/scripts/fingerprint-registry'
import { validateWorldBrief } from '../../.agents/skills/select-world-concept/scripts/validate-world-brief'
import { parseWorldBrief, selectedWorld, type WorldRegistry } from '../../.agents/skills/select-world-concept/scripts/world-contract'
import { isValidGdd } from '../../.agents/skills/generate-gdd-from-interpretation/scripts/validate-gdd'

export type StepId = 'chart-report' | 'saju' | 'ziwei' | 'natal' | 'integration' | 'selection' | 'world-selection' | 'gdd'

export type Step = {
  id: StepId
  needs: StepId[]
  /** 버전 폴더 기준 정식 경로 */
  output: string
  /** 이 단계가 읽어도 되는 선행 단계 */
  inputs: StepId[]
  /** 생성(generate·repair) 시도 한도 */
  generationLimit: number
  /** 방어 편집이 게시 전에 필요하면 그 시도 한도, 필요 없으면 0 */
  editLimit: number
  /** 지문 레지스트리 스냅샷이 필요한 선택 단계의 종류 */
  registry?: 'combat' | 'world'
  skill: string
}

const SYSTEMS = ['saju', 'ziwei', 'natal'] as const

export const STEPS: Step[] = [
  { id: 'chart-report', needs: [], output: 'charts/chart-report.md', inputs: [], generationLimit: 2, editLimit: 0, skill: 'generate-chart-report' },
  ...SYSTEMS.map((id): Step => ({ id, needs: ['chart-report'], output: `interpretation/${id}-interpretation.md`, inputs: ['chart-report'], generationLimit: 3, editLimit: 3, skill: 'interpret-chart-system' })),
  { id: 'integration', needs: [...SYSTEMS], output: 'interpretation/chart-interpretation.md', inputs: [...SYSTEMS], generationLimit: 2, editLimit: 3, skill: 'interpret-chart-report' },
  { id: 'selection', needs: ['integration'], output: 'design-rationale/gameplay-concept-brief.md', inputs: ['integration'], generationLimit: 2, editLimit: 0, registry: 'combat', skill: 'select-gameplay-concept' },
  { id: 'world-selection', needs: ['selection'], output: 'design-rationale/world-concept-brief.md', inputs: ['integration', 'selection'], generationLimit: 2, editLimit: 0, registry: 'world', skill: 'select-world-concept' },
  { id: 'gdd', needs: ['world-selection'], output: 'game/personalized-action-rpg-concept.md', inputs: ['chart-report', 'integration', 'selection', 'world-selection'], generationLimit: 2, editLimit: 0, skill: 'generate-gdd-from-interpretation' },
]

export type StepState = 'done' | 'publish' | 'repair' | 'edit' | 'ready' | 'exhausted' | 'wait' | 'input'

export type Attempt = {
  kind: 'generate' | 'repair' | 'edit'
  number: number
  /** 버전 폴더 기준 시도 폴더 경로 */
  path: string
  candidate?: string
  /** result.md의 `키: 값` 필드. result.md가 없으면 undefined (끊긴 시도) */
  result?: Record<string, string>
  registry?: unknown
}

export type StepStatus = {
  id: StepId
  state: StepState
  generationAttempts: number
  editAttempts: number
  diagnostics?: string[]
  /** 후보가 없는 생성 시도와 result.md가 없는 편집 시도. 작업 중인지 끊겼는지는 오케스트레이터가 확인한다 */
  unfinished?: string[]
  action?: Record<string, unknown>
}

export type PipelineStatus = { version: string; steps: StepStatus[] }

const ATTEMPT_DIR = /^(generate|repair|edit)-([1-9]\d*)$/
const VERSION_DIR = /^v(0\.(?:0|[1-9]\d*))\.(0|[1-9]\d*)$/
const EDIT_SCOPES = ['sentence', 'item', 'system'] as const

/** 일반 파일이면 내용을, 없거나 디렉터리면 undefined를 돌려준다. */
function read(path: string): string | undefined {
  return existsSync(path) && statSync(path).isFile() ? readFileSync(path, 'utf8') : undefined
}

/** result.md의 `키: 값` 줄을 읽는다. */
export function parseResult(text: string): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const match = line.match(/^([^:\s][^:]*):\s*(.*)$/)
    if (match && !(match[1] in fields)) fields[match[1].trim()] = match[2].trim()
  }
  return fields
}

/** 한 단계의 시도 폴더를 번호 순으로 읽는다. */
export function readAttempts(versionDir: string, step: StepId): Attempt[] {
  const root = join(versionDir, 'garbage', step)
  if (!existsSync(root)) return []
  return readdirSync(root).flatMap((name): Attempt[] => {
    const match = name.match(ATTEMPT_DIR)
    if (!match) return []
    const dir = join(root, name), resultText = read(join(dir, 'result.md')), registryText = read(join(dir, 'registry.json'))
    let registry: unknown
    try { registry = registryText == null ? undefined : JSON.parse(registryText) } catch { registry = null }
    return [{ kind: match[1] as Attempt['kind'], number: Number(match[2]), path: join('garbage', step, name), candidate: read(join(dir, 'candidate.md')), result: resultText == null ? undefined : parseResult(resultText), registry }]
  }).sort((a, b) => a.kind.localeCompare(b.kind) || a.number - b.number)
}

/**
 * 같은 series의 다른 버전 폴더 중 GDD가 게시된 run의 브리프에서 지문 레지스트리를 만든다.
 * 선택 시도 폴더를 만들 때 이 결과를 registry.json 스냅샷으로 한 번 쓴다.
 */
export function currentRegistry(artifactsDir: string, kind: 'combat' | 'world', excludeVersion: string): FingerprintRegistry | WorldRegistry {
  const series = excludeVersion.match(VERSION_DIR)?.[1]
  const versions = existsSync(artifactsDir) ? readdirSync(artifactsDir).filter(name => name !== excludeVersion && name.match(VERSION_DIR)?.[1] === series) : []
  versions.sort((a, b) => Number(a.match(VERSION_DIR)![2]) - Number(b.match(VERSION_DIR)![2]))
  const entries = versions.flatMap((version): any[] => {
    const dir = join(artifactsDir, version)
    if (!existsSync(join(dir, 'game/personalized-action-rpg-concept.md'))) return []
    try {
      if (kind === 'combat') {
        const brief = readFileSync(join(dir, 'design-rationale/gameplay-concept-brief.md'), 'utf8')
        const fingerprint = parseFinalFingerprint(brief), candidateId = parseSelectedCandidateId(brief)
        return fingerprint && candidateId ? [{ version, candidateId, fingerprint }] : []
      }
      const selected = selectedWorld(parseWorldBrief(readFileSync(join(dir, 'design-rationale/world-concept-brief.md'), 'utf8')))
      return [{ version, candidateId: selected.id, fingerprint: selected.fingerprint, spatialPlay: selected.spatialPlay }]
    } catch {
      return []
    }
  })
  return { schemaVersion: 1, entries }
}

type Context = { versionDir: string; finals: Partial<Record<StepId, string>> }

/** 할당 때 한 번 쓴 run.md의 `키: 값` 필드. 없으면 빈 객체. */
export function readRunConfig(versionDir: string): Record<string, string> {
  const text = read(join(versionDir, 'run.md'))
  return text == null ? {} : parseResult(text)
}

/** 이 run에 해당하는 단계. 차트 단독 실행은 차트 단계만 갖는다. */
export function runSteps(versionDir: string): Step[] {
  return readRunConfig(versionDir)['종류'] === 'chart-report' ? STEPS.filter(step => step.id === 'chart-report') : STEPS
}

/** 단계 입력으로 쓰는 게시 문서를 읽어 검증한다. 선행 문서가 없으면 그 사실을 오류로 돌려준다. */
export function checkStep(versionDir: string, id: StepId, text: string, registry?: unknown): string[] {
  const step = STEPS.find(s => s.id === id)!
  const finals: Context['finals'] = {}
  for (const input of new Set<StepId>([...step.needs, ...step.inputs])) finals[input] = read(join(versionDir, STEPS.find(s => s.id === input)!.output))
  return check(step, text, { versionDir, finals }, registry)
}

/** 단계 산출물의 구조 검증. 오류가 없으면 빈 배열. */
function check(step: Step, text: string, context: Context, registry?: unknown): string[] {
  const { finals } = context
  try {
    if (step.id === 'chart-report') { buildEvidenceManifest(text); return [] }
    if ((SYSTEMS as readonly string[]).includes(step.id)) {
      const manifest: ChartEvidenceManifest = buildEvidenceManifest(finals['chart-report']!)
      return diagnoseSystemInterpretation(step.id as 'saju', text, manifest).filter(error => error.code !== 'responsibility-avoidance').map(error => error.message)
    }
    if (step.id === 'integration') {
      const ids = Object.fromEntries(SYSTEMS.map(system => [{ saju: 'S', ziwei: 'Z', natal: 'N' }[system], new Set([...finals[system]!.matchAll(/^### ([SZN]-\d{2})/gm)].map(match => match[1]))]))
      return isValidInterpretation(text, ids as any, true) ? [] : ['Invalid integrated interpretation']
    }
    if (step.registry && registry == null) return ['Missing registry snapshot (registry.json)']
    if (step.id === 'selection') return validateConceptBrief(text, finals.integration!, registry as FingerprintRegistry)
    if (step.id === 'world-selection') return validateWorldBrief(text, finals.integration!, finals.selection!, registry as WorldRegistry)
    return isValidGdd(text, finals['chart-report']!, finals.integration!, finals.selection!, finals['world-selection']!) ? [] : ['Invalid GDD']
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)]
  }
}

function nextNumber(attempts: Attempt[], kinds: Attempt['kind'][]): number {
  return Math.max(0, ...attempts.filter(a => kinds.includes(a.kind)).map(a => a.number)) + 1
}

function inputPaths(step: Step): string[] {
  return step.inputs.map(id => STEPS.find(s => s.id === id)!.output)
}

function stepStatus(step: Step, context: Context, done: Set<StepId>, artifactsDir: string, version: string): StepStatus {
  const attempts = readAttempts(context.versionDir, step.id)
  const generations = attempts.filter(a => a.kind !== 'edit'), edits = attempts.filter(a => a.kind === 'edit')
  const unfinished = [...generations.filter(a => a.candidate == null && a.result == null), ...edits.filter(a => a.result == null)].map(a => a.path)
  const base = { id: step.id, generationAttempts: generations.length, editAttempts: edits.length, ...(unfinished.length > 0 ? { unfinished } : {}) }
  const validCandidate = (a: Attempt) => a.candidate != null && check(step, a.candidate, context, a.registry).length === 0
  const passedEdit = edits.find(a => a.result?.['상태'] === 'passed' && validCandidate(a))

  const final = read(join(context.versionDir, step.output))
  if (final != null) {
    const source = step.registry ? generations.find(a => a.candidate === final) : undefined
    const diagnostics = check(step, final, context, source?.registry)
    if (diagnostics.length > 0) return { ...base, state: 'repair', diagnostics, action: { action: 'repair', path: step.output } }
    if (step.editLimit > 0 && passedEdit?.candidate !== final) return { ...base, state: 'repair', diagnostics: ['Published without a passed defensive edit'], action: { action: 'repair', path: step.output } }
    return { ...base, state: 'done' }
  }

  if (!step.needs.every(id => done.has(id))) return { ...base, state: 'wait' }

  if (step.editLimit > 0 ? passedEdit : generations.find(validCandidate)) {
    const source = step.editLimit > 0 ? passedEdit! : generations.find(validCandidate)!
    return { ...base, state: 'publish', action: { action: 'publish', candidate: join(source.path, 'candidate.md'), output: step.output } }
  }

  if (step.editLimit > 0) {
    const original = [...generations].reverse().find(validCandidate)
    if (original) {
      // 범위를 넓혀 가며 고치므로 직전 편집이 남긴 후보가 다음 편집의 source다.
      const source = [...edits].reverse().find(a => a.candidate != null) ?? original
      const failed = edits.filter(a => a.result?.['상태'] === 'editing-failed' && (step.id !== 'integration' || a.result?.['실패 종류'] === 'semantic')).length
      const next = { action: 'edit', skill: 'edit-defensive-phrases', attempt: join('garbage', step.id, `edit-${nextNumber(attempts, ['edit'])}`), source: join(source.path, 'candidate.md'), scope: EDIT_SCOPES[Math.min(failed, EDIT_SCOPES.length - 1)] }
      // 끊긴 편집은 결과가 없으므로 scope가 그대로다. 작업이 끝났음을 확인한 뒤 교체할 때 쓸 다음 경로도 함께 준다.
      const interrupted = edits.find(a => a.result == null)
      if (interrupted) return { ...base, state: 'edit', action: { ...next, resume: interrupted.path } }
      if (edits.length >= step.editLimit) return { ...base, state: 'exhausted', diagnostics: ['Defensive edit attempts exhausted'] }
      return { ...base, state: 'edit', action: next }
    }
  }

  if (step.id === 'chart-report' && generations.length === 0) return { ...base, state: 'input', action: { action: 'generate', skill: step.skill, attempt: 'garbage/chart-report/generate-1', reason: 'Birth input is not stored; ask the user for it and run the chart report' } }
  if (generations.length >= step.generationLimit) return { ...base, state: 'exhausted', diagnostics: ['Generation attempts exhausted'] }
  const previous = [...generations].reverse().find(a => a.candidate != null)
  const kind = previous ? 'repair' : 'generate'
  return {
    ...base, state: 'ready',
    action: {
      action: kind, skill: step.skill,
      attempt: join('garbage', step.id, `${kind}-${nextNumber(attempts, ['generate', 'repair'])}`),
      inputs: inputPaths(step),
      ...(previous ? { previous: { candidate: join(previous.path, 'candidate.md'), diagnostics: check(step, previous.candidate!, context, previous.registry) } } : {}),
      ...(step.registry ? { registry: currentRegistry(artifactsDir, step.registry, version) } : {}),
    },
  }
}

/** 버전 폴더만 보고 단계별 상태와 다음 행동을 계산한다. 파일을 만들거나 고치지 않는다. */
export function pipelineStatus(versionDir: string): PipelineStatus {
  const version = basename(versionDir), artifactsDir = dirname(versionDir)
  const context: Context = { versionDir, finals: {} }
  const done = new Set<StepId>(), steps: StepStatus[] = []
  for (const step of runSteps(versionDir)) {
    const status = stepStatus(step, context, done, artifactsDir, version)
    if (status.state === 'done') { done.add(step.id); context.finals[step.id] = read(join(versionDir, step.output)) }
    steps.push(status)
  }
  return { version, steps }
}
