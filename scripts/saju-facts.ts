/**
 * 사주 1차 판단(강약·격국·용신)의 근거가 되는 사실만 규칙대로 계산한다.
 * 판단 결론은 내지 않는다. 각 항목 이름 옆에 계산 정의를 함께 적는다.
 */
import type { SajuResult } from '@orrery/core/types'
import { BRANCH_ELEMENT, ELEMENT_HANJA, STEM_INFO } from '@orrery/core/constants'
import { getJeonggi } from '@orrery/core/pillars'

type SipsinGroup = '비겁' | '식상' | '재성' | '관성' | '인성'

const SIPSIN_GROUP: Record<string, SipsinGroup> = {
  比肩: '비겁', 劫財: '비겁', 食神: '식상', 傷官: '식상', 偏財: '재성', 正財: '재성',
  偏官: '관성', 正官: '관성', 偏印: '인성', 正印: '인성',
}
const GROUPS: SipsinGroup[] = ['비겁', '식상', '재성', '관성', '인성']
const SEASON: Record<string, string> = {
  寅: '봄', 卯: '봄', 辰: '봄', 巳: '여름', 午: '여름', 未: '여름',
  申: '가을', 酉: '가을', 戌: '가을', 亥: '겨울', 子: '겨울', 丑: '겨울',
}
/** orrery pillars 순서(시, 일, 월, 년)의 위치 이름 */
const PILLAR_LABELS = ['時', '日', '月', '年']

/** 일간을 돕는 십신(비겁·인성)인지 */
function supportsDayMaster(sipsin: string): boolean {
  const group = SIPSIN_GROUP[sipsin]
  return group === '비겁' || group === '인성'
}

/** 시주를 포함한 사주(출생 시각 확정)를 받는다. */
export function sajuFactsToText(result: SajuResult): string {
  const [hour, day, month, year] = result.pillars
  const dayStem = day.pillar.stem
  const dayInfo = STEM_INFO[dayStem]
  const lines = ['四柱 사실 (규칙 계산값 · 강약·격국·용신 판단 아님)', '─────']

  lines.push(`일간: ${dayStem} (${ELEMENT_HANJA[dayInfo.element]}, ${dayInfo.yinyang === '+' ? '陽' : '陰'})`)

  const monthBranch = month.pillar.branch
  const monthMain = getJeonggi(monthBranch)
  lines.push(`월령: ${monthBranch}월 · 정기 ${monthMain}(${ELEMENT_HANJA[STEM_INFO[monthMain].element]}) · 계절 ${SEASON[monthBranch]}`)

  const elementCounts: Record<string, number> = { tree: 0, fire: 0, earth: 0, metal: 0, water: 0 }
  for (const { pillar } of result.pillars) {
    elementCounts[STEM_INFO[pillar.stem].element]++
    elementCounts[BRANCH_ELEMENT[pillar.branch]]++
  }
  lines.push(`오행 분포 (천간 4 + 지지 4, 지지는 지지 자체 오행, 가중치 없음): ${
    Object.entries(elementCounts).map(([element, count]) => `${ELEMENT_HANJA[element]} ${count}`).join(' · ')}`)

  const groupCounts = Object.fromEntries(GROUPS.map((group) => [group, 0])) as Record<SipsinGroup, number>
  for (const pillar of result.pillars) {
    if (pillar !== day) groupCounts[SIPSIN_GROUP[pillar.stemSipsin]]++
    groupCounts[SIPSIN_GROUP[pillar.branchSipsin]]++
  }
  lines.push(`십신 분포 (일간 제외 7자, 지지는 정기 기준): ${GROUPS.map((group) => `${group} ${groupCounts[group]}`).join(' · ')}`)

  const verdict = (label: string, pillar: typeof day) => {
    return `${supportsDayMaster(pillar.branchSipsin) ? '예' : '아니오'} — ${label} ${pillar.pillar.branch} 정기 ${getJeonggi(pillar.pillar.branch)} = ${pillar.branchSipsin}`
  }
  lines.push(`득령 (월지 정기가 비겁·인성): ${verdict('月支', month)}`)
  lines.push(`득지 (일지 정기가 비겁·인성): ${verdict('日支', day)}`)

  const others: [string, string][] = [
    ['年干', year.stemSipsin], ['年支', year.branchSipsin], ['月干', month.stemSipsin],
    ['時干', hour.stemSipsin], ['時支', hour.branchSipsin],
  ]
  const supporting = others.filter(([, sipsin]) => supportsDayMaster(sipsin))
  lines.push(`득세 근거 (年干·年支·月干·時干·時支 중 비겁·인성 수): ${supporting.length}/5${
    supporting.length > 0 ? ` — ${supporting.map(([label, sipsin]) => `${label} ${sipsin}`).join(', ')}` : ''}`)

  lines.push('투출 (지지 지장간이 일간 외 천간에 나타남):')
  const visibleStems = result.pillars
    .map((pillar, index) => ({ stem: pillar.pillar.stem, label: `${PILLAR_LABELS[index]}干` }))
    .filter((_, index) => index !== 1)
  let anyVisible = false
  result.pillars.forEach((pillar, index) => {
    const hits = [...pillar.jigang.replace(/\s/g, '')].flatMap((hidden) =>
      visibleStems.filter(({ stem }) => stem === hidden).map(({ label }) => `${hidden}→${label}`))
    if (hits.length > 0) {
      anyVisible = true
      lines.push(`  ${PILLAR_LABELS[index]}支 ${pillar.pillar.branch}: ${hits.join(', ')}`)
    }
  })
  if (!anyVisible) lines.push('  없음')

  return lines.join('\n')
}
