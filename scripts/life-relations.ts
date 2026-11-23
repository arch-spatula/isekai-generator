/**
 * 일생 해석 인물 사전의 관계 상태와 무게(함께 한 일·곁에 있던 시기·영향)를 검사한다.
 * 체계별 일생 해석과 통합 문서가 함께 쓴다. 계약: docs/spec/life-shape-and-relationship-status.md 5.2·5.4
 */
import { RELATION_STATUS } from './judgment-document.ts'
import { readLifeItems } from './life-document.ts'
import { LIFE_STAGES } from './life-stages.ts'

export { RELATION_STATUS }
/** 상태 필드가 있는 인물 칸과 그 상태를 정하는 1차 판단 섹션 */
export const RELATION_ITEMS: Record<string, string> = { '연인·배우자': '짝', '자녀': '자식', '제자': '제자' }
export const IMPACT = ['큼', '보통', '작음']
/** 인물 사전 8칸 모두에 있는 무게 필드 */
export const WEIGHT_FIELDS = ['함께 한 일', '곁에 있던 시기', '영향']
const STAGE_NAMES = LIFE_STAGES.map((stage) => stage.name)

/** 순서가 있는 값 셋의 중앙값. order는 큰 쪽부터다. */
export function median(values: string[], order: string[]): string {
  return [...values].sort((a, b) => order.indexOf(a) - order.indexOf(b))[Math.floor(values.length / 2)]
}

export interface RelationOptions {
  /** 인물 칸 → 기대 상태(1차 판단 결론이나 통합 중앙값). 없으면 상태 값의 일치는 보지 않는다 */
  expectedStatus?: Map<string, string>
  /** 인물 칸 → 기대 영향(통합 중앙값). 없으면 보지 않는다 */
  expectedImpact?: Map<string, string>
  /** 생애 연표가 있으면 곁에 있던 시기를 단계 이름으로 쓰고 인연과 맞춘다 */
  timeline: boolean
}

export function checkRelations(text: string, options: RelationOptions): string[] {
  const errors: string[] = []
  const items = readLifeItems(text)
  const ties = new Map<string, Set<string>>()
  for (const item of items.filter(({ section }) => section === '생애 연표')) {
    const value = item.fields.find(([key]) => key === '인연')?.[1] ?? ''
    for (const person of value.split(',').map((part) => part.trim()).filter(Boolean)) {
      ties.set(person, new Set([...(ties.get(person) ?? []), item.name]))
    }
  }

  for (const { name, fields } of items.filter(({ section }) => section === '인물 사전')) {
    const where = `인물 사전 > ${name}`
    const field = (key: string) => fields.find(([fieldKey]) => fieldKey === key)?.[1]
    const status = field('상태'), together = field('함께 한 일'), period = field('곁에 있던 시기'), impact = field('영향')

    if (name in RELATION_ITEMS) {
      if (status != null && !RELATION_STATUS.includes(status)) errors.push(`${where}: 상태 '${status}' — 허용값 ${RELATION_STATUS.join(' · ')}`)
      const expected = options.expectedStatus?.get(name)
      if (status != null && expected != null && status !== expected) errors.push(`${where}: 상태 불일치 — 문서 ${status}, 기대 ${expected}`)
    }
    if (impact != null && !IMPACT.includes(impact)) errors.push(`${where}: 영향 '${impact}' — 허용값 ${IMPACT.join(' · ')}`)
    const expectedImpact = options.expectedImpact?.get(name)
    if (impact != null && expectedImpact != null && IMPACT.includes(impact) && impact !== expectedImpact) {
      errors.push(`${where}: 영향 불일치 — 문서 ${impact}, 기대 ${expectedImpact}`)
    }

    if (status === '없음') {
      if (together != null && together !== '없음') errors.push(`${where}: 상태가 없음이면 함께 한 일은 없음이다`)
      if (period != null && period !== '없음') errors.push(`${where}: 상태가 없음이면 곁에 있던 시기는 없음이다`)
      if (impact != null && impact !== '작음') errors.push(`${where}: 상태가 없음이면 영향은 작음이다`)
      for (const stage of ties.get(name) ?? []) errors.push(`생애 연표 > ${stage}: 상태가 없음인 인물을 인연에 썼다 '${name}'`)
    }

    if (options.timeline && period != null && period !== '없음') {
      for (const stage of period.split(',').map((part) => part.trim())) {
        if (!STAGE_NAMES.includes(stage)) errors.push(`${where}: 곁에 있던 시기 '${stage}'는 생애 단계 이름이 아니다`)
        else if (!ties.get(name)?.has(stage)) errors.push(`${where}: 곁에 있던 시기 ${stage}의 생애 연표 인연에 이 인물이 없다`)
      }
    }
  }
  return errors
}
