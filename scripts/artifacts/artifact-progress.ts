import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { RunManifest } from './artifact-run'

export const PROGRESS_STAGES = {
  'chart-report': { label: '차트 보고서와 근거 검증', dependencies: [], outputs: ['chart-report.md', 'chart-evidence.json'] },
  saju: { label: '사주 해석 검증 및 게시', dependencies: ['chart-report'], outputs: ['saju-interpretation.md'] },
  ziwei: { label: '자미두수 해석 검증 및 게시', dependencies: ['chart-report'], outputs: ['ziwei-interpretation.md'] },
  natal: { label: '네이탈 해석 검증 및 게시', dependencies: ['chart-report'], outputs: ['natal-interpretation.md'] },
  integration: { label: '통합 해석 검증', dependencies: ['saju', 'ziwei', 'natal'], outputs: ['chart-interpretation.md'] },
  selection: { label: '전투 콘셉트 선정 및 검증', dependencies: ['integration'], outputs: ['gameplay-concept-brief.md'] },
  'world-selection': { label: '세계 콘셉트 선정 및 검증', dependencies: ['selection'], outputs: ['world-concept-brief.md'] },
  gdd: { label: 'GDD 작성 및 검증', dependencies: ['world-selection'], outputs: ['personalized-action-rpg-concept.md'] },
  'final-validation': { label: '모든 최종 validator 통과', dependencies: ['gdd'], outputs: [] },
  'combat-registration': { label: '전투 지문 등록 확인', dependencies: ['final-validation'], outputs: [] },
  'world-registration': { label: '세계 지문 등록 확인', dependencies: ['combat-registration'], outputs: [] },
} as const
export type ProgressStage = keyof typeof PROGRESS_STAGES
export type StageProgress = {
  status: 'pending' | 'running' | 'succeeded' | 'failed'
  updatedAt: string; agentId?: string; attempt?: number
}

function stages(manifest: RunManifest): ProgressStage[] {
  return manifest.artifactKind === 'chart-report' ? ['chart-report'] : Object.keys(PROGRESS_STAGES) as ProgressStage[]
}

function directory(run: string): string { return join(run, 'garbage', 'progress') }

function writeAtomic(path: string, content: string): void {
  const temp = `${path}.${randomUUID()}.tmp`
  try {
    writeFileSync(temp, content, { flag: 'wx' })
    renameSync(temp, path)
  } finally { rmSync(temp, { force: true }) }
}

/** Serialize read/render/write across parallel specialist processes without dropping updates. */
function locked<T>(run: string, action: () => T): T {
  const lock = join(directory(run), '.lock')
  const deadline = Date.now() + 5000
  for (;;) {
    try { mkdirSync(lock); break } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      if (Date.now() >= deadline) throw new Error('Progress writer lock remains; inspect garbage/progress/.lock before continuing')
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10)
    }
  }
  try { return action() } finally { rmSync(lock, { recursive: true }) }
}

export function readStageProgress(run: string, manifest: RunManifest): Partial<Record<ProgressStage, StageProgress>> {
  const progress: Partial<Record<ProgressStage, StageProgress>> = {}
  for (const stage of stages(manifest)) {
    const path = join(directory(run), `${stage}.json`)
    if (!existsSync(path)) continue
    const entry = JSON.parse(readFileSync(path, 'utf8')) as StageProgress
    if (!['running', 'succeeded', 'failed'].includes(entry.status) || !Number.isFinite(Date.parse(entry.updatedAt))) throw new Error(`Invalid progress record: ${stage}`)
    progress[stage] = entry
  }
  return progress
}

