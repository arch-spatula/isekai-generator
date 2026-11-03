import { readFile } from 'node:fs/promises'

import type { ChartEvidenceManifest, EvidenceSystem } from '../../generate-chart-report/scripts/chart-evidence'

const CONTRACTS = {
  saju: { prefix: 'S', evidenceSystem: 'saju', resolutions: ['원국 구조', '관계 작용', '운의 변화'], headings: ['# 사주팔자 심층 해석', '## 계산 전제', '## 원국과 십신 구조', '## 팔자 관계', '## 신살', '## 좌법과 인종법', '## 대운', '## 전문 해석 항목'] },
  ziwei: { prefix: 'Z', evidenceSystem: 'ziwei', resolutions: ['궁위 역할', '성요 상태', '시간 층위'], headings: ['# 자미두수 심층 해석', '## 계산 전제', '## 명반 기본 구조', '## 십이궁과 성요', '## 본명 사화', '## 대한', '## 유년과 유월', '## 전문 해석 항목'] },
  natal: { prefix: 'N', evidenceSystem: 'natal', resolutions: ['심리 기능', '삶의 영역', '내적 역동'], headings: ['# 네이탈 차트 심층 해석', '## 계산 전제', '## 앵글과 하우스', '## 행성 배치', '## 주요 애스펙트', '## 차트 내부 종합', '## 전문 해석 항목'] },
} as const

export type ChartSystem = keyof typeof CONTRACTS

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

/** Return whether one specialist interpretation follows its handoff contract. */
export function isValidSystemInterpretation(system: ChartSystem, markdown: string, manifest?: ChartEvidenceManifest): boolean {
  const contract = CONTRACTS[system]
  if (markdown.trim().length === 0) return false
  if (RESPONSIBILITY_AVOIDANCE.test(markdown)) return false
  let priorIndex = -1
  for (const heading of contract.headings) {
    const index = markdown.indexOf(heading)
    if (index <= priorIndex || markdown.indexOf(heading, index + heading.length) !== -1) return false
    priorIndex = index
  }

  const items = markdown.slice(markdown.indexOf('## 전문 해석 항목'))
  const matches = [...items.matchAll(new RegExp(`^### (${contract.prefix}-\\d{2})\\s*$`, 'gm'))]
  if (matches.length === 0) return false
  const coveredDomains = new Set<string>()
  const coveredResolutions = new Set<string>()
  const coveredEvidenceIds = new Set<string>()
  const validEvidenceIds = new Set(manifest?.systems[contract.evidenceSystem as EvidenceSystem].map(item => item.id) ?? [])
  const itemsAreValid = matches.every((match, index) => {
    if (match[1] !== `${contract.prefix}-${String(index + 1).padStart(2, '0')}`) return false
    const block = items.slice(match.index + match[0].length, matches[index + 1]?.index ?? items.length)
    const domain = block.match(/^영역:\s*(.+?)\s*$/m)?.[1]
    const resolution = block.match(/^해상도:\s*(.+?)\s*$/m)?.[1]
    const reading = block.match(/^해석:\s*(\S.+)$/m)?.[1]
    const evidence = block.match(/^근거:\s*(\S.+)$/m)?.[1]
    const evidenceIds = evidence?.match(new RegExp(`${contract.prefix}-E[0-9a-f]{16}`, 'g')) ?? []
    if (domain != null) coveredDomains.add(domain)
    if (resolution != null) coveredResolutions.add(resolution)
    for (const id of evidenceIds) coveredEvidenceIds.add(id)
    return domain != null
      && REQUIRED_DOMAINS.includes(domain as typeof REQUIRED_DOMAINS[number])
      && resolution != null
      && (contract.resolutions as readonly string[]).includes(resolution)
      && reading != null && reading.length >= 80
      && !/^시드 가치:/m.test(block)
      && evidenceIds.length > 0
      && (manifest == null || evidenceIds.every(id => validEvidenceIds.has(id)))
  })
  const domainsAreComplete = REQUIRED_DOMAINS.every(domain => coveredDomains.has(domain))
  const resolutionsAreComplete = contract.resolutions.every(resolution => coveredResolutions.has(resolution))
  if (!itemsAreValid || !domainsAreComplete || !resolutionsAreComplete || manifest == null) {
    return itemsAreValid && domainsAreComplete && resolutionsAreComplete
  }
  return [...validEvidenceIds].every(id => coveredEvidenceIds.has(id))
}

if (import.meta.main) {
  const [system, path, evidencePath] = process.argv.slice(2)
  if (!(system in CONTRACTS) || path == null || evidencePath == null) {
    console.error('Usage: bun validate-system-interpretation.ts <saju|ziwei|natal> <output.md> <chart-evidence.json>')
    process.exitCode = 2
  } else {
    try {
      const [markdown, evidenceJson] = await Promise.all([readFile(path, 'utf8'), readFile(evidencePath, 'utf8')])
      const manifest = JSON.parse(evidenceJson) as ChartEvidenceManifest
      if (!isValidSystemInterpretation(system as ChartSystem, markdown, manifest)) {
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
