import { createHash, randomUUID } from 'node:crypto'
import { existsSync, linkSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { diagnoseSystemInterpretation, type ChartSystem, type InterpretationDiagnostic } from '../../.agents/skills/interpret-chart-system/scripts/validate-system-interpretation'
import type { ChartEvidenceManifest } from '../../.agents/skills/generate-chart-report/scripts/chart-evidence'
import { appendArtifactEvent } from './artifact-events'
import { readRunManifest } from './artifact-run'
import { recordStageProgress } from './artifact-progress'
import type { AttemptResult } from './specialist-attempt'

type Scope = 'sentence' | 'item' | 'system'
type Edit = { id: string; target: string; original: string; replacement: string; diagnosticCode?: string; reviewTargetId?: string }
type Decision = { reason: string; editIds: string[] }
type Review = {
  system: ChartSystem; attempt: number; scope: Scope
  primary: (Decision & { diagnosticIndex: number; status: 'fixed' | 'unresolved' | 'false-positive' })[]
  secondary: (Decision & { id: string; target: string; status: 'fixed' | 'preserved' | 'needs-expansion' | 'deferred' })[]
  preservationConfirmed: boolean; unresolved: string[]; nextScopeReason?: string
  usage?: { inputTokens?: number; outputTokens?: number }
}
export type DefensiveEditInput = {
  system: ChartSystem; attempt: number; scope: Scope; source: { output: string; sha256: string; attempt: number }
  input: string; edits: string; review: string; candidate: string; result: string; chart: string; evidence: string
  originalSha256: string; diagnostics: InterpretationDiagnostic[]; previous?: { candidate: string; review: string; result: string }
}
export type DefensiveEditResult = { system: ChartSystem; attempt: number; scope: Scope; status: 'passed' | 'editing-failed' | 'execution-failed'; errors: InterpretationDiagnostic[]; sha256?: string; sourceSha256: string; unresolved: string[]; calls: number; usage: Review['usage'] | null }
const hash = (text: string): string => createHash('sha256').update(text).digest('hex')
const read = (path: string): string => readFileSync(path, 'utf8')
const json = <T>(path: string): T => JSON.parse(read(path)) as T
function requireRunning(run: string): void { if (readRunManifest(run).status !== 'running') throw new Error('Defensive editing requires a running run') }
function directory(run: string, system: ChartSystem): string {
  if (!['saju', 'ziwei', 'natal'].includes(system)) throw new Error('Invalid chart system')
  return join(run, 'garbage', 'defensive-editing', system)
}
function once(path: string, content: string): void {
  const temporary = join(dirname(path), `.${randomUUID()}.tmp`)
  try { writeFileSync(temporary, content, { flag: 'wx' }); linkSync(temporary, path) } finally { rmSync(temporary, { force: true }) }
}
function record(path: string, value: unknown): void { once(path, `${JSON.stringify(value, null, 2)}\n`) }
function locked<T>(run: string, system: ChartSystem, action: (dir: string) => T): T {
  requireRunning(run)
  const dir = directory(run, system)
  mkdirSync(dir, { recursive: true })
  const lock = join(dir, '.lock'); mkdirSync(lock)
  try { return action(dir) } finally { rmSync(lock, { recursive: true }) }
}
function evidence(run: string): ChartEvidenceManifest { return json(join(run, 'docs/GDD/chart-evidence.json')) }
function finalPath(run: string, system: ChartSystem): string { return join(run, 'docs/GDD', `${system}-interpretation.md`) }
function sourceAttempt(run: string, system: ChartSystem): AttemptResult {
  const dir = join(run, 'garbage/attempts', system)
  const attempts = readdirSync(dir).filter(name => /^\d{3}$/.test(name)).sort()
  const result = json<AttemptResult>(join(dir, attempts.at(-1)!, 'result.json'))
  if (result.status !== 'editing-required') throw new Error('Specialist needs structural repair before editing')
  return result
}
function checkedSource(run: string, input: DefensiveEditInput): string {
  const original = sourceAttempt(run, input.system)
  if (original.attempt !== input.source.attempt) throw new Error('Specialist source changed')
  if (hash(read(join(run, original.output))) !== input.originalSha256) throw new Error('Original specialist hash mismatch')
  const source = read(join(run, input.source.output))
  if (hash(source) !== input.source.sha256) throw new Error('Source hash mismatch')
  return source
}
export function prepareDefensiveEdit(runDirectory: string, system: ChartSystem): DefensiveEditInput {
  const run = resolve(runDirectory)
  return locked(run, system, dir => {
    if (existsSync(join(dir, 'accepted.json')) || existsSync(finalPath(run, system))) throw new Error('Defensive edit already accepted')
    const source = sourceAttempt(run, system)
    const attempts = readdirSync(dir).filter(name => /^\d{3}$/.test(name)).sort()
    if (attempts.length >= 3) throw new Error('Defensive edit limit exhausted (3 total)')
    let sourceOutput = source.output
    let previous: DefensiveEditInput['previous']
    if (attempts.length) {
      const prior = join(dir, attempts.at(-1)!)
      const result = json<DefensiveEditResult>(join(prior, 'result.json'))
      if (result.status !== 'editing-failed') throw new Error('Previous edit is not a recoverable recorded failure')
      const input = json<DefensiveEditInput>(join(prior, 'input.json'))
      checkedSource(run, input)
      if (!result.sha256 || hash(read(join(prior, 'candidate.md'))) !== result.sha256) throw new Error('Previous candidate hash mismatch')
      sourceOutput = relative(run, join(prior, 'candidate.md'))
      previous = { candidate: sourceOutput, review: input.review, result: input.result }
      const issues = result.errors.length
        ? result.errors.map(({ itemId, line, ...issue }) => ({ ...issue, ...(line != null && line > 0 ? { line } : {}), ...(itemId ? { item: itemId } : {}) }))
        : [{ code: 'editing-unresolved', message: 'Defensive editing left unresolved review targets.' }]
      appendArtifactEvent(run, { event: 'retry_scheduled', stage: system, attempt: attempts.length + 1, operation: 'prepare-defensive-edit', reason: 'Previous defensive edit failed validation.', issues })
    }
    const markdown = read(join(run, sourceOutput))
    const diagnostics = diagnoseSystemInterpretation(system, markdown, evidence(run))
    if (!attempts.length && diagnostics.some(error => error.code !== 'responsibility-avoidance')) throw new Error('Structural errors require specialist repair')
    const attempt = attempts.length + 1
    const target = join(dir, String(attempt).padStart(3, '0')); mkdirSync(target)
    const path = (name: string): string => relative(run, join(target, name))
    const input: DefensiveEditInput = { system, attempt, scope: (['sentence', 'item', 'system'] as const)[attempt - 1], source: { output: sourceOutput, sha256: hash(markdown), attempt: source.attempt }, input: path('input.json'), edits: path('edits.json'), review: path('review.md'), candidate: path('candidate.md'), result: path('result.json'), chart: path('chart.md'), evidence: path('evidence.json'), originalSha256: hash(read(join(run, source.output))), diagnostics, ...(previous ? { previous } : {}) }
    const chart = read(join(run, 'docs/GDD/chart-report.md'))
    const markers = { saju: ['四柱八字', '紫微斗數 命盤'], ziwei: ['紫微斗數 命盤', 'Natal Chart'], natal: ['Natal Chart', null] } as const
    const [startMarker, endMarker] = markers[system]
    const start = chart.indexOf(startMarker); const end = endMarker ? chart.indexOf(endMarker, start + startMarker.length) : chart.length
    if (start < 0 || end < start) throw new Error('Missing system chart section')
    once(join(run, input.chart), chart.slice(start, end))
    record(join(run, input.evidence), { version: 1, systems: { [system]: evidence(run).systems[system] } })
    record(join(target, 'input.json'), input)
    recordStageProgress(run, readRunManifest(run), system, 'running', { attempt: source.attempt, editing: { attempt, sourceSha256: input.source.sha256, status: 'running', result: input.result } })
    return input
  })
}

type Region = { target: string; start: number; end: number }
function regions(markdown: string): Region[] {
  const headings = [...markdown.matchAll(/^#{1,3} .+$/gm)]
  return headings.map((match, index) => ({ target: match[0].startsWith('### ') ? match[0].slice(4) : match[0], start: match.index!, end: headings[index + 1]?.index ?? markdown.length }))
}
function protectedParts(markdown: string): string[] {
  return markdown.split('\n').filter(line => /^#{1,3} |^(영역|해상도|근거):/.test(line))
}
function assemble(source: string, input: DefensiveEditInput, edits: Edit[], review: Review): string {
  const ranges = regions(source)
  const ids = new Set<string>()
  const changes = edits.map(edit => {
    if (!edit.id || ids.has(edit.id) || typeof edit.original !== 'string' || !edit.original || typeof edit.replacement !== 'string') throw new Error('Invalid or duplicate edit')
    ids.add(edit.id)
    const region = ranges.find(region => region.target === edit.target)
    if (!region) throw new Error('Unknown edit target')
    const block = source.slice(region.start, region.end)
    const offset = block.indexOf(edit.original)
    if (offset < 0 || block.indexOf(edit.original, offset + 1) >= 0) throw new Error('Original must match exactly once within target')
    const start = region.start + offset
    const end = start + edit.original.length
    if (input.scope === 'sentence' && ([edit.original, edit.replacement].some(text => /[\n]/.test(text) || /[.!?。！？]\s*\S/.test(text.replace(/\b(?:e\.g\.|i\.e\.)/g, 'example').replace(/(\d)\.(?=\d)/g, '$1decimal'))))) throw new Error('Sentence scope exceeded')
    if (input.scope === 'item' && !/^[SZN]-\d{2}$/.test(edit.target)) {
      const before = source.slice(region.start, start).lastIndexOf('\n\n')
      const after = source.indexOf('\n\n', start)
      if (edit.replacement.includes('\n\n') || edit.original.includes('\n\n') || (after >= 0 && end > after) || before > offset) throw new Error('Paragraph scope exceeded')
    }
    const primary = review.primary.some(decision => {
      const diagnostic = input.diagnostics[decision.diagnosticIndex]
      const firstLine = source.slice(0, start).split('\n').length
      const lastLine = source.slice(0, end).split('\n').length
      return decision.editIds.includes(edit.id) && diagnostic?.code === edit.diagnosticCode && ((diagnostic.itemId != null && diagnostic.code !== 'responsibility-avoidance' && diagnostic.itemId === edit.target) || (diagnostic.line != null && diagnostic.line >= firstLine && diagnostic.line <= lastLine))
    })
    const secondary = review.secondary.some(decision => decision.id === edit.reviewTargetId && decision.target === edit.target && decision.editIds.includes(edit.id))
    if (!primary && !secondary) throw new Error('Edit lacks diagnostic or semantic review link')
    return { start, end, replacement: edit.replacement }
  }).sort((a, b) => a.start - b.start)
  for (let i = 1; i < changes.length; i++) if (changes[i].start < changes[i - 1].end) throw new Error('Overlapping edits')
  let candidate = source
  for (const change of changes.toReversed()) candidate = candidate.slice(0, change.start) + change.replacement + candidate.slice(change.end)
  if (JSON.stringify(protectedParts(source)) !== JSON.stringify(protectedParts(candidate))) throw new Error('Protected headings, IDs, evidence, resolution or order changed')
  return candidate
}
function validateReview(input: DefensiveEditInput, review: Review, edits: Edit[], source: string): void {
  if (review.system !== input.system || review.attempt !== input.attempt || review.scope !== input.scope) throw new Error('Review input mismatch')
  if (!Array.isArray(review.primary) || !Array.isArray(review.secondary) || !Array.isArray(review.unresolved) || typeof review.preservationConfirmed !== 'boolean') throw new Error('Incomplete review')
  if (review.primary.length !== input.diagnostics.length || input.diagnostics.some((_, index) => review.primary.filter(item => item.diagnosticIndex === index).length !== 1)) throw new Error('Every automatic diagnostic requires one review decision')
  const ids = new Set(edits.map(edit => edit.id))
  const secondaryIds = new Set<string>()
  for (const decision of [...review.primary, ...review.secondary]) {
    if (typeof decision.reason !== 'string' || !decision.reason.trim() || !Array.isArray(decision.editIds) || decision.editIds.some(id => !ids.has(id))) throw new Error('Review decision needs reason and valid edit links')
    if (decision.status === 'fixed' && decision.editIds.length === 0) throw new Error('Fixed target needs an edit')
  }
  for (const decision of review.primary) {
    if (!['fixed', 'unresolved', 'false-positive'].includes(decision.status)) throw new Error('Invalid primary decision')
    const diagnostic = input.diagnostics[decision.diagnosticIndex]
    for (const id of decision.editIds) {
      const edit = edits.find(edit => edit.id === id)!
      const region = regions(source).find(region => region.target === edit.target)
      const offset = region ? source.indexOf(edit.original, region.start) : -1
      const first = source.slice(0, offset).split('\n').length
      const last = source.slice(0, offset + edit.original.length).split('\n').length
      if (!diagnostic || edit.diagnosticCode !== diagnostic.code || !((diagnostic.itemId != null && diagnostic.code !== 'responsibility-avoidance' && diagnostic.itemId === edit.target) || (diagnostic.line != null && diagnostic.line >= first && diagnostic.line <= last))) throw new Error('Primary edit link mismatch')
    }
  }
  for (const decision of review.secondary) {
    if (!decision.id || secondaryIds.has(decision.id) || !regions(source).some(region => region.target === decision.target)) throw new Error('Invalid secondary target')
    secondaryIds.add(decision.id)
    for (const id of decision.editIds) {
      const edit = edits.find(edit => edit.id === id)!
      if (edit.reviewTargetId !== decision.id || edit.target !== decision.target) throw new Error('Secondary edit link mismatch')
    }
    if (!['fixed', 'preserved', 'needs-expansion', 'deferred'].includes(decision.status)) throw new Error('Invalid secondary decision')
  }
}
export function finishDefensiveEdit(runDirectory: string, system: ChartSystem, attempt: number, executionFailed = false): DefensiveEditResult {
  const run = resolve(runDirectory)
  return locked(run, system, dir => {
    if (!Number.isInteger(attempt) || attempt < 1 || attempt > 3) throw new Error('Invalid edit attempt')
    const target = join(dir, String(attempt).padStart(3, '0'))
    if (existsSync(join(target, 'result.json'))) throw new Error('Edit attempt already completed')
    const input = json<DefensiveEditInput>(join(target, 'input.json'))
    if (input.system !== system || input.attempt !== attempt) throw new Error('Edit input mismatch')
    const source = checkedSource(run, input)
    const result: DefensiveEditResult = { system, attempt, scope: input.scope, status: 'execution-failed', errors: [], sourceSha256: input.source.sha256, unresolved: [], calls: attempt, usage: null }
    let candidate: string | undefined
    if (!executionFailed) {
      let proposal: { sourceSha256: string; edits: Edit[]; review: Review } | undefined
      try { proposal = json(join(run, input.edits)) } catch { /* recorded below as an editor contract failure */ }
      if (proposal && proposal.sourceSha256 !== input.source.sha256) throw new Error('Proposal source hash mismatch')
      try {
        if (!proposal || !Array.isArray(proposal.edits)) throw new Error('Invalid edits submission')
        if (!read(join(run, input.review)).trim()) throw new Error('Missing semantic review report')
        validateReview(input, proposal.review, proposal.edits, source)
        candidate = assemble(source, input, proposal.edits, proposal.review)
        const unresolved = [...proposal.review.unresolved,
          ...proposal.review.primary.filter(item => item.status !== 'fixed').map(item => `diagnostic:${item.diagnosticIndex}`),
          ...proposal.review.secondary.filter(item => ['needs-expansion', 'deferred'].includes(item.status)).map(item => item.id)]
        if (!proposal.review.preservationConfirmed) unresolved.push('meaning-preservation')
        if (unresolved.length && !proposal.review.nextScopeReason?.trim()) throw new Error('Unresolved targets require next scope reason')
        result.unresolved = unresolved
        result.usage = proposal.review.usage ?? null
      } catch (error) {
        candidate = source
        result.errors = [{ code: 'editing-contract', message: error instanceof Error ? error.message : 'Defensive edit submission failed contract validation.' }]
        result.unresolved = ['editing-contract']
      }
      once(join(run, input.candidate), candidate)
      if (!result.errors.length) result.errors = diagnoseSystemInterpretation(system, candidate, evidence(run))
      result.sha256 = hash(candidate)
      result.status = result.errors.length || result.unresolved.length ? 'editing-failed' : 'passed'
    }
    const event = { stage: system, attempt, operation: 'finish-defensive-edit' }
    if (result.status === 'passed') appendArtifactEvent(run, { ...event, event: 'validation_succeeded', output: input.candidate })
    else if (result.status === 'execution-failed') appendArtifactEvent(run, { ...event, event: 'execution_failed', reason: 'Defensive editor execution failed or produced no submission.', issues: [{ code: 'editor-execution', message: 'Defensive editor execution failed or produced no submission.' }] })
    else {
      const issues = result.errors.length
        ? result.errors.map(({ itemId, line, ...issue }) => ({ ...issue, ...(line != null && line > 0 ? { line } : {}), ...(itemId ? { item: itemId } : {}) }))
        : [{ code: 'editing-unresolved', message: 'Defensive editing left unresolved review targets.' }]
      appendArtifactEvent(run, { ...event, event: 'validation_failed', output: input.candidate, reason: 'Defensive edit submission or candidate failed validation.', issues })
    }
    record(join(target, 'result.json'), result)
    if (result.status === 'passed') {
      requireRunning(run)
      const original = sourceAttempt(run, system)
      const originalHash = hash(read(join(run, original.output)))
      const accepted = { system, attempt: original.attempt, editAttempt: attempt, output: relative(run, finalPath(run, system)), source: original.output, sourceSha256: originalHash, candidate: input.candidate, sha256: result.sha256, acceptedAt: new Date().toISOString() }
      record(join(dir, 'accepted.json'), accepted)
      record(join(run, 'garbage/attempts', system, 'accepted.json'), accepted)
      once(finalPath(run, system), candidate!)
    }
    recordStageProgress(run, readRunManifest(run), system, result.status === 'passed' ? 'succeeded' : 'failed', { attempt: input.source.attempt, editing: { attempt, sourceSha256: input.source.sha256, status: result.status, result: input.result } })
    return result
  })
}

/** Revalidate adopted documents and both provenance records before integration or resume. */
export function verifyDefensiveAcceptance(run: string, system: ChartSystem): void {
  const accepted = json<{ source: string; sourceSha256: string; candidate: string; sha256: string; editAttempt: number }>(join(directory(run, system), 'accepted.json'))
  const specialist = json<unknown>(join(run, 'garbage/attempts', system, 'accepted.json'))
  if (JSON.stringify(accepted) !== JSON.stringify(specialist)) throw new Error('Acceptance records disagree')
  if (hash(read(join(run, accepted.source))) !== accepted.sourceSha256 || hash(read(join(run, accepted.candidate))) !== accepted.sha256 || hash(read(finalPath(run, system))) !== accepted.sha256) throw new Error('Accepted source or candidate hash mismatch')
  const result = json<DefensiveEditResult>(join(directory(run, system), String(accepted.editAttempt).padStart(3, '0'), 'result.json'))
  if (result.status !== 'passed' || result.sha256 !== accepted.sha256 || diagnoseSystemInterpretation(system, read(finalPath(run, system)), evidence(run)).length) throw new Error('Accepted edit validation failed')
}
