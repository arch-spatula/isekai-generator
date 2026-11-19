import { expect, test } from 'bun:test'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { checkSajuJudgment } from './check-saju-judgment.ts'

// fixture: 합성 입력(2000-03-09 10:00 서울 남)의 chart-report 출력과 손으로 쓴 판단 문서.
// 변형은 정상 문서에서 한 곳만 바꾸고, 기대 위반은 docs/spec/saju-first-pass-judgment.md §2–3에서 정했다.
const fixtureDir = join(import.meta.dir, 'fixtures/saju-judgment')
const chart = readFileSync(join(fixtureDir, 'saju-chart.md'), 'utf8')
const facts = readFileSync(join(fixtureDir, 'saju-facts.md'), 'utf8')
const valid = readFileSync(join(fixtureDir, 'saju-judgment.md'), 'utf8')

function check(judgment: string): string[] {
  return checkSajuJudgment({ judgment, chart, facts })
}

/** 정상 문서에서 정확히 한 곳을 바꾼다. */
function mutate(from: string, to: string): string {
  expect(valid.split(from)).toHaveLength(2)
  return valid.replace(from, to)
}

/** 정상 문서의 n번째 줄(1부터) */
function lineOf(text: string): number {
  return valid.split('\n').indexOf(text) + 1
}

test('the hand-written fixture passes', () => {
  expect(check(valid)).toEqual([])
})

test('rejects a missing title', () => {
  expect(check(mutate('# 四柱 1차 판단', '# 사주 판단'))).toContain("1: 첫 줄은 '# 四柱 1차 판단'이어야 한다")
})

test('rejects a 원국 that differs from saju-chart.md (時日月年)', () => {
  // 연주와 시주를 뒤집은 순서
  expect(check(mutate('원국: 癸巳 丙寅 己卯 庚辰', '원국: 庚辰 己卯 丙寅 癸巳')))
    .toContain('3: 원국 불일치 — 문서 庚辰 己卯 丙寅 癸巳, saju-chart.md 癸巳 丙寅 己卯 庚辰')
  expect(check(mutate('원국: 癸巳 丙寅 己卯 庚辰\n', ''))).toContain('원국 줄이 없다')
})

