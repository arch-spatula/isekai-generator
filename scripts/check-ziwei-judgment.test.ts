import { expect, test } from 'bun:test'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { checkZiweiJudgment } from './check-ziwei-judgment.ts'

// fixture: 합성 입력(2000-03-03 10:00 서울 남, 流年 2026)의 chart-report 출력과 손으로 쓴 판단 문서.
// 섹션·필드·인용·대안의 공통 규칙은 check-saju-judgment.test.ts가 다루고, 여기서는 자미두수 설정만 확인한다.
// 기대 위반은 docs/spec/ziwei-first-pass-judgment.md에서 정했다.
const fixtureDir = join(import.meta.dir, 'fixtures/ziwei-judgment')
const chart = readFileSync(join(fixtureDir, 'ziwei-chart.md'), 'utf8')
const facts = readFileSync(join(fixtureDir, 'ziwei-facts.md'), 'utf8')
const valid = readFileSync(join(fixtureDir, 'ziwei-judgment.md'), 'utf8')

function check(judgment: string): string[] {
  return checkZiweiJudgment({ judgment, chart, facts })
}

/** 정상 문서에서 정확히 한 곳을 바꾼다. */
function mutate(from: string, to: string): string {
  expect(valid.split(from)).toHaveLength(2)
  return valid.replace(from, to)
}

function lineOf(text: string): number {
  return valid.split('\n').indexOf(text) + 1
}

test('the hand-written fixture passes', () => {
  expect(check(valid)).toEqual([])
})

test('requires the ziwei title and sections in order', () => {
  expect(check(mutate('# 紫微斗數 1차 판단', '# 四柱 1차 판단'))).toContain("1: 첫 줄은 '# 紫微斗數 1차 판단'이어야 한다")
  const swapped = mutate('## 강점 궁', '## X').replace('## 과제 궁', '## 강점 궁').replace('## X', '## 과제 궁')
  expect(check(swapped)).toContain('섹션은 명궁 역량, 격국, 강점 궁, 과제 궁, 짝, 자식, 제자 순서여야 한다 (실제: 명궁 역량, 격국, 과제 궁, 강점 궁, 짝, 자식, 제자)')
})

test('compares 명반 with the chart header (命宮 · 身宮 · 五行局)', () => {
  const identity = '명반: 命宮 乙酉 · 身宮 夫妻 (未) · 水二局'
  expect(check(mutate(identity, '명반: 命宮 乙酉 · 身宮 遷移 (卯) · 水二局')))
    .toContain(`${lineOf(identity)}: 명반 불일치 — 문서 命宮 乙酉 · 身宮 遷移 (卯) · 水二局, ziwei-chart.md 命宮 乙酉 · 身宮 夫妻 (未) · 水二局`)
  expect(check(mutate(`${identity}\n`, ''))).toContain('명반 줄이 없다')
})

test('limits 명궁 역량 and palace conclusions to their allowed values', () => {
  expect(check(mutate('결론: 약\n', '결론: 보통\n'))).toContain(`${lineOf('결론: 약')}: 명궁 역량: 결론 '보통' — 허용값 강 · 중 · 약`)
  // 12궁 이름 중 하나여야 하고 '父母宮'처럼 접미사를 붙여도 안 된다.
  expect(check(mutate('결론: 官祿', '결론: 官祿宮'))).toContain(
    `${lineOf('결론: 官祿')}: 강점 궁: 결론 '官祿宮' — 허용값 命宮 · 兄弟 · 夫妻 · 子女 · 財帛 · 疾厄 · 遷移 · 交友 · 官祿 · 田宅 · 福德 · 父母`)
  // 격국은 자유 텍스트다.
  expect(check(mutate('결론: 命無正曜格', '결론: 없음'))).toContain(`${lineOf('대안: 없음 — [facts:殺破狼]·[facts:機月同梁] 모두 불성립이라 이름 붙일 격이 없다고 본다')}: 격국: 대안 값이 결론과 같다 (없음)`)
})

test('rejects the same palace as strength and challenge', () => {
  expect(check(mutate('결론: 父母', '결론: 官祿'))).toContain(`${lineOf('결론: 父母')}: 과제 궁: 결론이 강점 궁과 같다 (官祿)`)
})

test('resolves ziwei fact items, ═/─ chart titles and palace positions', () => {
  const evidence = '근거: [facts:생년사화 위치] [chart:四化]'
  expect(check(mutate(evidence, '근거: [facts:化忌 충] [facts:殺破狼] [chart:紫微斗數 命盤] [chart:十二宮] [chart:疾厄]'))).toEqual([])
  expect(check(mutate(evidence, '근거: [chart:疾厄宮]'))).toContain(`${lineOf(evidence)}: 과제 궁: ziwei-chart.md에 없는 절·위치 [chart:疾厄宮]`)
  expect(check(mutate(evidence, '근거: [facts:궁 강도]'))).toContain(`${lineOf(evidence)}: 과제 궁: ziwei-facts.md에 없는 항목 [facts:궁 강도]`)
})

test('rejects citations of time-dependent sections 流年 · 流月 · 大限', () => {
  const evidence = '근거: [facts:생년사화 위치] [chart:四化]'
  for (const section of ['流年', '流月', '大限']) {
    expect(check(mutate(evidence, `근거: [facts:생년사화 위치] [chart:${section}]`)))
      .toEqual([`${lineOf(evidence)}: 과제 궁: 1차 판단에 쓰지 않는 절 [chart:${section}]`])
  }
})

test('CLI reads the directory and exits by result', () => {
  const script = join(import.meta.dir, 'check-ziwei-judgment.ts')
  const ok = Bun.spawnSync(['bun', script, fixtureDir])
  expect([ok.exitCode, ok.stdout.toString()]).toEqual([0, ''])

  const dir = mkdtempSync(join(tmpdir(), 'ziwei-judgment-'))
  try {
    cpSync(fixtureDir, dir, { recursive: true })
    writeFileSync(join(dir, 'ziwei-judgment.md'), valid.replace('결론: 父母', '결론: 官祿'))
    const bad = Bun.spawnSync(['bun', script, dir])
    expect(bad.exitCode).toBe(1)
    expect(bad.stdout.toString()).toContain('과제 궁: 결론이 강점 궁과 같다 (官祿)')

    rmSync(join(dir, 'ziwei-facts.md'))
    const missing = Bun.spawnSync(['bun', script, dir])
    expect(missing.exitCode).toBe(1)
    expect(missing.stderr.toString()).toContain('ziwei-facts.md')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
