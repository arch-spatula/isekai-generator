import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ActionError } from './pipeline-actions'
import { compareFingerprint } from './pipeline-fingerprints'

const combat = { combatRange: 'close', powerMedium: 'weapon', initiative: 'direct', spaceUse: 'pursuit', combatRhythm: 'pressure', mastery: 'timing', risk: 'health' }
const world = { topology: 'continental', ecology: 'forest', traversal: 'overland', settlement: 'fixed-cities', hazard: 'flooding', spatialLogic: 'routes' }

/** 일부 축만 바꾼 지문. 바꾼 축 수만큼 같은 축이 줄어든다. */
function differ<T extends Record<string, string>>(base: T, changed: Partial<T>): T {
  return { ...base, ...changed }
}

function attemptWith(stage: string, registry: unknown): { dir: string; attempt: string } {
  const dir = join(mkdtempSync(join(tmpdir(), 'artifact-fingerprints-')), 'artifacts', 'v0.5.9')
  const attempt = `garbage/${stage}/generate-1`
  mkdirSync(join(dir, attempt), { recursive: true })
  writeFileSync(join(dir, attempt, 'registry.json'), JSON.stringify(registry))
  return { dir, attempt }
}

function rejectsWith(code: string, run: () => unknown): void {
  try {
    run()
  } catch (error) {
    expect(error).toBeInstanceOf(ActionError)
    expect((error as ActionError).code).toBe(code)
    return
  }
  throw new Error(`expected ${code}`)
}

describe('compareFingerprint', () => {
  test('combat comparison keeps every closest tie and requires a challenger at five equal axes', () => {
    const { dir, attempt } = attemptWith('selection', {
      schemaVersion: 1,
      entries: [
        { version: 'v0.5.1', candidateId: 'C-01', fingerprint: differ(combat, { mastery: 'reading', risk: 'stamina' }) },
        { version: 'v0.5.2', candidateId: 'C-02', fingerprint: differ(combat, { combatRange: 'far', powerMedium: 'body' }) },
        { version: 'v0.5.3', candidateId: 'C-03', fingerprint: differ(combat, { combatRange: 'far', powerMedium: 'body', initiative: 'reactive', spaceUse: 'hold', combatRhythm: 'burst' }) },
      ],
    })
    expect(compareFingerprint(dir, attempt, combat)).toEqual({
      kind: 'combat', comparedEntries: 3, requiresChallenger: true,
      closest: [{ version: 'v0.5.1', candidateId: 'C-01', equalAxes: 5 }, { version: 'v0.5.2', candidateId: 'C-02', equalAxes: 5 }],
    })
  })

  test('combat comparison below five equal axes needs no challenger', () => {
    const { dir, attempt } = attemptWith('selection', {
      schemaVersion: 1,
      entries: [{ version: 'v0.5.1', candidateId: 'C-01', fingerprint: differ(combat, { mastery: 'reading', risk: 'stamina', combatRhythm: 'burst' }) }],
    })
    expect(compareFingerprint(dir, attempt, combat)).toMatchObject({ requiresChallenger: false, closest: [{ equalAxes: 4 }] })
  })

  test('world comparison requires a challenger at four equal axes', () => {
    const { dir, attempt } = attemptWith('world-selection', {
      schemaVersion: 1,
      entries: [{ version: 'v0.5.1', candidateId: 'W-01', fingerprint: differ(world, { hazard: 'collapse', spatialLogic: 'layers' }), spatialPlay: '길을 따라 이동한다' }],
    })
    expect(compareFingerprint(dir, attempt, world)).toEqual({
      kind: 'world', comparedEntries: 1, requiresChallenger: true, closest: [{ version: 'v0.5.1', candidateId: 'W-01', equalAxes: 4 }],
    })
  })

  test('empty snapshot compares nothing and needs no challenger', () => {
    const { dir, attempt } = attemptWith('selection', { schemaVersion: 1, entries: [] })
    expect(compareFingerprint(dir, attempt, combat)).toEqual({ kind: 'combat', comparedEntries: 0, closest: [], requiresChallenger: false })
  })

  test('without a candidate only the snapshot size is returned', () => {
    const { dir, attempt } = attemptWith('selection', { schemaVersion: 1, entries: [{ version: 'v0.5.1', candidateId: 'C-01', fingerprint: combat }] })
    expect(compareFingerprint(dir, attempt)).toEqual({ kind: 'combat', comparedEntries: 1 })
  })

  test('rejects attempts outside selection, missing snapshots and malformed candidates', () => {
    const { dir, attempt } = attemptWith('selection', { schemaVersion: 1, entries: [] })
    rejectsWith('not-a-selection-attempt', () => compareFingerprint(dir, 'garbage/saju/generate-1', combat))
    rejectsWith('missing-registry-snapshot', () => compareFingerprint(dir, 'garbage/selection/generate-2', combat))
    rejectsWith('invalid-fingerprint', () => compareFingerprint(dir, attempt, { ...combat, risk: undefined }))
    rejectsWith('invalid-fingerprint', () => compareFingerprint(dir, attempt, world))
    writeFileSync(join(dir, attempt, 'registry.json'), '{"schemaVersion":1,"entries":[{"version":"bad"}]}')
    rejectsWith('invalid-registry-snapshot', () => compareFingerprint(dir, attempt, combat))
  })

  test('comparison does not create or change files', () => {
    const { dir, attempt } = attemptWith('selection', { schemaVersion: 1, entries: [] })
    const before = readdirSync(dir, { recursive: true }).sort()
    compareFingerprint(dir, attempt, combat)
    expect(readdirSync(dir, { recursive: true }).sort()).toEqual(before)
  })
})
