
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

export type InterpretationDiagnostic = { code: string; line?: number; itemId?: string; message: string }

/** Diagnose failures without copying interpretation text into logs. */
export function diagnoseSystemInterpretation(system: ChartSystem, markdown: string, manifest?: ChartEvidenceManifest): InterpretationDiagnostic[] {
  const contract = CONTRACTS[system]
  const errors: InterpretationDiagnostic[] = []
  const add = (code: string, message: string, index?: number, itemId?: string) => {
    errors.push({ code, message, ...(index == null ? {} : { line: markdown.slice(0, Math.max(0, index)).split('\n').length }), ...(itemId == null ? {} : { itemId }) })
  }
  if (markdown.trim().length === 0) add('empty-document', 'Interpretation is empty.')
  for (const match of markdown.matchAll(new RegExp(RESPONSIBILITY_AVOIDANCE.source, 'g'))) {
    add('responsibility-avoidance', 'Remove responsibility-avoidance wording and provide evidence-based interpretation.', match.index)
  }
  let priorIndex = -1
  for (const heading of contract.headings) {
    const index = markdown.indexOf(heading)
    if (index <= priorIndex || markdown.indexOf(heading, index + heading.length) !== -1) {
      add('section-contract', `Required section is missing, duplicated or out of order: ${heading}`, index < 0 ? undefined : index)
    }
    priorIndex = index
  }
  const start = markdown.indexOf('## 전문 해석 항목')
  const items = markdown.slice(start)
  const matches = [...items.matchAll(new RegExp(`^### (${contract.prefix}-\\d{2})\\s*$`, 'gm'))]
  if (matches.length === 0) add('missing-items', 'No specialist items found.')
  const coveredDomains = new Set<string>()
  const coveredResolutions = new Set<string>()
  const coveredEvidenceIds = new Set<string>()
  const validEvidenceIds = new Set(manifest?.systems[contract.evidenceSystem as EvidenceSystem].map(item => item.id) ?? [])
  for (const [index, match] of matches.entries()) {
    const itemId = match[1]
    const report = (code: string, message: string) => add(code, message, start + match.index!, itemId)
    if (itemId !== `${contract.prefix}-${String(index + 1).padStart(2, '0')}`) report('item-sequence', 'Specialist IDs must be sequential.')
    const block = items.slice(match.index! + match[0].length, matches[index + 1]?.index ?? items.length)
    const domain = block.match(/^영역:\s*(.+?)\s*$/m)?.[1]
    const resolution = block.match(/^해상도:\s*(.+?)\s*$/m)?.[1]
    const reading = block.match(/^해석:[ \t]*(\S[^\r\n]*)$/m)?.[1]
    const evidence = block.match(/^근거:\s*(\S.+)$/m)?.[1]
    const evidenceIds = evidence?.match(new RegExp(`${contract.prefix}-E[0-9a-f]{16}`, 'g')) ?? []
    if (domain != null) coveredDomains.add(domain)
    if (resolution != null) coveredResolutions.add(resolution)
    for (const id of evidenceIds) coveredEvidenceIds.add(id)
    if (domain == null || !REQUIRED_DOMAINS.includes(domain as typeof REQUIRED_DOMAINS[number])) report('item-domain', 'Item requires a supported life domain.')
    if (resolution == null || !(contract.resolutions as readonly string[]).includes(resolution)) report('item-resolution', 'Item requires a supported system resolution.')
    if (reading == null) report('item-reading', 'Item requires a non-empty interpretation.')
    if (/^시드 가치:/m.test(block)) report('creative-preselection', 'Specialist items must not preselect creative material.')
    if (evidenceIds.length === 0) report('item-evidence', 'Item requires system evidence IDs.')
    if (manifest != null && evidenceIds.some(id => !validEvidenceIds.has(id))) report('unknown-evidence', 'Item references an unknown system evidence ID.')
  }
  for (const domain of REQUIRED_DOMAINS) if (!coveredDomains.has(domain)) add('domain-coverage', `Missing life domain: ${domain}`)
  for (const resolution of contract.resolutions) if (!coveredResolutions.has(resolution)) add('resolution-coverage', `Missing system resolution: ${resolution}`)
  if (manifest != null && [...validEvidenceIds].some(id => !coveredEvidenceIds.has(id))) add('evidence-coverage', 'Not all supplied system evidence IDs are cited.')
  return errors
}

/** Preserve the boolean API used by existing callers. */
export function isValidSystemInterpretation(system: ChartSystem, markdown: string, manifest?: ChartEvidenceManifest): boolean {
  return diagnoseSystemInterpretation(system, markdown, manifest).length === 0
}

if (import.meta.main) { console.error('Use artifact-state finish --attempt <id> --claim <claim> --request <id>; validation reads its immutable DB input'); process.exitCode=2 }
