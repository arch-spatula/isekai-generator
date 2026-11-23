/**
 * 파일 기반 생성 실행: 버전 폴더 할당(run.md), 시도별 입력 조회, 방어 편집 판정.
 * 모든 기록은 한 번 쓰고 고치지 않는다.
 * 계약: docs/spec/remove-sqlite-state.md
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, normalize } from 'node:path'
import { buildEvidenceManifest } from '../../.agents/skills/generate-chart-report/scripts/chart-evidence'
import { diagnoseSystemInterpretation, type ChartSystem, type InterpretationDiagnostic } from '../../.agents/skills/interpret-chart-system/scripts/validate-system-interpretation'
import { diagnoseIntegrationResponsibility } from '../../.agents/skills/interpret-chart-report/scripts/validate-interpretation'
import { KINDS, MODES, PURPOSES, readSeriesConfig, repositoryState } from './artifact-run'
import { defensiveAllowedTargets, evaluateDefensivePayload } from './defensive-edit'
import { ActionError } from './pipeline-actions'
import { checkStep, pipelineStatus, readAttempts, readRunConfig, STEPS, type Attempt, type StepId } from './pipeline-status'

const SYSTEMS = ['saju', 'ziwei', 'natal'] as const
/** 전문 해석 입력에 넘길 차트 구간의 시작과 끝 표식 */
const CHART_SECTIONS: Record<ChartSystem, [string, string | null]> = { saju: ['四柱八字', '紫微斗數 命盤'], ziwei: ['紫微斗數 命盤', 'Natal Chart'], natal: ['Natal Chart', null] }
const hash = (text: string): string => createHash('sha256').update(text).digest('hex')

/**
 * 활성 series의 다음 버전 폴더를 배타적으로 만들고 run.md를 쓴다. 상태 DB는 만들지 않는다.
 * `release-candidate`는 깨끗한 작업 트리에서만 할당한다.
 */
export function allocateRun(root: string, kind: string, mode: string, purpose: string): { version: string; directory: string } {
  if (!KINDS.includes(kind as never) || !MODES.includes(mode as never) || !PURPOSES.includes(purpose as never)) throw new ActionError('invalid-arguments', 'Unknown kind, mode or purpose')
  const config = readSeriesConfig(root), source = repositoryState(root)
  if (purpose === 'release-candidate' && source.dirty) throw new ActionError('dirty-release-candidate', 'release-candidate requires a clean working tree')
  const artifacts = join(root, 'artifacts'), pattern = new RegExp(`^v${config.activeSeries.replace('.', '\\.')}\\.(0|[1-9]\\d*)$`)
  mkdirSync(artifacts, { recursive: true })
  for (;;) {
    const patch = Math.max(-1, ...readdirSync(artifacts).map(name => Number(name.match(pattern)?.[1] ?? -1))) + 1
    const version = `v${config.activeSeries}.${patch}`, directory = join(artifacts, version)
    try {
      mkdirSync(directory)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') continue
      throw error
    }
    writeFileSync(join(directory, 'run.md'), [
      `종류: ${kind}`, `모드: ${mode}`, `목적: ${purpose}`, `series: ${config.activeSeries}`,
      `기준선 revision: ${config.baselineRevision}`, `source revision: ${source.revision}`, `dirty: ${source.dirty ? '예' : '아니오'}`, '',
    ].join('\n'), { flag: 'wx' })
    return { version, directory }
  }
}

function attemptOf(versionDir: string, attempt: string): { step: StepId; attempt: Attempt; others: Attempt[] } {
  const [root, step, name] = normalize(attempt).split('/')
  const found = root === 'garbage' && STEPS.some(s => s.id === step) ? readAttempts(versionDir, step as StepId) : []
  const target = found.find(a => a.path === join('garbage', step, name))
  if (!target) throw new ActionError('unknown-attempt', `${attempt} is not an attempt folder`)
  return { step: step as StepId, attempt: target, others: found }
}

function text(versionDir: string, id: StepId): string {
  return readFileSync(join(versionDir, STEPS.find(s => s.id === id)!.output), 'utf8')
}

function chartSection(report: string, system: ChartSystem): string {
  const [start, end] = CHART_SECTIONS[system], offset = report.indexOf(start)
  return report.slice(offset, end ? report.indexOf(end, offset + start.length) : undefined)
}

function diagnose(versionDir: string, step: StepId, source: string): InterpretationDiagnostic[] {
  return step === 'integration'
    ? diagnoseIntegrationResponsibility(source)
    : diagnoseSystemInterpretation(step as ChartSystem, source, buildEvidenceManifest(text(versionDir, 'chart-report')))
}

/** 편집 시도의 source(직전 편집 후보 또는 원래 생성 후보), 진단, scope */
function editContext(versionDir: string, step: StepId, attempt: Attempt, others: Attempt[]) {
  const status = pipelineStatus(versionDir).steps.find(s => s.id === step)!
  const action = status.action as Record<string, any> | undefined
  if (status.state !== 'edit' || !action || (action.attempt !== attempt.path && action.resume !== attempt.path)) {
    throw new ActionError('edit-not-expected', `${attempt.path} is not the edit attempt the status command expects`)
  }
  const earlier = others.filter(a => a.kind === 'edit' && a.number < attempt.number)
  const sourcePath = String(action.source), source = readFileSync(join(versionDir, sourcePath), 'utf8')
  const failed = earlier.filter(a => a.result?.['상태'] === 'editing-failed' && (step !== 'integration' || a.result?.['실패 종류'] === 'semantic')).length
  const scope = (['sentence', 'item', 'system'] as const)[Math.min(failed, 2)]
  const previous = [...earlier].reverse().find(a => a.result != null)
  return { sourcePath, source, scope, diagnostics: diagnose(versionDir, step, source), previous }
}

