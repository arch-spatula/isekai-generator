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
  '## 통합 인물 구조',
  '### 공통 핵심축',
  '### 체계별 고유 통찰',
  '### 영역 간 작동 구조',
  '### 시간에 따른 변화',
  '## 핵심 해석 항목',
] as const

const REQUIRED_DOMAINS = [
  '성격과 기질',
  '직업과 적성',
  '재물',
  '연애와 배우자',
  '가족과 대인관계',
  '건강과 생활 리듬',
  '시기운',
] as const

const RESPONSIBILITY_AVOIDANCE = /예언(?:이|을|하지)|예측(?:이 아니다|하지)|단정하지|진단하지|확정하지|면책|주의 문구/

type System = 'S' | 'Z' | 'N'
type SpecialistIds = Readonly<Record<System, ReadonlySet<string>>>

function citedIds(text: string): string[] {
  return text.match(/[SZN]-\d{2}/g) ?? []
}

function hasValidEvidence(text: string, specialistIds: SpecialistIds | undefined, minimumSystems: number): boolean {
  const ids = citedIds(text)
  const systems = new Set(ids.map(id => id[0]))
  return systems.size >= minimumSystems
    && (specialistIds == null || ids.every(id => specialistIds[id[0] as System].has(id)))
}

function section(markdown: string, heading: string, nextHeading: string): string {
  const start = markdown.indexOf(heading) + heading.length
  return markdown.slice(start, markdown.indexOf(nextHeading, start))
}

/** Return whether an interpretation follows the handoff contract. */
export function isValidInterpretation(markdown: string, specialistIds?: SpecialistIds): boolean {
  if (markdown.trim().length === 0) return false
  if (RESPONSIBILITY_AVOIDANCE.test(markdown)) return false
  let priorIndex = -1
  for (const heading of REQUIRED_HEADINGS) {
    const index = markdown.indexOf(heading)
    if (index <= priorIndex || markdown.indexOf(heading, index + heading.length) !== -1) return false
    priorIndex = index
  }

  const coreAxis = section(markdown, '### 공통 핵심축', '### 체계별 고유 통찰')
  const coreFields = ['핵심 욕구', '반복 갈등', '의사결정 기준']
  if (!coreFields.every(field => (coreAxis.match(new RegExp(`^${field}:\\s*(\\S.+)$`, 'm'))?.[1].length ?? 0) >= 20)) return false
  const coreEvidence = coreAxis.match(/^근거:\s*(.+)$/m)?.[1]
  if (coreEvidence == null || !hasValidEvidence(coreEvidence, specialistIds, 2)) return false

  const uniqueInsights = section(markdown, '### 체계별 고유 통찰', '### 영역 간 작동 구조')
  const systemLabels: ReadonlyArray<readonly [string, System]> = [
    ['사주', 'S'],
    ['자미두수', 'Z'],
    ['서양 점성술', 'N'],
  ]
  for (const [label, system] of systemLabels) {
    const match = uniqueInsights.match(new RegExp(`^- ${label} 고유:\\s*(\\S.{30,})\\s+\\(근거:\\s*([^)]+)\\)\\s*$`, 'm'))
    if (match == null) return false
    const ids = citedIds(match[2])
    if (ids.length === 0 || ids.some(id => id[0] !== system)) return false
    if (specialistIds != null && ids.some(id => !specialistIds[system].has(id))) return false
  }

  const operation = section(markdown, '### 영역 간 작동 구조', '### 시간에 따른 변화')
  const operationFields = ['내적 동기', '행동 방식', '환경 반응', '반복 결과']
  if (!operationFields.every(field => (operation.match(new RegExp(`^${field}:\\s*(\\S.+)$`, 'm'))?.[1].length ?? 0) >= 20)) return false
  const operationEvidence = operation.match(/^근거:\s*(.+)$/m)?.[1]
  if (operationEvidence == null || !hasValidEvidence(operationEvidence, specialistIds, 2)) return false

  const time = section(markdown, '### 시간에 따른 변화', '## 핵심 해석 항목')
  if ((time.match(/^유지:\s*(\S.+)$/m)?.[1].length ?? 0) < 20) return false
  if ((time.match(/^변화:\s*(\S.+)$/m)?.[1].length ?? 0) < 20) return false
  const timeEvidence = time.match(/^근거:\s*(.+)$/m)?.[1]
  if (timeEvidence == null || !hasValidEvidence(timeEvidence, specialistIds, 2)) return false

  const itemsStart = markdown.indexOf('## 핵심 해석 항목')
  const items = markdown.slice(itemsStart)
  const matches = [...items.matchAll(/^### (I-\d{2})\s*$/gm)]
  if (matches.length === 0) return false

  const coveredDomains = new Set<string>()
  const coveredSpecialistIds = new Set<string>()
  const itemsAreValid = matches.every((match, index) => {
    if (match[1] !== `I-${String(index + 1).padStart(2, '0')}`) return false
    const blockStart = match.index + match[0].length
    const blockEnd = matches[index + 1]?.index ?? items.length
    const block = items.slice(blockStart, blockEnd)
    const domain = block.match(/^영역:\s*(.+?)\s*$/m)?.[1]
    const linkedDomain = block.match(/^연결 영역:\s*(.+?)\s*$/m)?.[1]
    const relationship = block.match(/^관계:\s*(일관|구체화|상충|고유)\s*$/m)
    const evidence = block.match(/^근거:\s*(.+)$/m)
    const reading = block.match(/^해석:\s*(\S.+)$/m)?.[1]
    const operationChain = block.match(/^작동 사슬:\s*(\S.+)$/m)?.[1]
    const duality = block.match(/^양면성:\s*(\S.+)$/m)?.[1]
    const condition = block.match(/^조건:\s*(\S.+)$/m)?.[1]
    if (domain != null) coveredDomains.add(domain)
    for (const id of citedIds(evidence?.[1] ?? '')) coveredSpecialistIds.add(id)
    return domain != null
      && REQUIRED_DOMAINS.includes(domain as typeof REQUIRED_DOMAINS[number])
      && linkedDomain != null
      && REQUIRED_DOMAINS.includes(linkedDomain as typeof REQUIRED_DOMAINS[number])
      && linkedDomain !== domain
      && relationship != null
      && reading != null && reading.length >= 80
      && operationChain != null && (operationChain.match(/→/g)?.length ?? 0) >= 3
      && duality != null && /강점:\s*\S.{15,}\|\s*취약점:\s*\S.{15,}/.test(duality)
      && condition != null && condition.length >= 30
      && !/^창작 시드:/m.test(block)
      && evidence != null
      && hasValidEvidence(evidence[1], specialistIds, relationship?.[1] === '고유' ? 1 : 2)
      && (relationship?.[1] !== '고유' || new Set(citedIds(evidence[1]).map(id => id[0])).size === 1)
  })
  const allSpecialistIdsAreCovered = specialistIds == null || Object.values(specialistIds)
    .every(ids => [...ids].every(id => coveredSpecialistIds.has(id)))
  return itemsAreValid
    && REQUIRED_DOMAINS.every(domain => coveredDomains.has(domain))
    && allSpecialistIdsAreCovered
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
