import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkCombat } from './check-combat.ts'

// fixture: translation-brief/translation-brief.md(합성 브리프)를 입력으로 직접 쓴 전투 설계. 브리프의 주인공 능력은 셋, 동료는
// 스승·후원자와 연인·배우자다. 기대 위반은 docs/spec/claude-game-design-flow.md 4.3·5.2·6절과 전투 원형 ADR 2.1·2.2에서 정했다.
const fixtures = join(import.meta.dir, 'fixtures')
const brief = readFileSync(join(fixtures, 'translation-brief/translation-brief.md'), 'utf8')
const combat = readFileSync(join(fixtures, 'combat/combat.md'), 'utf8')
const identity = readFileSync(join(fixtures, 'identity/identity.md'), 'utf8')
const world = readFileSync(join(fixtures, 'world/world.md'), 'utf8')

function replaceOnce(text: string, from: string, to: string): string {
  expect(text.split(from)).toHaveLength(2)
  return text.replace(from, to)
}
const check = (changes: { combat?: string; brief?: string; identity?: string } = {}) =>
  checkCombat({ combat: changes.combat ?? combat, brief: changes.brief ?? brief, identity: changes.identity ?? identity, world })
const lineOf = (text: string) => combat.split('\n').indexOf(text) + 1

test('정상 전투 설계는 통과한다', () => {
  expect(check()).toEqual([])
})