function render(run: string, manifest: RunManifest): string {
  const progress = readStageProgress(run, manifest)
  const stageNames = stages(manifest)
  const active = stageNames.filter(stage => progress[stage]?.status === 'running')
  const failed = stageNames.filter(stage => progress[stage]?.status === 'failed')
  const ready = stageNames.filter(stage => progress[stage] == null && PROGRESS_STAGES[stage].dependencies.every(dependency => progress[dependency as ProgressStage]?.status === 'succeeded'))
  const lines = [
    `# ${manifest.artifactVersion} 생성 진행`, '',
    '실패 원인·재시도·중단 기록: [events.jsonl](events.jsonl)', '',
    `- 실행 상태: ${manifest.status}`, `- 종류: ${manifest.artifactKind}`, `- 모드 / 목적: ${manifest.mode} / ${manifest.purpose}`,
    `- 마지막 기록: ${new Date().toISOString()}`, '- 실행 기록: [artifact-run.json](artifact-run.json)', '',
    '## 단계', '',
  ]
  for (const stage of stageNames) {
    const state = progress[stage]
    lines.push(`- [${state?.status === 'succeeded' ? 'x' : ' '}] ${PROGRESS_STAGES[stage].label} — ${state?.status ?? 'pending'} (${stage})`)
    for (const output of PROGRESS_STAGES[stage].outputs) lines.push(`  - 산출물: [${output}](docs/GDD/${output})`)
    if (state) lines.push(`  - 체크포인트: [${stage}.json](garbage/progress/${stage}.json)`)
    if (state?.agentId) lines.push(`  - 에이전트: ${state.agentId}`)
    if (state?.attempt) lines.push(`  - 시도: ${state.attempt}/3 — [기록](garbage/attempts/${stage}/${String(state.attempt).padStart(3, '0')}/)`)
  }
  lines.push('', '## 이어서 작업할 때', '')
  if (manifest.status === 'succeeded') {
    lines.push('실행이 성공으로 종료됐다. 추가 생성 작업은 없다. 재실행하거나 지문을 다시 등록하지 않는다.')
  } else if (manifest.status === 'failed' || manifest.status === 'cancelled') {
    lines.push(`종료 상태는 ${manifest.status}다. 이 파일은 자동 재개 권한이 아니다. 종료된 run을 다시 열거나 같은 버전을 새 실행에 재사용하지 않는다.`)
    if (manifest.failure) lines.push(`실패 단계: ${manifest.failure.stage}. 오류 요약은 artifact-run.json에서 확인한다.`)
  } else {
    if (active.length) lines.push(`진행 중으로 기록된 단계: ${active.join(', ')}. 에이전트·프로세스가 실제로 살아 있는지 먼저 확인한다. 중단됐다고 추정해 중복 실행하지 않는다.`)
    if (failed.length) lines.push(`실패 기록 확인 대상: ${failed.join(', ')}. 전문 해석은 기록된 결과와 남은 시도 한도를 확인한 뒤에만 다음 시도를 예약한다.`)
    if (ready.length) lines.push(`선행 단계 기록상 다음 작업 후보: ${ready.join(', ')}.`)
    if (stageNames.every(stage => progress[stage]?.status === 'succeeded')) lines.push('모든 단계가 완료됐다. 지문 등록 결과까지 대조한 뒤 부모 run을 succeeded로 기록한다.')
    lines.push('체크 표시는 검증 완료 기록이다. 파일이 있다는 이유만으로 완료 처리하지 않는다. 완료된 산출물은 재검증해 재사용하고, 미완성 파일을 덮어쓰지 않는다.')
  }
  lines.push('', '## 복구 확인 순서', '',
    '1. artifact-run.json과 이 파일, garbage/progress/의 단계 기록을 확인한다. TODO.md가 오래됐으면 update-artifact-progress.ts sync로 다시 렌더링한다.',
    '2. 차트가 없으면 원래 입력을 확보한 뒤 차트 단계를 실행한다. 입력이 남아 있지 않으면 필요한 값만 사용자에게 확인한다.',
    '3. 전문 해석은 garbage/attempts/<system>/의 input.json, result.json, accepted.json과 정식 문서를 대조한다. 결과 없는 시도·남은 락은 자동 실패 처리하거나 삭제하지 않는다.',
    '4. 결과는 기록됐지만 게시나 체크포인트가 중단된 경우, 새 시도를 만들기 전에 산출물과 validator 결과를 대조한다.',
    '5. 지문 등록이 중단됐다면 두 레지스트리에 이 버전이 이미 등록됐는지 각각 확인한다. 등록 완료 후 체크포인트 전에 중단됐을 수 있으므로 같은 run을 다시 등록하지 않는다.',
    '6. 단계별 입력·격리·검증·재시도 계약은 generate-personalized-gdd 또는 generate-chart-report 스킬을 따른다. 이 파일을 하위 해석·설계 에이전트에 전달하지 않는다.',
    '', '이 파일은 도구가 갱신한다. 원시 출생정보, 차트·해석 본문, 명령 인자와 원시 stderr를 기록하지 않는다.', '')
  return lines.join('\n')
}

