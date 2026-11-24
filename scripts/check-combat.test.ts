import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkCombat } from './check-combat.ts'

// fixture: translation-brief/translation-brief.md(합성 브리프)를 입력으로 직접 쓴 전투 설계. 브리프의 주인공 능력은 셋, 동료는
// 스승·후원자와 연인·배우자다. 기대 위반은 docs/spec/claude-game-design-flow.md 4.3·5.2·6절과 전투 원형 ADR 2.1·2.2에서 정했다.
const fixtures = join(import.meta.dir, 'fixtures')
const brief = readFileSync(join(fixtures, 'translation-brief/translation-brief.md'), 'utf8')
const combat = readFileSync(join(fixtures, 'combat/combat.md'), 'utf8')

function replaceOnce(text: string, from: string, to: string): string {
  expect(text.split(from)).toHaveLength(2)
  return text.replace(from, to)
}
const check = (changes: { combat?: string; brief?: string } = {}) => checkCombat({ combat: changes.combat ?? combat, brief: changes.brief ?? brief })
const lineOf = (text: string) => combat.split('\n').indexOf(text) + 1

test('정상 전투 설계는 통과한다', () => {
  expect(check()).toEqual([])
})

test('후보가 네 개가 아니면 거부한다', () => {
  const three = combat.replace(/### 성질을 바꾸는 손\n[^#]*/, '')
  expect(check({ combat: three })).toEqual([`${lineOf('## 후보')}: 후보: 후보는 4개여야 한다 (실제: 3)`])
})

test('이름만 다르고 축이 거의 같은 후보를 거부한다', () => {
  // 성질을 바꾸는 손을 빚어 세우는 손과 거리·매개체·주도·공간·리듬이 같게 만든다. 숙련·위험 두 축만 다르다.
  const same = replaceOnce(combat, '전투 거리: 원거리\n힘의 매개체: 주문\n주도 방식: 직접 타격\n공간 활용: 추격\n전투 리듬: 축적 후 폭발',
    '전투 거리: 중거리\n힘의 매개체: 설치물\n주도 방식: 준비·함정\n공간 활용: 진지 구축\n전투 리듬: 준비 후 실행')
  expect(check({ combat: same })).toEqual(['후보 > 빚어 세우는 손 · 성질을 바꾸는 손: 다른 축이 2개다 (최소 3개)'])
})

test('축 값이 허용값이 아니면 거부한다', () => {
  const changed = replaceOnce(combat, '힘의 매개체: 주문', '힘의 매개체: 노래')
  expect(check({ combat: changed })).toEqual([`${lineOf('힘의 매개체: 주문')}: 후보 > 성질을 바꾸는 손: 힘의 매개체 '노래' — 허용값 신체 · 무기 · 주문 · 소환체 · 설치물 · 환경 · 장치 · 기호 · 소리 · 물질`])
})

test('출처가 브리프의 주인공 능력이 아니면 거부한다', () => {
  const changed = replaceOnce(combat, '출처: [brief:고칠 곳을 짚는 눈]', '출처: [brief:출신지]')
  expect(check({ combat: changed })).toEqual([`${lineOf('출처: [brief:고칠 곳을 짚는 눈]')}: 후보 > 틈을 짚는 일격: 출처 [brief:출신지]는 브리프의 주인공 능력이 아니다`])
})

test('채택이 하나가 아니거나 전투 방식의 채택과 다르면 거부한다', () => {
  const two = replaceOnce(combat, '판단: 제외 — 만든 것을 남기는 재능이 쓰고 사라지는 힘으로 바뀐다', '판단: 채택')
  expect(check({ combat: two })).toContain(`${lineOf('## 후보')}: 후보: 채택한 후보는 하나여야 한다 (실제: 2)`)
  const other = replaceOnce(combat, '채택: 빚어 세우는 손', '채택: 틈을 짚는 일격')
  expect(check({ combat: other })).toEqual([`${lineOf('채택: 빚어 세우는 손')}: 전투 방식: 채택 '틈을 짚는 일격' — 후보에서 채택한 것은 '빚어 세우는 손'`])
  const noReason = replaceOnce(combat, '판단: 제외 — 동료가 청년의 장에만 있어 다른 장에서 전투가 성립하지 않는다', '판단: 제외')
  expect(check({ combat: noReason })).toEqual([`${lineOf('판단: 제외 — 동료가 청년의 장에만 있어 다른 장에서 전투가 성립하지 않는다')}: 후보 > 함께 지키는 터: 판단은 '채택' 또는 '제외 — <이유>'이다`])
})

test('런 밖 성장이 브리프의 능력을 인용하지 않으면 거부한다', () => {
  const line = '런 밖 성장: 런에서 익힌 재료의 성질이 쌓여 처음부터 빚을 수 있는 구조가 늘어난다 [brief:성질을 읽고 빚는 손]'
  const changed = replaceOnce(combat, line, '런 밖 성장: 런에서 익힌 재료의 성질이 쌓인다')
  expect(check({ combat: changed })).toEqual([`${lineOf(line)}: 전투 방식: 런 밖 성장에 [brief:<주인공 능력>] 인용이 없다`])
})

test('동료의 행동은 브리프의 동료마다 하나이고 동료가 아닌 인물은 거부한다', () => {
  const missing = combat.replace(/### 연인·배우자\n[^#]*$/, '')
  expect(check({ combat: missing })).toEqual([`${lineOf('## 동료의 행동')}: 동료의 행동: 브리프의 동료 '연인·배우자'의 행동이 없다`])
  const stranger = replaceOnce(combat, '### 스승·후원자\n행동:', '### 부모\n행동:').replace('근거: [brief:스승·후원자]', '근거: [brief:부모]')
  const errors = check({ combat: stranger })
  expect(errors).toContain(`${lineOf('### 스승·후원자')}: 동료의 행동 > 부모: 브리프의 동료가 아니다`)
  expect(errors).toContain(`${lineOf('## 동료의 행동')}: 동료의 행동: 브리프의 동료 '스승·후원자'의 행동이 없다`)
})

test('브리프의 동료가 없으면 동료의 행동 절은 비어도 된다', () => {
  const companions = brief.slice(brief.indexOf('## 동료'), brief.indexOf('## 배경'))
  const alone = brief.replace(companions, '## 동료\n후보: 없음\n혼자: 곁에서 함께 한 사람이 없다\n\n')
  const noSkills = combat.slice(0, combat.indexOf('## 동료의 행동')) + '## 동료의 행동\n'
  expect(check({ combat: noSkills, brief: alone })).toEqual([])
})

test('제외 메커니즘의 용어, 차트 명칭, 다른 문서 인용을 거부한다', () => {
  const line = '런 중 보상: 새 재료의 성질과 빚는 방식 하나를 고른다'
  const slot = replaceOnce(combat, line, '런 중 보상: 장비 슬롯을 연결해 효과를 키운다')
  expect(check({ combat: slot })).toEqual([`${lineOf(line)}: 쓰지 않는 메커니즘의 용어 '슬롯'`])
  const name = replaceOnce(combat, line, '런 중 보상: 칠살의 힘을 고른다')
  expect(check({ combat: name })).toEqual([`${lineOf(line)}: 차트 명칭 '칠살'`])
  const life = replaceOnce(combat, '출처: [brief:고칠 곳을 짚는 눈]', '출처: [brief:고칠 곳을 짚는 눈] [life:보조 재능]')
  expect(check({ combat: life })).toEqual([`${lineOf('출처: [brief:고칠 곳을 짚는 눈]')}: [life:보조 재능] — 이 문서는 [brief:]만 인용한다`])
})

test('2026-11-24 개정으로 더한 축 값을 받아들인다', () => {
  // 전투 원형 ADR 2.1 개정: 손재주·학문·예술·돌봄 재능의 매개와 방식
  const changed = replaceOnce(combat, '전투 거리: 원거리\n힘의 매개체: 주문\n주도 방식: 직접 타격\n공간 활용: 추격',
    '전투 거리: 원거리\n힘의 매개체: 장치\n주도 방식: 제작\n공간 활용: 지형 변형')
  expect(check({ combat: changed.replace('숙련의 핵심: 자원 조합\n위험 구조: 과열', '숙련의 핵심: 정밀 조작\n위험 구조: 오작동') })).toEqual([])
})
