import { readFile } from 'node:fs/promises'
import { parseGamePresentation, readGamePresentationContract } from '../../../../scripts/game-presentation'

import {
  AXIS_KEYS,
  closestEntries,
  equalAxes,
  parseRegistry,
  type Axes,
  type AxisKey,
  type FingerprintRegistry,
} from './fingerprint-registry'

const AXIS_VALUES: Record<AxisKey, readonly string[]> = {
  combatRange: ['close', 'mid', 'long'],
  powerMedium: ['body', 'weapon', 'spell', 'summon', 'device', 'environment'],
  initiative: ['direct', 'reactive', 'command', 'prepare', 'transform'],
  spaceUse: ['pursuit', 'fortify', 'swap', 'expand', 'aerial'],
  combatRhythm: ['pressure', 'build_release', 'cycle', 'prepare_execute', 'improvise'],
  mastery: ['timing', 'aim', 'resource_combo', 'placement', 'command', 'form_shift'],
  risk: ['health', 'overheat', 'focus_break', 'summon_loss', 'terrain_collapse'],
}

const SCORE_KEYS = [
  'interpretationFit',
  'distinctiveness',
  'actionability',
  'progression',
  'nonMonopoly',
  'genreIndependence',
  'candidateDistance',
] as const

type ScoreKey = typeof SCORE_KEYS[number]
type Scores = Record<ScoreKey, number>

type Candidate = {
  id: string
  axes: Axes
  scores: Scores
}

type RegistryMatch = {
  version: string
  candidateId: string
  equalAxes: number
  similar: boolean
}

export type ParsedConceptBrief = {
  candidates: Candidate[]
  initialSelected: string
  selected: string
  finalFingerprint: Axes
}

function section(markdown: string, heading: string, nextLevel: number): string | null {
  const startPattern = new RegExp(`^${'#'.repeat(nextLevel)} ${heading}\\s*$`, 'm')
  const start = startPattern.exec(markdown)
  if (start == null) return null
  const bodyStart = start.index + start[0].length
  const next = new RegExp(`^#{1,${nextLevel}} `, 'm').exec(markdown.slice(bodyStart))
  return markdown.slice(bodyStart, next == null ? markdown.length : bodyStart + next.index)
}

function field(block: string, name: string): string | null {
  return new RegExp(`^- ${name}:\\s*(.*?)\\s*$`, 'm').exec(block)?.[1] ?? null
}

function validateFieldNames(block: string, allowed: readonly string[], errors: string[], context: string): void {
  const names = [...block.matchAll(/^- ([A-Za-z][A-Za-z-]*):/gm)].map(match => match[1])
  const unknown = names.filter(name => !allowed.includes(name))
  if (unknown.length > 0) errors.push(`${context} has unknown fields: ${[...new Set(unknown)].join(', ')}.`)
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index)
  if (duplicates.length > 0) errors.push(`${context} has duplicate fields: ${[...new Set(duplicates)].join(', ')}.`)
}

function parseAxes(block: string, errors: string[], context: string): Axes {
  const axes = {} as Axes
  for (const key of AXIS_KEYS) {
    const value = field(block, key)
    if (value == null || !AXIS_VALUES[key].includes(value)) {
      errors.push(`${context} has invalid or missing ${key}.`)
      axes[key] = ''
    } else {
      axes[key] = value
    }
  }
  return axes
}

function parseScores(block: string, errors: string[], candidateId: string): Scores {
  const scores = {} as Scores
  for (const key of SCORE_KEYS) {
    const value = field(block, key)
    const match = value?.match(/^([1-5])\s*\|\s*(\S.*)$/)
    if (match == null) {
      errors.push(`${candidateId} has invalid or missing score ${key}.`)
      scores[key] = 0
    } else {
      scores[key] = Number(match[1])
    }
  }
  return scores
}

function parseEvidence(value: string | null, validIds: Set<string>, errors: string[], context: string): void {
  const ids = value?.split(',').map(id => id.trim()).filter(Boolean) ?? []
  if (ids.length === 0 || ids.some(id => !validIds.has(id))) {
    errors.push(`${context} must cite only existing interpretation IDs.`)
  }
}

function scoreOrder(left: Candidate, right: Candidate): number {
  const total = (scores: Scores) => SCORE_KEYS.reduce((sum, key) => sum + scores[key], 0)
  return total(right.scores) - total(left.scores)
    || right.scores.interpretationFit - left.scores.interpretationFit
    || right.scores.actionability - left.scores.actionability
    || right.scores.distinctiveness - left.scores.distinctiveness
    || left.id.localeCompare(right.id)
}

