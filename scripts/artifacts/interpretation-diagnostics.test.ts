import { expect, test } from 'bun:test'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { diagnoseInterpretation, isValidInterpretation } from '../../.agents/skills/interpret-chart-report/scripts/validate-interpretation'
import { allocateRun, updateRun } from './artifact-run'
import { makeRepository } from './test-fixtures'

// Synthetic contract fixture: concise, evidence-bearing prose is valid regardless
// of its length; this does not claim to assess interpretation quality.
const domains = ['성격과 기질', '직업과 적성', '재물', '연애와 배우자', '가족과 대인관계', '건강과 생활 리듬', '시기운']
const valid = `# 통합 차트 해석
## 해석 원칙
## 전문 해석 요약
### 사주팔자
### 자미두수
### 서양 점성술
## 교차 체계 비교
### 일관된 해석
### 구체성을 더하는 해석
### 상충하는 해석
## 통합 인물 구조
### 공통 핵심축
핵심 욕구: 자율을 원한다.
반복 갈등: 간섭과 충돌한다.
의사결정 기준: 자율을 우선한다.
근거: S-01, Z-01
### 체계별 고유 통찰
- 사주 고유: 에너지를 아낀다. (근거: S-01)
- 자미두수 고유: 무대가 바뀐다. (근거: Z-01)
- 서양 점성술 고유: 내적 긴장이 있다. (근거: N-01)
### 영역 간 작동 구조
내적 동기: 자율을 원한다.
행동 방식: 기준을 정한다.
환경 반응: 간섭에 저항한다.
반복 결과: 홀로 부담한다.
근거: S-01, N-01
### 시간에 따른 변화
유지: 자율을 중시한다.
변화: 관심사가 바뀐다.
근거: S-01, Z-01
## 핵심 해석 항목
${domains.map((domain, index) => `### I-0${index + 1}
영역: ${domain}
연결 영역: ${domains[(index + 1) % domains.length]}
관계: 일관
해석: 간섭이 강하면 혼자 결정한다.
작동 사슬: 욕구 → 선택 → 마찰 → 고립
양면성: 강점: 결단 | 취약점: 고립
조건: 자율이 있을 때 몰입한다.
근거: S-01, Z-01, N-01`).join('\n')}
`
const ids = { S: new Set(['S-01']), Z: new Set(['Z-01']), N: new Set(['N-01']) }
const cases = [
  { field: '조건', value: '', code: 'item-field' },
  { field: '근거', value: '', code: 'item-evidence' },
  { field: '양면성', value: '강점: 결단 | 취약점:', code: 'item-duality' },
  { field: '작동 사슬', value: '욕구 → 행동 → 결과', code: 'item-chain' },
]
function changeItem(field: string, value: string): string {
  const start = valid.indexOf('### I-01')
  return valid.slice(0, start) + valid.slice(start).replace(new RegExp(`^${field}:.*$`, 'm'), `${field}: ${value}`)
}
function itemLine(markdown: string, field: string): number {
  const lines = markdown.split('\n'), start = lines.indexOf('### I-01')
  return lines.findIndex((text, index) => index > start && text.startsWith(`${field}:`)) + 1
}
for (const { field, value, code } of cases) {
  test(`diagnostics identify item, field and exact line for ${code}`, () => {
    const markdown = changeItem(field, value)
    expect(diagnoseInterpretation(markdown, ids)).toContainEqual(expect.objectContaining({ code, item: 'I-01', field, line: itemLine(markdown, field) }))
    expect(isValidInterpretation(markdown, ids)).toBe(false)
    expect(JSON.stringify(diagnoseInterpretation(markdown, ids))).not.toContain('간섭이 강하면 혼자 결정한다.')
  })
}
test('missing item fields and headings have actionable identities', () => {
  expect(diagnoseInterpretation(valid.replace(/^조건:.*\n/m, ''), ids)).toContainEqual(expect.objectContaining({ code: 'item-field', item: 'I-01', field: '조건', line: expect.any(Number) }))
  expect(diagnoseInterpretation(valid.replace('### 시간에 따른 변화', ''), ids)).toContainEqual(expect.objectContaining({ code: 'required-heading' }))
})
test('boolean API agrees with diagnostics across structural and evidence regressions', () => {
  const corpus = [valid, '', valid.replace('### I-01', '### I-02'), valid.replace('Z-01', 'Z-99'), valid.replace('관계: 일관\n', ''), valid.replace('## 해석 원칙', ''), valid + '\n단정하지 않는다.', ...cases.map(({ field, value }) => changeItem(field, value))]
  for (const markdown of corpus) expect(isValidInterpretation(markdown, ids)).toBe(diagnoseInterpretation(markdown, ids).length === 0)
  expect(diagnoseInterpretation(valid, ids)).toEqual([])
})
test('wrapper preserves real integration-validator issue codes and exact field locations', async () => {
  const run = allocateRun(makeRepository(), 'personalized-gdd')
  updateRun(run, 'running')
  const paths = ['integrated.md', 'saju.md', 'ziwei.md', 'natal.md'].map(name => join(run, name))
  const markdown = changeItem('양면성', '강점: 결단 | 취약점:')
  writeFileSync(paths[0], markdown)
  for (const [index, system] of ['S', 'Z', 'N'].entries()) writeFileSync(paths[index + 1], `### ${system}-01\nSynthetic source.`)
  const child = Bun.spawn([Bun.argv[0], join(import.meta.dir, '../run-logged-step.ts'), run, 'integration', '1', '--', Bun.argv[0], join(import.meta.dir, '../../.agents/skills/interpret-chart-report/scripts/validate-interpretation.ts'), ...paths], { stdout: 'pipe', stderr: 'pipe' })
  const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()])
  expect(exitCode).toBe(1)
  const reported = JSON.parse(stderr).issues
  expect(reported).toContainEqual(expect.objectContaining({ code: 'item-duality', item: 'I-01', field: '양면성', line: itemLine(markdown, '양면성') }))
  const log = readFileSync(join(run, 'events.jsonl'), 'utf8').trim().split('\n').map(text => JSON.parse(text))
  expect(log.at(-1)).toMatchObject({ event: 'validation_failed', stage: 'integration', attempt: 1, issues: reported })
})