test('rejects missing or reordered sections', () => {
  const withoutJohu = valid.replace(/## 조후\n[\s\S]*?\n\n(?=## 용신)/, '')
  expect(check(withoutJohu)).toContain('섹션은 일간 강약, 격국, 조후, 용신, 희신, 기신 순서여야 한다 (실제: 일간 강약, 격국, 용신, 희신, 기신)')
  const swapped = mutate('## 희신', '## 기신X').replace('## 기신\n', '## 희신\n').replace('## 기신X', '## 기신')
  expect(check(swapped)).toContain('섹션은 일간 강약, 격국, 조후, 용신, 희신, 기신 순서여야 한다 (실제: 일간 강약, 격국, 조후, 용신, 기신, 희신)')
})

test('requires each field exactly once and 기준 only in 용신', () => {
  const flip = '뒤집힘: 절입 직후 출생이라 한기가 남았다고 보면 한습'
  expect(check(mutate(`${flip}\n`, ''))).toContain('조후: 뒤집힘 필드가 없다')
  expect(check(mutate(`${flip}\n`, `${flip}\n${flip}\n`))).toContain(`${lineOf(flip) + 1}: 조후: 뒤집힘 필드가 두 번 이상 있다`)
  expect(check(mutate('기준: 억부\n', ''))).toContain('용신: 기준 필드가 없다')
  expect(check(mutate('결론: 정인격\n', '결론: 정인격\n기준: 억부\n'))).toContain(`${lineOf('결론: 정인격') + 1}: 격국: 기준 필드는 용신 섹션에만 쓴다`)
})

test('rejects lines that are not fields', () => {
  const line = '결론: 불필요'
  expect(check(mutate(`${line}\n`, `${line}\n봄이라 따뜻하다\n`))).toContain(`${lineOf(line) + 1}: 조후: '키: 값' 필드가 아닌 줄이다`)
  expect(check(mutate(`${line}\n`, `${line}\n확신도: 높음\n`))).toContain(`${lineOf(line) + 1}: 조후: 알 수 없는 필드 '확신도'`)
})

test('rejects 결론 and 기준 outside the allowed values', () => {
  expect(check(mutate('결론: 土', '결론: 土 또는 金'))).toContain(`${lineOf('결론: 土')}: 용신: 결론 '土 또는 金' — 허용값 木 · 火 · 土 · 金 · 水`)
  expect(check(mutate('결론: 신강', '결론: 강함'))).toContain(`${lineOf('결론: 신강')}: 일간 강약: 결론 '강함' — 허용값 신강 · 신약 · 중화`)
  expect(check(mutate('기준: 억부', '기준: 종합'))).toContain(`${lineOf('기준: 억부')}: 용신: 기준 '종합' — 허용값 억부 · 조후 · 통관 · 병약 · 전왕`)
  // 격국은 자유 텍스트라 아무 이름이나 통과하고, 비어 있을 때만 막는다.
  expect(check(mutate('결론: 정인격', '결론: 인수격'))).toEqual([])
  expect(check(mutate('결론: 정인격', '결론: '))).toContain(`${lineOf('결론: 정인격')}: 격국: 결론이 비어 있다`)
})

test('requires at least one citation in 근거 and rejects citations missing from the chart files', () => {
  const evidence = '근거: [facts:월령] [facts:투출]'
  expect(check(mutate(evidence, '근거: 월령이 卯라서'))).toContain(`${lineOf(evidence)}: 격국: 근거에 인용이 없다`)
  expect(check(mutate(evidence, '근거: [facts:월령] [facts:신강도]'))).toContain(`${lineOf(evidence)}: 격국: saju-facts.md에 없는 항목 [facts:신강도]`)
  expect(check(mutate(evidence, '근거: [facts:월령] [chart:用神]'))).toContain(`${lineOf(evidence)}: 격국: saju-chart.md에 없는 절·위치 [chart:用神]`)
})

test('resolves facts item names and chart section titles and positions', () => {
  const evidence = '근거: [facts:월령] [facts:투출]'
  // 이름 뒤 괄호 정의는 빼고 인용한다. 坐法 절 제목은 '坐法 (장간 → 운성)'이다.
  expect(check(mutate(evidence, '근거: [facts:득세 근거] [chart:坐法] [chart:神殺] [chart:時支]'))).toEqual([])
  expect(check(mutate(evidence, '근거: [facts:득세 근거 (年干·年支·月干·時干·時支 중 비겁·인성 수)]'))).not.toEqual([])
  // 표 행 이름(십신)은 구분선 위에 있어도 절 제목이 아니다.
  expect(check(mutate(evidence, '근거: [chart:십신]'))).toContain(`${lineOf(evidence)}: 격국: saju-chart.md에 없는 절·위치 [chart:십신]`)
})

test('requires 대안 to name a different allowed value and cite evidence', () => {
  const alternative = '대안: 金 — 재성으로 인성을 제어하는 쪽을 택하면 [facts:십신 분포] 재성 1이 약하다'
  const line = lineOf(alternative)
  expect(check(mutate(alternative, '대안: 土 — [facts:십신 분포]'))).toContain(`${line}: 용신: 대안 값이 결론과 같다 (土)`)
  expect(check(mutate(alternative, '대안: 금속 — [facts:십신 분포]'))).toContain(`${line}: 용신: 대안 '금속' — 허용값 木 · 火 · 土 · 金 · 水`)
  expect(check(mutate(alternative, '대안: 金 [facts:십신 분포]'))).toContain(`${line}: 용신: 대안은 '<값> — <설명>' 형태여야 한다`)
  expect(check(mutate(alternative, '대안: 金 — 재성으로 인성을 제어한다'))).toContain(`${line}: 용신: 대안 설명에 인용이 없다`)
  expect(check(mutate(alternative, '대안: 金 — [facts:재성 강도]'))).toContain(`${line}: 용신: saju-facts.md에 없는 항목 [facts:재성 강도]`)
  expect(check(mutate('대안: 상관격 —', '대안: 정인격 —'))).toContain(`${lineOf('대안: 상관격 — 月干 己가 [chart:月干]에 드러나고 [facts:통근]에서 辰 정기에 뿌리를 둔다')}: 격국: 대안 값이 결론과 같다 (정인격)`)
})

test('rejects an empty 뒤집힘 and unknown citations in it', () => {
  const flip = '뒤집힘: 인성 과다를 병으로 보면 병약 기준의 金'
  expect(check(mutate(flip, '뒤집힘: '))).toContain(`${lineOf(flip)}: 용신: 뒤집힘이 비어 있다`)
  expect(check(mutate(flip, '뒤집힘: [facts:병약] 기준이면 金'))).toContain(`${lineOf(flip)}: 용신: saju-facts.md에 없는 항목 [facts:병약]`)
})

test('rejects 용신·희신·기신 sharing an element', () => {
  const hostile = '결론: 木'
  expect(check(mutate(hostile, '결론: 土'))).toContain(`${lineOf(hostile)}: 기신: 결론이 용신과 같다 (土)`)
})

test('CLI reads the directory and exits by result', () => {
  const ok = Bun.spawnSync(['bun', join(import.meta.dir, 'check-saju-judgment.ts'), fixtureDir])
  expect([ok.exitCode, ok.stdout.toString()]).toEqual([0, ''])

  const dir = mkdtempSync(join(tmpdir(), 'saju-judgment-'))
  try {
    cpSync(fixtureDir, dir, { recursive: true })
    writeFileSync(join(dir, 'saju-judgment.md'), valid.replace('결론: 木', '결론: 土'))
    const bad = Bun.spawnSync(['bun', join(import.meta.dir, 'check-saju-judgment.ts'), dir])
    expect(bad.exitCode).toBe(1)
    expect(bad.stdout.toString()).toContain('기신: 결론이 용신과 같다 (土)')

    rmSync(join(dir, 'saju-judgment.md'))
    const missing = Bun.spawnSync(['bun', join(import.meta.dir, 'check-saju-judgment.ts'), dir])
    expect(missing.exitCode).toBe(1)
    expect(missing.stderr.toString()).toContain('saju-judgment.md')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
