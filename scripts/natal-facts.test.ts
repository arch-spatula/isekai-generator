import { expect, test } from 'bun:test'
import { calculateNatal } from '@orrery/core/natal'
import type { BirthInput, PlanetId, ZodiacSign } from '@orrery/core/types'

import { dignities, natalFactsToText } from './natal-facts.ts'

// 기대값은 chart-report의 Planets 표(사인·하우스·역행)와 Major Aspects 목록을 보고 손으로 셌다.
// 품위는 전통 도미사일·엑잘테이션 표와 그 반대 사인(데트리먼트·폴)으로 손으로 판정했다.

/** 제목 줄 아래 들여쓴 항목들 */
function section(lines: string[], title: string): string[] {
  const start = lines.findIndex((candidate) => candidate.startsWith(title)) + 1
  const end = lines.findIndex((candidate, index) => index >= start && !candidate.startsWith('  '))
  return lines.slice(start, end === -1 ? undefined : end)
}

const newYork: BirthInput = {
  year: 1995, month: 8, day: 3, hour: 23, minute: 10, gender: 'F',
  latitude: 40.7128, longitude: -74.006, timezone: 'America/New_York',
}

test('night chart with Aries rising', async () => {
  const lines = natalFactsToText(await calculateNatal(newYork, 'P')).split('\n')
  const line = (prefix: string) => lines.find((candidate) => candidate.startsWith(prefix))

  expect(lines).toContain('ASC: Aries')
  expect(line('차트 룰러')).toEndWith(': Mars in Libra 6H')
  expect(line('섹트')).toEndWith('야간 — Sun 5H')
  // Fire: Sun·Mercury·Venus(Leo), Jupiter(Sag) / Earth: Uranus·Neptune(Cap) / Air: Mars(Libra) / Water: Moon·Pluto(Sco), Saturn(Pis)
  expect(line('원소 분포')).toEndWith('Fire 4 · Earth 2 · Air 1 · Water 3')
  expect(line('양태 분포')).toEndWith('Cardinal 3 · Fixed 5 · Mutable 2')
  // 위: Moon 7, Pluto 7, Jupiter 8, Uranus 10, Neptune 10, Saturn 12 / 동쪽: Uranus 10, Neptune 10, Saturn 12
  expect(line('반구')).toEndWith('지평선 위 7–12H 6 · 아래 1–6H 4 / 동쪽 10–3H 3 · 서쪽 4–9H 7')
  expect(line('앵글 하우스 행성')).toEndWith('Moon, Venus, Uranus, Neptune, Pluto')
  // 5H는 Sun·Mercury 둘뿐이라 하우스 스텔리움은 없다.
  expect(line('스텔리움')).toEndWith(': Leo: Sun, Mercury, Venus')
  expect(line('역행')).toEndWith('Saturn, Uranus, Neptune, Pluto')
  // Sun: Moon·Mars·Venus·Jupiter·Mercury, Mercury: Sun·Moon
  expect(line('메이저 애스펙트 수')).toContain('Sun 5')
  expect(line('메이저 애스펙트 수')).toContain('Mercury 2')
  expect(line('메이저 애스펙트 수')).toContain('Jupiter 4')
  // 전통 품위표: Sun 도미사일 Leo · Moon 폴 Scorpio · Mars 데트리먼트 Libra · Jupiter 도미사일 Sagittarius
  expect(section(lines, '본질적 품위')).toEqual([
    '  Sun in Leo: 도미사일',
    '  Moon in Scorpio: 폴',
    '  Mercury in Leo: 없음',
    '  Venus in Leo: 없음',
    '  Mars in Libra: 데트리먼트',
    '  Jupiter in Sagittarius: 도미사일',
    '  Saturn in Pisces: 없음',
  ])
  // 야간: 광체 Moon, 섹트 안 길성 Venus·흉성 Mars, 섹트 밖 길성 Jupiter·흉성 Saturn
  expect(line('섹트 소속')).toEndWith(': 섹트 광체 Moon · 섹트 안 길성 Venus · 섹트 안 흉성 Mars · 섹트 밖 길성 Jupiter · 섹트 밖 흉성 Saturn')
})

