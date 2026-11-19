import { expect, test } from 'bun:test'
import { calculateNatal } from '@orrery/core/natal'
import type { BirthInput } from '@orrery/core/types'

import { natalFactsToText } from './natal-facts.ts'

// 기대값은 chart-report의 Planets 표(사인·하우스·역행)와 Major Aspects 목록을 보고 손으로 셌다.

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