test('후보가 세 개가 아니면 거부한다', () => {
  const two = combat.replace(/### 틈을 짚는 일격\n[^#]*/, '')
  expect(check({ combat: two })).toContain(`${lineOf('## 후보')}: 후보: 후보는 3개여야 한다 (실제: 2)`)
})

// 적은 세계의 세력에서 정한다. 세계가 전투보다 먼저 만들어진다(재료 부족 정리).
test('적이 세계의 세력을 인용하지 않으면 거부한다', () => {
  const enemy = combat.split('\n').find((line) => line.startsWith('적:'))!
  expect(check({ combat: replaceOnce(combat, enemy, '적: 구조를 부수는 적') })).toEqual([`${lineOf(enemy)}: 전투 방식: 적에 [world:<세력>] 인용이 없다`])
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
  const reason = '판단: 제외 — 만든 것을 남기는 재능이 쓰고 사라지는 힘으로 바뀐다'
  expect(check({ combat: replaceOnce(combat, reason, '판단: 제외') })).toEqual([`${lineOf(reason)}: 후보 > 성질을 바꾸는 손: 판단은 '채택' 또는 '제외 — <이유>'이다`])
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
  expect(check({ combat: life })).toEqual([`${lineOf('출처: [brief:고칠 곳을 짚는 눈]')}: [life:보조 재능] — 이 문서는 [brief:]·[identity:]·[world:]만 인용한다`])
})

test('2026-11-24 개정으로 더한 축 값을 받아들인다', () => {
  // 전투 원형 ADR 2.1 개정: 손재주·학문·예술·돌봄 재능의 매개와 방식
  const changed = replaceOnce(combat, '전투 거리: 원거리\n힘의 매개체: 주문\n주도 방식: 직접 타격\n공간 활용: 추격',
    '전투 거리: 원거리\n힘의 매개체: 장치\n주도 방식: 제작\n공간 활용: 지형 변형')
  expect(check({ combat: changed.replace('숙련의 핵심: 자원 조합\n위험 구조: 과열', '숙련의 핵심: 정밀 조작\n위험 구조: 오작동') })).toEqual([])
})

// #75·#82: 후보는 재능의 다루는 것에서 만들고 혼자 성립을 보인다. 채택은 재능 전체를 놓고 고르고, 능력마다 하나씩 만들지 않는다.
test('후보에 조작하는 것이나 혼자일 때가 없으면 거부한다', () => {
  const noTarget = replaceOnce(combat, '조작하는 것: 적의 동작에서 어긋난 곳\n', '')
  expect(check({ combat: noTarget })).toEqual([`${lineOf('### 틈을 짚는 일격')}: 후보 > 틈을 짚는 일격: 조작하는 것 필드가 없다`])
  const noSolo = replaceOnce(combat, '혼자일 때: 혼자 상대의 동작을 읽어 받아친다\n', '')
  expect(check({ combat: noSolo })).toEqual([`${lineOf('### 틈을 짚는 일격')}: 후보 > 틈을 짚는 일격: 혼자일 때 필드가 없다`])
})

test('주 재능이 아닌 능력에서 나온 후보도 채택할 수 있다', () => {
  const adoptOther = replaceOnce(combat, '판단: 채택', '판단: 제외 — 비교를 위해 내려 둔다')
    .replace('판단: 제외 — 눈은 손을 돕는 재능이라 혼자 전투의 중심이 되면 주 재능이 가려진다', '판단: 채택')
    .replace('채택: 빚어 세우는 손', '채택: 틈을 짚는 일격')
  expect(check({ combat: adoptOther })).toEqual([])
})

test('후보를 능력마다 하나씩만 만들면 거부한다', () => {
  // 브리프에 능력 둘을 더하고 후보 넷이 서로 다른 능력을 하나씩 인용하게 한다.
  const extra = '### 무게를 읽는 감각\n출처: [life:주 재능]\n다루는 것: 물건의 무게와 균형\n약점: 서두르면 어긋난다\n### 셈하는 눈\n출처: [life:보조 재능]\n다루는 것: 수와 기록\n약점: 지치면 놓친다\n\n## 생업'
  const fourAbilities = replaceOnce(brief, '\n## 생업', `\n${extra}`)
  const spread = combat
    .replace('출처: [brief:성질을 읽고 빚는 손]\n조작하는 것: 터를 이루는 지형', '출처: [brief:무게를 읽는 감각]\n조작하는 것: 터를 이루는 지형')
    .replace('출처: [brief:성질을 읽고 빚는 손]\n조작하는 것: 재료의 성질', '출처: [brief:셈하는 눈]\n조작하는 것: 재료의 성질')
  const wideClass = replaceOnce(identity, '재료: [brief:성질을 읽고 빚는 손] [brief:고칠 곳을 짚는 눈]',
    '재료: [brief:성질을 읽고 빚는 손] [brief:고칠 곳을 짚는 눈] [brief:무게를 읽는 감각] [brief:셈하는 눈]')
  expect(check({ combat: spread, brief: fourAbilities, identity: wideClass })).toEqual([`${lineOf('## 후보')}: 후보: 같은 능력에서 나온 후보가 둘 이상 있어야 한다 (능력마다 하나씩 만들지 않는다)`])
  expect(check({ combat, brief: fourAbilities, identity: wideClass })).toEqual([])
})

// #86: 후보는 정체성 단계가 고른 클래스 안에서 만든다.
test('후보의 출처가 클래스의 재료가 아니면 거부한다', () => {
  const narrow = replaceOnce(identity, '재료: [brief:성질을 읽고 빚는 손] [brief:고칠 곳을 짚는 눈]', '재료: [brief:성질을 읽고 빚는 손]')
  expect(check({ identity: narrow })).toEqual([`${lineOf('출처: [brief:고칠 곳을 짚는 눈]')}: 후보 > 틈을 짚는 일격: 출처 [brief:고칠 곳을 짚는 눈]는 클래스 '결 새김꾼'의 재료가 아니다`])
})

// #112: 주인공이 반복해서 기우는 쪽(브리프의 반복되는 실패)을 서술이 아니라 플레이 시스템으로 옮긴다. 장마다 그 시기의 의미를 둔다.
test('끌림의 재료가 반복되는 실패가 아니거나 필드가 빠지면 거부한다', () => {
  const material = '재료: [brief:반복되는 실패] [brief:다시 나눠 지는 짐]'
  expect(check({ combat: replaceOnce(combat, material, '재료: [brief:다시 나눠 지는 짐]') })).toEqual([`${lineOf(material)}: 끌림 > 혼자 정하는 손: 재료에 [brief:반복되는 실패]이 없다`])
  const cost = combat.split('\n').find((line) => line.startsWith('대가: '))!
  expect(check({ combat: replaceOnce(combat, `${cost}\n`, '') })).toEqual([`${lineOf('### 혼자 정하는 손')}: 끌림 > 혼자 정하는 손: 대가 필드가 없다`])
  const name = '플레이어용 이름: 외길\n'
  expect(check({ combat: replaceOnce(combat, name, '') })).toEqual([`${lineOf('### 혼자 정하는 손')}: 끌림 > 혼자 정하는 손: 플레이어용 이름 필드가 없다`])
})

test('끌림이 둘이면 거부한다', () => {
  const start = combat.indexOf('### 혼자 정하는 손'), end = combat.indexOf('## 장별 끌림')
  const twice = combat.slice(0, end) + combat.slice(start, end).replace('### 혼자 정하는 손', '### 또 다른 끌림') + combat.slice(end)
  expect(check({ combat: twice })).toContain(`${lineOf('## 끌림')}: 끌림: 항목은 하나다 (실제: 2개)`)
})

test('장별 끌림이 브리프의 장과 다르거나 그 장을 인용하지 않으면 거부한다', () => {
  const missing = combat.replace(/### 장년\n의미:[^#]*/, '')
  expect(check({ combat: missing })).toEqual([`${lineOf('## 장별 끌림')}: 장별 끌림: 항목은 브리프의 장 소년, 청년, 장년 순서여야 한다 (실제: 소년, 청년)`])
  const basis = '근거: [brief:청년]'
  expect(check({ combat: replaceOnce(combat, basis, '근거: [brief:장년]') })).toEqual([`${lineOf(basis)}: 장별 끌림 > 청년: 근거에 [brief:청년]이 없다`])
})
