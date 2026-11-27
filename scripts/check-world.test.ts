import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkWorld } from './check-world.ts'

// fixture: 합성 번역 브리프와 정체성을 입력으로 직접 쓴 세계 설계. 브리프의 장은 소년·청년·장년이다.
// 기대 위반은 docs/spec/claude-game-design-flow.md 4.2·5.3·6절에서 정했다.
const fixtures = join(import.meta.dir, 'fixtures')
const brief = readFileSync(join(fixtures, 'translation-brief/translation-brief.md'), 'utf8')
const world = readFileSync(join(fixtures, 'world/world.md'), 'utf8')
const identity = readFileSync(join(fixtures, 'identity/identity.md'), 'utf8')

function replaceOnce(text: string, from: string, to: string): string {
  expect(text.split(from)).toHaveLength(2)
  return text.replace(from, to)
}
const check = (changed = world) => checkWorld({ world: changed, brief, identity })
const lineOf = (text: string) => world.split('\n').indexOf(text) + 1

test('정상 세계 설계는 통과한다', () => {
  expect(check()).toEqual([])
})

// #123: 지역은 장과 따로 세우고, 장은 그 사건이 일어나는 지역을 하나 고른다.
test('장이 브리프의 장과 다르거나 없는 지역을 고르면 거부한다', () => {
  const missing = replaceOnce(world, '### 장년\n지역: 모여든 사람들의 거처\n', '')
  expect(check(missing)).toEqual([`${lineOf('## 장')}: 장: 항목은 브리프의 장 소년, 청년, 장년 순서여야 한다 (실제: 소년, 청년)`])
  const unknown = replaceOnce(world, '지역: 모여든 사람들의 거처', '지역: 없는 곳')
  expect(check(unknown)).toEqual([`${lineOf('지역: 모여든 사람들의 거처')}: 장 > 장년: 지역 '없는 곳'는 이 문서의 지역이 아니다`])
})

test('여러 장이 한 지역을 쓰거나 장이 고르지 않은 지역이 있어도 통과한다', () => {
  expect(world.includes('### 스승의 작업장')).toBe(true)
  expect(check(replaceOnce(world, '지역: 모여든 사람들의 거처', '지역: 새 터전'))).toEqual([])
})

test('지역에 장 필드를 쓰면 거부한다', () => {
  const line = '성격: 둘이 함께 일구기 시작한 아직 아무것도 정해지지 않은 땅'
  expect(check(replaceOnce(world, line, `장: 청년\n${line}`))).toEqual([`${lineOf(line)}: 지역 > 새 터전: 허용하지 않는 필드 '장'`])
})

test('첫 장은 출신지에서 만든 첫 지역에서 시작한다', () => {
  const basis = replaceOnce(world, '근거: [identity:하구 목재 시장] [brief:성장 환경] [brief:소년]', '근거: [brief:출신지] [brief:소년]')
  expect(check(basis)).toEqual([`${lineOf('근거: [identity:하구 목재 시장] [brief:성장 환경] [brief:소년]')}: 지역 > 셈하는 마을: 첫 지역의 근거에 출신지 [identity:하구 목재 시장]가 없다`])
  const first = replaceOnce(world, '지역: 셈하는 마을', '지역: 스승의 작업장')
  expect(check(first)).toEqual([`${lineOf('지역: 셈하는 마을')}: 장 > 소년: 첫 장의 지역은 출신지에서 만든 첫 지역 '셈하는 마을'이다`])
})

