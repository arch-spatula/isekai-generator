import { createHash, randomUUID } from 'node:crypto'
import { basename, relative, resolve } from 'node:path'
import { ArtifactState } from './artifact-state-store'
import { diagnoseSystemInterpretation, type ChartSystem, type InterpretationDiagnostic } from '../../.agents/skills/interpret-chart-system/scripts/validate-system-interpretation'
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
const hash = (text:string):string => createHash('sha256').update(text).digest('hex')
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
/** Pure edit contract shared by SQLite submissions and validators. */
export function evaluateDefensivePayload(source: string, input: Pick<DefensiveEditInput, 'system' | 'attempt' | 'scope' | 'diagnostics'>, proposal: { sourceSha256?: string; edits: Edit[]; review: Review; reviewMarkdown?: string }): { candidate: string; errors: InterpretationDiagnostic[]; passed: boolean; unresolved: string[] } {
  if (proposal.sourceSha256 && proposal.sourceSha256 !== hash(source)) throw new Error('Source hash mismatch')
  if (!Array.isArray(proposal.edits) || !proposal.reviewMarkdown?.trim()) throw new Error('Missing edits or semantic review report')
  validateReview(input as DefensiveEditInput, proposal.review, proposal.edits, source)
  const candidate = assemble(source, input as DefensiveEditInput, proposal.edits, proposal.review)
  const unresolved = [...proposal.review.unresolved, ...proposal.review.primary.filter(item => item.status !== 'fixed').map(item => `diagnostic:${item.diagnosticIndex}`), ...proposal.review.secondary.filter(item => ['needs-expansion','deferred'].includes(item.status)).map(item => item.id)]
  if (!proposal.review.preservationConfirmed) unresolved.push('meaning-preservation')
  if (unresolved.length && !proposal.review.nextScopeReason?.trim()) throw new Error('Unresolved targets require next scope reason')
  const errors = diagnoseSystemInterpretation(input.system, candidate)
  return { candidate, errors, passed: !errors.length && !unresolved.length, unresolved }
}

export function prepareDefensiveEdit(runDirectory:string,system:ChartSystem): DefensiveEditInput & {attemptId:string;claim:string} {
 const state=new ArtifactState(resolve(runDirectory,'../..'))
 try {const result=state.prepare(basename(runDirectory),system,'edit',randomUUID()).data,a=state.attempt(result.attemptId),snapshot=JSON.parse(a.input);return {system,attempt:result.number,scope:result.scope,source:{output:relative(runDirectory,state.path(snapshot.source.path)),sha256:snapshot.source.sha256,attempt:state.attempt(snapshot.source.attemptId).number},originalSha256:snapshot.source.sha256,diagnostics:snapshot.diagnostics,candidate:relative(runDirectory,result.output),review:relative(runDirectory,result.output.replace('candidate.md','review.md')),input:'',edits:'',result:'',chart:'',evidence:'',attemptId:result.attemptId,claim:result.claim}}finally{state.close()}
}
export function finishDefensiveEdit(_runDirectory:string,_system:ChartSystem,_attempt:number,_executionFailed=false): DefensiveEditResult {throw new Error('Submit edits on stdin using artifact-state submit, then finish the assigned attempt')}
export function verifyDefensiveAcceptance(runDirectory:string,system:ChartSystem):void {const state=new ArtifactState(resolve(runDirectory,'../..'),false,true);try{const run=state.run(basename(runDirectory));state.text(run.id,system)}finally{state.close()}}
