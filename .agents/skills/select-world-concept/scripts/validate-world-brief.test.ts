import { describe, expect, test } from 'bun:test'
import { matchesWorldStructure } from '../../generate-gdd-from-interpretation/scripts/validate-gdd'
import { validateWorldBrief } from './validate-world-brief'
import { closestWorldEntries, equalWorldAxes, parseWorldBrief, type WorldBrief, type WorldRegistry } from './world-contract'
import { fixtureCombat, fixtureInterpretation, serializeWorldBrief, worldBriefFixture, worldCandidate, worldFingerprints, worldStructureFixture } from './world-fixtures'

const empty: WorldRegistry = { schemaVersion: 1, entries: [] }
const validate = (brief: WorldBrief, registry = empty) => validateWorldBrief(serializeWorldBrief(brief), fixtureInterpretation, fixtureCombat, registry)

function similarFixture(): { brief: WorldBrief; registry: WorldRegistry } {
  const brief = worldBriefFixture(1)
  const fingerprint = brief.candidates[1].fingerprint
  const registry: WorldRegistry = { schemaVersion: 1, entries: [
    { version: 'v0.1.23', candidateId: 'W-02', fingerprint, spatialPlay: '해상 섬을 항로로 연결하고 항구로 귀환한다.' },
    { version: 'v0.1.24', candidateId: 'W-01', fingerprint: { ...fingerprint, traversal: 'aerial', ecology: 'ice' }, spatialPlay: '하늘 군도의 항로를 열고 분산 거점에 정박한다.' },
  ] }
  brief.candidates.push(worldCandidate(4, 2))
  brief.rejected.push({ id: 'W-05', reason: '이동 사막의 정착 주기보다 조수 창이 현재 해석과 전투의 타이밍을 직접 연결한다.' })
  brief.registryReview.comparedEntries = registry.entries.length
  brief.registryReview.initialClosest = closestWorldEntries(fingerprint, registry.entries)
  brief.registryReview.finalClosest = closestWorldEntries(fingerprint, registry.entries)
  brief.registryReview.similarityDifferences = brief.registryReview.finalClosest.map(match => ({ version: match.version, candidateId: match.candidateId, interpretationFit: '해석의 단절과 재연결을 조수 시간창의 결정으로 드러낸다.', spatialDifference: '항로 복구 대신 섬의 지표를 우회해 조수 창을 통제하고 한 번 연 통로는 왕복한다.' }))
  return { brief, registry }
}

describe('world selection', () => {
  test('accepts four structurally distinct candidates and functional anchor translations', () => {
    expect(validate(worldBriefFixture())).toEqual([])
  })
  test('allows a maritime winner with concrete non-maritime comparison', () => {
    expect(validate(worldBriefFixture(1))).toEqual([])
    const brief = worldBriefFixture(1)
    brief.maritimeJustification = null
    expect(validate(brief)[0]).toContain('Maritime world')
  })
  test('requires different structures rather than names or ecological reskins', () => {
    const brief = worldBriefFixture()
    brief.candidates[2].fingerprint = { ...brief.candidates[0].fingerprint, ecology: 'desert' }
    expect(validate(brief).length).toBeGreaterThan(0)
  })
  test('rejects missing evidence, altered combat candidate, unmapped or duplicate verbs', () => {
    for (const mutate of [
      (b: WorldBrief) => { b.candidates[0].evidence = ['I-01', 'I-99'] },
      (b: WorldBrief) => { b.combatCandidateId = 'C-02' },
      (b: WorldBrief) => { b.candidates[0].verbMapping[1].verb = 'anchor' },
      (b: WorldBrief) => { b.candidates[0].verbMapping.pop() },
    ]) { const b = worldBriefFixture(); mutate(b); expect(validate(b).length).toBeGreaterThan(0) }
  })
  test('rejects hidden maritime grammar and requires non-maritime alternatives', () => {
    const b = worldBriefFixture()
    b.candidates[1].maritimeRole = 'none'
    expect(validate(b)[0]).toContain('core maritime role')
    const c = worldBriefFixture()
    c.candidates[0].maritimeRole = 'core-grammar'
    c.candidates[2].maritimeRole = 'core-grammar'
    expect(validate(c)[0]).toContain('two non-core-maritime')
  })
  test('rejects unknown keys, invalid enums, non-integer scores and duplicate JSON blocks', () => {
    for (const mutate of [
      (b: WorldBrief) => { (b as unknown as Record<string, unknown>).extra = true },
      (b: WorldBrief) => { b.candidates[0].fingerprint.topology = 'sky-islands' as never },
      (b: WorldBrief) => { b.candidates[0].scores.combatFit.value = 4.5 },
    ]) { const b = worldBriefFixture(); mutate(b); expect(validate(b).length).toBeGreaterThan(0) }
    const md = serializeWorldBrief()
    expect(() => parseWorldBrief(md + md)).toThrow('exactly one')
  })
  test('enforces score order and rejection coverage', () => {
    const b = worldBriefFixture()
    b.selected = 'W-02'
    expect(validate(b)[0]).toContain('score order')
    const c = worldBriefFixture()
    c.rejected.pop()
    expect(validate(c)[0]).toContain('every unselected candidate')
  })
  test('breaks equal totals by interpretation fit, combat fit and candidate ID', () => {
    const b = worldBriefFixture()
    for (const c of b.candidates) for (const score of Object.values(c.scores)) score.value = 4
    expect(validate(b)).toEqual([])
    b.candidates[1].scores.interpretationFit.value = 5
    b.candidates[1].scores.distinctiveness.value = 3
    expect(validate(b)[0]).toContain('score order')
    b.candidates[1].scores.interpretationFit.value = 4
    b.candidates[1].scores.combatFit.value = 5
    expect(validate(b)[0]).toContain('score order')
  })
})

