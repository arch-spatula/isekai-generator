import { readFile } from 'node:fs/promises'

const CONTRACTS = {
  saju: { prefix: 'S', conditional: ['八字關係', '神殺', '坐法', '引從法'], headings: ['# 사주팔자 심층 해석', '## 계산 전제와 불확실성', '## 원국과 십신 구조', '## 팔자 관계', '## 신살', '## 좌법과 인종법', '## 대운', '## 원문 항목 검토표', '## 전문 해석 항목', '## 한계와 금지된 단정'] },
  ziwei: { prefix: 'Z', conditional: [], headings: ['# 자미두수 심층 해석', '## 계산 전제와 불확실성', '## 명반 기본 구조', '## 십이궁과 성요', '## 본명 사화', '## 대한', '## 유년과 유월', '## 원문 항목 검토표', '## 전문 해석 항목', '## 한계와 금지된 단정'] },
  natal: { prefix: 'N', conditional: ['Angles', 'Houses', 'Chiron', 'Fortuna'], headings: ['# 네이탈 차트 심층 해석', '## 계산 전제와 불확실성', '## 앵글과 하우스', '## 행성 배치', '## 주요 애스펙트', '## 차트 내부 종합', '## 원문 항목 검토표', '## 전문 해석 항목', '## 한계와 금지된 단정'] },
} as const

export type ChartSystem = keyof typeof CONTRACTS

function sourceSection(system: ChartSystem, report: string): string {
  const starts = { saju: '四柱八字', ziwei: '紫微斗數 命盤', natal: 'Natal Chart' } as const
  const start = report.indexOf(starts[system])
  if (start === -1) return ''
  const next = system === 'saju'
    ? report.indexOf('紫微斗數 命盤', start)
    : system === 'ziwei' ? report.indexOf('Natal Chart', start) : -1
  return report.slice(start, next === -1 ? report.length : next)
}

function normalizedRows(source: string): string[] {
  return [...new Set(source.split('\n')
    .map(line => line.trim().replace(/\s+/g, ' '))
    .filter(line => line.length > 0 && !/^─+$/.test(line)))]
}

/** Return whether one specialist interpretation follows its handoff contract. */
export function isValidSystemInterpretation(system: ChartSystem, markdown: string, chartReport?: string): boolean {
  const contract = CONTRACTS[system]
  if (markdown.trim().length === 0) return false
  let priorIndex = -1
  for (const heading of contract.headings) {
    const index = markdown.indexOf(heading)
    if (index <= priorIndex || markdown.indexOf(heading, index + heading.length) !== -1) return false
    priorIndex = index
  }

  const items = markdown.slice(markdown.indexOf('## 전문 해석 항목'), markdown.indexOf('## 한계와 금지된 단정'))
  const matches = [...items.matchAll(new RegExp(`^### (${contract.prefix}-\\d{2})\\s*$`, 'gm'))]
  if (matches.length === 0) return false
  const itemsAreValid = matches.every((match, index) => {
    if (match[1] !== `${contract.prefix}-${String(index + 1).padStart(2, '0')}`) return false
    const block = items.slice(match.index + match[0].length, matches[index + 1]?.index ?? items.length)
    return /^해석:\s*\S.+$/m.test(block) && /^근거:\s*\S.+$/m.test(block)
  })
  if (!itemsAreValid || chartReport == null) return itemsAreValid
  const source = sourceSection(system, chartReport)
  if (source.length === 0) return false
  const rowsCovered = normalizedRows(source).every(row => markdown.includes(`- 검토: ${row}`))
  const absencesCovered = contract.conditional
    .filter(marker => !source.includes(marker))
    .every(marker => markdown.includes(`- 보고서에 없음: ${marker}`))
  return rowsCovered && absencesCovered
}

if (import.meta.main) {
  const [system, path, reportPath] = process.argv.slice(2)
  if (!(system in CONTRACTS) || path == null || reportPath == null) {
    console.error('Usage: bun validate-system-interpretation.ts <saju|ziwei|natal> <output.md> <chart-report.md>')
    process.exitCode = 2
  } else {
    try {
      const [markdown, report] = await Promise.all([readFile(path, 'utf8'), readFile(reportPath, 'utf8')])
      if (!isValidSystemInterpretation(system as ChartSystem, markdown, report)) {
        console.error('Specialist interpretation violates its required section or evidence contract.')
        process.exitCode = 1
      } else {
        console.log(`Validated ${system} specialist interpretation.`)
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    }
  }
}