/** 시도 하나가 읽어도 되는 입력만 모아 돌려준다. 파일을 쓰지 않는다. */
export function attemptInput(versionDir: string, attemptPath: string): Record<string, unknown> {
  const { step, attempt, others } = attemptOf(versionDir, attemptPath)
  const definition = STEPS.find(s => s.id === step)!
  const system = (SYSTEMS as readonly string[]).includes(step) ? step as ChartSystem : undefined
  const documents = definition.inputs.map(input => ({
    step: input, path: STEPS.find(s => s.id === input)!.output,
    text: system && input === 'chart-report' ? chartSection(text(versionDir, input), system) : text(versionDir, input),
  }))
  const base = { step, kind: attempt.kind, number: attempt.number, mode: readRunConfig(versionDir)['모드'] ?? 'light', candidate: join(attempt.path, 'candidate.md'), documents }
  const evidence = system ? { evidence: buildEvidenceManifest(text(versionDir, 'chart-report')).systems[system] } : {}
  if (attempt.kind === 'edit') {
    const context = editContext(versionDir, step, attempt, others)
    return {
      ...base, ...evidence, scope: context.scope,
      source: { path: context.sourcePath, sha256: hash(context.source), text: context.source },
      diagnostics: context.diagnostics, allowedTargets: defensiveAllowedTargets(context.source, step === 'integration'),
      ...(context.previous ? { previous: { candidate: context.previous.candidate ?? null, result: context.previous.result } } : {}),
    }
  }
  const previous = others.filter(a => a.kind !== 'edit' && a.number < attempt.number && a.candidate != null).at(-1)
  return {
    ...base, ...evidence,
    ...(definition.registry ? { registry: attempt.registry ?? null } : {}),
    ...(previous ? { previous: { candidate: previous.candidate, diagnostics: checkStep(versionDir, step, previous.candidate!, previous.registry) } } : {}),
  }
}

type Proposal = Parameters<typeof evaluateDefensivePayload>[2] & { executionFailed?: boolean }

function resultMarkdown(fields: Record<string, string | undefined>, errors: { code: string; message: string }[], decisions: string[]): string {
  const lines = Object.entries(fields).filter(([, value]) => value != null).map(([key, value]) => `${key}: ${value}`)
  if (errors.length) lines.push('', '## 오류', ...errors.map(error => `- ${error.code}: ${error.message}`))
  if (decisions.length) lines.push('', '## 진단 처리', ...decisions)
  return `${lines.join('\n')}\n`
}

/**
 * 편집 제안을 source에 적용해 판정하고 candidate.md와 result.md를 한 번 쓴다. 제안 원문은 보관하지 않는다.
 * 통합 편집은 진단마다 처리 결과와 보존 사유를 result.md에 남긴다. 이미 결과가 있으면 그 결과를 돌려준다.
 */
export function finishEdit(versionDir: string, attemptPath: string, proposal: Proposal): { status: string; errors: { code: string; message: string }[] } {
  const { step, attempt, others } = attemptOf(versionDir, attemptPath)
  if (attempt.kind !== 'edit') throw new ActionError('not-an-edit-attempt', `${attemptPath} is not an edit attempt`)
  if (attempt.result) return { status: attempt.result['상태'], errors: [] }
  const context = editContext(versionDir, step, attempt, others)
  const dir = join(versionDir, attempt.path)
  let candidate: string | undefined, errors: { code: string; message: string }[] = [], status: string, failureKind: string | undefined, decisions: string[] = []
  if (proposal.executionFailed) {
    status = 'execution-failed'
    errors = [{ code: 'agent-execution', message: 'Worker produced no edit proposal' }]
  } else {
    try {
      const evaluated = evaluateDefensivePayload(context.source, { system: step as ChartSystem | 'integration', attempt: attempt.number, scope: context.scope, diagnostics: context.diagnostics }, proposal)
      candidate = evaluated.candidate
      errors = step === 'integration'
        ? [...evaluated.errors, ...checkStep(versionDir, step, candidate).map(message => ({ code: 'validation', message })), ...evaluated.unresolved.map(target => ({ code: 'semantic-unresolved', message: target }))]
        : diagnoseSystemInterpretation(step as ChartSystem, candidate, buildEvidenceManifest(text(versionDir, 'chart-report')))
      status = evaluated.passed && errors.length === 0 ? 'passed' : 'editing-failed'
      if (status === 'editing-failed') failureKind = 'semantic'
      if (step === 'integration') decisions = proposal.review.primary.map(item => `- 진단 ${item.diagnosticIndex}: ${item.status} — ${item.reason}`)
    } catch (error) {
      candidate = context.source
      errors = [{ code: 'editing-contract', message: error instanceof Error ? error.message : String(error) }]
      status = 'editing-failed'
      failureKind = 'format'
    }
  }
  if (candidate != null) {
    const path = join(dir, 'candidate.md')
    if (existsSync(path)) { if (readFileSync(path, 'utf8') !== candidate) throw new ActionError('candidate-conflict', `${attemptPath}/candidate.md differs from the evaluated candidate`) }
    else writeFileSync(path, candidate, { flag: 'wx' })
  }
  writeFileSync(join(dir, 'result.md'), resultMarkdown({ '상태': status, scope: context.scope, '실패 종류': failureKind, source: context.sourcePath }, errors, decisions), { flag: 'wx' })
  return { status, errors }
}
