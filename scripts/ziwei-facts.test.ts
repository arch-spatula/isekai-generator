import { expect, test } from 'bun:test'
import { createChart } from '@orrery/core/ziwei'

import { ziweiFactsToText } from './ziwei-facts.ts'

// 기대값은 chart-report의 十二宮 표를 보고 삼방사정 규칙(명궁·삼합 ±4지지·대궁 +6지지)으로 손으로 골랐다.

/** 제목 줄 아래 들여쓴 항목들 */
function section(lines: string[], title: string): string[] {
  const start = lines.findIndex((line) => line.startsWith(title)) + 1
  const end = lines.findIndex((line, index) => index >= start && !line.startsWith('  '))
  return lines.slice(start, end === -1 ? undefined : end)
}

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

  // 十二宮 표의 吉·煞 줄과 四化를 궁마다 셌다.
  expect(section(lines, '궁별 보조성 수')).toEqual([
    '  命宮 乙酉: 吉 0 · 煞 1',
    '  兄弟 甲申: 吉 1 · 煞 1',
    '  夫妻 癸未: 吉 0 · 煞 0',
    '  子女 壬午: 吉 0 · 煞 0',
    '  財帛 辛巳: 吉 1 · 煞 0 · 化科',
    '  疾厄 庚辰: 吉 1 · 煞 1 · 化祿 化權',
    '  遷移 己卯: 吉 2 · 煞 0',
    '  交友 戊寅: 吉 0 · 煞 1',
    '  官祿 己丑: 吉 0 · 煞 0',
    '  田宅 戊子: 吉 1 · 煞 1 · 化忌',
    '  福德 丁亥: 吉 1 · 煞 0',
    '  父母 丙戌: 吉 1 · 煞 1',
  ])
  // 化忌 田宅(子) → 대궁 午
  expect(lines.find((line) => line.startsWith('化忌 충'))).toEndWith(': 子女 壬午 ← 田宅 太陰 化忌')
  // 삼방사정 酉·丑·巳·卯: 破軍 命宮, 貪狼 官祿, 七殺 財帛
  expect(lines.find((line) => line.startsWith('殺破狼'))).toEndWith(': 예 — 삼방사정 안: 七殺 財帛, 破軍 命宮, 貪狼 官祿')
  // 天機·天梁 疾厄(辰), 天同·太陰 田宅(子)는 삼방사정 밖
  expect(lines.find((line) => line.startsWith('機月同梁'))).toEndWith(': 아니오 — 삼방사정 안: 없음')
  // 大限 세는나이 2–11歲부터 10년씩 → 출생 연도 차로는 1–10, 11–20, …. 세는나이 1歲(연도 차 0)는 大限 이전
  expect(section(lines, '생애 단계별 大限')).toEqual([
    '  유년 0–12: 大限 이전 1–1歲, 命宮 乙酉 2–11歲, 父母 丙戌 12–21歲',
    '  소년 13–19: 父母 丙戌 12–21歲',
    '  청년 20–34: 父母 丙戌 12–21歲, 福德 丁亥 22–31歲, 田宅 戊子 32–41歲',
    '  장년 35–54: 田宅 戊子 32–41歲, 官祿 己丑 42–51歲, 交友 戊寅 52–61歲',
    '  노년 55–: 交友 戊寅 52–61歲, 遷移 己卯 62–71歲, 疾厄 庚辰 72–81歲, 財帛 辛巳 82–91歲, 子女 壬午 92–101歲, 夫妻 癸未 102–111歲, 兄弟 甲申 112–121歲',
  ])
})

