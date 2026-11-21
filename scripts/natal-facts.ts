/**
 * 네이탈 1차 판단(차트 룰러·주요 행성·우세 기질 해석)의 근거가 되는 사실만 규칙대로 계산한다.
 * 판단 결론은 내지 않는다. 각 항목 이름 옆에 계산 정의를 함께 적는다.
 */
import type { NatalChart, PlanetId, PlanetPosition, ZodiacSign } from '@orrery/core/types'

/** 분포·반구·스텔리움 계산 대상: 전통 7행성 + 외행성 3개 */
const PLANETS: PlanetId[] = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']

const TRADITIONAL_RULER: Record<ZodiacSign, PlanetId> = {
  Aries: 'Mars', Taurus: 'Venus', Gemini: 'Mercury', Cancer: 'Moon', Leo: 'Sun', Virgo: 'Mercury',
  Libra: 'Venus', Scorpio: 'Mars', Sagittarius: 'Jupiter', Capricorn: 'Saturn', Aquarius: 'Saturn', Pisces: 'Jupiter',
}
const MODERN_RULER: Partial<Record<ZodiacSign, PlanetId>> = { Scorpio: 'Pluto', Aquarius: 'Uranus', Pisces: 'Neptune' }
const EXALTATION: Partial<Record<ZodiacSign, PlanetId>> = {
  Aries: 'Sun', Taurus: 'Moon', Virgo: 'Mercury', Pisces: 'Venus', Capricorn: 'Mars', Cancer: 'Jupiter', Libra: 'Saturn',
}
const SIGNS = Object.keys(TRADITIONAL_RULER) as ZodiacSign[]
/** 본질적 품위 대상: 전통 7행성 */
const TRADITIONAL_PLANETS: PlanetId[] = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']

const ELEMENT: Record<ZodiacSign, string> = {
  Aries: 'Fire', Leo: 'Fire', Sagittarius: 'Fire', Taurus: 'Earth', Virgo: 'Earth', Capricorn: 'Earth',
  Gemini: 'Air', Libra: 'Air', Aquarius: 'Air', Cancer: 'Water', Scorpio: 'Water', Pisces: 'Water',
}
const MODALITY: Record<ZodiacSign, string> = {
  Aries: 'Cardinal', Cancer: 'Cardinal', Libra: 'Cardinal', Capricorn: 'Cardinal',
  Taurus: 'Fixed', Leo: 'Fixed', Scorpio: 'Fixed', Aquarius: 'Fixed',
  Gemini: 'Mutable', Virgo: 'Mutable', Sagittarius: 'Mutable', Pisces: 'Mutable',
}

function opposite(sign: ZodiacSign): ZodiacSign {
  return SIGNS[(SIGNS.indexOf(sign) + 6) % 12]
}

/** 도미사일·엑잘테이션과 그 반대 사인의 데트리먼트·폴 */
export function dignities(id: PlanetId, sign: ZodiacSign): string[] {
  return [
    TRADITIONAL_RULER[sign] === id ? '도미사일' : null,
    EXALTATION[sign] === id ? '엑잘테이션' : null,
    TRADITIONAL_RULER[opposite(sign)] === id ? '데트리먼트' : null,
    EXALTATION[opposite(sign)] === id ? '폴' : null,
  ].filter((name) => name != null)
}

function countBy(planets: PlanetPosition[], key: (planet: PlanetPosition) => string, order: string[]): string {
  return order.map((value) => `${value} ${planets.filter((planet) => key(planet) === value).length}`).join(' · ')
}

function names(planets: PlanetPosition[]): string {
  return planets.length > 0 ? planets.map((planet) => planet.id).join(', ') : '없음'
}