test('day chart sect and a planet with two dignities: Mercury in Virgo', async () => {
  const lines = natalFactsToText(await calculateNatal({
    year: 2000, month: 9, day: 5, hour: 12, minute: 0, gender: 'M',
    latitude: 37.5665, longitude: 126.978, timezone: 'Asia/Seoul',
  }, 'P')).split('\n')

  // Sun Virgo · Moon Sagittarius · Mercury Virgo · Venus Libra · Mars Leo · Jupiter Gemini · Saturn Gemini, Sun 10H
  expect(section(lines, '본질적 품위')).toEqual([
    '  Sun in Virgo: 없음',
    '  Moon in Sagittarius: 없음',
    '  Mercury in Virgo: 도미사일·엑잘테이션',
    '  Venus in Libra: 도미사일',
    '  Mars in Leo: 없음',
    '  Jupiter in Gemini: 데트리먼트',
    '  Saturn in Gemini: 없음',
  ])
  expect(lines.find((candidate) => candidate.startsWith('섹트 소속')))
    .toEndWith(': 섹트 광체 Sun · 섹트 안 길성 Jupiter · 섹트 안 흉성 Saturn · 섹트 밖 길성 Venus · 섹트 밖 흉성 Mars')
})

test('Scorpio rising lists both traditional and modern rulers', async () => {
  const lines = natalFactsToText(await calculateNatal({ ...newYork, hour: 13, minute: 0 }, 'P')).split('\n')

  expect(lines).toContain('ASC: Scorpio')
  expect(lines).toContain('차트 룰러 (ASC 사인의 지배성, 전통 / 현대): Mars in Libra 11H / Pluto in Scorpio 1H')
})

test('does not state a chart ruler meaning or dominant temperament conclusion', async () => {
  const text = natalFactsToText(await calculateNatal(newYork, 'P'))
  for (const verdict of ['우세:', '기질:', 'dominant', 'strongest']) expect(text).not.toContain(verdict)
})

test('essential dignity table: domicile and exaltation, detriment and fall in the opposite sign', () => {
  // 전통 품위표 (행성: 도미사일 / 엑잘테이션)
  const table: [PlanetId, ZodiacSign[], ZodiacSign][] = [
    ['Sun', ['Leo'], 'Aries'],
    ['Moon', ['Cancer'], 'Taurus'],
    ['Mercury', ['Gemini', 'Virgo'], 'Virgo'],
    ['Venus', ['Taurus', 'Libra'], 'Pisces'],
    ['Mars', ['Aries', 'Scorpio'], 'Capricorn'],
    ['Jupiter', ['Sagittarius', 'Pisces'], 'Cancer'],
    ['Saturn', ['Capricorn', 'Aquarius'], 'Libra'],
  ]
  const opposite: Record<ZodiacSign, ZodiacSign> = {
    Aries: 'Libra', Taurus: 'Scorpio', Gemini: 'Sagittarius', Cancer: 'Capricorn', Leo: 'Aquarius', Virgo: 'Pisces',
    Libra: 'Aries', Scorpio: 'Taurus', Sagittarius: 'Gemini', Capricorn: 'Cancer', Aquarius: 'Leo', Pisces: 'Virgo',
  }
  for (const [planet, domiciles, exaltation] of table) {
    for (const sign of Object.keys(opposite) as ZodiacSign[]) {
      const expected = [
        domiciles.includes(sign) ? '도미사일' : null,
        sign === exaltation ? '엑잘테이션' : null,
        domiciles.includes(opposite[sign]) ? '데트리먼트' : null,
        opposite[sign] === exaltation ? '폴' : null,
      ].filter((name) => name != null)
      expect([planet, sign, dignities(planet, sign)]).toEqual([planet, sign, expected])
    }
  }
})
