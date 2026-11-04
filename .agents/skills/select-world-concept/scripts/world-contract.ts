export const WORLD_AXES = {
  topology: ['continental', 'archipelago', 'vertical', 'underground', 'mobile', 'celestial'],
  ecology: ['forest', 'desert', 'ice', 'wetland', 'marine', 'urban', 'organism', 'immaterial'],
  traversal: ['overland', 'aerial', 'sea', 'subterranean', 'teleport', 'creature'],
  settlement: ['fixed-cities', 'mobile-base', 'distributed', 'single-fortress', 'cyclic'],
  hazard: ['flooding', 'falling', 'collapse', 'contamination', 'depletion', 'time-distortion', 'predation'],
  spatialLogic: ['routes', 'borders', 'layers', 'veins', 'fractures', 'cycles', 'gravity'],
} as const
export const WORLD_KEYS = Object.keys(WORLD_AXES) as Array<keyof typeof WORLD_AXES>
export type WorldFingerprint = { [K in keyof typeof WORLD_AXES]: typeof WORLD_AXES[K][number] }
export const SCORE_KEYS = ['interpretationFit', 'combatFit', 'spatialPlay', 'distinctiveness'] as const
export type WorldCandidate = {
  id: string; name: string; fingerprint: WorldFingerprint
  maritimeRole: 'none' | 'decoration' | 'major-region' | 'core-world' | 'core-grammar'
  evidence: string[]; causalChain: string; counterEvidence: string; spatialPlay: string
  verbMapping: Array<{ verb: string; operation: string }>
  scores: Record<typeof SCORE_KEYS[number], { value: number; reason: string }>
}
export type WorldEntry = { version: string; candidateId: string; fingerprint: WorldFingerprint; spatialPlay: string }
export type WorldRegistry = { schemaVersion: 1; entries: WorldEntry[] }
export type WorldMatch = { version: string; candidateId: string; equalAxes: number }
export type WorldBrief = {
  schemaVersion: 1; combatCandidateId: string; candidates: WorldCandidate[]
  initialSelected: string; selected: string; reason: string
  rejected: Array<{ id: string; reason: string }>
  registryReview: { comparedEntries: number; initialClosest: WorldMatch[]; finalClosest: WorldMatch[]; similarityDifferences: Array<{ version: string; candidateId: string; interpretationFit: string; spatialDifference: string }> }
  maritimeJustification: string | null
}

