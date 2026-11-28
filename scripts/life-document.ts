/**
 * 일생 해석 문서(`## 섹션 > ### 항목 > 키: 값`)의 구조와 인용을 검사한다. 체계별 차이는 LifeSpec으로 받는다.
 * 계약: docs/spec/life-narrative-interpretation.md
 */
import { LIFE_STAGES } from './life-stages.ts'

const CITATION = /\[(facts|chart|judgment|derived):([^\]]*)\]/g
const HAS_CITATION = /\[(facts|chart|judgment|derived):[^\]]*\]/
const STAGE_NAMES = LIFE_STAGES.map((stage) => stage.name)

export interface LifeSection {
  name: string
  /** 반드시 이 순서로 시작해야 하는 항목 */
  items: string[]
  /** 필수 항목 뒤에 다른 이름의 항목을 더할 수 있는지 */
  extraItems?: boolean
  fields: string[]
  /** 특정 항목에만 더 있는 필드 (항목 이름 → 필드) */
  itemFields?: Record<string, string[]>
  /** 정해진 값 가운데 하나만 쓰는 필드 (필드 → 허용 값) */
  values?: Record<string, string[]>
  /** 생애 단계 이름을 하나 이상 포함해야 하는 필드 */
  stageFields?: string[]
  /** `생업: <이름>` 항목을 하나 이상 둔다. 생업 항목은 fields 대신 LIVELIHOOD_FIELDS를 쓴다(#85). timeline이면 시기에 생애 단계를 쓴다 */
  livelihood?: { timeline: boolean }
}

export const LIVELIHOOD_PREFIX = '생업: '
export const LIVELIHOOD_FIELDS = ['내용', '시기', '쓰인 재능', '근거']
/** 생업 이름에 쓰지 않는 말: 이세계에 없는 현대 제도·기술에 기대는 이름(#85) */
export const MODERN_LIVELIHOOD_WORDS = ['회사', '직장', '공무원', '기업', '대학', '프로그래머', '개발자', '엔지니어', '회계사', '세무사', '변호사', '디자이너', '유튜버']
export const isLivelihood = (name: string) => name.startsWith(LIVELIHOOD_PREFIX)

/** 항목에 적용할 필드와 생애 단계 필드. 생업 항목은 섹션의 기본 필드 대신 생업 필드를 쓴다. */
function itemSpec(section: LifeSection, name: string): { fields: string[]; stageFields: string[] } {
  if (section.livelihood != null && isLivelihood(name)) {
    return { fields: LIVELIHOOD_FIELDS, stageFields: section.livelihood.timeline ? ['시기'] : [] }
  }
  return { fields: [...section.fields, ...(section.itemFields?.[name] ?? [])], stageFields: section.stageFields ?? [] }
}

export interface LifeSpec {
  title: string
  /** 없으면 제목과 첫 섹션 사이에 아무 줄도 두지 않는다 */
  identity?: { key: string; expected: string; file: string }
  sections: LifeSection[]
  /** 생애 연표 `운` 필드의 기대값 (단계 이름 → 사실 파일 줄 내용) */
  luck?: { file: string; expected: Map<string, string> }
  /** 체계별 일생 해석의 인용 규칙. 없으면 구조만 검사하고 인용은 호출한 쪽이 검사한다 */
  citations?: {
    facts: { file: string; items: Set<string> }
    chart: { file: string; names: Set<string>; forbidden?: string[] }
    judgment: { file: string; sections: Set<string> }
    derived?: { file: string; items: Set<string> }
  }
}

interface Field { value: string; line: number }
interface Item { name: string; fields: Map<string, Field[]> }

/** 사실 파일의 '<제목> (…):' 아래 '  <단계> <나이>: <내용>' 줄을 단계 이름 → 내용으로 읽는다. */
export function stageLines(facts: string, title: string): Map<string, string> {
  const lines = facts.split('\n')
  const start = lines.findIndex((line) => line.startsWith(title)) + 1
  const result = new Map<string, string>()
  for (const line of lines.slice(start)) {
    if (!line.startsWith('  ')) break
    const [label, ...rest] = line.trim().split(': ')
    result.set(label.split(' ')[0], rest.join(': '))
  }
  return result
}

export interface LifeItem { section: string; name: string; fields: [key: string, value: string][] }

