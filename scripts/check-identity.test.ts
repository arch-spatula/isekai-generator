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
const lineOf = (text: string, from = 0) => identity.split('\n').indexOf(text, from) + 1
/** 클래스 후보와 클래스가 같은 이름·재료를 쓰므로, 클래스 절 안에서만 바꾸고 찾는다 */
const classStart = identity.indexOf('\n## 클래스\n')
const classLine = identity.slice(0, classStart).split('\n').length + 1
const replaceInClass = (from: string, to: string) => identity.slice(0, classStart) + replaceOnce(identity.slice(classStart), from, to)
const candidates = (from: string, to: string) => replaceOnce(identity.slice(0, classStart), from, to) + identity.slice(classStart)

test('정상 정체성은 통과한다', () => {
  expect(check()).toEqual([])
})

test('클래스의 재료로 고른 주인공 능력을 읽는다', () => {
  expect(classAbilities(identity, brief)).toEqual({ name: '결 새김꾼', abilities: ['성질을 읽고 빚는 손', '고칠 곳을 짚는 눈'] })
})

test('섹션이 빠지거나 클래스가 둘이면 거부한다', () => {
  const start = identity.indexOf('## 부직업'), end = identity.indexOf('## 출신지')
  expect(check(identity.slice(0, start) + identity.slice(end))).toEqual(['섹션은 클래스 후보, 클래스, 속성, 부직업, 출신지 순서여야 한다 (실제: 클래스 후보, 클래스, 속성, 출신지)'])
  const two = replaceOnce(identity, '\n## 속성', '### 두 번째 클래스\n재료: [brief:고칠 곳을 짚는 눈]\n하는 일: 틈을 짚는다\n판단: 비교용\n\n## 속성')
  expect(check(two)).toEqual([`${classLine}: 클래스: 항목은 하나다 (실제: 2개)`])
})

test('클래스 후보가 세 개가 아니거나 채택이 하나가 아니면 거부한다', () => {
  const start = identity.indexOf('### 빚어 깨우는 자')
  const two = identity.slice(0, start) + identity.slice(classStart + 1)
  expect(check(two)).toEqual([`${lineOf('## 클래스 후보')}: 클래스 후보: 후보는 3개여야 한다 (실제: 2)`])
  const none = candidates('판단: 채택', '판단: 제외 — 비교용\n남는 곳: 부직업 — 비교용')
  expect(check(none)).toEqual([`${lineOf('## 클래스 후보')}: 클래스 후보: 채택한 후보는 하나여야 한다 (실제: 0)`])
})

test('후보의 재료에 능력이 없거나 이세계의 힘·판단 형식이 어긋나면 거부한다', () => {
  const material = candidates('재료: [brief:고칠 곳을 짚는 눈]\n영역: 약한 곳을 찾아내는 일', '재료: [brief:목수]\n영역: 약한 곳을 찾아내는 일')
  expect(check(material)).toEqual([`${lineOf('재료: [brief:고칠 곳을 짚는 눈]')}: 클래스 후보 > 숨은 금 사냥꾼: 재료에 [brief:<주인공 능력>]이 없다`])
  const power = candidates('이세계의 힘: 빚은 형상에 숨을 불어 스스로 걷고 싸우게 한다\n', '')
  expect(check(power)).toEqual([`${lineOf('### 빚어 깨우는 자')}: 클래스 후보 > 빚어 깨우는 자: 이세계의 힘 필드가 없다`])
  const verdict = candidates('판단: 제외 — 형상을', '판단: 보류 — 형상을')
  const verdictLine = identity.split('\n').findIndex((line) => line.startsWith('판단: 제외 — 형상을')) + 1
  expect(check(verdict)).toEqual([`${verdictLine}: 클래스 후보 > 빚어 깨우는 자: 판단은 '채택' 또는 '제외 — <이유>'이다`])
})

test('클래스가 채택한 후보와 다르면 거부한다', () => {
  const changed = replaceInClass('### 결 새김꾼', '### 결 읽는 장인')
  expect(check(changed)).toEqual([`${classLine + 1}: 클래스 > 결 읽는 장인: 클래스는 후보에서 채택한 '결 새김꾼'이다`])
})

test('클래스의 재료에 주인공 능력이 없으면 거부한다', () => {
  const changed = replaceInClass('재료: [brief:성질을 읽고 빚는 손] [brief:고칠 곳을 짚는 눈]', '재료: [brief:목수]')
  expect(check(changed)).toEqual([`${classLine + 2}: 클래스 > 결 새김꾼: 재료에 [brief:<주인공 능력>]이 없다`])
})

