/**
 * 자미두수 1차 판단(명궁 성격·격국·사화 해석)의 근거가 되는 사실만 규칙대로 계산한다.
 * 판단 결론은 내지 않는다. 각 항목 이름 옆에 계산 정의를 함께 적는다.
 */
import type { ZiweiChart, ZiweiPalace, ZiweiStar } from '@orrery/core/types'
import { MAIN_STAR_NAMES } from '@orrery/core/constants'

const ZHI = '子丑寅卯辰巳午未申酉戌亥'
/** chart-report.ts의 吉 분류와 같은 목록. 나머지 보조성은 煞로 본다. */
const LUCKY_STARS = new Set(['左輔', '右弼', '文昌', '文曲', '天魁', '天鉞', '祿存', '天馬'])

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

function describePalace(palace: ZiweiPalace): string {
  const aux = palace.stars.filter((star) => !MAIN_STAR_NAMES.has(star.name))
  const lucky = aux.filter((star) => LUCKY_STARS.has(star.name)).map((star) => star.name)
  const sha = aux.filter((star) => !LUCKY_STARS.has(star.name)).map((star) => star.name)
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

  lines.push('생년사화 위치:')
  for (const hua of ['化祿', '化權', '化科', '化忌']) {
    const palace = Object.values(chart.palaces).find((candidate) => candidate.stars.some((star) => star.siHua === hua))
    const star = palace?.stars.find((candidate) => candidate.siHua === hua)
    lines.push(`  ${hua}: ${palace != null && star != null ? `${star.name} 在 ${palace.name}` : '명반에 없음'}`)
  }

  return lines.join('\n')
}