test('empty 명궁 borrows the main stars of the opposite palace', () => {
  const lines = ziweiFactsToText(createChart(2000, 3, 3, 10, 0, true, 'Asia/Seoul', 126.978)).split('\n')

  expect(lines).toContain('명궁 주성: 空宮 (乙酉) — 대궁 遷移 己卯 주성 차성: 紫微 利, 貪狼 陷')
  // 命宮 文曲·擎羊, 官祿 天魁, 財帛 文昌, 遷移 鈴星
  expect(lines).toContain('삼방사정 보조성 수: 吉 3 · 煞 2')

  expect(section(lines, '궁별 보조성 수')).toEqual([
    '  命宮 乙酉: 吉 1 · 煞 1',
    '  兄弟 甲申: 吉 1 · 煞 0',
    '  夫妻 癸未: 吉 1 · 煞 2',
    '  子女 壬午: 吉 0 · 煞 1',
    '  財帛 辛巳: 吉 1 · 煞 0',
    '  疾厄 庚辰: 吉 1 · 煞 1',
    '  遷移 己卯: 吉 0 · 煞 1',
    '  交友 戊寅: 吉 1 · 煞 0 · 化科',
    '  官祿 己丑: 吉 1 · 煞 0',
    '  田宅 戊子: 吉 0 · 煞 0 · 化祿',
    '  福德 丁亥: 吉 0 · 煞 0 · 化權',
    '  父母 丙戌: 吉 1 · 煞 0 · 化忌',
  ])
  // 化忌 父母(戌) → 대궁 辰
  expect(lines.find((line) => line.startsWith('化忌 충'))).toEndWith(': 疾厄 庚辰 ← 父母 天同 化忌')
  // 삼방사정 酉·丑·巳·卯 중 貪狼만 遷移(卯)에 있고 七殺 夫妻(未)·破軍 福德(亥)는 밖
  expect(lines.find((line) => line.startsWith('殺破狼'))).toEndWith(': 아니오 — 삼방사정 안: 貪狼 遷移')
  expect(lines.find((line) => line.startsWith('機月同梁'))).toEndWith(': 아니오 — 삼방사정 안: 없음')
})

test('機月同梁 holds when all four stars sit in the 명궁 삼방사정: 子 命宮, 三合 辰·申, 對宮 午', () => {
  const lines = ziweiFactsToText(createChart(2000, 1, 15, 2, 0, true, 'Asia/Seoul', 126.978)).split('\n')

  // 天同·太陰 命宮(子), 天機·天梁 官祿(辰)
  expect(lines.find((line) => line.startsWith('機月同梁'))).toEndWith(': 예 — 삼방사정 안: 天機 官祿, 太陰 命宮, 天同 命宮, 天梁 官祿')
})

test('life stages compare 大限 in 세는나이 minus one: 火六局 starting at 6歲', () => {
  const lines = ziweiFactsToText(createChart(2001, 4, 5, 16, 0, false, 'Asia/Seoul', 126.978)).split('\n')

  // 福德 26–35歲 = 연도 차 25–34라 장년(35–)에 걸리지 않고, 官祿 46–55歲 = 45–54라 노년(55–)에 걸리지 않는다.
  expect(section(lines, '생애 단계별 大限')).toEqual([
    '  유년 0–12: 大限 이전 1–5歲, 命宮 丙申 6–15歲',
    '  소년 13–19: 命宮 丙申 6–15歲, 父母 丁酉 16–25歲',
    '  청년 20–34: 父母 丁酉 16–25歲, 福德 戊戌 26–35歲',
    '  장년 35–54: 田宅 己亥 36–45歲, 官祿 庚子 46–55歲',
    '  노년 55–: 交友 辛丑 56–65歲, 遷移 庚寅 66–75歲, 疾厄 辛卯 76–85歲, 財帛 壬辰 86–95歲, 子女 癸巳 96–105歲, 夫妻 甲午 106–115歲, 兄弟 乙未 116–125歲',
  ])
})

test('does not state a palace character, 격국 or 사화 interpretation', () => {
  const text = ziweiFactsToText(createChart(1995, 8, 3, 23, 10, false, 'America/New_York', -74.006))
  for (const verdict of ['격국:', '성격:', '格局', '길하다', '흉하다']) expect(text).not.toContain(verdict)
})
