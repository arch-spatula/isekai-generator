import { readFile } from 'node:fs/promises'

const REQUIRED_HEADINGS = [
  '# 통합 차트 해석',
  '## 해석 원칙',
  '## 전문 해석 요약',
  '### 사주팔자',
  '### 자미두수',
  '### 서양 점성술',
  '## 교차 체계 비교',
  '### 일관된 해석',
  '### 구체성을 더하는 해석',
  '### 상충하는 해석',
  '## 핵심 해석 항목',
  '## 불확실성과 금지된 단정',
] as const

/** Return whether an interpretation follows the handoff contract. */
export function isValidInterpretation(markdown: string, specialistIds?: Readonly<Record<'S' | 'Z' | 'N', ReadonlySet<string>>>): boolean {
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
    const relationship = block.match(/^관계:\s*(일관|구체화|상충)\s*$/m)
    const evidence = block.match(/^근거:\s*(.+)$/m)
    const citedIds = evidence?.[1].match(/[SZN]-\d{2}/g) ?? []
    const citedSystems = new Set(citedIds.map(id => id[0]))
    return relationship != null
      && /^해석:\s*\S.+$/m.test(block)
      && citedSystems.size >= 2
      && (specialistIds == null || citedIds.every(id => specialistIds[id[0] as 'S' | 'Z' | 'N'].has(id)))
  })
}

if (import.meta.main) {
  const [path, sajuPath, ziweiPath, natalPath] = process.argv.slice(2)
  if (path == null || sajuPath == null || ziweiPath == null || natalPath == null) {
    console.error('Usage: bun validate-interpretation.ts <chart-interpretation.md> <saju.md> <ziwei.md> <natal.md>')
    process.exitCode = 2
  } else {
    try {
      if (new Set([path, sajuPath, ziweiPath, natalPath]).size !== 4) {
        throw new Error('Interpretation input and output paths must be distinct.')
      }
      const [markdown, ...specialists] = await Promise.all([path, sajuPath, ziweiPath, natalPath].map(file => readFile(file, 'utf8')))
      if (specialists.some(source => source.trim().length === 0)) throw new Error('Specialist interpretations must not be empty.')
      const specialistIds = {
        S: new Set([...specialists[0].matchAll(/^### (S-\d{2})\s*$/gm)].map(match => match[1])),
        Z: new Set([...specialists[1].matchAll(/^### (Z-\d{2})\s*$/gm)].map(match => match[1])),
        N: new Set([...specialists[2].matchAll(/^### (N-\d{2})\s*$/gm)].map(match => match[1])),
      }
      if (Object.values(specialistIds).some(ids => ids.size === 0)) throw new Error('Each specialist interpretation must contain its own IDs.')
      if (!isValidInterpretation(markdown, specialistIds)) {
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