/** 출생 시각을 알아 하우스·앵글이 있는 차트를 받는다. */
export function natalFactsToText(chart: NatalChart): string {
  const lines = ['Natal 사실 (규칙 계산값 · 차트 룰러·주요 행성·기질 해석 아님)', '─────']
  const planets = PLANETS.map((id) => chart.planets.find((planet) => planet.id === id)!)
  const byId = (id: PlanetId) => planets.find((planet) => planet.id === id)!

  const ascSign = chart.angles!.asc.sign
  const rulers = [TRADITIONAL_RULER[ascSign], MODERN_RULER[ascSign]].filter((id) => id != null)
  lines.push(`ASC: ${ascSign}`)
  lines.push(`차트 룰러 (ASC 사인의 지배성, 전통${rulers.length > 1 ? ' / 현대' : ''}): ${
    rulers.map((id) => `${id} in ${byId(id).sign} ${byId(id).house}H`).join(' / ')}`)

  const sun = byId('Sun')
  const diurnal = sun.house! >= 7
  lines.push(`섹트 (태양이 7–12하우스면 주간): ${diurnal ? '주간' : '야간'} — Sun ${sun.house}H`)
  const [inBenefic, inMalefic, outBenefic, outMalefic] = diurnal ? ['Jupiter', 'Saturn', 'Venus', 'Mars'] : ['Venus', 'Mars', 'Jupiter', 'Saturn']
  lines.push(`섹트 소속 (주간은 Sun·Jupiter·Saturn, 야간은 Moon·Venus·Mars가 섹트 안): 섹트 광체 ${diurnal ? 'Sun' : 'Moon'} · ${
    `섹트 안 길성 ${inBenefic} · 섹트 안 흉성 ${inMalefic} · 섹트 밖 길성 ${outBenefic} · 섹트 밖 흉성 ${outMalefic}`}`)

  lines.push('본질적 품위 (전통 7행성 · 도미사일·엑잘테이션, 반대 사인 데트리먼트·폴):')
  for (const id of TRADITIONAL_PLANETS) {
    const { sign } = byId(id)
    const found = dignities(id, sign)
    lines.push(`  ${id} in ${sign}: ${found.length > 0 ? found.join('·') : '없음'}`)
  }

  lines.push(`원소 분포 (10행성, 가중치 없음): ${countBy(planets, (planet) => ELEMENT[planet.sign], ['Fire', 'Earth', 'Air', 'Water'])}`)
  lines.push(`양태 분포 (10행성, 가중치 없음): ${countBy(planets, (planet) => MODALITY[planet.sign], ['Cardinal', 'Fixed', 'Mutable'])}`)

  const above = planets.filter((planet) => planet.house! >= 7).length
  const east = planets.filter((planet) => planet.house! >= 10 || planet.house! <= 3).length
  lines.push(`반구 (10행성): 지평선 위 7–12H ${above} · 아래 1–6H ${planets.length - above} / 동쪽 10–3H ${east} · 서쪽 4–9H ${planets.length - east}`)

  lines.push(`앵글 하우스 행성 (1·4·7·10H): ${names(planets.filter((planet) => [1, 4, 7, 10].includes(planet.house!)))}`)

  const stelliums: string[] = []
  for (const sign of new Set(planets.map((planet) => planet.sign))) {
    const members = planets.filter((planet) => planet.sign === sign)
    if (members.length >= 3) stelliums.push(`${sign}: ${names(members)}`)
  }
  for (const house of new Set(planets.map((planet) => planet.house!))) {
    const members = planets.filter((planet) => planet.house === house)
    if (members.length >= 3) stelliums.push(`${house}H: ${names(members)}`)
  }
  lines.push(`스텔리움 (같은 사인·하우스에 10행성 중 3개 이상): ${stelliums.length > 0 ? stelliums.join(' / ') : '없음'}`)

  lines.push(`역행 (10행성): ${names(planets.filter((planet) => planet.isRetrograde))}`)

  lines.push('하우스별 룰러와 행성 (커스프 사인의 전통 룰러와 그 위치 · 하우스 안 10행성):')
  for (const house of chart.houses) {
    const ruler = byId(TRADITIONAL_RULER[house.sign])
    const inside = planets.filter((planet) => planet.house === house.number)
    lines.push(`  ${house.number}H ${house.sign}: 룰러 ${ruler.id} in ${ruler.sign} ${ruler.house}H · 행성 ${names(inside)}`)
  }

  const aspectCounts = PLANETS
    .map((id) => ({ id, count: chart.aspects.filter((aspect) => aspect.planet1 === id || aspect.planet2 === id).length }))
    .sort((a, b) => b.count - a.count)
  lines.push(`메이저 애스펙트 수 (orrery 애스펙트 목록 기준, 상대 천체 무관): ${
    aspectCounts.map(({ id, count }) => `${id} ${count}`).join(' · ')}`)

  return lines.join('\n')
}
