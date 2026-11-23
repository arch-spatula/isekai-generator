/**
 * 선택 시도 폴더의 레지스트리 스냅샷(registry.json)과 후보 지문을 비교한다.
 * 브리프 검증기와 같은 근접 항목 계산(closestEntries, closestWorldEntries)을 쓴다. 파일을 쓰지 않는다.
 * 계약: docs/spec/remove-sqlite-state.md
 */
import { existsSync, readFileSync } from 'node:fs'
import { join, normalize } from 'node:path'
import { AXIS_KEYS, closestEntries, parseRegistry, type Axes } from '../../.agents/skills/select-gameplay-concept/scripts/fingerprint-registry'
import { WORLD_KEYS, closestWorldEntries, parseWorldRegistry, type WorldFingerprint } from '../../.agents/skills/select-world-concept/scripts/world-contract'
import { ActionError } from './pipeline-actions'

/** 근접 항목의 같은 축 수가 이 값 이상이면 challenger가 필요하다. */
const CHALLENGER_THRESHOLD = { combat: 5, world: 4 } as const

export type Comparison = {
  kind: 'combat' | 'world'
  comparedEntries: number
  closest?: Array<{ version: string; candidateId: string; equalAxes: number }>
  requiresChallenger?: boolean
}

function kindOf(attempt: string): 'combat' | 'world' {
  const [root, stage] = normalize(attempt).split('/')
  if (root === 'garbage' && stage === 'selection') return 'combat'
  if (root === 'garbage' && stage === 'world-selection') return 'world'
  throw new ActionError('not-a-selection-attempt', `${attempt} is not a combat or world selection attempt`)
}

/** `attempt`는 버전 폴더 기준 시도 폴더 경로다(예: garbage/selection/generate-1). 후보가 없으면 비교 항목 수만 돌려준다. */
export function compareFingerprint(versionDir: string, attempt: string, candidate?: unknown): Comparison {
  const kind = kindOf(attempt)
  const path = join(versionDir, attempt, 'registry.json')
  if (!existsSync(path)) throw new ActionError('missing-registry-snapshot', `${attempt}/registry.json does not exist`)
  const text = readFileSync(path, 'utf8')
  let entries
  try {
    entries = kind === 'combat' ? parseRegistry(text).entries : parseWorldRegistry(JSON.parse(text)).entries
  } catch (error) {
    throw new ActionError('invalid-registry-snapshot', `${attempt}/registry.json: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (candidate === undefined) return { kind, comparedEntries: entries.length }

  const axes: readonly string[] = kind === 'combat' ? AXIS_KEYS : WORLD_KEYS
  const value = candidate as Record<string, unknown> | null
  if (value == null || typeof value !== 'object' || Object.keys(value).length !== axes.length || axes.some(axis => typeof value[axis] !== 'string')) {
    throw new ActionError('invalid-fingerprint', `Candidate must have exactly these string axes: ${axes.join(', ')}`)
  }
  const closest = kind === 'combat'
    ? closestEntries(value as Axes, entries as ReturnType<typeof parseRegistry>['entries']).map(({ version, candidateId, equalAxes }) => ({ version, candidateId, equalAxes }))
    : closestWorldEntries(value as WorldFingerprint, entries as ReturnType<typeof parseWorldRegistry>['entries'])
  return { kind, comparedEntries: entries.length, closest, requiresChallenger: closest.length > 0 && closest[0].equalAxes >= CHALLENGER_THRESHOLD[kind] }
}