describe('independent world similarity', () => {
  test('detects shared sky-island grammar despite different medium and biome', () => {
    const sea = worldFingerprints[1]
    const sky = { ...sea, traversal: 'aerial', ecology: 'ice' } as const
    expect(equalWorldAxes(sea, sky)).toBe(4)
    expect(closestWorldEntries(sky, [{ version: 'v0.1.23', candidateId: 'W-01', fingerprint: sea, spatialPlay: '섬의 항로를 연결한다.' }])[0].equalAxes).toBe(4)
  })
  test('requires a challenger on similarity, but allows a justified similar final winner', () => {
    const { brief, registry } = similarFixture()
    expect(validate(brief, registry)).toEqual([])
    brief.candidates.pop(); brief.rejected.pop()
    expect(validate(brief, registry)[0]).toContain('challenger')
  })
  test('requires every tied nearest entry, not just the first', () => {
    const { brief, registry } = similarFixture()
    registry.entries[1].fingerprint = { ...registry.entries[0].fingerprint }
    expect(validate(brief, registry)[0]).toContain('closest')
    brief.registryReview.initialClosest = closestWorldEntries(brief.candidates[1].fingerprint, registry.entries)
    brief.registryReview.finalClosest = brief.registryReview.initialClosest
    expect(validate(brief, registry)[0]).toContain('every nearest')
    brief.registryReview.similarityDifferences.push({ version: registry.entries[1].version, candidateId: registry.entries[1].candidateId, interpretationFit: '현재 입력의 특정 긴장과 맞는다.', spatialDifference: '섬을 왕복하는 조수 시간창으로 바꾼다.' })
    expect(validate(brief, registry)).toEqual([])
  })
  test('requires a challenger different from the initial winner and nearest entries', () => {
    const { brief, registry } = similarFixture()
    brief.candidates[4].fingerprint = { ...brief.candidates[1].fingerprint }
    brief.candidates[4].maritimeRole = 'core-world'
    expect(validate(brief, registry)[0]).toContain('too close')
  })
  test('recomputes final matches when the challenger wins', () => {
    const { brief, registry } = similarFixture()
    for (const score of Object.values(brief.candidates[1].scores)) score.value = 4
    for (const score of Object.values(brief.candidates[4].scores)) score.value = 5
    brief.selected = 'W-05'
    brief.rejected = brief.candidates.slice(0, 4).map(c => ({ id: c.id, reason: '이동 세계가 더 구체적인 공간 선택을 제공한다.' }))
    expect(validate(brief, registry)[0]).toContain('closest')
    brief.registryReview.finalClosest = closestWorldEntries(brief.candidates[4].fingerprint, registry.entries)
    brief.registryReview.similarityDifferences = []
    brief.maritimeJustification = null
    expect(validate(brief, registry)).toEqual([])
  })
})

describe('GDD world structure', () => {
  test('allows sea similes and a local port in a continental world', () => {
    const b = worldBriefFixture()
    b.candidates[0].maritimeRole = 'decoration'
    expect(validate(b)).toEqual([])
    expect(matchesWorldStructure('구름이 바다처럼 흐른다. 강 어귀 항구를 잠깐 방문한다.' + worldStructureFixture(), serializeWorldBrief(b))).toBe(true)
  })
  test('rejects missing, duplicated, altered or unexplained world structure', () => {
    const brief = serializeWorldBrief(), structure = worldStructureFixture()
    expect(matchesWorldStructure(structure, brief)).toBe(true)
    expect(matchesWorldStructure('# 제목만 있다', brief)).toBe(false)
    expect(matchesWorldStructure(structure + structure, brief)).toBe(false)
    expect(matchesWorldStructure(structure.replace('continental', 'archipelago'), brief)).toBe(false)
    expect(matchesWorldStructure(structure.replace(/"manifestation":"[^"]+"/, '"manifestation":""'), brief)).toBe(false)
  })
})
