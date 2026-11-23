import { expect, test } from 'bun:test'
import { calculateSaju } from '@orrery/core/saju'

import { sajuFactsToText } from './saju-facts.ts'

// 기대값은 원국 간지만 보고 손으로 계산했다. 간지 자체는 orrery 계산을 신뢰한다.

/** 제목 줄 아래 들여쓴 항목들 */
function section(lines: string[], title: string): string[] {
  const start = lines.findIndex((line) => line.startsWith(title)) + 1
  const end = lines.findIndex((line, index) => index >= start && !line.startsWith('  '))
  return lines.slice(start, end === -1 ? undefined : end)
}

test('summer chart without 득령: 己亥 丙寅 癸未 乙亥 (時日月年)', () => {
  const lines = sajuFactsToText(calculateSaju({
    year: 1995, month: 8, day: 3, hour: 23, minute: 10, gender: 'F',
    latitude: 40.7128, longitude: -74.006, timezone: 'America/New_York',
  })).split('\n')

  expect(lines).toContain('일간: 丙 (火, 陽)')
  expect(lines).toContain('월령: 未월 · 정기 己(土) · 계절 여름')
  // 己土 丙火 癸水 乙木 / 亥水 寅木 未土 亥水
  expect(lines.find((line) => line.startsWith('오행 분포'))).toEndWith('木 2 · 火 1 · 土 2 · 金 0 · 水 3')
  // 己傷官 亥偏官 寅偏印 癸正官 未傷官 乙正印 亥偏官
  expect(lines.find((line) => line.startsWith('십신 분포'))).toEndWith('비겁 0 · 식상 2 · 재성 0 · 관성 3 · 인성 2')
  expect(lines.find((line) => line.startsWith('득령'))).toEndWith('아니오 — 月支 未 정기 己 = 傷官')
  expect(lines.find((line) => line.startsWith('득지'))).toEndWith('예 — 日支 寅 정기 甲 = 偏印')
  expect(lines.find((line) => line.startsWith('득세 근거'))).toEndWith('1/5 — 年干 正印')
  // 亥(戊甲壬)·寅(戊丙甲)은 일간 외 천간(己·癸·乙)과 겹치지 않고, 未(丁乙己)만 乙·己가 투출한다.
  expect(section(lines, '투출')).toEqual(['  月支 未: 乙→年干, 己→時干'])
  // 지장간 위치: 亥 여기戊 중기甲 정기壬 · 寅 여기戊 중기丙 정기甲 · 未 여기丁 중기乙 정기己
  // 大運 1運 甲申 1세부터 10년씩 (1–10, 11–20, …, 91–100), 0세는 대운 이전
  expect(section(lines, '생애 단계별 大運')).toEqual([
    '  유년 0–12: 대운 이전 0–0, 1運 甲申 1–10, 2運 乙酉 11–20',
    '  소년 13–19: 2運 乙酉 11–20',
    '  청년 20–34: 2運 乙酉 11–20, 3運 丙戌 21–30, 4運 丁亥 31–40',
    '  장년 35–54: 4運 丁亥 31–40, 5運 戊子 41–50, 6運 己丑 51–60',
    '  노년 55–: 6運 己丑 51–60, 7運 庚寅 61–70, 8運 辛卯 71–80, 9運 壬辰 81–90, 10運 癸巳 91–100',
  ])
  // 여자: 時干 傷官 · 時支 偏官 · 日支 偏印 · 月干 正官 · 月支 傷官 · 年干 正印 · 年支 偏官
  expect(section(lines, '육친')).toEqual([
    '  어머니 (正印): 年干 正印',
    '  아버지 (偏財): 원국에 없음',
    '  형제 (比肩·劫財): 원국에 없음',
    '  배우자 (여: 正官): 月干 正官',
    '  자녀 (여: 食神·傷官): 時干 傷官, 月支 傷官',
    '  배우자 자리: 日支 寅 偏印',
  ])
  expect(section(lines, '통근')).toEqual([
    '  時干 己(土): 時支 亥 여기 戊, 日支 寅 여기 戊, 月支 未 정기 己, 年支 亥 여기 戊',
    '  日干 丙(火): 日支 寅 중기 丙, 月支 未 여기 丁',
    '  月干 癸(水): 時支 亥 정기 壬, 年支 亥 정기 壬',
    '  年干 乙(木): 時支 亥 중기 甲, 日支 寅 정기 甲, 月支 未 중기 乙, 年支 亥 중기 甲',
  ])
})

