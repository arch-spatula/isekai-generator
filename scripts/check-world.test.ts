import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkWorld } from './check-world.ts'

// fixture: 합성 번역 브리프와 전투 설계를 입력으로 직접 쓴 세계 설계. 브리프의 장은 소년·청년·장년이다.
// 기대 위반은 docs/spec/claude-game-design-flow.md 4.2·5.3·6절에서 정했다.
const fixtures = join(import.meta.dir, 'fixtures')
const brief = readFileSync(join(fixtures, 'translation-brief/translation-brief.md'), 'utf8')
const combat = readFileSync(join(fixtures, 'combat/combat.md'), 'utf8')
const world = readFileSync(join(fixtures, 'world/world.md'), 'utf8')

function replaceOnce(text: string, from: string, to: string): string {
  expect(text.split(from)).toHaveLength(2)
  return text.replace(from, to)
}
const check = (changed = world) => checkWorld({ world: changed, brief, combat })
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

test('첫 지역은 브리프의 첫 장이고 출신지나 성장 환경에서 시작한다', () => {
  const basis = replaceOnce(world, '근거: [brief:출신지] [brief:성장 환경] [brief:소년]', '근거: [brief:소년]')
  expect(check(basis)).toEqual([`${lineOf('근거: [brief:출신지] [brief:성장 환경] [brief:소년]')}: 지역 > 셈하는 마을: 첫 지역의 근거에 [brief:출신지] 또는 [brief:성장 환경]이 없다`])
})

test('근거 없는 설정은 창작으로 구분하면 통과하고, 인용도 창작 표시도 없으면 거부한다', () => {
  const line = '근거: [brief:같은 자리의 사람] 창작: 맞수가 무리를 이끈다는 설정'
  expect(check(replaceOnce(world, line, '근거: 창작: 맞수가 무리를 이끈다는 설정'))).toEqual([])
  expect(check(replaceOnce(world, line, '근거: 맞수가 무리를 이끈다는 설정'))).toEqual([
    `${lineOf(line)}: 세력 > 같은 재주의 맞수 무리: 근거에 [brief:<항목>] 인용이 없다 (근거 없는 설정은 '창작:'으로 시작한다)`,
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

test('전장이 전투 설계를 인용하지 않으면 거부한다', () => {
  const line = '전장: 쌓아 둔 재료와 짓다 만 구조물 사이에서 마을 밖 약탈자가 재료를 노리고 들어온다 [combat:전투 방식]'
  const changed = replaceOnce(world, line, '전장: 쌓아 둔 재료 사이')
  expect(check(changed)).toEqual([`${lineOf(line)}: 지역 > 셈하는 마을: 전장에 [combat:<항목>] 인용이 없다`])
})

test('기호를 직역한 지역 이름과 없는 인용 대상을 거부한다', () => {
  const literal = replaceOnce(world, '### 셈하는 마을', '### 무곡의 장부 도시')
  expect(check(literal)).toEqual([`${lineOf('### 셈하는 마을')}: 차트 명칭 '무곡'`])
  const unknown = replaceOnce(world, '근거: [brief:장년] [brief:비어 있던 자리]', '근거: [brief:장년] [brief:없는 퀘스트]')
  expect(check(unknown)).toEqual([`${lineOf('근거: [brief:장년] [brief:비어 있던 자리]')}: [brief:없는 퀘스트] — 인용 대상 문서에 없는 항목`])
})
