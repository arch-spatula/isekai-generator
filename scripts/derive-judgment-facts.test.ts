import { expect, test } from 'bun:test'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { chartsToTexts } from './chart-report.ts'
import { luckTone, sajuDerivedFacts, ziweiDerivedFacts } from './derive-judgment-facts.ts'

// 기대값은 fixture 차트의 大運·大限 표와 판단 문서의 결론을 보고 손으로 대조했다.
const sajuDir = join(import.meta.dir, 'fixtures/saju-judgment')
const ziweiDir = join(import.meta.dir, 'fixtures/ziwei-judgment')
const read = (dir: string, file: string) => readFileSync(join(dir, file), 'utf8')
const script = join(import.meta.dir, 'derive-judgment-facts.ts')

test('saju: element of each 大運 stem and branch against 용신 土 · 희신 金 · 기신 木', () => {
  expect(sajuDerivedFacts(read(sajuDir, 'saju-chart.md'), read(sajuDir, 'saju-judgment.md')).split('\n')).toEqual([
    '四柱 판단 파생 사실 (1차 판단 용신 土 · 희신 金 · 기신 木 기준)',
    '─────',
    '大運별 용신·희신·기신 (大運 천간과 지지 자체 오행, 나이는 출생 연도 차, 괄호는 겹치는 생애 단계):',
    // 기조: 용신·희신만 있으면 순풍, 기신만 있으면 역풍, 둘이 섞이면 혼조, 해당 없음뿐이면 평이 (명세 4.1)
    '  1運 庚辰 8–17 (유년·소년): 庚 金 희신 · 辰 土 용신 · 순풍',
    '  2運 辛巳 18–27 (소년·청년): 辛 金 희신 · 巳 火 해당 없음 · 순풍',
    '  3運 壬午 28–37 (청년·장년): 壬 水 해당 없음 · 午 火 해당 없음 · 평이',
    '  4運 癸未 38–47 (장년): 癸 水 해당 없음 · 未 土 용신 · 순풍',
    '  5運 甲申 48–57 (장년·노년): 甲 木 기신 · 申 金 희신 · 혼조',
    '  6運 乙酉 58–67 (노년): 乙 木 기신 · 酉 金 희신 · 혼조',
    '  7運 丙戌 68–77 (노년): 丙 火 해당 없음 · 戌 土 용신 · 순풍',
    '  8運 丁亥 78–87 (노년): 丁 火 해당 없음 · 亥 水 해당 없음 · 평이',
    '  9運 戊子 88–97 (노년): 戊 土 용신 · 子 水 해당 없음 · 순풍',
    '  10運 己丑 98–107 (노년): 己 土 용신 · 丑 土 용신 · 순풍',
    // 단계 구간으로 잘라 순서대로 나열한다. 첫 大運(8세) 이전은 뺀다 (명세 4.2)
    '생애 단계별 운 기조 (단계 나이 구간 안에서 겹치는 大運의 기조, 첫 大運 이전 제외):',
    '  유년 0–12: 순풍 8–12',
    '  소년 13–19: 순풍 13–17 → 순풍 18–19',
    '  청년 20–34: 순풍 20–27 → 평이 28–34',
    '  장년 35–54: 평이 35–37 → 순풍 38–47 → 혼조 48–54',
    '  노년 55–: 혼조 55–57 → 혼조 58–67 → 순풍 68–77 → 평이 78–87 → 순풍 88–97 → 순풍 98–107',
  ])
})

test('saju: luck tone covers all six role combinations', () => {
  expect(luckTone('용신', '희신')).toBe('순풍')
  expect(luckTone('기신', '기신')).toBe('역풍')
  expect(luckTone('희신', '기신')).toBe('혼조')
  expect(luckTone('해당 없음', '용신')).toBe('순풍')
  expect(luckTone('기신', '해당 없음')).toBe('역풍')
  expect(luckTone('해당 없음', '해당 없음')).toBe('평이')
})

test('ziwei: the 大限 holding the strength and challenge palaces', () => {
  expect(ziweiDerivedFacts(read(ziweiDir, 'ziwei-chart.md'), read(ziweiDir, 'ziwei-judgment.md')).split('\n')).toEqual([
    '紫微斗數 판단 파생 사실 (1차 판단의 강점 궁·과제 궁이 걸린 大限, 생애 단계는 세는나이 − 1로 대조)',
    '─────',
    // 官祿 42–51歲 = 연도 차 41–50, 父母 12–21歲 = 11–20
    '강점 궁 官祿: 大限 42–51歲 己丑 (장년)',
    '과제 궁 父母: 大限 12–21歲 丙戌 (유년·소년·청년)',
  ])
})

test('ziwei: 세는나이 minus one decides the life stage at a boundary (火六局)', async () => {
  const { ziwei } = await chartsToTexts({
    year: 2001, month: 4, day: 5, hour: 16, minute: 0, gender: 'F',
    latitude: 37.5665, longitude: 126.978, timezone: 'Asia/Seoul',
  }, { ziweiYear: 2026, houseSystem: 'P' })
  const judgment = '## 강점 궁\n결론: 福德\n\n## 과제 궁\n결론: 官祿\n'
  // 福德 26–35歲 = 연도 차 25–34 → 청년만, 官祿 46–55歲 = 45–54 → 장년만
  expect(ziweiDerivedFacts(ziwei!, judgment).split('\n').slice(2)).toEqual([
    '강점 궁 福德: 大限 26–35歲 戊戌 (청년)',
    '과제 궁 官祿: 大限 46–55歲 庚子 (장년)',
  ])
})

function run(system: string, dir: string) {
  const result = Bun.spawnSync(['bun', script, system, dir])
  return { exitCode: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() }
}

test('CLI writes the derived facts file next to the judgment and refuses to overwrite it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'derived-facts-'))
  try {
    cpSync(sajuDir, dir, { recursive: true })
    expect(run('saju', dir)).toEqual({ exitCode: 0, stdout: '', stderr: '' })
    const written = read(dir, 'saju-derived-facts.md')
    expect(written).toBe(`${sajuDerivedFacts(read(dir, 'saju-chart.md'), read(dir, 'saju-judgment.md'))}\n`)

    const again = run('saju', dir)
    expect(again.exitCode).toBe(1)
    expect(again.stderr).toContain('saju-derived-facts.md')
    expect(read(dir, 'saju-derived-facts.md')).toBe(written)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('CLI refuses a judgment document that fails its validator and writes nothing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'derived-facts-'))
  try {
    cpSync(ziweiDir, dir, { recursive: true })
    writeFileSync(join(dir, 'ziwei-judgment.md'), read(ziweiDir, 'ziwei-judgment.md').replace('결론: 父母', '결론: 官祿'))
    const result = run('ziwei', dir)
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('과제 궁: 결론이 강점 궁과 같다 (官祿)')
    expect(existsSync(join(dir, 'ziwei-derived-facts.md'))).toBe(false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('CLI rejects an unknown system', () => {
  const result = run('natal', sajuDir)
  expect(result.exitCode).toBe(1)
  expect(result.stderr).toContain('usage')
})
