/**
 * 체계별 1차 판단 문서의 공통 구조(제목·신원 줄·섹션·필드·인용·대안·뒤집힘)를 검사한다.
 * 체계마다 다른 것(섹션과 허용값, 신원 줄, 인용 대상, 서로 달라야 할 결론)은 JudgmentSpec으로 받는다.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_FIELDS = ['결론', '근거', '대안', '뒤집힘']
const CITATION = /\[(facts|chart):([^\]]*)\]/g
const HAS_CITATION = /\[(facts|chart):[^\]]*\]/

export interface JudgmentSection {
  name: string
  /** 결론 허용값. null은 비어 있지만 않으면 되는 자유 텍스트 */
  allowed: string[] | null
  /** 이 섹션에만 있는 추가 필드와 허용값 */
  extra?: { key: string; allowed: string[] }
}

export interface JudgmentSpec {
  title: string
  /** 첫 섹션 앞의 '<key>: <값>' 줄. 공백을 하나로 줄여 expected와 비교한다. */
  identity: { key: string; expected: string }
  sections: JudgmentSection[]
  facts: { file: string; items: Set<string> }
  chart: { file: string; names: Set<string>; forbidden?: string[] }
  /** 결론이 서로 달라야 하는 섹션 묶음 */
  distinct?: string[][]
}

interface Field { value: string; line: number }

