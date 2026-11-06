import { readFileSync } from 'node:fs'
import { parseGamePresentation, readGamePresentationContract } from '../../../../scripts/game-presentation'
import { parseSelectedCandidateId } from '../../select-gameplay-concept/scripts/validate-concept-brief'
import { closestWorldEntries, ensure, equalWorldAxes, parseWorldBrief, parseWorldRegistry, selectedWorld, worldScoreOrder, type WorldMatch, type WorldRegistry } from './world-contract'

function sameMatches(a: WorldMatch[], b: WorldMatch[]): boolean {
  const normalize = (values: WorldMatch[]) => values.map(v => `${v.version}|${v.candidateId}|${v.equalAxes}`).sort()
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b))
}
export function validateWorldBrief(markdown: string, interpretation: string, combatBrief: string, registry: WorldRegistry): string[] {
  try {
    parseGamePresentation(markdown)
    parseGamePresentation(combatBrief)
    parseWorldRegistry(registry)
    const b = parseWorldBrief(markdown)
    const combatId = parseSelectedCandidateId(combatBrief)
    ensure(combatId != null && b.combatCandidateId === combatId, 'World brief must preserve the selected combat candidate')
    const candidates = combatBrief.split(/^### Candidate /m).slice(1)
    const block = candidates.find(c => new RegExp(`^${combatId}[ \\t]*\\r?\\n`).test(c))?.split(/^## /m)[0] ?? ''
    const verbs = /^- primary-verbs:\s*(.+)$/m.exec(block)?.[1].split(',').map(v => v.trim()) ?? []
    ensure(verbs.length >= 2 && verbs.length <= 3 && new Set(verbs).size === verbs.length, 'Selected combat candidate must have two or three distinct primary verbs')
    const validIds = new Set([...interpretation.matchAll(/^### (I-\d{2})\s*$/gm)].map(m => m[1]))
    for (const c of b.candidates) {
      ensure(c.evidence.every(id => validIds.has(id)), `${c.id} cites an unknown interpretation ID`)
      ensure(JSON.stringify(c.verbMapping.map(m => m.verb).sort()) === JSON.stringify([...verbs].sort()), `${c.id} must map every selected combat verb exactly once`)
    }
    const first = b.candidates.slice(0, 4)
    ensure(new Set(first.map(c => c.fingerprint.topology)).size >= 3, 'World alternatives need at least three topologies')
    ensure(first.filter(c => !c.maritimeRole.startsWith('core-')).length >= 2, 'World alternatives need at least two non-core-maritime candidates')
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) ensure(equalWorldAxes(first[i].fingerprint, first[j].fingerprint) <= 3, 'World candidates differ on fewer than three axes')
    ensure([...first].sort(worldScoreOrder)[0].id === b.initialSelected, 'Initial world selection violates score order')
    ensure([...b.candidates].sort(worldScoreOrder)[0].id === b.selected, 'Final world selection violates score order')
    const rejected = b.candidates.filter(c => c.id !== b.selected).map(c => c.id).sort()
    ensure(JSON.stringify(b.rejected.map(c => c.id).sort()) === JSON.stringify(rejected), 'World rejection reasons must cover every unselected candidate once')
    const initial = b.candidates.find(c => c.id === b.initialSelected)!
    const final = selectedWorld(b)
    const initialMatches = closestWorldEntries(initial.fingerprint, registry.entries)
    const finalMatches = closestWorldEntries(final.fingerprint, registry.entries)
    ensure(b.registryReview.comparedEntries === registry.entries.length, 'Incorrect world registry count')
    ensure(sameMatches(b.registryReview.initialClosest, initialMatches) && sameMatches(b.registryReview.finalClosest, finalMatches), 'Incorrect or missing closest world registry matches')
    const similar = initialMatches.some(m => m.equalAxes >= 4)
    ensure(b.candidates.length === (similar ? 5 : 4), 'A similar initial world requires exactly one challenger W-05; other worlds require four candidates')
    if (similar) {
      const challenger = b.candidates[4]
      ensure(equalWorldAxes(challenger.fingerprint, initial.fingerprint) <= 3, 'World challenger is too close to the initial selection')
      for (const match of initialMatches) {
        const entry = registry.entries.find(e => e.version === match.version)!
        ensure(equalWorldAxes(challenger.fingerprint, entry.fingerprint) <= 3, 'World challenger is too close to a nearest registry entry')
      }
    }
    const similarFinal = finalMatches.some(m => m.equalAxes >= 4)
    const differences = b.registryReview.similarityDifferences.map(m => ({ version: m.version, candidateId: m.candidateId, equalAxes: finalMatches.find(f => f.version === m.version && f.candidateId === m.candidateId)?.equalAxes ?? -1 }))
    ensure(sameMatches(differences, similarFinal ? finalMatches : []), 'Similar final world needs fit and spatial-play differences for every nearest entry')
    const maritime = ['major-region', 'core-world', 'core-grammar'].includes(final.maritimeRole)
    ensure(maritime ? typeof b.maritimeJustification === 'string' && b.maritimeJustification.trim().length > 0 : b.maritimeJustification === null, 'Maritime world needs a comparison with non-maritime alternatives; decoration requires no justification')
    return []
  } catch (error) { return [error instanceof Error ? error.message : String(error)] }
}
if (import.meta.main) {
  try {
    const args = process.argv.slice(2)
    ensure(args.length === 5, 'Usage: bun validate-world-brief.ts <world-brief> <interpretation> <combat-brief> <world-registry> <game-presentation-contract.md>')
    readGamePresentationContract(args[4])
    const [brief, interpretation, combat, registry] = args.slice(0, 4).map(path => readFileSync(path, 'utf8'))
    const errors = validateWorldBrief(brief, interpretation, combat, parseWorldRegistry(JSON.parse(registry)))
    ensure(errors.length === 0, errors.join('\n'))
    console.log('Validated world concept brief.')
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1 }
}
