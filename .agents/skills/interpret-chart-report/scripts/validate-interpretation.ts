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
export type SpecialistIds = Readonly<Record<System, ReadonlySet<string>>>

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

function fieldValue(text: string, label: string): string | undefined {
  const value = text.match(new RegExp(`^${label}:[^\\S\\r\\n]*([^\\r\\n]*)$`, 'm'))?.[1].trim()
  return value === '' ? undefined : value
}

export type InterpretationDiagnostic = { code: string; message: string; item?: string; field?: string; line?: number }

/** Diagnose the complete structural handoff without quoting source prose. */
export function diagnoseInterpretation(markdown: string, specialistIds?: SpecialistIds): InterpretationDiagnostic[] {
  const issues: InterpretationDiagnostic[] = []
  const lineAt = (offset: number) => markdown.slice(0, Math.max(0, offset)).split('\n').length
  const add = (code: string, message: string, offset = 0, item?: string, field?: string) => issues.push({ code, message, line: lineAt(offset), ...(item ? { item } : {}), ...(field ? { field } : {}) })
  if (!markdown.trim()) add('empty-document', 'Interpretation document is empty.')
  if (RESPONSIBILITY_AVOIDANCE.test(markdown)) add('field-content', 'Responsibility avoidance wording is prohibited.', markdown.search(RESPONSIBILITY_AVOIDANCE))
  let prior = -1
  for (const heading of REQUIRED_HEADINGS) {
    const index = markdown.indexOf(heading)
    if (index < 0 || index <= prior || markdown.indexOf(heading, index + heading.length) !== -1) add('required-heading', `Required heading missing, duplicated, or out of order: ${heading}`, Math.max(0, index), undefined, heading)
    prior = index
  }
  for (const [heading, next, fields] of [
    ['### 공통 핵심축', '### 체계별 고유 통찰', ['핵심 욕구', '반복 갈등', '의사결정 기준']],
    ['### 영역 간 작동 구조', '### 시간에 따른 변화', ['내적 동기', '행동 방식', '환경 반응', '반복 결과']],
    ['### 시간에 따른 변화', '## 핵심 해석 항목', ['유지', '변화']],
  ] as const) {
    const block = section(markdown, heading, next)
    for (const field of fields) if (fieldValue(block, field) == null) add('field-content', 'Required section field is empty or missing.', markdown.indexOf(heading), undefined, field)
    if (!hasValidEvidence(fieldValue(block, '근거') ?? '', specialistIds, 2)) add('item-evidence', 'Section requires valid evidence from at least two systems.', markdown.indexOf(heading), undefined, '근거')
  }
  const unique = section(markdown, '### 체계별 고유 통찰', '### 영역 간 작동 구조')
  for (const [label, system] of [['사주', 'S'], ['자미두수', 'Z'], ['서양 점성술', 'N']] as const) {
    const match = unique.match(new RegExp(`^- ${label} 고유:[^\\S\\r\\n]*([^\\r\\n]*)[^\\S\\r\\n]+\\(근거:[^\\S\\r\\n]*([^()\\r\\n]+)\\)[^\\S\\r\\n]*$`, 'm'))
    const ids = citedIds(match?.[2] ?? '')
    if (!match || !match[1].trim() || !ids.length || ids.some(id => id[0] !== system || (specialistIds != null && !specialistIds[system].has(id)))) add('item-evidence', 'System-specific insight requires content and valid evidence from its own system.', markdown.indexOf('### 체계별 고유 통찰'), undefined, `${label} 고유`)
  }
  const start = Math.max(0, markdown.indexOf('## 핵심 해석 항목'))
  const items = markdown.slice(start)
  const matches = [...items.matchAll(/^### (I-\d{2})\s*$/gm)]
  if (!matches.length) add('item-field', 'At least one interpretation item is required.', start)
  const domains = new Set<string>(), covered = new Set<string>()
  for (const [index, match] of matches.entries()) {
    const offset = start + match.index
    const block = items.slice(match.index + match[0].length, matches[index + 1]?.index ?? items.length)
    const item = match[1]
    const report = (code: string, message: string, field?: string) => add(code, message, field && block.indexOf(`${field}:`) >= 0 ? offset + match[0].length + block.indexOf(`${field}:`) : offset, item, field)
    if (item !== `I-${String(index + 1).padStart(2, '0')}`) report('item-sequence', 'Item IDs must be sequential.')
    for (const field of ['영역', '연결 영역', '관계', '근거', '해석', '작동 사슬', '양면성', '조건']) if (fieldValue(block, field) == null) report('item-field', 'Required item field is empty or missing.', field)
    const domain = fieldValue(block, '영역'), linked = fieldValue(block, '연결 영역'), relationship = fieldValue(block, '관계'), evidence = fieldValue(block, '근거') ?? ''
    if (domain) domains.add(domain)
    for (const id of citedIds(evidence)) covered.add(id)
    if (!REQUIRED_DOMAINS.includes(domain as never)) report('item-domain', 'Unsupported item domain.', '영역')
    if (!REQUIRED_DOMAINS.includes(linked as never) || linked === domain) report('item-domain', 'Linked domain must be supported and differ from the primary domain.', '연결 영역')
    if (!/^(일관|구체화|상충|고유)$/.test(relationship ?? '')) report('field-content', 'Unsupported relationship.', '관계')
    const chain = fieldValue(block, '작동 사슬')?.split('→') ?? []
    if (chain.length < 4 || chain.some(value => !value.trim())) report('item-chain', 'Operation chain requires at least four nonempty stages.', '작동 사슬')
    if (!/^강점:\s*[^|]*[^\s|][^|]*\|\s*취약점:\s*[^|]*[^\s|][^|]*$/.test(fieldValue(block, '양면성') ?? '')) report('item-duality', 'Duality requires nonempty strength and vulnerability.', '양면성')
    if (/^창작 시드:/m.test(block)) report('field-content', 'Creative seed fields are prohibited.', '창작 시드')
    if (!hasValidEvidence(evidence, specialistIds, relationship === '고유' ? 1 : 2) || (relationship === '고유' && new Set(citedIds(evidence).map(id => id[0])).size !== 1)) report('item-evidence', 'Evidence is unknown or does not meet the relationship system requirement.', '근거')
  }
  for (const domain of REQUIRED_DOMAINS) if (!domains.has(domain)) add('domain-coverage', `Required domain is not covered: ${domain}`, start, undefined, '영역')
  if (specialistIds) for (const ids of Object.values(specialistIds)) for (const id of ids) if (!covered.has(id)) add('evidence-coverage', `Specialist evidence is not covered: ${id}`, start, id, '근거')
  return issues
}

export function isValidInterpretation(markdown: string, specialistIds?: SpecialistIds): boolean {
  return diagnoseInterpretation(markdown, specialistIds).length === 0
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
        console.error(JSON.stringify({ issues: diagnoseInterpretation(markdown, specialistIds) }))
        process.exitCode = 1
      } else {
        console.log('Validated chart interpretation.')
      }
    } catch (error) {
      console.error(JSON.stringify({ issues: [{ code: 'input-error', message: error instanceof Error ? error.message : String(error) }] }))
      process.exitCode = 1
    }
  }
}
