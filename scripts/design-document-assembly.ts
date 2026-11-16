import { parseGamePresentation } from './game-presentation'
import { parseFinalFingerprint } from '../.agents/skills/select-gameplay-concept/scripts/validate-concept-brief'
import { parseWorldBrief, selectedWorld, WORLD_KEYS, record } from '../.agents/skills/select-world-concept/scripts/world-contract'

export class AssemblyError extends Error {
  constructor(public code: string, message: string) { super(message) }
}
export type DesignAssemblyInput = {
  stage: 'selection' | 'world-selection' | 'gdd'
  draft: string
  presentationContract: string
  combatBrief?: string
  worldBrief?: string
}
const fail = (code: string, message: string): never => { throw new AssemblyError(`assembly-${code}`, message) }
const block = (language: string, value: unknown): string => '```' + language + '\n' + JSON.stringify(value, null, 2) + '\n```'

/** Assemble only tool-owned fields. Ordinary prose and manifestation strings stay model-owned. */
export function assembleDesignDocument(input: DesignAssemblyInput): string {
  let presentation: ReturnType<typeof parseGamePresentation>
  try { presentation = parseGamePresentation(input.presentationContract) }
  catch (error) { return fail('source-invalid', String(error)) }
  if (/^ {0,3}(?:`{3,}|~{3,})(?:game-presentation|combat-fingerprint)\b/m.test(input.draft)) {
    return fail('managed-field', 'Draft contains a tool-owned declaration.')
  }
  let draft = input.draft
  if (input.stage === 'gdd') {
    let combat: ReturnType<typeof parseFinalFingerprint>, world: ReturnType<typeof selectedWorld>
    try {
      if (!input.combatBrief || !input.worldBrief) throw new Error('Missing accepted design source.')
      parseGamePresentation(input.combatBrief); parseGamePresentation(input.worldBrief)
      combat = parseFinalFingerprint(input.combatBrief)
      if (!combat) throw new Error('Invalid accepted combat fingerprint.')
      world = selectedWorld(parseWorldBrief(input.worldBrief))
    } catch (error) { return fail('source-invalid', String(error)) }
    const marker = '<!-- design-assembly:production -->'
    const markers = [...draft.matchAll(/<!--\s*design-assembly:production\s*-->/g)]
    const headings: Array<{ title: string; offset: number }> = []
    let fence: string | undefined, inComment = false, markerInFence = false, cursor = 0
    const offset = markers[0]?.index ?? -1
    for (const line of draft.split(/(?<=\n)/)) {
      const clean = line.replace(/\r?\n$/, '')
      const delimiter = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(clean)
      if (cursor <= offset && offset < cursor + line.length) markerInFence = !!fence || inComment
      if (fence) {
        if (delimiter && delimiter[1][0] === fence[0] && delimiter[1].length >= fence.length && !delimiter[2].trim()) fence = undefined
      } else if (!inComment && delimiter) fence = delimiter[1]
      else {
        if (!inComment && /^##[ \t]+/.test(clean)) headings.push({ title: clean.trim(), offset: cursor })
        // The standalone production marker itself is a complete comment.
        for (const token of clean.matchAll(/<!--|-->/g)) inComment = token[0] === '<!--'
      }
      cursor += line.length
    }
    const sectionIndex = headings.findIndex(heading => heading.title === '## 1. 게임 개요')
    if (markers.length !== 1 || markerInFence || sectionIndex < 0
      || headings.filter(heading => heading.title === '## 1. 게임 개요').length !== 1
      || offset <= headings[sectionIndex].offset || !headings[sectionIndex + 1]
      || offset >= headings[sectionIndex + 1].offset
      || !draft.split(/\r?\n/).some(line => line.trimEnd() === marker)) {
      return fail('production-marker', 'Expected one standalone production insertion line in section 1.')
    }
    const paragraphs = [...input.presentationContract.matchAll(/<!-- design-production:start -->\r?\n([\s\S]*?)\r?\n<!-- design-production:end -->/g)]
    if (input.presentationContract.split('<!-- design-production:start -->').length !== 2 || input.presentationContract.split('<!-- design-production:end -->').length !== 2 || paragraphs.length !== 1 || !paragraphs[0][1].trim()) return fail('source-invalid', 'Missing unique production paragraph in shared contract.')
    const openings = [...draft.matchAll(/^```world-structure[^\r\n]*$/gm)]
    const structures = [...draft.matchAll(/^```world-structure[ \t]*\r?\n([\s\S]*?)\r?\n```[ \t]*$/gm)]
    if (openings.length !== 1 || structures.length !== 1) return fail('world-structure', 'Expected one complete world-structure block.')
    let structure: Record<string, unknown>
    try {
      structure = record(JSON.parse(structures[0][1]), WORLD_KEYS, 'Draft world structure')
      for (const key of WORLD_KEYS) {
        const value = structure[key]
        if (value && typeof value === 'object' && Object.hasOwn(value, 'value')) return fail('managed-field', `Draft ${key} contains managed value.`)
        const axis = record(value, ['manifestation'], `Draft ${key}`)
        if (typeof axis.manifestation !== 'string' || !axis.manifestation.trim()) throw new Error(`Missing ${key} manifestation.`)
        structure[key] = { value: world!.fingerprint[key], manifestation: axis.manifestation }
      }
    } catch (error) {
      if (error instanceof AssemblyError) throw error
      return fail('world-structure', String(error))
    }
    draft = draft.replace(structures[0][0], () => block('world-structure', structure))
    draft = draft.replace(marker, () => paragraphs[0][1])
    return draft + '\n\n' + block('combat-fingerprint', combat!) + '\n\n' + block('game-presentation', presentation) + '\n'
  }
  return draft + '\n\n' + block('game-presentation', presentation) + '\n'
}