export function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}
export function record(value: unknown, keys: readonly string[], context: string): Record<string, unknown> {
  ensure(value != null && typeof value === 'object' && !Array.isArray(value), `${context} must be an object`)
  const item = value as Record<string, unknown>
  ensure(Object.keys(item).length === keys.length && keys.every(key => Object.hasOwn(item, key)), `${context} has missing or unknown fields`)
  return item
}
function text(value: unknown, context: string): asserts value is string {
  ensure(typeof value === 'string' && value.trim().length > 0, `${context} must be non-empty text`)
}
export function parseWorldFingerprint(value: unknown): WorldFingerprint {
  const item = record(value, WORLD_KEYS, 'World fingerprint')
  for (const key of WORLD_KEYS) ensure((WORLD_AXES[key] as readonly unknown[]).includes(item[key]), `Invalid world axis: ${key}`)
  return item as WorldFingerprint
}
export function equalWorldAxes(a: WorldFingerprint, b: WorldFingerprint): number {
  return WORLD_KEYS.filter(key => a[key] === b[key]).length
}
export function closestWorldEntries(fingerprint: WorldFingerprint, entries: WorldEntry[]): WorldMatch[] {
  const matches = entries.map(entry => ({ version: entry.version, candidateId: entry.candidateId, equalAxes: equalWorldAxes(fingerprint, entry.fingerprint) }))
  const maximum = Math.max(-1, ...matches.map(match => match.equalAxes))
  return matches.filter(match => match.equalAxes === maximum)
}
export function jsonBlock(markdown: string, language: string): unknown {
  const blocks = [...markdown.matchAll(new RegExp('^```' + language + '[ \\t]*\\r?\\n([\\s\\S]*?)\\r?\\n```[ \\t]*$', 'gm'))]
  ensure(blocks.length === 1, `Expected exactly one ${language} block`)
  return JSON.parse(blocks[0][1])
}
export function parseWorldRegistry(value: unknown): WorldRegistry {
  const registry = record(value, ['schemaVersion', 'entries'], 'World registry')
  ensure(registry.schemaVersion === 1 && Array.isArray(registry.entries), 'Invalid world registry schema')
  const versions = new Set<string>()
  for (const value of registry.entries) {
    const entry = record(value, ['version', 'candidateId', 'fingerprint', 'spatialPlay'], 'World registry entry')
    ensure(typeof entry.version === 'string' && /^v\d+\.\d+\.\d+$/.test(entry.version) && !versions.has(entry.version), 'Invalid or duplicate world registry version')
    ensure(typeof entry.candidateId === 'string' && /^W-0[1-5]$/.test(entry.candidateId), 'Invalid world candidate ID')
    parseWorldFingerprint(entry.fingerprint)
    text(entry.spatialPlay, 'Registry spatialPlay')
    versions.add(entry.version)
  }
  return registry as WorldRegistry
}
export function parseWorldBrief(markdown: string): WorldBrief {
  const b = record(jsonBlock(markdown, 'world-concept'), ['schemaVersion', 'combatCandidateId', 'candidates', 'initialSelected', 'selected', 'reason', 'rejected', 'registryReview', 'maritimeJustification'], 'World brief')
  ensure(b.schemaVersion === 1, 'World brief schemaVersion must be 1')
  ensure(typeof b.combatCandidateId === 'string' && /^C-\d{2}$/.test(b.combatCandidateId), 'Invalid combat candidate ID')
  ensure(Array.isArray(b.candidates) && [4, 5].includes(b.candidates.length), 'Expected four or five world candidates')
  b.candidates.forEach((value, index) => {
    const c = record(value, ['id', 'name', 'fingerprint', 'maritimeRole', 'evidence', 'causalChain', 'counterEvidence', 'spatialPlay', 'verbMapping', 'scores'], 'World candidate')
    ensure(c.id === `W-0${index + 1}`, 'World candidate IDs must be sequential')
    for (const key of ['name', 'causalChain', 'counterEvidence', 'spatialPlay']) text(c[key], `${c.id} ${key}`)
    const fp = parseWorldFingerprint(c.fingerprint)
    ensure(['none', 'decoration', 'major-region', 'core-world', 'core-grammar'].includes(c.maritimeRole as string), 'Invalid maritimeRole')
    const core = c.maritimeRole === 'core-world' || c.maritimeRole === 'core-grammar'
    ensure(!(fp.topology === 'archipelago' || fp.traversal === 'sea') || core, 'Archipelago or sea traversal requires a core maritime role')
    ensure(fp.ecology !== 'marine' || core || c.maritimeRole === 'major-region', 'Marine ecology requires at least a major-region maritime role')
    ensure(c.maritimeRole !== 'core-world' || (fp.ecology === 'marine' && fp.traversal === 'sea'), 'core-world requires marine ecology and sea traversal')
    ensure(Array.isArray(c.evidence) && new Set(c.evidence).size >= 2 && c.evidence.every(id => typeof id === 'string' && /^I-\d{2}$/.test(id)), 'World candidates need at least two distinct interpretation IDs')
    ensure(Array.isArray(c.verbMapping) && c.verbMapping.length >= 2, 'World candidate needs combat verb mappings')
    for (const mapping of c.verbMapping) {
      const m = record(mapping, ['verb', 'operation'], 'Verb mapping')
      text(m.verb, 'Mapping verb'); text(m.operation, 'Mapping operation')
    }
    const scores = record(c.scores, SCORE_KEYS, 'World scores')
    for (const key of SCORE_KEYS) {
      const score = record(scores[key], ['value', 'reason'], 'World score')
      ensure(Number.isInteger(score.value) && Number(score.value) >= 1 && Number(score.value) <= 5, 'World scores must be integers from 1 to 5')
      text(score.reason, 'Score reason')
    }
  })
  const ids = b.candidates.map(c => (c as WorldCandidate).id)
  ensure(ids.slice(0, 4).includes(b.initialSelected as string) && ids.includes(b.selected as string), 'Unknown selected world candidate')
  text(b.reason, 'World selection reason')
  ensure(Array.isArray(b.rejected), 'Missing rejected world candidates')
  for (const value of b.rejected) {
    const rejected = record(value, ['id', 'reason'], 'Rejected world candidate')
    text(rejected.id, 'Rejected ID'); text(rejected.reason, 'Rejected reason')
  }
  const review = record(b.registryReview, ['comparedEntries', 'initialClosest', 'finalClosest', 'similarityDifferences'], 'World registry review')
  ensure(Number.isInteger(review.comparedEntries) && Number(review.comparedEntries) >= 0, 'Invalid comparedEntries')
  for (const key of ['initialClosest', 'finalClosest']) {
    ensure(Array.isArray(review[key]), 'Missing world registry matches')
    for (const value of review[key]) {
      const match = record(value, ['version', 'candidateId', 'equalAxes'], 'World registry match')
      text(match.version, 'Match version'); text(match.candidateId, 'Match candidate')
      ensure(Number.isInteger(match.equalAxes) && Number(match.equalAxes) >= 0 && Number(match.equalAxes) <= 6, 'Invalid world match equalAxes')
    }
  }
  ensure(Array.isArray(review.similarityDifferences), 'Missing similarityDifferences')
  for (const value of review.similarityDifferences) {
    const difference = record(value, ['version', 'candidateId', 'interpretationFit', 'spatialDifference'], 'World similarity difference')
    for (const key of ['version', 'candidateId', 'interpretationFit', 'spatialDifference']) text(difference[key], `World difference ${key}`)
  }
  ensure(b.maritimeJustification === null || typeof b.maritimeJustification === 'string', 'Invalid maritimeJustification')
  return b as WorldBrief
}
export function selectedWorld(brief: WorldBrief): WorldCandidate {
  return brief.candidates.find(candidate => candidate.id === brief.selected)!
}
export function worldScoreOrder(a: WorldCandidate, b: WorldCandidate): number {
  const total = (c: WorldCandidate) => SCORE_KEYS.reduce((sum, key) => sum + c.scores[key].value, 0)
  return total(b) - total(a) || b.scores.interpretationFit.value - a.scores.interpretationFit.value || b.scores.combatFit.value - a.scores.combatFit.value || a.id.localeCompare(b.id)
}
