/**
 * 상태 명령이 안내한 쓰기 동작: 시도 폴더 만들기와 정식 문서 게시.
 * 모든 쓰기는 배타적 생성(mkdir, link)이라 같은 기록을 고쳐 쓰지 않는다.
 * 계약: docs/spec/remove-sqlite-state.md
 */
import { existsSync, linkSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { pipelineStatus, STEPS, type StepId, type StepStatus } from './pipeline-status'

export class ActionError extends Error {
  constructor(public code: string, message: string) { super(message) }
}

function stepOf(versionDir: string, id: StepId): StepStatus {
  if (!STEPS.some(step => step.id === id)) throw new ActionError('unknown-step', `Unknown step: ${id}`)
  return pipelineStatus(versionDir).steps.find(step => step.id === id)!
}

/**
 * `<kind>-<n>` 폴더를 배타적으로 만든다. 이미 있으면 다음 번호로 넘어가며, 한도를 넘는 번호는 만들지 않는다.
 * 같은 단계를 병렬로 만들어도 서로 다른 번호를 받는다. `sharedWith` 종류가 같은 번호를 쓰고 있으면 그 번호도 건너뛴다
 * (generate·repair는 번호와 한도를 함께 쓴다).
 */
export function claimAttemptDir(stageDir: string, kind: string, start: number, limit: number, sharedWith?: string): { number: number; dir: string } {
  mkdirSync(stageDir, { recursive: true })
  for (let number = start; number <= limit; number++) {
    if (sharedWith && existsSync(join(stageDir, `${sharedWith}-${number}`))) continue
    const dir = join(stageDir, `${kind}-${number}`)
    try {
      mkdirSync(dir)
      return { number, dir }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
  }
  throw new ActionError('attempt-budget-exhausted', `No ${kind} attempt left within limit ${limit}`)
}

export type CreatedAttempt = { attempt: string; candidate: string; kind: string; inputs?: string[]; source?: string; scope?: string }

/**
 * 상태가 `ready`나 `edit`인 단계의 다음 시도 폴더를 만든다.
 * 끝나지 않은 시도가 있으면 중복 호출을 막기 위해 거부한다. 그 시도의 작업이 끝났음을 확인했을 때만 `replaceUnfinished`를 쓴다.
 */
export function createAttempt(versionDir: string, id: StepId, options: { replaceUnfinished?: boolean } = {}): CreatedAttempt {
  const status = stepOf(versionDir, id)
  // 차트 단계의 `input`은 출생 입력을 가진 차트 실행기만 시도를 만들 수 있다는 뜻이다.
  if (status.state !== 'ready' && status.state !== 'edit' && !(id === 'chart-report' && status.state === 'input')) throw new ActionError('step-not-ready', `Step ${id} is ${status.state}`)
  if (status.unfinished && !options.replaceUnfinished) throw new ActionError('unfinished-attempt', `Unfinished attempt exists: ${status.unfinished.join(', ')}`)
  const action = status.action as Record<string, any>
  if (action.resume && !options.replaceUnfinished) throw new ActionError('unfinished-attempt', `Resume ${action.resume} instead`)

  const step = STEPS.find(s => s.id === id)!
  const kind = status.state === 'edit' ? 'edit' : action.action as string
  const start = Number(String(action.attempt).match(/-(\d+)$/)![1])
  const limit = kind === 'edit' ? step.editLimit : step.generationLimit
  const sharedWith = kind === 'generate' ? 'repair' : kind === 'repair' ? 'generate' : undefined
  const claimed = claimAttemptDir(join(versionDir, 'garbage', id), kind, start, limit, sharedWith)
  const attempt = join('garbage', id, `${kind}-${claimed.number}`)
  if (action.registry) writeFileSync(join(claimed.dir, 'registry.json'), `${JSON.stringify(action.registry, null, 2)}\n`)
  return {
    attempt, candidate: join(attempt, 'candidate.md'), kind,
    ...(action.inputs ? { inputs: action.inputs } : {}),
    ...(action.source ? { source: action.source, scope: action.scope } : {}),
  }
}

/**
 * 상태가 `publish`인 단계의 후보를 정식 경로에 둔다. 정식 파일이 이미 있으면 덮어쓰지 않는다.
 * 같은 내용이면 성공으로 본다. 게시 도중 끊겨도 정식 파일은 없거나 완전하다.
 */
export function publishStep(versionDir: string, id: StepId): { output: string } {
  const step = STEPS.find(s => s.id === id)
  if (!step) throw new ActionError('unknown-step', `Unknown step: ${id}`)
  const output = join(versionDir, step.output)
  const status = stepOf(versionDir, id)
  if (status.state === 'done') return { output: step.output }
  if (status.state !== 'publish') throw new ActionError('step-not-publishable', `Step ${id} is ${status.state}`)
  const candidate = readFileSync(join(versionDir, String((status.action as Record<string, unknown>).candidate)), 'utf8')
  mkdirSync(dirname(output), { recursive: true })
  const temporary = `${output}.${randomUUID()}.tmp`
  writeFileSync(temporary, candidate)
  try {
    linkSync(temporary, output)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    if (readFileSync(output, 'utf8') !== candidate) throw new ActionError('output-conflict', `${step.output} already exists with different content`)
  } finally {
    unlinkSync(temporary)
  }
  return { output: step.output }
}
