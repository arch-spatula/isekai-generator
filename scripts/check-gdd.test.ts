import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkGdd } from './check-gdd.ts'

// fixture: 합성 번역 브리프·전투 설계·세계 설계를 입력으로 직접 쓴 GDD. 브리프의 장은 소년·청년·장년, 동료는 스승·후원자와
// 연인·배우자다. 기대 위반은 docs/spec/claude-game-design-flow.md 4·5.4·6절에서 정했다.
const fixtures = join(import.meta.dir, 'fixtures')
const read = (path: string) => readFileSync(join(fixtures, path), 'utf8')
const brief = read('translation-brief/translation-brief.md'), combat = read('combat/combat.md'), world = read('world/world.md'), gdd = read('gdd/gdd.md')
const identity = read('identity/identity.md')

function replaceOnce(text: string, from: string, to: string): string {
  expect(text.split(from)).toHaveLength(2)
  return text.replace(from, to)
}
const check = (changes: { gdd?: string; brief?: string } = {}) => checkGdd({ gdd: changes.gdd ?? gdd, brief: changes.brief ?? brief, identity, combat, world })
const lineOf = (text: string) => gdd.split('\n').indexOf(text) + 1

test('정상 GDD는 통과한다', () => {
  expect(check()).toEqual([])
})

test('절이 빠지거나 순서가 다르면 거부한다', () => {
  const start = gdd.indexOf('## 대표 장면')
  expect(check({ gdd: gdd.slice(0, start) })).toEqual(['섹션은 게임 개요, 주인공, 동료, 세계와 장, 전투, 런과 성장, 서사의 변화, 대표 장면 순서여야 한다 (실제: 게임 개요, 주인공, 동료, 세계와 장, 전투, 런과 성장, 서사의 변화)'])
})

test('인용이 없는 절을 거부한다', () => {
  const scene = gdd.slice(gdd.indexOf('## 대표 장면'))
  const changed = gdd.replace(scene, '## 대표 장면\n주인공이 새 터전에서 첫 런을 치른다.\n')
  expect(check({ gdd: changed })).toEqual([`${lineOf('## 대표 장면')}: 대표 장면: [brief:]·[identity:]·[combat:]·[world:] 인용이 없다`])
})

test('주인공 절이 배경 네 항목을 모두 인용하지 않으면 거부한다', () => {
  const changed = replaceOnce(gdd, ' [brief:가족 구조]', '')
  expect(check({ gdd: changed })).toEqual([`${lineOf('## 주인공')}: 주인공: [brief:가족 구조]을 인용하지 않았다`])
})

test('동료 절은 브리프의 동료마다 항목을 두고, 동료가 없으면 항목 없이 쓴다', () => {
  const missing = gdd.replace(/### 연인·배우자\n[^\n]*\n/, '')
  expect(check({ gdd: missing })).toEqual([`${lineOf('## 동료')}: 동료: 브리프의 동료 '연인·배우자' 항목이 없다`])
  const companions = brief.slice(brief.indexOf('## 동료'), brief.indexOf('## 배경'))
  const alone = brief.replace(companions, '## 동료\n후보: 없음\n혼자: 곁에서 함께 한 사람이 없다\n\n')
  const section = gdd.slice(gdd.indexOf('## 동료'), gdd.indexOf('## 세계와 장'))
  const soloGdd = gdd.replace(section, '## 동료\n곁에서 함께 한 사람이 없어 주인공은 혼자 모험한다 [brief:축].\n\n')
  expect(check({ gdd: soloGdd, brief: alone })).toEqual([])
  expect(check({ gdd, brief: alone })).toEqual([
    `${lineOf('### 스승·후원자')}: 동료 > 스승·후원자: 브리프의 동료가 아니다`,
    `${lineOf('### 연인·배우자')}: 동료 > 연인·배우자: 브리프의 동료가 아니다`,
    `${lineOf('### 스승·후원자') + 1}: [brief:스승·후원자] — 인용 대상 문서에 없는 항목`,
    `${lineOf('### 연인·배우자') + 1}: [brief:연인·배우자] — 인용 대상 문서에 없는 항목`,
  ])
})

test('세계와 장은 브리프의 장을 순서대로 쓰고 그 장의 지역을 인용한다', () => {
  const missing = gdd.replace(/### 장년\n[^\n]*\n/, '')
  expect(check({ gdd: missing })).toEqual([`${lineOf('## 세계와 장')}: 세계와 장: 항목은 브리프의 장 소년, 청년, 장년 순서여야 한다 (실제: 소년, 청년)`])
  const wrongRegion = replaceOnce(gdd, '[world:모여든 사람들의 거처]', '[world:새 터전]')
  expect(check({ gdd: wrongRegion })).toEqual([`${lineOf('### 장년')}: 세계와 장 > 장년: 이 장의 지역을 [world:<지역>]으로 인용하지 않았다`])
})

test('런과 성장이 브리프의 능력을 인용하지 않으면 거부한다', () => {
  const changed = replaceOnce(gdd, '이 성장은 재료의 성질을 읽고 빚는 재능에서 나온다 [brief:성질을 읽고 빚는 손].', '')
  expect(check({ gdd: changed })).toEqual([`${lineOf('## 런과 성장')}: 런과 성장: 성장의 출처인 [brief:<주인공 능력>] 인용이 없다`])
})

test('짧지만 인용이 있는 개요는 길이를 이유로 거부하지 않는다', () => {
  const overview = gdd.slice(gdd.indexOf('## 게임 개요'), gdd.indexOf('## 주인공'))
  const short = gdd.replace(overview, '## 게임 개요\n구조를 빚고 무너뜨리며 싸우는 픽셀 실시간 액션 로그라이트다 [combat:전투 방식].\n\n')
  expect(check({ gdd: short })).toEqual([])
})

test('제외 메커니즘, 차트 명칭, life 인용, 없는 인용 대상을 거부한다', () => {
  const line = gdd.split('\n').find((text) => text.startsWith('런 한 번은'))!
  expect(check({ gdd: gdd.replace(line, `${line} 보상은 인벤토리 칸에 배치한다.`) })).toEqual([`${lineOf(line)}: 쓰지 않는 메커니즘의 용어 '인벤토리 칸'`])
  expect(check({ gdd: replaceOnce(gdd, '# 빚는 사람의 터', '# 탐랑의 터') })).toEqual(["1: 차트 명칭 '탐랑'"])
  expect(check({ gdd: replaceOnce(gdd, '[brief:축].\n\n## 주인공', '[brief:축] [life:축].\n\n## 주인공') })).toEqual([
    `${lineOf('## 주인공') - 2}: [life:축] — 이 문서는 [brief:]·[identity:]·[combat:]·[world:]만 인용한다`,
  ])
  expect(check({ gdd: replaceOnce(gdd, '[world:새 터전]. 같은', '[world:없는 땅]. 같은') })).toContain(`${lineOf('### 청년') + 1}: [world:없는 땅] — 인용 대상 문서에 없는 항목`)
})

// #86: 주인공 절은 정체성 단계의 클래스와 부직업을 잇는다.
test('주인공 절이 클래스나 부직업을 인용하지 않으면 거부한다', () => {
  const changed = replaceOnce(gdd, ' [identity:수레 고치는 사람]', '')
  expect(check({ gdd: changed })).toEqual([`${lineOf('## 주인공')}: 주인공: 부직업 [identity:수레 고치는 사람]를 인용하지 않았다`])
})
