import { readFile } from 'node:fs/promises'

const REQUIRED_HEADINGS = [
  '# 명식 해석',
  '## 해석 원칙',
  '## 체계별 관찰',
  '### 사주팔자',
  '### 자미두수',
  '### 서양 점성술',
  '## 교차 체계 종합',
  '## 핵심 해석 항목',
  '## 불확실성과 금지된 단정',
] as const

/** Return whether an interpretation follows the handoff contract. */
export function isValidInterpretation(markdown: string): boolean {
  if (markdown.trim().length === 0) return false
  let priorIndex = -1
  for (const heading of REQUIRED_HEADINGS) {
    const index = markdown.indexOf(heading)
    if (index <= priorIndex || markdown.indexOf(heading, index + heading.length) !== -1) return false
    priorIndex = index
  }

  const itemsStart = markdown.indexOf('## 핵심 해석 항목')
  const itemsEnd = markdown.indexOf('## 불확실성과 금지된 단정')
  const items = markdown.slice(itemsStart, itemsEnd)
  const matches = [...items.matchAll(/^### (I-\d{2})\s*$/gm)]
  if (matches.length === 0) return false

  return matches.every((match, index) => {
    if (match[1] !== `I-${String(index + 1).padStart(2, '0')}`) return false
    const blockStart = match.index + match[0].length
    const blockEnd = matches[index + 1]?.index ?? items.length
    const block = items.slice(blockStart, blockEnd)
    return /^해석:\s*\S.+$/m.test(block) && /^근거:\s*\S.+$/m.test(block)
  })
}

if (import.meta.main) {
  const path = process.argv[2]
  if (path == null) {
    console.error('Usage: bun validate-interpretation.ts <chart-interpretation.md>')
    process.exitCode = 2
  } else {
    try {
      if (!isValidInterpretation(await readFile(path, 'utf8'))) {
        console.error('Interpretation is empty or violates the required section and interpretation-item contract.')
        process.exitCode = 1
      } else {
        console.log('Validated chart interpretation.')
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    }
  }
}
