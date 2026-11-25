/**
 * 게임 단계 검토 문서(`<단계>-review-<n>.md`)의 형식과 지적 위치를 검사한다. 판정의 타당성은 보지 않는다.
 * 계약: docs/spec/claude-game-design-flow.md 4.7절, docs/ADR/2026-11-25-single-pass-review.md
 */
import { readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { checkSectionOrder, fieldsOf, headingNames, parseGameDocument, type Report } from './game-document.ts'

/** 검토하는 단계와 그 산출물 */
export const REVIEWED = { identity: 'identity.md', combat: 'combat.md', world: 'world.md' } as const
export type ReviewedStage = keyof typeof REVIEWED
export const VERDICTS = ['통과', '되돌림']
/** 지적의 기준. 정체성·세계의 목표와 경계, 정체성·전투의 비교에서 나온다 */
export const CRITERIA = ['재해석', '투영', '이세계다움', '모순', '직역', '비교']
/** 반드시 고쳐야 하는 기준. 브리프 사실과의 모순과 기호 직역은 판단의 정도가 아니라 있고 없음이라 판정을 가른다(#100). 나머지는 권고다 */
export const REQUIRED_CRITERIA = ['모순', '직역']
/** 위치에 항목 대신 쓸 수 있는 말 */
const WHOLE = '문서 전체'

/** number는 파일 이름의 <n>. 검토는 단계마다 한 번이라 1만 허용한다(#100) */
export interface ReviewTexts { review: string; stage: ReviewedStage; target: string; number?: number }

export function checkReview({ review, stage, target, number }: ReviewTexts): string[] {
  const errors: string[] = []
  const report: Report = (line, message) => errors.push(line == null ? message : `${line}: ${message}`)
  if (number != null && number !== 1) report(null, `검토는 단계마다 한 번이다 — ${stage}-review-1.md만 둔다 (실제: ${stage}-review-${number}.md)`)
  const sections = parseGameDocument(review, '# 검토', report)
  checkSectionOrder(sections, ['판정', '지적'], report)

  const verdictSection = sections.find(({ name }) => name === '판정')
  let verdict: string | undefined
  if (verdictSection != null) {
    for (const item of verdictSection.items) report(item.line, `판정: 항목을 두지 않는다`)
    const fields = fieldsOf('판정', verdictSection, ['대상', '판정'], report)
    const targetField = fields.get('대상')
    if (targetField != null && targetField.value !== '' && targetField.value !== REVIEWED[stage]) {
      report(targetField.line, `판정: 대상은 ${REVIEWED[stage]}이다 (실제: ${targetField.value})`)
    }
    const verdictField = fields.get('판정')
    verdict = verdictField?.value
    if (verdictField != null && verdict !== '' && !VERDICTS.includes(verdict!)) report(verdictField.line, `판정: 판정은 ${VERDICTS.join(' 또는 ')}이다`)
  }

  const findings = sections.find(({ name }) => name === '지적')
  if (findings != null) {
    for (const field of findings.fields) report(field.line, `지적: 허용하지 않는 필드 '${field.key}'`)
    const names = headingNames(target)
    let required = 0
    for (const item of findings.items) {
      const where = `지적 > ${item.name}`
      const fields = fieldsOf(where, item, ['위치', '기준', '내용', '고칠 방향'], report)
      const place = fields.get('위치')
      if (place != null && place.value !== '' && place.value !== WHOLE && !names.has(place.value)) {
        report(place.line, `${where}: 위치 '${place.value}'는 ${REVIEWED[stage]}의 제목이 아니다 ('${WHOLE}'도 쓸 수 있다)`)
      }
      const criterion = fields.get('기준')
      if (criterion != null && criterion.value !== '' && !CRITERIA.includes(criterion.value)) report(criterion.line, `${where}: 기준은 ${CRITERIA.join(' · ')} 중 하나다`)
      if (criterion != null && REQUIRED_CRITERIA.includes(criterion.value)) required += 1
    }
    // 판정은 필수 기준의 지적이 있는지로 정한다. 권고만 있으면 통과다.
    if (verdict === '되돌림' && required === 0) report(findings.line, `지적: 되돌림이면 ${REQUIRED_CRITERIA.join('·')} 지적이 하나 이상 있어야 한다`)
    if (verdict === '통과' && required > 0) report(findings.line, `지적: ${REQUIRED_CRITERIA.join('·')} 지적이 있으면 판정은 되돌림이다`)
  }
  return errors
}

if (import.meta.main) {
  const [path] = process.argv.slice(2)
  const match = path == null ? null : basename(path).match(/^(identity|combat|world)-review-(\d+)\.md$/)
  if (path == null || match == null) {
    console.error('usage: bun scripts/check-review.ts <차트 디렉터리>/<identity|combat|world>-review-<n>.md')
    process.exit(1)
  }
  const stage = match[1] as ReviewedStage
  const read = (file: string) => {
    try {
      return readFileSync(file, 'utf8')
    } catch {
      console.error(`읽을 수 없음: ${file}`)
      process.exit(1)
    }
  }
  const errors = checkReview({ review: read(path), stage, target: read(join(dirname(path), REVIEWED[stage])), number: Number(match[2]) })
  for (const error of errors) console.log(error)
  process.exit(errors.length > 0 ? 1 : 0)
}