test('생업 이름을 그대로 클래스로 쓰면 거부한다', () => {
  // 채택한 후보와 클래스를 함께 바꿔도 생업 이름은 거부한다
  const changed = identity.replaceAll('### 결 새김꾼', '### 목수')
  expect(check(changed)).toEqual([`${classLine + 1}: 클래스 > 목수: 생업 이름을 그대로 클래스로 쓰지 않는다`])
})

test('부직업의 재료에 생업이나 능력이 없으면 거부한다', () => {
  const changed = replaceOnce(identity, '재료: [brief:목수] [brief:성질을 읽고 빚는 손]', '재료: [brief:출신지]')
  expect(check(changed)).toEqual([`${lineOf('재료: [brief:목수] [brief:성질을 읽고 빚는 손]')}: 부직업 > 수레 고치는 사람: 재료에 [brief:<생업>]이나 [brief:<주인공 능력>]이 없다`])
})

// #121: 출신지는 형태를 열어 두고 생활만 정한다. 권력·역사는 이 단계에서 정하지 않는다.
test('출신지에 형태·생활이 없거나 출신지를 인용하지 않으면 거부한다', () => {
  const noForm = replaceOnce(identity, '형태: 강 하구에 뗏목이 닿는 일꾼 마을\n', '')
  expect(check(noForm)).toEqual([`${lineOf('### 하구 목재 시장')}: 출신지 > 하구 목재 시장: 형태 필드가 없다`])
  const power = replaceOnce(identity, '형태: 강 하구에 뗏목이 닿는 일꾼 마을\n', '형태: 강 하구에 뗏목이 닿는 일꾼 마을\n권력: 목재 조합이 다스린다\n')
  expect(check(power)).toEqual([`${lineOf('생활: 상류에서 떠내려 보낸 목재를 받아 다듬어 바다 건너로 판다')}: 출신지 > 하구 목재 시장: 허용하지 않는 필드 '권력'`])
  const basis = replaceOnce(identity, '근거: [brief:출신지] [brief:가족 구조]', '근거: [brief:소년]')
  expect(check(basis)).toEqual([`${lineOf('근거: [brief:출신지] [brief:가족 구조]')}: 출신지 > 하구 목재 시장: 근거에 [brief:출신지]가 없다`])
  // 가족 구조만으로는 출신지의 재료가 되지 않는다. 출신지가 차트의 환경 자리에서 읽은 배경을 옮긴다(#97).
  const familyOnly = replaceOnce(identity, '근거: [brief:출신지] [brief:가족 구조]', '근거: [brief:가족 구조]')
  expect(check(familyOnly)).toEqual([`${lineOf('근거: [brief:출신지] [brief:가족 구조]')}: 출신지 > 하구 목재 시장: 근거에 [brief:출신지]가 없다`])
})

// #123: 장의 무대는 세계 단계가 정한다. 정체성에는 장별 세계를 두지 않는다.
test('장별 세계 섹션을 쓰면 거부한다', () => {
  const eras = `${identity}\n## 장별 세계\n### 소년\n세계: 강가 작업장\n근거: [brief:소년]\n`
  expect(check(eras)).toEqual(['섹션은 클래스 후보, 클래스, 속성, 부직업, 출신지 순서여야 한다 (실제: 클래스 후보, 클래스, 속성, 부직업, 출신지, 장별 세계)'])
})

test('브리프 밖 인용과 차트 명칭을 거부한다', () => {
  const basis = '근거: [brief:출신지] [brief:가족 구조]'
  const life = replaceOnce(identity, basis, `${basis} [life:유년]`)
  expect(check(life)).toEqual([`${lineOf(basis)}: [life:유년] — 이 문서는 [brief:]만 인용한다`])
  const name = replaceOnce(identity, '### 하구 목재 시장', '### 무곡의 장부 도시')
  expect(check(name)).toEqual([`${lineOf('### 하구 목재 시장')}: 차트 명칭 '무곡'`])
})