/** 검증을 통과한 일생 해석 문서의 `###` 항목을 순서대로 읽는다. */
export function readLifeItems(text: string): LifeItem[] {
  const items: LifeItem[] = []
  let section = ''
  for (const line of text.split('\n')) {
    if (line.startsWith('## ')) section = line.slice(3).trim()
    else if (line.startsWith('### ')) items.push({ section, name: line.slice(4).trim(), fields: [] })
    else {
      const match = line.match(/^([^:]+):\s?(.*)$/)
      if (match != null && items.length > 0) items.at(-1)!.fields.push([match[1], match[2].trim()])
    }
  }
  return items
}

export function checkLifeDocument(text: string, spec: LifeSpec): string[] {
  const errors: string[] = []
  const report = (line: number | null, message: string) => errors.push(line == null ? message : `${line}: ${message}`)
  const lines = text.split('\n')

  if (lines[0] !== spec.title) report(1, `첫 줄은 '${spec.title}'이어야 한다`)

  const firstSection = lines.findIndex((line) => line.startsWith('## '))
  const preamble = lines.slice(1, firstSection === -1 ? undefined : firstSection)
  let identityIndex = -1
  if (spec.identity != null) {
    const { key: identityKey, file } = spec.identity
    identityIndex = preamble.findIndex((line) => line.startsWith(`${identityKey}:`))
    if (identityIndex === -1) {
      report(null, `${identityKey} 줄이 없다`)
    } else {
      const written = preamble[identityIndex].slice(identityKey.length + 1).trim().split(/\s+/).join(' ')
      const expected = spec.identity.expected.split(/\s+/).join(' ')
      if (written !== expected) report(identityIndex + 2, `${identityKey} 불일치 — 문서 ${written}, ${file} ${expected}`)
    }
  }
  preamble.forEach((line, index) => {
    if (line.trim() !== '' && index !== identityIndex) report(index + 2, '섹션 밖의 줄이다')
  })

  const sections = new Map<string, Item[]>()
  let section: string | null = null
  let item: Item | null = null
  lines.forEach((textLine, index) => {
    if (firstSection === -1 || index < firstSection) return
    const line = index + 1
    if (textLine.startsWith('## ')) {
      section = textLine.slice(3).trim()
      sections.set(section, [])
      item = null
      return
    }
    if (textLine.startsWith('### ')) {
      item = { name: textLine.slice(4).trim(), fields: new Map() }
      sections.get(section!)!.push(item)
      return
    }
    if (textLine.trim() === '') return
    if (item == null) return report(line, `${section}: 항목 밖의 줄이다`)
    const where = `${section} > ${(item as Item).name}`
    const match = textLine.match(/^([^:]+):\s?(.*)$/)
    if (match == null) return report(line, `${where}: '키: 값' 필드가 아닌 줄이다`)
    const [, key, value] = match
    const sectionSpec = spec.sections.find(({ name }) => name === section)
    if (sectionSpec != null && !itemSpec(sectionSpec, (item as Item).name).fields.includes(key)) return report(line, `${where}: 알 수 없는 필드 '${key}'`)
    const fields = (item as Item).fields
    fields.set(key, [...(fields.get(key) ?? []), { value: value.trim(), line }])
  })

  const order = [...sections.keys()]
  const expectedOrder = spec.sections.map(({ name }) => name)
  if (order.join() !== expectedOrder.join()) {
    report(null, `섹션은 ${expectedOrder.join(', ')} 순서여야 한다 (실제: ${order.join(', ')})`)
  }

  const cast = spec.sections.find(({ name }) => name === '인물 사전')?.items ?? []
  const cited = { judgment: new Set<string>(), derived: false }
  const { citations } = spec

  for (const sectionSpec of spec.sections) {
    const items = sections.get(sectionSpec.name)
    if (items == null) continue
    const names = items.map(({ name }) => name)
    if (sectionSpec.extraItems) {
      if (names.slice(0, sectionSpec.items.length).join() !== sectionSpec.items.join()) {
        report(null, `${sectionSpec.name}: 항목은 ${sectionSpec.items.join(', ')}으로 시작해야 한다 (실제: ${names.join(', ')})`)
      }
    } else if (names.join() !== sectionSpec.items.join()) {
      report(null, `${sectionSpec.name}: 항목은 ${sectionSpec.items.join(', ')} 순서여야 한다 (실제: ${names.join(', ')})`)
    }
    if (sectionSpec.livelihood != null && !names.some(isLivelihood)) {
      report(null, `${sectionSpec.name}: '${LIVELIHOOD_PREFIX}<이름>' 생업 항목이 하나 이상 있어야 한다`)
    }
    const talents = names.filter((name) => !isLivelihood(name))

    for (const { name, fields } of items) {
      const where = `${sectionSpec.name} > ${name}`
      const { fields: required, stageFields } = itemSpec(sectionSpec, name)
      for (const key of required) {
        const entries = fields.get(key) ?? []
        if (entries.length === 0) report(null, `${where}: ${key} 필드가 없다`)
        for (const entry of entries.slice(1)) report(entry.line, `${where}: ${key} 필드가 두 번 이상 있다`)
        if (entries[0]?.value === '') report(entries[0].line, `${where}: ${key} 값이 비어 있다`)
        const allowed = sectionSpec.values?.[key]
        if (allowed != null && entries[0] != null && entries[0].value !== '' && !allowed.includes(entries[0].value)) {
          report(entries[0].line, `${where}: ${key}은 ${allowed.join(', ')} 중 하나다 (실제: ${entries[0].value})`)
        }
      }
      const field = (key: string) => fields.get(key)?.[0]

      const luck = field('운')
      const expectedLuck = spec.luck?.expected.get(name)
      if (luck != null && spec.luck != null && expectedLuck == null) {
        report(luck.line, `${where}: ${spec.luck.file}에 이 단계의 운 대응 줄이 없다`)
      } else if (luck != null && luck.value !== '' && expectedLuck != null && luck.value !== expectedLuck) {
        report(luck.line, `${where}: 운 불일치 — 문서 ${luck.value}, ${spec.luck!.file} ${expectedLuck}`)
      }

      const ties = field('인연')
      if (ties != null && ties.value !== '') {
        for (const tie of ties.value.split(',').map((part) => part.trim())) {
          if (!cast.includes(tie)) report(ties.line, `${where}: 인물 사전에 없는 인연 '${tie}'`)
        }
      }

      if (sectionSpec.livelihood != null && isLivelihood(name)) {
        const modern = MODERN_LIVELIHOOD_WORDS.filter((word) => name.includes(word))
        if (modern.length > 0) report(null, `${where}: 생업 이름에 현대 제도·기술의 말(${modern.join(', ')})을 쓰지 않는다 — 이세계에서도 성립하는 일의 이름으로 쓴다`)
        const used = field('쓰인 재능')
        if (used != null && used.value !== '') {
          for (const talent of used.value.split(',').map((part) => part.trim())) {
            if (!talents.includes(talent)) report(used.line, `${where}: 같은 섹션에 없는 재능 '${talent}'`)
          }
        }
      }

      for (const key of stageFields) {
        const entry = field(key)
        if (entry != null && entry.value !== '' && !STAGE_NAMES.some((stage) => entry.value.includes(stage))) {
          report(entry.line, `${where}: ${key}에 생애 단계 이름이 없다`)
        }
      }

      if (citations == null) continue
      const { facts, chart, judgment, derived } = citations
      const evidence = field('근거')
      if (evidence != null && evidence.value !== '' && !HAS_CITATION.test(evidence.value)) report(evidence.line, `${where}: 근거에 인용이 없다`)

      for (const entries of fields.values()) for (const { value, line } of entries) {
        for (const [, source, target] of value.matchAll(CITATION)) {
          if (source === 'facts' && !facts.items.has(target)) report(line, `${where}: ${facts.file}에 없는 항목 [facts:${target}]`)
          if (source === 'chart') {
            if (chart.forbidden?.includes(target)) report(line, `${where}: 일생 해석에 쓰지 않는 절 [chart:${target}]`)
            else if (!chart.names.has(target)) report(line, `${where}: ${chart.file}에 없는 절·위치 [chart:${target}]`)
          }
          if (source === 'judgment') {
            if (judgment.sections.has(target)) cited.judgment.add(target)
            else report(line, `${where}: ${judgment.file}에 없는 섹션 [judgment:${target}]`)
          }
          if (source === 'derived') {
            if (derived?.items.has(target)) cited.derived = true
            else report(line, `${where}: ${derived?.file ?? '판단 파생 사실'}에 없는 항목 [derived:${target}]`)
          }
        }
      }
    }
  }

  if (citations != null) {
    const uncited = [...citations.judgment.sections].filter((name) => !cited.judgment.has(name))
    if (uncited.length > 0) report(null, `1차 판단 섹션을 인용하지 않았다: ${uncited.join(', ')}`)
    if (citations.derived != null && !cited.derived) report(null, '판단 파생 사실을 인용하지 않았다')
  }

  return errors
}
