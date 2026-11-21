/**
 * 사주 1차 판단(강약·격국·용신)의 근거가 되는 사실만 규칙대로 계산한다.
 * 판단 결론은 내지 않는다. 각 항목 이름 옆에 계산 정의를 함께 적는다.
 */
import type { SajuResult } from '@orrery/core/types'
import { BRANCH_ELEMENT, ELEMENT_HANJA, STEM_INFO } from '@orrery/core/constants'
import { getJeonggi } from '@orrery/core/pillars'

import { LIFE_STAGES, overlaps, stageLabel } from './life-stages.ts'

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
/** orrery 지장간 문자열의 자리(공백은 중기 없음) */
const HIDDEN_POSITIONS = ['여기', '중기', '정기']

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

  lines.push('통근 (천간과 같은 오행의 지장간이 있는 지지, 지장간 자리 여기·중기·정기):')
  result.pillars.forEach(({ pillar: { stem } }, stemIndex) => {
    const element = STEM_INFO[stem].element
    const roots = result.pillars.flatMap(({ pillar, jigang }, branchIndex) => [...jigang].flatMap((hidden, position) =>
      hidden !== ' ' && STEM_INFO[hidden].element === element
        ? [`${PILLAR_LABELS[branchIndex]}支 ${pillar.branch} ${HIDDEN_POSITIONS[position]} ${hidden}`]
        : []))
    lines.push(`  ${PILLAR_LABELS[stemIndex]}干 ${stem}(${ELEMENT_HANJA[element]}): ${roots.length > 0 ? roots.join(', ') : '없음'}`)
  })

  const periods = result.daewoon.map((item, index) => ({
    label: `${item.index}運 ${item.ganzi}`,
    from: item.age,
    to: (result.daewoon[index + 1]?.age ?? item.age + 10) - 1,
  }))
  if (periods.length > 0 && periods[0].from > 0) periods.unshift({ label: '대운 이전', from: 0, to: periods[0].from - 1 })
  lines.push(`생애 단계별 大運 (단계 나이와 大運 표시 나이는 출생 연도 차, 단계와 구간이 겹치는 大運):`)
  for (const stage of LIFE_STAGES) {
    const hits = periods.filter((period) => overlaps(stage, period.from, period.to))
    lines.push(`  ${stageLabel(stage)}: ${hits.map((period) => `${period.label} ${period.from}–${period.to}`).join(', ')}`)
  }

  const male = result.input.gender === 'M'
  // 일간의 천간 십신은 本元이라 어느 역할에도 해당하지 않는다.
  const positions = result.pillars.flatMap((pillar, index) => [
    { label: `${PILLAR_LABELS[index]}干`, sipsin: pillar.stemSipsin },
    { label: `${PILLAR_LABELS[index]}支`, sipsin: pillar.branchSipsin },
  ])
  const sex = male ? '남: ' : '여: '
  /** [역할, 성별에 따라 달라지면 접두사, 십신] */
  const kin: [string, string, string[]][] = [
    ['어머니', '', ['正印']],
    ['아버지', '', ['偏財']],
    ['형제', '', ['比肩', '劫財']],
    ['배우자', sex, male ? ['正財'] : ['正官']],
    ['자녀', sex, male ? ['正官', '偏官'] : ['食神', '傷官']],
  ]
  lines.push('육친 (십신 → 가족 역할, 일간 외 천간과 지지 정기 기준 · 배우자 자리는 日支):')
  for (const [role, prefix, sipsins] of kin) {
    const found = positions.filter(({ sipsin }) => sipsins.includes(sipsin)).map(({ label, sipsin }) => `${label} ${sipsin}`)
    lines.push(`  ${role} (${prefix}${sipsins.join('·')}): ${found.length > 0 ? found.join(', ') : '없음'}`)
  }
  lines.push(`  배우자 자리: 日支 ${day.pillar.branch} ${day.branchSipsin}`)

  return lines.join('\n')
}