// Each invalid example has an independent rejection expectation, beyond parity
// between two APIs that deliberately share their implementation.
for (const { name, markdown, code, item, field } of [
  { name: 'unsupported domain', markdown: changeItem('영역', '없는 영역'), code: 'item-domain', item: 'I-01', field: '영역' },
  { name: 'unsupported relationship', markdown: changeItem('관계', '알 수 없음'), code: 'field-content', item: 'I-01', field: '관계' },
  { name: 'unknown specialist evidence', markdown: changeItem('근거', 'S-99, Z-01'), code: 'item-evidence', item: 'I-01', field: '근거' },
  { name: 'cross-system relation with only one source system', markdown: changeItem('근거', 'S-01'), code: 'item-evidence', item: 'I-01', field: '근거' },
  { name: 'prohibited creative seed', markdown: changeItem('조건', '자율이 있을 때 몰입한다.\n창작 시드: 전투 직업'), code: 'field-content', item: 'I-01', field: '창작 시드' },
]) {
  test(`rejects ${name} with its actionable diagnostic`, () => {
    expect(isValidInterpretation(markdown, ids)).toBe(false)
    expect(diagnoseInterpretation(markdown, ids)).toContainEqual(expect.objectContaining({ code, item, field }))
  })
}
test('rejects uncited specialist evidence with the missing evidence ID', () => {
  const withUnused = { ...ids, S: new Set(['S-01', 'S-02']) }
  expect(isValidInterpretation(valid, withUnused)).toBe(false)
  expect(diagnoseInterpretation(valid, withUnused)).toContainEqual(expect.objectContaining({ code: 'evidence-coverage', item: 'S-02', field: '근거' }))
})
