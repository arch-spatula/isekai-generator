import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
const domains = ['성격과 기질', '직업과 적성', '재물', '연애와 배우자', '가족과 대인관계', '건강과 생활 리듬', '시기운']
const headings = ['# 사주팔자 심층 해석', '## 계산 전제', '## 원국과 십신 구조', '## 팔자 관계', '## 신살', '## 좌법과 인종법', '## 대운', '## 전문 해석 항목']
export const syntheticSajuInterpretation = headings.join('\n') + '\n' + domains.map((domain, index) => `### S-0${index + 1}\n영역: ${domain}\n해상도: ${['원국 구조', '관계 작용', '운의 변화'][index % 3]}\n해석: ${'이 차트의 근거를 실제 생활의 선택과 반응 방식에 연결하여 강점과 마찰의 조건을 구체적으로 설명한다. '.repeat(2)}\n근거: S-E0000000000000001`).join('\n')


/** Synthetic durable acceptance records for progress gate tests; no local artifacts are read. */
export function seedDefensiveAcceptances(run: string): void {
  const variants = {
    saju: syntheticSajuInterpretation,
    ziwei: ['# 자미두수 심층 해석', '## 계산 전제', '## 명반 기본 구조', '## 십이궁과 성요', '## 본명 사화', '## 대한', '## 유년과 유월', '## 전문 해석 항목'].join('\n') + syntheticSajuInterpretation.slice(syntheticSajuInterpretation.indexOf('\n### S-01')).replaceAll('S-', 'Z-').replaceAll('원국 구조', '궁위 역할').replaceAll('관계 작용', '성요 상태').replaceAll('운의 변화', '시간 층위'),
    natal: ['# 네이탈 차트 심층 해석', '## 계산 전제', '## 앵글과 하우스', '## 행성 배치', '## 주요 애스펙트', '## 차트 내부 종합', '## 전문 해석 항목'].join('\n') + syntheticSajuInterpretation.slice(syntheticSajuInterpretation.indexOf('\n### S-01')).replaceAll('S-', 'N-').replaceAll('원국 구조', '심리 기능').replaceAll('관계 작용', '삶의 영역').replaceAll('운의 변화', '내적 역동'),
  }
  const put = (path: string, text: string): void => { mkdirSync(dirname(join(run, path)), { recursive: true }); writeFileSync(join(run, path), text) }
  put('docs/GDD/chart-evidence.json', JSON.stringify({ version: 1, systems: Object.fromEntries(['saju', 'ziwei', 'natal'].map((system, index) => [system, [{ id: ['S', 'Z', 'N'][index] + '-E0000000000000001', text: 'fixture' }]])) }))
  for (const [system, text] of Object.entries(variants)) {
    const sha256 = createHash('sha256').update(text).digest('hex')
    const source = `garbage/attempts/${system}/001/interpretation.md`
    const candidate = `garbage/defensive-editing/${system}/001/candidate.md`
    const output = `docs/GDD/${system}-interpretation.md`
    for (const path of [source, candidate, output]) put(path, text)
    const accepted = { system, attempt: 1, editAttempt: 1, output, source, sourceSha256: sha256, candidate, sha256, acceptedAt: '2026-11-10T00:00:00.000Z' }
    for (const path of [`garbage/attempts/${system}/accepted.json`, `garbage/defensive-editing/${system}/accepted.json`]) put(path, JSON.stringify(accepted))
    put(`garbage/defensive-editing/${system}/001/result.json`, JSON.stringify({ system, attempt: 1, scope: 'sentence', status: 'passed', errors: [], sha256, sourceSha256: sha256, unresolved: [], calls: 1, usage: null }))
  }
}
