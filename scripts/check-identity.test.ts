import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkIdentity, classAbilities } from './check-identity.ts'

// fixture: 합성 번역 브리프를 입력으로 직접 쓴 이세계 정체성. 브리프의 장은 소년·청년·장년, 생업은 목수·공방 선생이다.
// 기대 위반은 docs/spec/claude-game-design-flow.md 5.5절과 docs/ADR/2026-11-24-isekai-identity-design.md 2번에서 정했다.
const fixtures = join(import.meta.dir, 'fixtures')
const brief = readFileSync(join(fixtures, 'translation-brief/translation-brief.md'), 'utf8')
const identity = readFileSync(join(fixtures, 'identity/identity.md'), 'utf8')

function replaceOnce(text: string, from: string, to: string): string {
  expect(text.split(from)).toHaveLength(2)
  return text.replace(from, to)
}
const check = (changed = identity) => checkIdentity({ identity: changed, brief })
const lineOf = (text: string) => identity.split('\n').indexOf(text) + 1

test('정상 정체성은 통과한다', () => {
  expect(check()).toEqual([])
})

test('클래스의 재료로 고른 주인공 능력을 읽는다', () => {
  expect(classAbilities(identity, brief)).toEqual({ name: '결 새김꾼', abilities: ['성질을 읽고 빚는 손', '고칠 곳을 짚는 눈'] })
})

test('섹션이 빠지거나 클래스가 둘이면 거부한다', () => {
  const start = identity.indexOf('## 부직업'), end = identity.indexOf('## 출신 도시')
  expect(check(identity.slice(0, start) + identity.slice(end))).toEqual(['섹션은 클래스, 부직업, 출신 도시, 장별 세계 순서여야 한다 (실제: 클래스, 출신 도시, 장별 세계)'])
  const two = replaceOnce(identity, '\n## 부직업', '### 두 번째 클래스\n재료: [brief:고칠 곳을 짚는 눈]\n하는 일: 틈을 짚는다\n판단: 비교용\n\n## 부직업')
  expect(check(two)).toEqual([`${lineOf('## 클래스')}: 클래스: 항목은 하나다 (실제: 2개)`])
})

test('클래스의 재료에 주인공 능력이 없으면 거부한다', () => {
  const changed = replaceOnce(identity, '재료: [brief:성질을 읽고 빚는 손] [brief:고칠 곳을 짚는 눈]', '재료: [brief:목수]')
  expect(check(changed)).toEqual([`${lineOf('재료: [brief:성질을 읽고 빚는 손] [brief:고칠 곳을 짚는 눈]')}: 클래스 > 결 새김꾼: 재료에 [brief:<주인공 능력>]이 없다`])
})

test('생업 이름을 그대로 클래스로 쓰면 거부한다', () => {
  const changed = replaceOnce(identity, '### 결 새김꾼', '### 목수')
  expect(check(changed)).toEqual([`${lineOf('### 결 새김꾼')}: 클래스 > 목수: 생업 이름을 그대로 클래스로 쓰지 않는다`])
})

test('부직업의 재료에 생업이나 능력이 없으면 거부한다', () => {
  const changed = replaceOnce(identity, '재료: [brief:목수] [brief:성질을 읽고 빚는 손]', '재료: [brief:출신지]')
  expect(check(changed)).toEqual([`${lineOf('재료: [brief:목수] [brief:성질을 읽고 빚는 손]')}: 부직업 > 수레 고치는 사람: 재료에 [brief:<생업>]이나 [brief:<주인공 능력>]이 없다`])
})

test('출신 도시에 산업·권력·역사가 없거나 출신지를 인용하지 않으면 거부한다', () => {
  const noPower = replaceOnce(identity, '권력: 목재 조합이 수량과 몫을 장부로 셈하고, 납기를 어긴 공방에서 일감을 거둔다\n', '')
  expect(check(noPower)).toEqual([`${lineOf('### 하구 목재 시장')}: 출신 도시 > 하구 목재 시장: 권력 필드가 없다`])
  const basis = replaceOnce(identity, '근거: [brief:출신지] [brief:가족 구조]', '근거: [brief:소년]')
  expect(check(basis)).toEqual([`${lineOf('근거: [brief:출신지] [brief:가족 구조]')}: 출신 도시 > 하구 목재 시장: 근거에 [brief:출신지]가 없다`])
  // 가족 구조만으로는 출신 도시의 재료가 되지 않는다. 출신지가 차트의 환경 자리에서 읽은 배경을 옮긴다(#97).
  const familyOnly = replaceOnce(identity, '근거: [brief:출신지] [brief:가족 구조]', '근거: [brief:가족 구조]')
  expect(check(familyOnly)).toEqual([`${lineOf('근거: [brief:출신지] [brief:가족 구조]')}: 출신 도시 > 하구 목재 시장: 근거에 [brief:출신지]가 없다`])
})

test('장별 세계가 브리프의 장과 다르거나 그 장을 인용하지 않으면 거부한다', () => {
  const start = identity.indexOf('### 장년')
  expect(check(identity.slice(0, start))).toEqual([`${lineOf('## 장별 세계')}: 장별 세계: 항목은 브리프의 장 소년, 청년, 장년 순서여야 한다 (실제: 소년, 청년)`])
  const basis = replaceOnce(identity, '근거: [brief:청년]', '근거: [brief:연인·배우자]')
  expect(check(basis)).toEqual([`${lineOf('근거: [brief:청년]')}: 장별 세계 > 청년: 근거에 [brief:청년]이 없다`])
})

test('브리프 밖 인용과 차트 명칭을 거부한다', () => {
  const life = replaceOnce(identity, '근거: [brief:소년]', '근거: [brief:소년] [life:유년]')
  expect(check(life)).toEqual([`${lineOf('근거: [brief:소년]')}: [life:유년] — 이 문서는 [brief:]만 인용한다`])
  const name = replaceOnce(identity, '### 하구 목재 시장', '### 무곡의 장부 도시')
  expect(check(name)).toEqual([`${lineOf('### 하구 목재 시장')}: 차트 명칭 '무곡'`])
})
