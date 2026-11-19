/**
 * 사주 1차 판단 문서(saju-judgment.md)의 구조와 근거 인용을 검사한다.
 * 판단 내용의 옳고 그름은 보지 않는다. 계약: docs/spec/saju-first-pass-judgment.md
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const TITLE = '# 四柱 1차 판단'
const ELEMENTS = ['木', '火', '土', '金', '水']
/** 결론 허용값. null은 비어 있지만 않으면 되는 자유 텍스트 */
const SECTIONS: [string, string[] | null][] = [
  ['일간 강약', ['신강', '신약', '중화']],
  ['격국', null],
  ['조후', ['한습', '난조', '불필요']],
  ['용신', ELEMENTS],
  ['희신', ELEMENTS],
  ['기신', ELEMENTS],
]
const BASES = ['억부', '조후', '통관', '병약', '전왕']
const FIELDS = ['결론', '기준', '근거', '대안', '뒤집힘']
const POSITIONS = ['時', '日', '月', '年'].flatMap((pillar) => ['干', '支', '柱'].map((part) => pillar + part))
const CITATION = /\[(facts|chart):([^\]]*)\]/g
const HAS_CITATION = /\[(facts|chart):[^\]]*\]/

interface Field { value: string; line: number }

export interface SajuJudgmentInput { judgment: string; chart: string; facts: string }

/** 이름 뒤 ' (정의)'나 ':' 앞까지가 항목 이름이다. */
function itemName(line: string): string {
  return line.split(/ \(|:/)[0].trim()
}

/** 들여쓰지 않은 '이름 (정의): 값' 줄 */
function factItems(facts: string): Set<string> {
  return new Set(facts.split('\n').filter((line) => /^\S/.test(line) && line.includes(':')).map(itemName))
}

/** 구분선 바로 위의 들여쓰지 않은 줄이 절 제목이다. 표 행은 줄 전체가 이름이 되어 인용과 맞지 않는다. */
function chartNames(chart: string): Set<string> {
  const lines = chart.split('\n')
  const titles = lines.filter((line, index) => /^\S/.test(line) && lines[index + 1]?.startsWith('─'))
  return new Set([...titles.map(itemName), ...POSITIONS])
}

/** 차트 표의 천간·지지 행에서 時日月年 간지를 읽는다. */
function chartPillars(chart: string): string {
  const row = (label: string) => chart.split('\n').find((line) => line.startsWith(label))!.split(/\s+/).slice(1)
  const stems = row('천간')
  const branches = row('지지')
  return stems.map((stem, index) => stem + branches[index]).join(' ')
}

export function checkSajuJudgment({ judgment, chart, facts }: SajuJudgmentInput): string[] {
  const errors: string[] = []
  const report = (line: number | null, message: string) => errors.push(line == null ? message : `${line}: ${message}`)
  const knownFacts = factItems(facts)
  const knownChart = chartNames(chart)
  const lines = judgment.split('\n')

  if (lines[0] !== TITLE) report(1, `첫 줄은 '${TITLE}'이어야 한다`)

  const firstSection = lines.findIndex((line) => line.startsWith('## '))
  const preamble = lines.slice(1, firstSection === -1 ? undefined : firstSection)
  const pillarsIndex = preamble.findIndex((line) => line.startsWith('원국:'))
  if (pillarsIndex === -1) {
    report(null, '원국 줄이 없다')
  } else {
    const written = preamble[pillarsIndex].slice('원국:'.length).trim().split(/\s+/).join(' ')
    const expected = chartPillars(chart)
    if (written !== expected) report(pillarsIndex + 2, `원국 불일치 — 문서 ${written}, saju-chart.md ${expected}`)
  }
  preamble.forEach((line, index) => {
    if (line.trim() !== '' && index !== pillarsIndex) report(index + 2, '섹션 밖의 줄이다')
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
    if (!FIELDS.includes(key)) return report(line, `${current.name}: 알 수 없는 필드 '${key}'`)
    current.fields.set(key, [...(current.fields.get(key) ?? []), { value: value.trim(), line }])
  })

  const order = [...sections.keys()]
  const expectedOrder = SECTIONS.map(([name]) => name)
  if (order.join() !== expectedOrder.join()) {
    report(null, `섹션은 ${expectedOrder.join(', ')} 순서여야 한다 (실제: ${order.join(', ')})`)
  }

  const conclusions = new Map<string, Field>()
  for (const [name, allowed] of SECTIONS) {
    const fields = sections.get(name)
    if (fields == null) continue
    const required = name === '용신' ? FIELDS : FIELDS.filter((key) => key !== '기준')
    for (const key of FIELDS) {
      const entries = fields.get(key) ?? []
      if (key === '기준' && name !== '용신') {
        for (const entry of entries) report(entry.line, `${name}: 기준 필드는 용신 섹션에만 쓴다`)
        continue
      }
      if (entries.length === 0 && required.includes(key)) report(null, `${name}: ${key} 필드가 없다`)
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

    const basis = field('기준')
    if (name === '용신' && basis != null && !BASES.includes(basis.value)) {
      report(basis.line, `${name}: 기준 '${basis.value}' — 허용값 ${BASES.join(' · ')}`)
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
        if (source === 'facts' && !knownFacts.has(item)) report(line, `${name}: saju-facts.md에 없는 항목 [facts:${item}]`)
        if (source === 'chart' && !knownChart.has(item)) report(line, `${name}: saju-chart.md에 없는 절·위치 [chart:${item}]`)
      }
    }
  }

  const favorable = conclusions.get('용신')
  const helpful = conclusions.get('희신')
  const hostile = conclusions.get('기신')
  if (favorable && helpful && helpful.value === favorable.value) report(helpful.line, `희신: 결론이 용신과 같다 (${helpful.value})`)
  if (favorable && hostile && hostile.value === favorable.value) report(hostile.line, `기신: 결론이 용신과 같다 (${hostile.value})`)
  if (helpful && hostile && hostile.value === helpful.value) report(hostile.line, `기신: 결론이 희신과 같다 (${hostile.value})`)

  return errors
}

if (import.meta.main) {
  const dir = process.argv[2]
  if (dir == null) {
    console.error('usage: bun scripts/check-saju-judgment.ts <차트 디렉터리>')
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
  const errors = checkSajuJudgment({ judgment: read('saju-judgment.md'), chart: read('saju-chart.md'), facts: read('saju-facts.md') })
  for (const error of errors) console.log(error)
  process.exit(errors.length > 0 ? 1 : 0)
}