/** 이름 뒤 ' (정의)'나 ':' 앞까지가 항목 이름이다. */
function itemName(line: string): string {
  return line.split(/ \(|:/)[0].trim()
}

/** 들여쓰지 않은 '이름 (정의): 값' 줄 */
export function factItems(facts: string): Set<string> {
  return new Set(facts.split('\n').filter((line) => /^\S/.test(line) && line.includes(':')).map(itemName))
}

/** 구분선(─ 또는 ═) 바로 위의 들여쓰지 않은 줄이 절 제목이다. 표 행은 줄 전체가 이름이 되어 인용과 맞지 않는다. */
export function chartTitles(chart: string): string[] {
  const lines = chart.split('\n')
  return lines.filter((line, index) => /^\S/.test(line) && /^[─═]/.test(lines[index + 1] ?? '')).map(itemName)
}

export function checkJudgmentDocument(judgment: string, spec: JudgmentSpec): string[] {
  const errors: string[] = []
  const report = (line: number | null, message: string) => errors.push(line == null ? message : `${line}: ${message}`)
  const extraOwners = new Map(spec.sections.flatMap((section) => section.extra ? [[section.extra.key, section.name] as const] : []))
  const knownFields = [...BASE_FIELDS, ...extraOwners.keys()]
  const lines = judgment.split('\n')

  if (lines[0] !== spec.title) report(1, `첫 줄은 '${spec.title}'이어야 한다`)

  const { key: identityKey } = spec.identity
  const firstSection = lines.findIndex((line) => line.startsWith('## '))
  const preamble = lines.slice(1, firstSection === -1 ? undefined : firstSection)
  const identityIndex = preamble.findIndex((line) => line.startsWith(`${identityKey}:`))
  if (identityIndex === -1) {
    report(null, `${identityKey} 줄이 없다`)
  } else {
    const written = preamble[identityIndex].slice(identityKey.length + 1).trim().split(/\s+/).join(' ')
    const expected = spec.identity.expected.split(/\s+/).join(' ')
    if (written !== expected) report(identityIndex + 2, `${identityKey} 불일치 — 문서 ${written}, ${spec.chart.file} ${expected}`)
  }
  preamble.forEach((line, index) => {
    if (line.trim() !== '' && index !== identityIndex) report(index + 2, '섹션 밖의 줄이다')
  })

  const sections = new Map<string, Map<string, Field[]>>()
  let current: { name: string; fields: Map<string, Field[]> } | null = null
  lines.forEach((text, index) => {
    if (index < firstSection || firstSection === -1) return
    const line = index + 1
    if (text.startsWith('## ')) {
      current = { name: text.slice(3).trim(), fields: new Map() }
      sections.set(current.name, current.fields)
      return
    }
    if (text.trim() === '' || current == null) return
    const match = text.match(/^([^:\s]+):\s?(.*)$/)
    if (match == null) return report(line, `${current.name}: '키: 값' 필드가 아닌 줄이다`)
    const [, key, value] = match
    if (!knownFields.includes(key)) return report(line, `${current.name}: 알 수 없는 필드 '${key}'`)
    current.fields.set(key, [...(current.fields.get(key) ?? []), { value: value.trim(), line }])
  })

  const order = [...sections.keys()]
  const expectedOrder = spec.sections.map(({ name }) => name)
  if (order.join() !== expectedOrder.join()) {
    report(null, `섹션은 ${expectedOrder.join(', ')} 순서여야 한다 (실제: ${order.join(', ')})`)
  }

  const conclusions = new Map<string, Field>()
  for (const { name, allowed, extra } of spec.sections) {
    const fields = sections.get(name)
    if (fields == null) continue
    for (const key of knownFields) {
      const entries = fields.get(key) ?? []
      const owner = extraOwners.get(key)
      if (owner != null && owner !== name) {
        for (const entry of entries) report(entry.line, `${name}: ${key} 필드는 ${owner} 섹션에만 쓴다`)
        continue
      }
      if (entries.length === 0) report(null, `${name}: ${key} 필드가 없다`)
      for (const entry of entries.slice(1)) report(entry.line, `${name}: ${key} 필드가 두 번 이상 있다`)
    }
    const field = (key: string) => fields.get(key)?.[0]

    const checkValue = (label: string, value: string, line: number) => {
      if (allowed != null && !allowed.includes(value)) report(line, `${name}: ${label} '${value}' — 허용값 ${allowed.join(' · ')}`)
    }
    const conclusion = field('결론')
    if (conclusion != null) {
      if (conclusion.value === '') report(conclusion.line, `${name}: 결론이 비어 있다`)
      else checkValue('결론', conclusion.value, conclusion.line)
      if (allowed == null || allowed.includes(conclusion.value)) conclusions.set(name, conclusion)
    }

    const extraField = extra && field(extra.key)
    if (extra && extraField != null && !extra.allowed.includes(extraField.value)) {
      report(extraField.line, `${name}: ${extra.key} '${extraField.value}' — 허용값 ${extra.allowed.join(' · ')}`)
    }

    const evidence = field('근거')
    if (evidence != null && !HAS_CITATION.test(evidence.value)) report(evidence.line, `${name}: 근거에 인용이 없다`)

    const alternative = field('대안')
    if (alternative != null) {
      const separator = alternative.value.indexOf(' — ')
      const value = separator === -1 ? '' : alternative.value.slice(0, separator).trim()
      if (value === '') {
        report(alternative.line, `${name}: 대안은 '<값> — <설명>' 형태여야 한다`)
      } else {
        checkValue('대안', value, alternative.line)
        if (value === conclusion?.value) report(alternative.line, `${name}: 대안 값이 결론과 같다 (${value})`)
        if (!HAS_CITATION.test(alternative.value.slice(separator))) report(alternative.line, `${name}: 대안 설명에 인용이 없다`)
      }
    }

    const flip = field('뒤집힘')
    if (flip != null && flip.value === '') report(flip.line, `${name}: 뒤집힘이 비어 있다`)

    for (const entries of fields.values()) for (const { value, line } of entries) {
      for (const [, source, item] of value.matchAll(CITATION)) {
        if (source === 'facts' && !spec.facts.items.has(item)) report(line, `${name}: ${spec.facts.file}에 없는 항목 [facts:${item}]`)
        if (source !== 'chart') continue
        if (spec.chart.forbidden?.includes(item)) report(line, `${name}: 1차 판단에 쓰지 않는 절 [chart:${item}]`)
        else if (!spec.chart.names.has(item)) report(line, `${name}: ${spec.chart.file}에 없는 절·위치 [chart:${item}]`)
      }
    }
  }

  for (const group of spec.distinct ?? []) {
    group.forEach((later, laterIndex) => {
      const value = conclusions.get(later)
      for (const earlier of group.slice(0, laterIndex)) {
        if (value != null && conclusions.get(earlier)?.value === value.value) {
          report(value.line, `${later}: 결론이 ${earlier}과 같다 (${value.value})`)
        }
      }
    })
  }

  return errors
}

/** 차트 디렉터리의 세 파일을 읽어 검사하고 결과로 종료한다. */
export function runJudgmentCli(script: string, files: { judgment: string; chart: string; facts: string },
  check: (texts: { judgment: string; chart: string; facts: string }) => string[]): never {
  const dir = process.argv[2]
  if (dir == null) {
    console.error(`usage: bun scripts/${script} <차트 디렉터리>`)
    process.exit(1)
  }
  const read = (file: string) => {
    try {
      return readFileSync(join(dir, file), 'utf8')
    } catch {
      console.error(`읽을 수 없음: ${join(dir, file)}`)
      process.exit(1)
    }
  }
  const errors = check({ judgment: read(files.judgment), chart: read(files.chart), facts: read(files.facts) })
  for (const error of errors) console.log(error)
  process.exit(errors.length > 0 ? 1 : 0)
}
