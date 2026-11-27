import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkReview } from './check-review.ts'

// fixture: identity/identity.md(합성 정체성)를 대상으로 쓴 검토 문서. 필수(모순) 지적 하나와 권고(이세계다움) 지적 하나가 있다.
// 기대 위반은 docs/spec/claude-game-design-flow.md 4.7절에서 정했다.
const fixtures = join(import.meta.dir, 'fixtures')
const identity = readFileSync(join(fixtures, 'identity/identity.md'), 'utf8')
const review = readFileSync(join(fixtures, 'review/identity-review-1.md'), 'utf8')

function replaceOnce(text: string, from: string, to: string): string {
  expect(text.split(from)).toHaveLength(2)
  return text.replace(from, to)
}
const check = (changed = review) => checkReview({ review: changed, stage: 'identity', target: identity })
const lineOf = (text: string) => review.split('\n').indexOf(text) + 1
const passed = review.slice(0, review.indexOf('### 오가던 집안을 한곳에 묶음')).replace('판정: 되돌림', '판정: 통과')
const required = review.slice(review.indexOf('### 오가던 집안을 한곳에 묶음'), review.indexOf('### 현실 수리 일 그대로'))
const advisoryOnly = review.replace(required, '')

test('되돌림 검토와 지적 없는 통과 검토는 통과한다', () => {
  expect(check()).toEqual([])
  expect(check(passed)).toEqual([])
})

test('판정 값과 대상이 맞지 않으면 거부한다', () => {
  expect(check(replaceOnce(review, '판정: 되돌림', '판정: 보류'))).toEqual([`${lineOf('판정: 되돌림')}: 판정: 판정은 통과 또는 되돌림이다`])
  expect(check(replaceOnce(review, '대상: identity.md', '대상: world.md'))).toEqual([`${lineOf('대상: identity.md')}: 판정: 대상은 identity.md이다 (실제: world.md)`])
})

// 판정은 필수 기준(모순·직역) 지적의 유무로 정한다. 권고(재해석·투영·이세계다움·비교)만 있으면 통과다(#100).
test('되돌림은 모순·직역 지적이 있을 때만이고, 권고만 있으면 통과다', () => {
  expect(check(passed.replace('판정: 통과', '판정: 되돌림'))).toEqual([`${lineOf('## 지적')}: 지적: 되돌림이면 모순·직역 지적이 하나 이상 있어야 한다`])
  expect(check(advisoryOnly)).toEqual([`${lineOf('## 지적')}: 지적: 되돌림이면 모순·직역 지적이 하나 이상 있어야 한다`])
  expect(check(advisoryOnly.replace('판정: 되돌림', '판정: 통과'))).toEqual([])
  expect(check(replaceOnce(review, '판정: 되돌림', '판정: 통과'))).toEqual([`${lineOf('## 지적')}: 지적: 모순·직역 지적이 있으면 판정은 되돌림이다`])
  expect(check(replaceOnce(review, '기준: 모순', '기준: 직역'))).toEqual([])
})

test('지적의 위치가 대상 문서의 제목이 아니거나 기준이 목록 밖이면 거부한다', () => {
  expect(check(replaceOnce(review, '위치: 수레 고치는 사람', '위치: 노년'))).toEqual([
    `${lineOf('위치: 수레 고치는 사람')}: 지적 > 현실 수리 일 그대로: 위치 '노년'는 identity.md의 제목이 아니다 ('문서 전체'도 쓸 수 있다)`,
  ])
  expect(check(replaceOnce(review, '위치: 수레 고치는 사람', '위치: 문서 전체'))).toEqual([])
  expect(check(replaceOnce(review, '기준: 이세계다움', '기준: 재미'))).toEqual([
    `${lineOf('기준: 이세계다움')}: 지적 > 현실 수리 일 그대로: 기준은 재해석 · 투영 · 이세계다움 · 모순 · 직역 · 비교 중 하나다`,
  ])
})

// 검토는 단계마다 한 번이다. 두 번째 검토 문서는 지침만으로 막지 못해(실제 run에서 지적 없는 통과 뒤 두 번 더 부름) 검증기가 거부한다(#100).
test('두 번째 검토 문서는 거부한다', () => {
  expect(checkReview({ review, stage: 'identity', target: identity, number: 1 })).toEqual([])
  expect(checkReview({ review, stage: 'identity', target: identity, number: 2 }))
    .toEqual(['검토는 단계마다 한 번이다 — identity-review-1.md만 둔다 (실제: identity-review-2.md)'])
})

test('지적에 고칠 방향이 없으면 거부한다', () => {
  const changed = replaceOnce(review, '고칠 방향: 이 세계에서 수레가 왜 자주 부서지고 누가 그 수리를 찾는지 쓴다\n', '')
  expect(check(changed)).toEqual([`${lineOf('### 현실 수리 일 그대로')}: 지적 > 현실 수리 일 그대로: 고칠 방향 필드가 없다`])
})
