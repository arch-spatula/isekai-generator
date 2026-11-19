/**
 * 자미두수 1차 판단(명궁 성격·격국·사화 해석)의 근거가 되는 사실만 규칙대로 계산한다.
 * 판단 결론은 내지 않는다. 각 항목 이름 옆에 계산 정의를 함께 적는다.
 */
import type { ZiweiChart, ZiweiPalace, ZiweiStar } from '@orrery/core/types'
import { MAIN_STAR_NAMES, PALACE_NAMES } from '@orrery/core/constants'

const ZHI = '子丑寅卯辰巳午未申酉戌亥'
/** chart-report.ts의 吉 분류와 같은 목록. 나머지 보조성은 煞로 본다. */
const LUCKY_STARS = new Set(['左輔', '右弼', '文昌', '文曲', '天魁', '天鉞', '祿存', '天馬'])
const HUA = ['化祿', '化權', '化科', '化忌']
/** 명궁 삼방사정에 모든 주성이 있는지 보는 성계 조합 */
const STAR_GROUPS: [string, string[]][] = [
  ['殺破狼', ['七殺', '破軍', '貪狼']],
  ['機月同梁', ['天機', '太陰', '天同', '天梁']],
]

function palaceAt(chart: ZiweiChart, zhi: string): ZiweiPalace {
  return Object.values(chart.palaces).find((palace) => palace.zhi === zhi)!
}

function shiftZhi(zhi: string, steps: number): string {
  return ZHI[(ZHI.indexOf(zhi) + steps + 12) % 12]
}

function mainStars(palace: ZiweiPalace): ZiweiStar[] {
  return palace.stars.filter((star) => MAIN_STAR_NAMES.has(star.name))
}

function formatMain(stars: ZiweiStar[]): string {
  return stars.map((star) => [star.name, star.brightness, star.siHua].filter(Boolean).join(' ')).join(', ')
}

/** 보조성을 吉과 煞로 나눈 이름 목록 */
function auxStars(palace: ZiweiPalace): { lucky: string[]; sha: string[] } {
  const aux = palace.stars.filter((star) => !MAIN_STAR_NAMES.has(star.name)).map((star) => star.name)
  return { lucky: aux.filter((name) => LUCKY_STARS.has(name)), sha: aux.filter((name) => !LUCKY_STARS.has(name)) }
}

function describePalace(palace: ZiweiPalace): string {
  const { lucky, sha } = auxStars(palace)
  const main = mainStars(palace)
  return [
    `${palace.name} ${palace.ganZhi}: ${main.length > 0 ? formatMain(main) : '(空宮)'}`,
    lucky.length > 0 ? `吉 ${lucky.join(' ')}` : null,
    sha.length > 0 ? `煞 ${sha.join(' ')}` : null,
  ].filter(Boolean).join(' | ')
}

export function ziweiFactsToText(chart: ZiweiChart): string {
  const lines = ['紫微斗數 사실 (규칙 계산값 · 명궁 성격·격국·사화 해석 아님)', '─────']

  const ming = palaceAt(chart, chart.mingGongZhi)
  const opposite = palaceAt(chart, shiftZhi(chart.mingGongZhi, 6))
  const mingMain = mainStars(ming)
  lines.push(mingMain.length > 0
    ? `명궁 주성: ${formatMain(mingMain)} (${ming.ganZhi})`
    : `명궁 주성: 空宮 (${ming.ganZhi}) — 대궁 ${opposite.name} ${opposite.ganZhi} 주성 차성: ${formatMain(mainStars(opposite)) || '(空宮)'}`)

  const shen = palaceAt(chart, chart.shenGongZhi)
  lines.push(`신궁: ${shen.name} (${shen.zhi})`)
  lines.push(`오행국: ${chart.wuXingJu.name}`)

  // 삼방사정: 명궁, 삼합(±4지지), 대궁(+6지지)
  const square = [0, 4, -4, 6].map((steps) => palaceAt(chart, shiftZhi(chart.mingGongZhi, steps)))
  lines.push('명궁 삼방사정 (명궁 · 삼합 ±4지지 · 대궁 +6지지):')
  for (const palace of square) lines.push(`  ${describePalace(palace)}`)
  const aux = square.flatMap((palace) => palace.stars.filter((star) => !MAIN_STAR_NAMES.has(star.name)))
  const luckyCount = aux.filter((star) => LUCKY_STARS.has(star.name)).length
  lines.push(`삼방사정 보조성 수: 吉 ${luckyCount} · 煞 ${aux.length - luckyCount}`)

  for (const [name, members] of STAR_GROUPS) {
    const inside = members.flatMap((member) => {
      const palace = square.find((candidate) => candidate.stars.some((star) => star.name === member))
      return palace != null ? [`${member} ${palace.name}`] : []
    })
    lines.push(`${name} (${members.join('·')}이 모두 명궁 삼방사정에 있음): ${
      inside.length === members.length ? '예' : '아니오'} — 삼방사정 안: ${inside.length > 0 ? inside.join(', ') : '없음'}`)
  }

  lines.push('궁별 보조성 수 (12궁, 吉·煞 분류는 삼방사정과 같음, 생년사화 표시):')
  for (const name of PALACE_NAMES) {
    const palace = chart.palaces[name]
    const { lucky, sha } = auxStars(palace)
    const hua = HUA.filter((item) => palace.stars.some((star) => star.siHua === item))
    lines.push(`  ${[`${palace.name} ${palace.ganZhi}: 吉 ${lucky.length}`, `煞 ${sha.length}`, ...(hua.length > 0 ? [hua.join(' ')] : [])].join(' · ')}`)
  }

  lines.push('생년사화 위치:')
  for (const hua of HUA) {
    const palace = Object.values(chart.palaces).find((candidate) => candidate.stars.some((star) => star.siHua === hua))
    const star = palace?.stars.find((candidate) => candidate.siHua === hua)
    lines.push(`  ${hua}: ${palace != null && star != null ? `${star.name} 在 ${palace.name}` : '명반에 없음'}`)
  }

  const jiPalace = Object.values(chart.palaces).find((palace) => palace.stars.some((star) => star.siHua === '化忌'))!
  const jiStar = jiPalace.stars.find((star) => star.siHua === '化忌')!
  const jiTarget = palaceAt(chart, shiftZhi(jiPalace.zhi, 6))
  lines.push(`化忌 충 (생년 化忌 궁의 대궁, +6지지): ${jiTarget.name} ${jiTarget.ganZhi} ← ${jiPalace.name} ${jiStar.name} 化忌`)

  return lines.join('\n')
}