test('spring chart with 득령: 癸巳 丙寅 己卯 庚辰 (時日月年)', () => {
  const lines = sajuFactsToText(calculateSaju({
    year: 2000, month: 3, day: 9, hour: 10, minute: 0, gender: 'M',
    latitude: 37.5665, longitude: 126.978, timezone: 'Asia/Seoul',
  })).split('\n')

  expect(lines).toContain('월령: 卯월 · 정기 乙(木) · 계절 봄')
  // 癸水 丙火 己土 庚金 / 巳火 寅木 卯木 辰土
  expect(lines.find((line) => line.startsWith('오행 분포'))).toEndWith('木 2 · 火 2 · 土 2 · 金 1 · 水 1')
  // 癸正官 巳比肩 寅偏印 己傷官 卯正印 庚偏財 辰食神
  expect(lines.find((line) => line.startsWith('십신 분포'))).toEndWith('비겁 1 · 식상 2 · 재성 1 · 관성 1 · 인성 2')
  expect(lines.find((line) => line.startsWith('득령'))).toEndWith('예 — 月支 卯 정기 乙 = 正印')
  expect(lines.find((line) => line.startsWith('득세 근거'))).toEndWith('1/5 — 時支 比肩')
  // 남자: 時干 正官 · 時支 比肩 · 日支 偏印 · 月干 傷官 · 月支 正印 · 年干 偏財 · 年支 食神
  expect(section(lines, '육친')).toEqual([
    '  어머니 (正印): 月支 正印',
    '  아버지 (偏財): 年干 偏財',
    '  형제 (比肩·劫財): 時支 比肩',
    '  배우자 (남: 正財): 원국에 없음',
    '  자녀 (남: 正官·偏官): 時干 正官',
    '  배우자 자리: 日支 寅 偏印',
  ])
  // 일간 丙은 투출 대상에서 빠지므로 寅의 丙은 세지 않는다.
  expect(section(lines, '투출')).toEqual([
    '  時支 巳: 庚→年干',
    '  年支 辰: 癸→時干',
  ])
  // 巳 여기戊 중기庚 정기丙 · 寅 여기戊 중기丙 정기甲 · 卯 여기甲 정기乙(중기 없음) · 辰 여기乙 중기癸 정기戊
  expect(section(lines, '통근')).toEqual([
    '  時干 癸(水): 年支 辰 중기 癸',
    '  日干 丙(火): 時支 巳 정기 丙, 日支 寅 중기 丙',
    '  月干 己(土): 時支 巳 여기 戊, 日支 寅 여기 戊, 年支 辰 정기 戊',
    '  年干 庚(金): 時支 巳 중기 庚',
  ])
})

test('통근 lists every same-element hidden stem and marks a rootless stem: 丙午 壬寅 甲午 辛巳 (時日月年)', () => {
  const lines = sajuFactsToText(calculateSaju({
    year: 2001, month: 6, day: 8, hour: 12, minute: 0, gender: 'M',
    latitude: 37.5665, longitude: 126.978, timezone: 'Asia/Seoul',
  })).split('\n')

  // 午 여기丙 중기己 정기丁 · 寅 여기戊 중기丙 정기甲 · 巳 여기戊 중기庚 정기丙 — 水 지장간(壬·癸)은 하나도 없다.
  expect(section(lines, '통근')).toEqual([
    '  時干 丙(火): 時支 午 여기 丙, 時支 午 정기 丁, 日支 寅 중기 丙, 月支 午 여기 丙, 月支 午 정기 丁, 年支 巳 정기 丙',
    '  日干 壬(水): 없음',
    '  月干 甲(木): 日支 寅 정기 甲',
    '  年干 辛(金): 年支 巳 중기 庚',
  ])
})

test('통근 in a branch without 중기 keeps the 정기 position: 己巳 甲子 己卯 庚辰 (時日月年)', () => {
  const lines = sajuFactsToText(calculateSaju({
    year: 2000, month: 3, day: 7, hour: 10, minute: 0, gender: 'M',
    latitude: 37.5665, longitude: 126.978, timezone: 'Asia/Seoul',
  })).split('\n')

  // 卯는 여기甲 정기乙로 중기가 없다. 乙은 두 번째 글자지만 정기다.
  expect(section(lines, '통근')).toContain('  日干 甲(木): 月支 卯 여기 甲, 月支 卯 정기 乙, 年支 辰 여기 乙')
})

test('does not state a strength, structure or 용신 conclusion', () => {
  const text = sajuFactsToText(calculateSaju({
    year: 1995, month: 8, day: 3, hour: 23, minute: 10, gender: 'F',
    latitude: 40.7128, longitude: -74.006, timezone: 'America/New_York',
  }))
  for (const verdict of ['신강', '신약', '격국:', '용신:', '희신', '기신']) expect(text).not.toContain(verdict)
})
