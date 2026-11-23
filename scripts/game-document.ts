/**
 * 게임 단계 산출물(전투·세계·GDD)이 함께 쓰는 문서 읽기와 공통 검사. `## 섹션 > ### 항목 > 키: 값` 형식이다.
 * 계약: docs/spec/claude-game-design-flow.md 4·6절
 */
import { chartNameErrors } from './chart-names.ts'

export interface Field { key: string; value: string; line: number }
export interface Item { name: string; line: number; fields: Field[] }
export interface Section { name: string; line: number; fields: Field[]; items: Item[] }

export const CITATION = /\[([^\]:]+):([^\]]*)\]/g

/** 칸 배치 인벤토리·인접 칸 시너지·장비 슬롯 연결·슬롯 퍼즐을 가리키는 말. 의미 판단은 의미 검토가 한다. */
export const EXCLUDED_MECHANICS = ['슬롯', '그리드', '칸 배치', '인접 칸', '인벤토리 칸', '격자 인벤토리']

export type Report = (line: number | null, message: string) => void

/** 첫 줄 제목을 확인하고 섹션·항목·필드를 읽는다. 필드 줄이 아닌 줄은 보고한다. */
export function parseGameDocument(text: string, title: string, report: Report): Section[] {
  const sections: Section[] = []
  const lines = text.split('\n')
  if (lines[0] !== title) report(1, `첫 줄은 '${title}'이어야 한다`)
  for (const [index, raw] of lines.entries()) {
    const line = index + 1, value = raw.trimEnd()
    if (index === 0 || value === '') continue
    const section = sections.at(-1)
    if (value.startsWith('## ')) sections.push({ name: value.slice(3).trim(), line, fields: [], items: [] })
    else if (value.startsWith('### ') && section != null) section.items.push({ name: value.slice(4).trim(), line, fields: [] })
    else {
      const match = value.match(/^([^:\s][^:]*):\s*(.*)$/)
      if (match == null || section == null) report(line, '`키: 값` 필드 줄이 아니다')
      else (section.items.at(-1) ?? section).fields.push({ key: match[1].trim(), value: match[2].trim(), line })
    }
  }
  return sections
}

export function checkSectionOrder(sections: Section[], expected: string[], report: Report): void {
  const order = sections.map(({ name }) => name)
  if (order.join() !== expected.join()) report(null, `섹션은 ${expected.join(', ')} 순서여야 한다 (실제: ${order.join(', ')})`)
}

/** 필드가 required를 모두 갖고, allowed 밖의 필드와 빈 값이 없는지 확인하고 키 → 필드로 돌려준다. */
export function fieldsOf(where: string, owner: { line: number; fields: Field[] }, required: string[], report: Report, allowed = required): Map<string, Field> {
  for (const field of owner.fields) {
    if (!allowed.includes(field.key)) report(field.line, `${where}: 허용하지 않는 필드 '${field.key}'`)
    else if (field.value === '') report(field.line, `${where}: ${field.key} 값이 비었다`)
  }
  const map = new Map(owner.fields.map((field) => [field.key, field]))
  for (const key of required) if (!map.has(key)) report(owner.line, `${where}: ${key} 필드가 없다`)
  return map
}

export const citationsIn = (value: string) => [...value.matchAll(CITATION)].map(([, tag, target]) => ({ tag, target: target.trim() }))
export const targetsOf = (value: string, tag: string) => citationsIn(value).filter((citation) => citation.tag === tag).map(({ target }) => target)

/** 허용한 인용 종류와 그 대상 이름만 쓰였는지, 차트 명칭과 제외 메커니즘 용어가 없는지 확인한다. */
export function checkCitationsAndNames(text: string, targets: Record<string, Set<string>>, report: Report, excludedMechanics = false): void {
  const tags = Object.keys(targets)
  for (const [index, line] of text.split('\n').entries()) {
    for (const { tag, target } of citationsIn(line)) {
      if (!tags.includes(tag)) report(index + 1, `[${tag}:${target}] — 이 문서는 ${tags.map((name) => `[${name}:]`).join('·')}만 인용한다`)
      else if (!targets[tag].has(target)) report(index + 1, `[${tag}:${target}] — 인용 대상 문서에 없는 항목`)
    }
    if (excludedMechanics) for (const term of EXCLUDED_MECHANICS) if (line.includes(term)) report(index + 1, `쓰지 않는 메커니즘의 용어 '${term}'`)
  }
  for (const error of chartNameErrors(text)) {
    const [line, ...rest] = error.split(': ')
    report(Number(line), rest.join(': '))
  }
}

/** `###` 항목 이름 전체 */
export function itemNames(text: string): Set<string> {
  return new Set(text.split('\n').filter((line) => line.startsWith('### ')).map((line) => line.slice(4).trim()))
}

/** 섹션의 `###` 항목 이름 */
export function sectionItemNames(text: string, section: string): string[] {
  const names: string[] = []
  let current = ''
  for (const line of text.split('\n')) {
    if (line.startsWith('## ')) current = line.slice(3).trim()
    else if (line.startsWith('### ') && current === section) names.push(line.slice(4).trim())
  }
  return names
}

/** `##`·`###` 제목 이름 전체 */
export function headingNames(text: string): Set<string> {
  return new Set(text.split('\n').filter((line) => /^###? /.test(line)).map((line) => line.replace(/^###? /, '').trim()))
}
