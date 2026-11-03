import { readFile } from 'node:fs/promises'

const REQUIRED_HEADINGS = [
  '# 명식 창작 해석',
  '## 해석 원칙',
  '## 체계별 관찰',
  '### 사주팔자',
  '### 자미두수',
  '### 서양 점성술',
  '## 교차 체계 종합',
  '## 창작 모티프',
  '## 불확실성과 금지된 단정',
] as const

/** Return whether an interpretation follows the handoff contract. */
export function isValidInterpretation(markdown: string): boolean {
  if (markdown.trim().length === 0 || !markdown.includes('근거:')) return false
  let priorIndex = -1
  for (const heading of REQUIRED_HEADINGS) {
    const index = markdown.indexOf(heading)
    if (index <= priorIndex || markdown.indexOf(heading, index + heading.length) !== -1) return false
    priorIndex = index
  }
  return true
}

if (import.meta.main) {
  const path = process.argv[2]
  if (path == null) {
    console.error('Usage: bun validate-interpretation.ts <chart-interpretation.md>')
    process.exitCode = 2
  } else {
    try {
      if (!isValidInterpretation(await readFile(path, 'utf8'))) {
        console.error('Interpretation is empty, lacks evidence, or violates the required section contract.')
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
