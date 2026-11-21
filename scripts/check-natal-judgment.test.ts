import { expect, test } from 'bun:test'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { checkNatalJudgment } from './check-natal-judgment.ts'

// fixture: 합성 입력(2000-09-05 12:00 서울 남, Placidus)의 chart-report 출력과 손으로 쓴 판단 문서.
// 섹션·필드·인용·대안의 공통 규칙은 check-saju-judgment.test.ts가 다루고, 여기서는 네이탈 설정만 확인한다.
// 기대 위반은 docs/spec/natal-first-pass-judgment.md에서 정했다.
const fixtureDir = join(import.meta.dir, 'fixtures/natal-judgment')
const chart = readFileSync(join(fixtureDir, 'natal-chart.md'), 'utf8')
const facts = readFileSync(join(fixtureDir, 'natal-facts.md'), 'utf8')
const valid = readFileSync(join(fixtureDir, 'natal-judgment.md'), 'utf8')

function check(judgment: string): string[] {
  return checkNatalJudgment({ judgment, chart, facts })
}

/** 정상 문서에서 정확히 한 곳을 바꾼다. */
function mutate(from: string, to: string): string {
  expect(valid.split(from)).toHaveLength(2)
  return valid.replace(from, to)
}

function lineOf(text: string): number {
  return valid.split('\n').indexOf(text) + 1
}

// fixture 차트의 Major Aspects 중 □·☍ (차트에 적힌 순서와 방향)
const HARD_ASPECTS = [
  'Jupiter ☍ Pluto', 'Jupiter ☍ Chiron', 'Sun □ Chiron', 'Sun □ Jupiter', 'Sun □ Pluto',
  'Moon ☍ Jupiter', 'Mars ☍ Uranus', 'Moon ☍ Saturn', 'Sun □ Moon',
]

test('the hand-written fixture passes', () => {
  expect(check(valid)).toEqual([])
})

test('requires the natal title and sections in order', () => {
  expect(check(mutate('# Natal 1차 판단', '# 네이탈 판단'))).toContain("1: 첫 줄은 '# Natal 1차 판단'이어야 한다")
  const swapped = mutate('## 우세 원소', '## X').replace('## 핵심 긴장', '## 우세 원소').replace('## X', '## 핵심 긴장')
  expect(check(swapped)).toContain('섹션은 차트 룰러 상태, 주요 행성, 우세 원소, 핵심 긴장 순서여야 한다 (실제: 차트 룰러 상태, 주요 행성, 핵심 긴장, 우세 원소)')
})

test('compares 차트 with ASC, Sun and Moon signs and the house system', () => {
  const identity = '차트: ASC Scorpio · Sun Virgo · Moon Sagittarius · Placidus'
  expect(check(mutate(identity, '차트: ASC Scorpio · Sun Virgo · Moon Sagittarius · Whole Sign')))
    .toContain(`${lineOf(identity)}: 차트 불일치 — 문서 ASC Scorpio · Sun Virgo · Moon Sagittarius · Whole Sign, natal-chart.md ASC Scorpio · Sun Virgo · Moon Sagittarius · Placidus`)
  expect(check(mutate(identity, '차트: ASC Libra · Sun Virgo · Moon Sagittarius · Placidus'))).toHaveLength(1)
  // 같은 출생이라도 다른 하우스 시스템으로 뽑은 차트와 비교하면 불일치다.
  const wholeSign = chart.replace('Houses (Placidus)', 'Houses (Whole Sign)')
  expect(checkNatalJudgment({ judgment: valid, chart: wholeSign, facts }))
    .toContain(`${lineOf(identity)}: 차트 불일치 — 문서 ASC Scorpio · Sun Virgo · Moon Sagittarius · Placidus, natal-chart.md ASC Scorpio · Sun Virgo · Moon Sagittarius · Whole Sign`)
})

test('limits 차트 룰러 상태, 주요 행성 and 우세 원소 to their allowed values', () => {
  expect(check(mutate('결론: 약', '결론: 보통'))).toContain(`${lineOf('결론: 약')}: 차트 룰러 상태: 결론 '보통' — 허용값 강 · 중 · 약`)
  // 주요 행성 후보는 10행성이고 Chiron 같은 보조 천체는 아니다.
  expect(check(mutate('결론: Venus', '결론: Chiron'))).toContain(
    `${lineOf('결론: Venus')}: 주요 행성: 결론 'Chiron' — 허용값 Sun · Moon · Mercury · Venus · Mars · Jupiter · Saturn · Uranus · Neptune · Pluto`)
  expect(check(mutate('결론: Air', '결론: 공기'))).toContain(`${lineOf('결론: Air')}: 우세 원소: 결론 '공기' — 허용값 Fire · Earth · Air · Water`)
})

test('limits 핵심 긴장 to □ and ☍ aspects listed in the chart, written as listed', () => {
  const conclusion = '결론: Jupiter ☍ Pluto'
  const allowed = `허용값 ${HARD_ASPECTS.join(' · ')}`
  // 차트에 있지만 조화 애스펙트
  expect(check(mutate(conclusion, '결론: Venus △ Neptune'))).toContain(`${lineOf(conclusion)}: 핵심 긴장: 결론 'Venus △ Neptune' — ${allowed}`)
  // 차트에 없는 애스펙트
  expect(check(mutate(conclusion, '결론: Mars □ Saturn'))).toContain(`${lineOf(conclusion)}: 핵심 긴장: 결론 'Mars □ Saturn' — ${allowed}`)
  // 순서를 뒤집어 쓰면 차트 표기와 달라 허용하지 않는다.
  expect(check(mutate(conclusion, '결론: Pluto ☍ Jupiter'))).toContain(`${lineOf(conclusion)}: 핵심 긴장: 결론 'Pluto ☍ Jupiter' — ${allowed}`)
  expect(check(mutate(conclusion, '결론: Mars ☍ Uranus'))).toEqual([])
})

test('resolves natal fact items, chart titles and planet or angle positions', () => {
  const evidence = '근거: [facts:원소 분포]'
  expect(check(mutate(evidence, '근거: [facts:ASC] [facts:섹트] [chart:Natal Chart] [chart:Houses] [chart:Angles] [chart:MC] [chart:Saturn]'))).toEqual([])
  expect(check(mutate(evidence, '근거: [chart:Chiron]'))).toContain(`${lineOf(evidence)}: 우세 원소: natal-chart.md에 없는 절·위치 [chart:Chiron]`)
  expect(check(mutate(evidence, '근거: [facts:원소 가중치]'))).toContain(`${lineOf(evidence)}: 우세 원소: natal-facts.md에 없는 항목 [facts:원소 가중치]`)
})

test('CLI reads the directory and exits by result', () => {
  const script = join(import.meta.dir, 'check-natal-judgment.ts')
  const ok = Bun.spawnSync(['bun', script, fixtureDir])
  expect([ok.exitCode, ok.stdout.toString()]).toEqual([0, ''])

  const dir = mkdtempSync(join(tmpdir(), 'natal-judgment-'))
  try {
    cpSync(fixtureDir, dir, { recursive: true })
    writeFileSync(join(dir, 'natal-judgment.md'), valid.replace('결론: Air', '결론: 공기'))
    const bad = Bun.spawnSync(['bun', script, dir])
    expect(bad.exitCode).toBe(1)
    expect(bad.stdout.toString()).toContain("우세 원소: 결론 '공기'")

    rmSync(join(dir, 'natal-chart.md'))
    const missing = Bun.spawnSync(['bun', script, dir])
    expect(missing.exitCode).toBe(1)
    expect(missing.stderr.toString()).toContain('natal-chart.md')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