// #87: 요소마다 인용을 요구하지 않는다. 지어낸 지역·세력은 근거 없이 쓰고, 근거를 쓰면 브리프나 정체성을 인용한다.
test('지어낸 지역과 세력은 근거 없이 통과하고, 인용 없는 근거는 거부한다', () => {
  const line = '근거: [brief:같은 자리의 사람]'
  expect(check(replaceOnce(world, `${line}\n`, ''))).toEqual([])
  expect(check(replaceOnce(world, '근거: [brief:청년] [brief:연인·배우자]\n', ''))).toEqual([])
  expect(check(replaceOnce(world, line, '근거: 맞수가 무리를 이끈다는 설정'))).toEqual([
    `${lineOf(line)}: 세력 > 같은 재주의 맞수 무리: 근거에 [brief:<항목>]이나 [identity:<항목>] 인용이 없다 (지어낸 설정이면 근거 줄을 쓰지 않는다)`,
  ])
})

test('첫 지역과 서사 갈등의 근거는 빠뜨릴 수 없다', () => {
  const first = '근거: [identity:하구 목재 시장] [brief:성장 환경] [brief:소년]'
  expect(check(replaceOnce(world, `${first}\n`, ''))).toEqual([`${lineOf('### 셈하는 마을')}: 지역 > 셈하는 마을: 근거 필드가 없다`])
  const conflict = '근거: [brief:반복되는 실패] [brief:다시 나눠 지는 짐]'
  expect(check(replaceOnce(world, `${conflict}\n`, ''))).toEqual([
    `${lineOf('### 혼자 정한 터')}: 서사 갈등 > 혼자 정한 터: 근거 필드가 없다`,
    `${lineOf('## 서사 갈등')}: 서사 갈등: 근거 어디에도 [brief:반복되는 실패]이 없다`,
  ])
})

test('세력에 제약이 없으면 거부한다', () => {
  const changed = replaceOnce(world, '제약: 자기 방식만으로는 사람을 모으지 못해 주인공의 실수를 기다린다\n', '')
  expect(check(changed)).toEqual([`${lineOf('### 같은 재주의 맞수 무리')}: 세력 > 같은 재주의 맞수 무리: 제약 필드가 없다`])
})

test('서사 갈등이 축이나 반복되는 실패를 인용하지 않으면 거부한다', () => {
  const changed = replaceOnce(world, '근거: [brief:축] [brief:비어 있던 자리]', '근거: [brief:비어 있던 자리]')
  expect(check(changed)).toEqual([`${lineOf('## 서사 갈등')}: 서사 갈등: 근거 어디에도 [brief:축]이 없다`])
})

// #121·#123: 전장은 위협이 있는 지역에만 두고 세계 전체에 하나 이상 둔다. 장마다 강제하지 않는다. 적은 장르의 적이어도 된다. 전투 설계는 인용할 수 없다.
test('전장이 있는 지역이 하나도 없으면 거부하고, 전장 없는 장은 허용한다', () => {
  const battles = world.split('\n').filter((text) => text.startsWith('전장:'))
  expect(battles).toHaveLength(3)
  expect(check(replaceOnce(world, `${battles[0]}\n`, ''))).toEqual([])
  const peaceful = battles.reduce((text, line) => replaceOnce(text, `${line}\n`, ''), world)
  expect(check(peaceful)).toEqual([`${lineOf('## 지역')}: 지역: 전장이 있는 지역이 없다`])
  expect(check(replaceOnce(world, battles[0], `${battles[0]} [combat:전투 방식]`)))
    .toEqual([`${lineOf(battles[0])}: [combat:전투 방식] — 이 문서는 [brief:]·[identity:]만 인용한다`])
})

test('기호를 직역한 지역 이름과 없는 인용 대상을 거부한다', () => {
  const literal = replaceOnce(world, '### 스승의 작업장', '### 무곡의 장부 도시')
  expect(check(literal)).toEqual([`${lineOf('### 스승의 작업장')}: 차트 명칭 '무곡'`])
  const unknown = replaceOnce(world, '근거: [brief:장년] [brief:비어 있던 자리]', '근거: [brief:장년] [brief:없는 퀘스트]')
  expect(check(unknown)).toEqual([`${lineOf('근거: [brief:장년] [brief:비어 있던 자리]')}: [brief:없는 퀘스트] — 인용 대상 문서에 없는 항목`])
})
