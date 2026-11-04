import { SCORE_KEYS, WORLD_KEYS, type WorldBrief, type WorldCandidate, type WorldFingerprint } from './world-contract'

export const worldFingerprints: WorldFingerprint[] = [
  { topology: 'continental', ecology: 'forest', traversal: 'overland', settlement: 'fixed-cities', hazard: 'collapse', spatialLogic: 'borders' },
  { topology: 'archipelago', ecology: 'marine', traversal: 'sea', settlement: 'distributed', hazard: 'flooding', spatialLogic: 'routes' },
  { topology: 'vertical', ecology: 'urban', traversal: 'aerial', settlement: 'single-fortress', hazard: 'falling', spatialLogic: 'layers' },
  { topology: 'underground', ecology: 'organism', traversal: 'subterranean', settlement: 'mobile-base', hazard: 'contamination', spatialLogic: 'veins' },
  { topology: 'mobile', ecology: 'desert', traversal: 'creature', settlement: 'cyclic', hazard: 'depletion', spatialLogic: 'cycles' },
]
export const spatialPlays = [
  '연속된 숲의 경계 관문을 열어 고정 도시 사이 지름길을 만들고 귀환한다.',
  '분절된 섬의 조수 창을 맞춰 배로 건너고 여러 정착지에서 보급한다.',
  '한 성채의 층별 승강로를 열고 추락 위험을 감수해 하층으로 귀환한다.',
  '생체 통로의 오염을 우회하며 이동 거점을 따라 지하망을 탐색한다.',
  '주기적으로 이동하는 사막 생물을 타고 다음 정착 주기에 맞춰 길을 바꾼다.',
]
export const fixtureInterpretation = '### I-01\n해석: 기반 유지와 외부 탐색의 긴장\n### I-02\n해석: 충동적인 돌파와 반복 숙련의 차이'
export const fixtureCombat = '## Candidates\n\n### Candidate C-01\n\n- primary-verbs: anchor, redirect\n\n## Selection\n\n- selected: C-01'
export function worldCandidate(index: number, score: number): WorldCandidate {
  return {
    id: `W-0${index + 1}`, name: `구조 후보 ${index + 1}`, fingerprint: { ...worldFingerprints[index] },
    maritimeRole: index === 1 ? 'core-world' : 'none', evidence: ['I-01', 'I-02'],
    causalChain: '기반 유지와 탐색의 긴장을 귀환 가능한 관문과 우회 위험의 선택으로 옮긴다.',
    counterEvidence: '빠른 전진 욕구에 비해 귀환 경로를 여는 비용이 크다.', spatialPlay: spatialPlays[index],
    verbMapping: [{ verb: 'anchor', operation: '적을 표면에 고정하여 공간의 차단점을 만든다.' }, { verb: 'redirect', operation: '적의 돌진 방향을 바꿔 우회 통로를 확보한다.' }],
    scores: Object.fromEntries(SCORE_KEYS.map(key => [key, { value: score, reason: '해석의 긴장이 탐험 경로의 선택으로 작동한다.' }])) as WorldCandidate['scores'],
  }
}
export function worldBriefFixture(winner = 0): WorldBrief {
  const candidates = [0, 1, 2, 3].map(index => worldCandidate(index, index === winner ? 5 : 3))
  return {
    schemaVersion: 1, combatCandidateId: 'C-01', candidates,
    initialSelected: candidates[winner].id, selected: candidates[winner].id,
    reason: '귀환과 탐색의 긴장을 공간 해금으로 구체화한다.',
    rejected: candidates.filter(c => c.id !== candidates[winner].id).map(c => ({ id: c.id, reason: '선택안보다 해석의 반복 숙련을 공간 해금에 옮기는 인과가 약하다.' })),
    registryReview: { comparedEntries: 0, initialClosest: [], finalClosest: [], similarityDifferences: [] },
    maritimeJustification: winner === 1 ? '연속 대륙과 수직 성채보다 조수 시간창이 단절과 재연결의 긴장을 직접 구현한다.' : null,
  }
}
export function serializeWorldBrief(brief = worldBriefFixture()): string {
  return '# World Concept Brief\n\n```world-concept\n' + JSON.stringify(brief, null, 2) + '\n```\n'
}
export function worldStructureFixture(fingerprint = worldFingerprints[0]): string {
  const structure = Object.fromEntries(WORLD_KEYS.map(key => [key, { value: fingerprint[key], manifestation: `${key}의 공간 규칙을 관문, 우회와 귀환 경로에 적용한다.` }]))
  return '\n\n```world-structure\n' + JSON.stringify(structure) + '\n```\n'
}