// #110: 제외한 후보의 갈래가 조용히 사라지지 않도록 어디에 남는지 적는다. 값이 실제로 그 자리에 쓰였는지는 검토가 본다.
test('제외한 후보에 남는 곳이 없거나 형식이 어긋나면 거부한다', () => {
  const leftover = '남는 곳: 동료 — 약한 곳을 짚는 일은 동료가 맡는다\n'
  expect(check(candidates(leftover, ''))).toEqual([`${lineOf('### 숨은 금 사냥꾼')}: 클래스 후보 > 숨은 금 사냥꾼: 남는 곳 필드가 없다`])
  const wrong = candidates('남는 곳: 동료 — ', '남는 곳: 세계 — ')
  expect(check(wrong)).toEqual([`${lineOf(leftover.trim())}: 클래스 후보 > 숨은 금 사냥꾼: 남는 곳은 '<클래스 | 부직업 | 동료 | 퀘스트> — <어떻게>'이다`])
})

test('채택한 후보에는 남는 곳을 쓰지 않는다', () => {
  const adopted = candidates('판단: 채택\n', '판단: 채택\n남는 곳: 클래스 — 그대로\n')
  expect(check(adopted)).toEqual([`${lineOf('판단: 채택') + 1}: 클래스 후보 > 결 새김꾼: 허용하지 않는 필드 '남는 곳'`])
})

// #114: 플레이어에게 보이는 이름은 설계용 이름(### 제목, 인용에 쓰임)과 따로 둔다. 심리 용어·현실 동작이 그대로 이름이 되지 않게 한다.
test('클래스에 플레이어용 이름이 없으면 거부한다', () => {
  const name = '플레이어용 이름: 각인술사\n'
  expect(check(replaceInClass(name, ''))).toEqual([`${lineOf('### 결 새김꾼', classLine)}: 클래스 > 결 새김꾼: 플레이어용 이름 필드가 없다`])
})

// #120: 생업과 재능에서 나온 부직업은 여러 개 둘 수 있고, 부직업에서 들어오는 의뢰(퀘스트)를 적을 수 있다.
test('부직업이 없으면 거부하고, 여러 개와 의뢰는 허용한다', () => {
  const start = identity.indexOf('### 수레 고치는 사람'), end = identity.indexOf('\n## 출신지')
  expect(check(identity.slice(0, start) + identity.slice(end + 1))).toEqual([`${lineOf('## 부직업')}: 부직업: 항목이 하나 이상 있어야 한다 (실제: 0개)`])
  expect(identity.split('\n').filter((line) => line.startsWith('의뢰:'))).toHaveLength(1)
})

test('부직업의 의뢰 값이 비면 거부한다', () => {
  const changed = replaceOnce(identity, '의뢰: 연장을 배우러 온 젊은 손들이 고향의 무너진 작업장을 고쳐 달라는 일을 가져온다', '의뢰:')
  expect(check(changed)).toEqual([`${lineOf('의뢰: 연장을 배우러 온 젊은 손들이 고향의 무너진 작업장을 고쳐 달라는 일을 가져온다')}: 부직업 > 공방 선생: 의뢰 값이 비었다`])
})

// #115: 속성은 기운 사실과 직업 특성을 함께 보고 정한다. 직업 특성 쪽은 브리프의 능력·생업 인용으로 남는다.
test('속성의 재료에 브리프의 능력이나 생업이 없으면 거부한다', () => {
  const line = '재료: [brief:고칠 곳을 짚는 눈] [brief:성질을 읽고 빚는 손]'
  expect(identity.split(line)).toHaveLength(3)
  const attributeLine = identity.indexOf('## 속성')
  const changed = identity.slice(0, attributeLine) + identity.slice(attributeLine).replace(line, '재료: [brief:출신지]')
  expect(check(changed)).toEqual([`${lineOf(line, lineOf('## 속성'))}: 속성 > 바람: 재료에 [brief:<주인공 능력>]이나 [brief:<생업>]이 없다`])
  expect(check(changed.replace('재료: [brief:출신지]', '재료: [brief:목수]'))).toEqual([])
})

test('속성은 하나이고 기운과 판단을 쓴다', () => {
  const reading = '기운: 서양 네 원소에서 공기가 다섯으로 가장 많고 움직임도 변화가 여섯이라, 한자리에 머물지 않고 흐르는 기운이 두드러진다\n'
  expect(check(replaceOnce(identity, reading, ''))).toEqual([`${lineOf('### 바람')}: 속성 > 바람: 기운 필드가 없다`])
  const two = replaceOnce(identity, '\n## 부직업', '### 무속성\n기운: 고르다\n재료: [brief:목수]\n판단: 비교용\n\n## 부직업')
  expect(check(two)).toEqual([`${lineOf('## 속성')}: 속성: 항목은 하나다 (실제: 2개)`])
})
