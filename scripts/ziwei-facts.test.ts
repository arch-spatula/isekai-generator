import { expect, test } from 'bun:test'
import { createChart } from '@orrery/core/ziwei'

import { ziweiFactsToText } from './ziwei-facts.ts'

// 기대값은 chart-report의 十二宮 표를 보고 삼방사정 규칙(명궁·삼합 ±4지지·대궁 +6지지)으로 손으로 골랐다.

test('명궁 with main stars: 酉 命宮, 三合 巳·丑, 對宮 卯', () => {
  const lines = ziweiFactsToText(createChart(1995, 8, 3, 23, 10, false, 'America/New_York', -74.006)).split('\n')

  expect(lines).toContain('명궁 주성: 廉貞 平, 破軍 旺 (乙酉)')
  expect(lines).toContain('신궁: 夫妻 (未)')
  expect(lines).toContain('오행국: 水二局')
  const start = lines.findIndex((line) => line.startsWith('명궁 삼방사정'))
  expect(lines.slice(start + 1, start + 5).sort()).toEqual([
    '  命宮 乙酉: 廉貞 平, 破軍 旺 | 煞 鈴星',
    '  官祿 己丑: 武曲 廟, 貪狼 廟',
    '  財帛 辛巳: 紫微 得 化科, 七殺 廟 | 吉 天馬',
    '  遷移 己卯: 天相 利 | 吉 文曲 祿存',
  ].sort())
  // 吉: 天馬·文曲·祿存, 煞: 鈴星
  expect(lines).toContain('삼방사정 보조성 수: 吉 3 · 煞 1')
  expect(lines).toContain('  化祿: 天機 在 疾厄')
  expect(lines).toContain('  化權: 天梁 在 疾厄')
  expect(lines).toContain('  化科: 紫微 在 財帛')
  expect(lines).toContain('  化忌: 太陰 在 田宅')
})

test('empty 명궁 borrows the main stars of the opposite palace', () => {
  const lines = ziweiFactsToText(createChart(2000, 3, 3, 10, 0, true, 'Asia/Seoul', 126.978)).split('\n')

  expect(lines).toContain('명궁 주성: 空宮 (乙酉) — 대궁 遷移 己卯 주성 차성: 紫微 利, 貪狼 陷')
  // 命宮 文曲·擎羊, 官祿 天魁, 財帛 文昌, 遷移 鈴星
  expect(lines).toContain('삼방사정 보조성 수: 吉 3 · 煞 2')
})

test('does not state a palace character, 격국 or 사화 interpretation', () => {
  const text = ziweiFactsToText(createChart(1995, 8, 3, 23, 10, false, 'America/New_York', -74.006))
  for (const verdict of ['격국:', '성격:', '格局', '길하다', '흉하다']) expect(text).not.toContain(verdict)
})