function expectedMatches(fingerprint: Axes, registry: FingerprintRegistry): Array<RegistryMatch & { fingerprint: Axes }> {
  return closestEntries(fingerprint, registry.entries).map(entry => ({
    version: entry.version,
    candidateId: entry.candidateId,
    fingerprint: entry.fingerprint,
    equalAxes: entry.equalAxes,
    similar: entry.equalAxes >= 5,
  }))
}

function parseMatches(markdown: string, kind: 'Initial' | 'Final', errors: string[]): RegistryMatch[] {
  const pattern = new RegExp(`^### ${kind} Closest Match (v\\d+\\.\\d+\\.\\d+) (C-\\d{2})\\s*$`, 'gm')
  const headings = [...markdown.matchAll(pattern)]
  return headings.map((match, index) => {
    const start = match.index! + match[0].length
    const nextHeading = /^#{1,3} /m.exec(markdown.slice(start))
    const block = markdown.slice(start, nextHeading == null ? markdown.length : start + nextHeading.index)
    const equal = Number(field(block, 'equal-axes'))
    const similarValue = field(block, 'similar')
    if (!Number.isInteger(equal) || equal < 0 || equal > 7 || !['true', 'false'].includes(similarValue ?? '')) {
      errors.push(`${kind} closest match ${index + 1} has invalid fields.`)
    }
    return { version: match[1], candidateId: match[2], equalAxes: equal, similar: similarValue === 'true' }
  })
}

function matchesEqual(left: RegistryMatch[], right: RegistryMatch[]): boolean {
  const normalize = (matches: RegistryMatch[]) => matches
    .map(match => `${match.version}|${match.candidateId}|${match.equalAxes}|${match.similar}`)
    .sort()
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right))
}

