import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkWorld } from './check-world.ts'

// fixture: 합성 번역 브리프와 전투 설계를 입력으로 직접 쓴 세계 설계. 브리프의 장은 소년·청년·장년이다.
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

test('브리프의 장에 지역이 없거나 브리프에 없는 장을 쓰면 거부한다', () => {
  const missing = world.replace(/### 모여든 사람들의 거처\n[^#]*/, '')
  expect(check(missing)).toEqual([`${lineOf('## 지역')}: 지역: 브리프의 장 '장년'의 지역이 없다`])
  const unknown = replaceOnce(world, '장: 장년', '장: 노년')
  expect(check(unknown)).toEqual([
    `${lineOf('장: 장년')}: 지역 > 모여든 사람들의 거처: 장 '노년'는 브리프의 장(소년, 청년, 장년)이 아니다`,
    `${lineOf('## 지역')}: 지역: 브리프의 장 '장년'의 지역이 없다`,
  ])
})

test('첫 지역은 브리프의 첫 장이고 정체성의 출신지에서 시작한다', () => {
  const basis = replaceOnce(world, '근거: [identity:하구 목재 시장] [brief:성장 환경] [brief:소년]', '근거: [brief:출신지] [brief:소년]')
  expect(check(basis)).toEqual([`${lineOf('근거: [identity:하구 목재 시장] [brief:성장 환경] [brief:소년]')}: 지역 > 셈하는 마을: 첫 지역의 근거에 출신지 [identity:하구 목재 시장]가 없다`])
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

// #121: 전장은 지역마다 강제하지 않고 장마다 하나 이상 둔다. 적은 세력이 아니라 장르의 적이어도 된다. 전투 설계는 인용할 수 없다.
test('장에 전장이 있는 지역이 없으면 거부하고, 세력 없는 전장과 전장 없는 지역은 허용한다', () => {
  const line = '전장: 쌓아 둔 재료와 짓다 만 구조물 사이에서 셈하는 사람들의 셈꾼들이 몫을 걷으러 재료 더미를 막아선다'
  expect(check(replaceOnce(world, `${line}\n`, ''))).toEqual([`${lineOf('## 지역')}: 지역: 브리프의 장 '소년'에 전장이 있는 지역이 없다`])
  expect(world.split('\n').filter((text) => text.startsWith('전장:'))).toHaveLength(3)
  expect(check(replaceOnce(world, line, `${line} [combat:전투 방식]`)))
    .toEqual([`${lineOf(line)}: [combat:전투 방식] — 이 문서는 [brief:]·[identity:]만 인용한다`])
})

test('기호를 직역한 지역 이름과 없는 인용 대상을 거부한다', () => {
  const literal = replaceOnce(world, '### 셈하는 마을', '### 무곡의 장부 도시')
  expect(check(literal)).toEqual([`${lineOf('### 셈하는 마을')}: 차트 명칭 '무곡'`])
  const unknown = replaceOnce(world, '근거: [brief:장년] [brief:비어 있던 자리]', '근거: [brief:장년] [brief:없는 퀘스트]')
  expect(check(unknown)).toEqual([`${lineOf('근거: [brief:장년] [brief:비어 있던 자리]')}: [brief:없는 퀘스트] — 인용 대상 문서에 없는 항목`])
})
