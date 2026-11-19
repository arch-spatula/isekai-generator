import { expect, test } from 'bun:test'
import { calculateSaju } from '@orrery/core/saju'

import { sajuFactsToText } from './saju-facts.ts'

// 기대값은 원국 간지만 보고 손으로 계산했다. 간지 자체는 orrery 계산을 신뢰한다.

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
  expect(lines.slice(lines.findIndex((line) => line.startsWith('투출')) + 1)).toEqual(['  月支 未: 乙→年干, 己→時干'])
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
  // 일간 丙은 투출 대상에서 빠지므로 寅의 丙은 세지 않는다.
  expect(lines.slice(lines.findIndex((line) => line.startsWith('투출')) + 1)).toEqual([
    '  時支 巳: 庚→年干',
    '  年支 辰: 癸→時干',
  ])
})

test('does not state a strength, structure or 용신 conclusion', () => {
  const text = sajuFactsToText(calculateSaju({
    year: 1995, month: 8, day: 3, hour: 23, minute: 10, gender: 'F',
    latitude: 40.7128, longitude: -74.006, timezone: 'America/New_York',
  }))
  for (const verdict of ['신강', '신약', '격국:', '용신:', '희신', '기신']) expect(text).not.toContain(verdict)
})