export function validateConceptBrief(markdown: string, interpretation: string, registry: FingerprintRegistry): string[] {
  const errors: string[] = []
  try { parseGamePresentation(markdown) } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error))
  }
  if (!markdown.startsWith('# Gameplay Concept Brief\n')) errors.push('Missing Gameplay Concept Brief title.')
  validateFieldNames(markdown.split(/^## Interpretation Traits\s*$/m)[0], ['schema-version'], errors, 'Document')
  if (field(markdown, 'schema-version') !== '1') errors.push('schema-version must be 1.')
  const validIds = new Set([...interpretation.matchAll(/^### (I-\d{2})\s*$/gm)].map(match => match[1]))

  const traitSection = section(markdown, 'Interpretation Traits', 2)
  const traitMatches = [...(traitSection ?? '').matchAll(/^### Trait (T-\d{2})\s*$/gm)]
  if (traitMatches.length < 7) errors.push('Interpretation Traits must cover all seven axes.')
  const traitAxes = new Set<string>()
  traitMatches.forEach((match, index) => {
    const start = match.index! + match[0].length
    const next = /^### /m.exec((traitSection ?? '').slice(start))
    const block = (traitSection ?? '').slice(start, next == null ? undefined : start + next.index)
    validateFieldNames(block, ['axis', 'value', 'evidence', 'counter-evidence', 'confidence'], errors, match[1])
    if (match[1] !== `T-${String(index + 1).padStart(2, '0')}`) errors.push('Trait IDs must be sequential.')
    const axis = field(block, 'axis')
    const value = field(block, 'value')
    if (axis == null || !AXIS_KEYS.includes(axis as AxisKey) || !AXIS_VALUES[axis as AxisKey]?.includes(value ?? '')) {
      errors.push(`${match[1]} has an invalid axis or value.`)
    } else {
      traitAxes.add(axis)
    }
    parseEvidence(field(block, 'evidence'), validIds, errors, match[1])
    if (!(Number(field(block, 'confidence')) >= 0 && Number(field(block, 'confidence')) <= 1)) {
      errors.push(`${match[1]} confidence must be between 0 and 1.`)
    }
    if ((field(block, 'counter-evidence') ?? '').trim() === '') errors.push(`${match[1]} needs counter-evidence.`)
  })
  if (AXIS_KEYS.some(key => !traitAxes.has(key))) errors.push('Interpretation Traits do not cover every axis.')

  const candidatesSection = section(markdown, 'Candidates', 2) ?? ''
  const candidateHeadings = [...candidatesSection.matchAll(/^### Candidate (C-\d{2})\s*$/gm)]
  const candidates: Candidate[] = candidateHeadings.map((match, index) => {
    const start = match.index! + match[0].length
    const next = /^### Candidate /m.exec(candidatesSection.slice(start))
    const block = candidatesSection.slice(start, next == null ? undefined : start + next.index)
    const id = match[1]
    const candidateFields = block.split(/^#### Axes\s*$/m)[0]
    validateFieldNames(candidateFields, ['name', 'player-fantasy', 'primary-verbs', 'core-loop', 'growth-path', 'weakness', 'evidence'], errors, id)
    if (id !== `C-${String(index + 1).padStart(2, '0')}`) errors.push('Candidate IDs must be sequential.')
    for (const name of ['name', 'player-fantasy', 'core-loop', 'growth-path', 'weakness']) {
      if ((field(block, name) ?? '').trim() === '') errors.push(`${id} needs ${name}.`)
    }
    const verbs = field(block, 'primary-verbs')?.split(',').map(value => value.trim()) ?? []
    if (verbs.length < 2 || verbs.length > 3 || verbs.some(value => !/^[a-z]+(?:-[a-z]+)*$/.test(value))) {
      errors.push(`${id} needs two or three kebab-case primary verbs.`)
    }
    parseEvidence(field(block, 'evidence'), validIds, errors, id)
    const axesBlock = section(block, 'Axes', 4) ?? ''
    const scoresBlock = section(block, 'Scores', 4) ?? ''
    validateFieldNames(axesBlock, AXIS_KEYS, errors, `${id} Axes`)
    validateFieldNames(scoresBlock, SCORE_KEYS, errors, `${id} Scores`)
    return { id, axes: parseAxes(axesBlock, errors, id), scores: parseScores(scoresBlock, errors, id) }
  })

  if (![4, 5].includes(candidates.length)) errors.push('The brief must contain four or five candidates.')
  const initialCandidates = candidates.slice(0, 4)
  for (let left = 0; left < initialCandidates.length; left += 1) {
    for (let right = left + 1; right < initialCandidates.length; right += 1) {
      if (7 - equalAxes(initialCandidates[left].axes, initialCandidates[right].axes) < 3) {
        errors.push(`${initialCandidates[left].id} and ${initialCandidates[right].id} differ on fewer than three axes.`)
      }
    }
  }

  const selection = section(markdown, 'Selection', 2) ?? ''
  validateFieldNames(selection.split(/^### Rejected /m)[0], ['initial-selected', 'selected', 'reason'], errors, 'Selection')
  const initialSelected = field(selection, 'initial-selected') ?? ''
  const selected = field(selection, 'selected') ?? ''
  if ((field(selection, 'reason') ?? '').trim() === '') errors.push('Selection needs a reason.')
  const expectedInitial = [...initialCandidates].sort(scoreOrder)[0]?.id ?? ''
  const expectedSelected = [...candidates].sort(scoreOrder)[0]?.id ?? ''
  if (initialSelected !== expectedInitial) errors.push('initial-selected does not follow the score tie-break rules.')
  if (selected !== expectedSelected) errors.push('selected does not follow the score tie-break rules.')

  const rejected = [...selection.matchAll(/^### Rejected (C-\d{2})\s*$/gm)]
  const expectedRejected = candidates.map(candidate => candidate.id).filter(id => id !== selected).sort()
  const actualRejected = rejected.map(match => match[1]).sort()
  if (JSON.stringify(expectedRejected) !== JSON.stringify(actualRejected)) errors.push('Rejected comparisons must cover every unselected candidate once.')
  rejected.forEach(match => {
    const start = match.index! + match[0].length
    const next = /^### /m.exec(selection.slice(start))
    if ((field(selection.slice(start, next == null ? undefined : start + next.index), 'reason') ?? '').trim() === '') {
      errors.push(`${match[1]} rejection needs a reason.`)
    }
  })

  const review = section(markdown, 'Registry Review', 2) ?? ''
  validateFieldNames(review.split(/^### (?:Initial|Final) Closest Match /m)[0], [
    'threshold', 'compared-entries', 'challenger-required', 'challenger-candidate', 'similarity-justification',
  ], errors, 'Registry Review')
  if (field(review, 'threshold') !== '5') errors.push('Registry threshold must be 5.')
  if (Number(field(review, 'compared-entries')) !== registry.entries.length) errors.push('Registry compared-entries is incorrect.')
  const initial = candidates.find(candidate => candidate.id === initialSelected)
  const final = candidates.find(candidate => candidate.id === selected)
  const expectedInitialMatches = initial == null ? [] : expectedMatches(initial.axes, registry)
  const expectedFinalMatches = final == null ? [] : expectedMatches(final.axes, registry)
  const actualInitialMatches = parseMatches(review, 'Initial', errors)
  const actualFinalMatches = parseMatches(review, 'Final', errors)
  if (!matchesEqual(actualInitialMatches, expectedInitialMatches)) errors.push('Initial closest registry matches are incorrect.')
  if (!matchesEqual(actualFinalMatches, expectedFinalMatches)) errors.push('Final closest registry matches are incorrect.')
  const challengerRequired = expectedInitialMatches.some(match => match.similar)
  if (field(review, 'challenger-required') !== String(challengerRequired)) errors.push('challenger-required is incorrect.')
  const challenger = field(review, 'challenger-candidate')
  if (challengerRequired) {
    if (candidates.length !== 5 || challenger !== 'C-05') errors.push('A similar initial choice requires challenger C-05.')
    const candidate = candidates[4]
    if (candidate != null && initial != null && 7 - equalAxes(candidate.axes, initial.axes) < 3) {
      errors.push('C-05 differs from the initial choice on fewer than three axes.')
    }
    for (const match of expectedInitialMatches) {
      if (candidate != null && 7 - equalAxes(candidate.axes, match.fingerprint) < 3) {
        errors.push(`C-05 differs from ${match.version} on fewer than three axes.`)
      }
    }
  } else if (candidates.length !== 4 || challenger !== 'none') {
    errors.push('A non-similar initial choice must not add a challenger.')
  }
  const finalIsSimilar = expectedFinalMatches.some(match => match.similar)
  const justification = field(review, 'similarity-justification')
  if (finalIsSimilar ? justification == null || justification === 'none' : justification !== 'none') {
    errors.push('similarity-justification does not match the final similarity result.')
  }

  const finalFingerprintBlock = section(markdown, 'Final Fingerprint', 2) ?? ''
  validateFieldNames(finalFingerprintBlock, AXIS_KEYS, errors, 'Final Fingerprint')
  const finalFingerprint = parseAxes(finalFingerprintBlock, errors, 'Final Fingerprint')
  if (final != null && equalAxes(finalFingerprint, final.axes) !== 7) errors.push('Final Fingerprint does not match the selected candidate.')
  return errors
}

export function parseFinalFingerprint(markdown: string): Axes | null {
  const errors: string[] = []
  const block = section(markdown, 'Final Fingerprint', 2)
  if (block == null) return null
  const fingerprint = parseAxes(block, errors, 'Final Fingerprint')
  return errors.length === 0 ? fingerprint : null
}

export function parseSelectedCandidateId(markdown: string): string | null {
  const selection = section(markdown, 'Selection', 2)
  const selected = selection == null ? null : field(selection, 'selected')
  return selected != null && /^C-\d{2}$/.test(selected) ? selected : null
}

export function isValidConceptBrief(markdown: string, interpretation: string, registryJson: string): boolean {
  try {
    return validateConceptBrief(markdown, interpretation, parseRegistry(registryJson)).length === 0
  } catch {
    return false
  }
}

if (import.meta.main) {
  const [briefPath, interpretationPath, registryPath, presentationPath, ...extra] = process.argv.slice(2)
  if (briefPath == null || interpretationPath == null || registryPath == null || presentationPath == null || extra.length > 0) {
    console.error('Usage: bun validate-concept-brief.ts <gameplay-concept-brief.md> <chart-interpretation.md> <combat-concept-fingerprints.json> <game-presentation-contract.md>')
    process.exitCode = 2
  } else {
    try {
      readGamePresentationContract(presentationPath)
      const [brief, interpretation, registryJson] = await Promise.all([
        readFile(briefPath, 'utf8'),
        readFile(interpretationPath, 'utf8'),
        readFile(registryPath, 'utf8'),
      ])
      const errors = validateConceptBrief(brief, interpretation, parseRegistry(registryJson))
      if (errors.length > 0) {
        errors.forEach(error => console.error(error))
        process.exitCode = 1
      } else {
        console.log('Validated gameplay concept brief.')
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    }
  }
}