/** New runs get a readable handoff immediately; older runs are not backfilled. */
export function initializeProgress(run: string, manifest: RunManifest): void {
  mkdirSync(directory(run), { recursive: true })
  writeFileSync(join(run, 'TODO.md'), render(run, manifest), { flag: 'wx' })
}

export function refreshProgress(run: string, manifest: RunManifest): void {
  if (!existsSync(join(run, 'TODO.md'))) return
  locked(run, () => {
    if (manifest.status === 'failed' && manifest.failure && stages(manifest).includes(manifest.failure.stage as ProgressStage)) {
      const stage = manifest.failure.stage as ProgressStage
      const current = readStageProgress(run, manifest)[stage]
      if (current?.status !== 'succeeded') writeAtomic(join(directory(run), `${stage}.json`), `${JSON.stringify({ ...current, status: 'failed', updatedAt: new Date().toISOString() }, null, 2)}\n`)
    }
    writeAtomic(join(run, 'TODO.md'), render(run, manifest))
  })
}

export function recordStageProgress(run: string, manifest: RunManifest, stage: ProgressStage, status: StageProgress['status'], details: { agentId?: string; attempt?: number } = {}): void {
  if (!stages(manifest).includes(stage)) throw new Error('Unsupported progress stage for this run')
  if (manifest.status !== 'running') throw new Error('Stage checkpoints require a running run')
  if (!existsSync(join(run, 'TODO.md'))) throw new Error('Run has no progress log; do not backfill previous runs automatically')
  if (!['running', 'succeeded', 'failed'].includes(status)) throw new Error('Invalid checkpoint status')
  if (details.agentId != null && !/^[a-zA-Z0-9_./:-]{1,160}$/.test(details.agentId)) throw new Error('Invalid agent identifier')
  if (details.attempt != null && (!['saju', 'ziwei', 'natal'].includes(stage) || !Number.isInteger(details.attempt) || details.attempt < 1 || details.attempt > 3)) throw new Error('Invalid specialist attempt')
  locked(run, () => {
    const progress = readStageProgress(run, manifest)
    const current = progress[stage]
    if (current?.status === 'succeeded' && status !== 'succeeded') throw new Error('Completed stages cannot be restarted')
    if (status !== 'failed' && !PROGRESS_STAGES[stage].dependencies.every(dependency => progress[dependency as ProgressStage]?.status === 'succeeded')) throw new Error('Stage dependencies are not complete')
    const next: StageProgress = { status, updatedAt: new Date().toISOString(), ...details }
    if (current?.attempt && details.attempt == null) next.attempt = current.attempt
    if (current?.agentId && details.agentId == null && (details.attempt == null || details.attempt === current.attempt)) next.agentId = current.agentId
    writeAtomic(join(directory(run), `${stage}.json`), `${JSON.stringify(next, null, 2)}\n`)
    writeAtomic(join(run, 'TODO.md'), render(run, manifest))
  })
}
