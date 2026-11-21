import { expect, test } from 'bun:test'
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { checkLifeIntegration } from './check-life-integration.ts'

// fixture: 세 일생 해석 fixture(서로 다른 합성 출생 입력)를 재료로 손으로 쓴 통합 문서. 변형은 한 곳만 바꾸고
// 기대 위반은 docs/spec/life-integration.md §5·§7에서 정했다.
const fixtures = join(import.meta.dir, 'fixtures')
const sourcePaths = {
  saju: join(fixtures, 'saju-life/saju-life.md'),
  ziwei: join(fixtures, 'ziwei-life/ziwei-life.md'),
  natal: join(fixtures, 'natal-life/natal-life.md'),
}
const sources = {
  saju: readFileSync(sourcePaths.saju, 'utf8'),
  ziwei: readFileSync(sourcePaths.ziwei, 'utf8'),
  natal: readFileSync(sourcePaths.natal, 'utf8'),
}
const lifePath = join(fixtures, 'life-integration/life.md')
const valid = readFileSync(lifePath, 'utf8')
const check = (life: string) => checkLifeIntegration({ life, sources })

function mutate(from: string, to: string): string {
  expect(valid.split(from)).toHaveLength(2)
  return valid.replace(from, to)
}
const lineOf = (text: string) => valid.split('\n').indexOf(text) + 1

test('the hand-written fixture passes', () => {
  expect(check(valid)).toEqual([])
})

test('checks the title, the absence of an identity line and the section order', () => {
  expect(check(mutate('# 일생 통합 해석', '# 四柱 일생 해석'))).toContain("1: 첫 줄은 '# 일생 통합 해석'이어야 한다")
  expect(check(mutate('# 일생 통합 해석\n', '# 일생 통합 해석\n원국: 癸巳 丙寅 己卯 庚辰\n'))).toContain('2: 섹션 밖의 줄이다')
  expect(check(mutate('## 갈림길\n', '')))
    .toContain('섹션은 일생의 축, 생애 연표, 인물 사전, 재능과 생업, 상처와 회복, 갈림길 순서여야 한다 (실제: 일생의 축, 생애 연표, 인물 사전, 재능과 생업, 상처와 회복)')
})

test('timeline has no 운 field and talents bloom in a named life stage', () => {
  const theme = '주제: 넘치는 힘과 채워지지 않는 허기 사이에서 머물 곳을 찾는다'
  expect(check(mutate(theme, `운: 2運 辛巳 18–27\n${theme}`))).toContain(`${lineOf(theme)}: 생애 연표 > 청년: 알 수 없는 필드 '운'`)
  const bloom = '꽃피는 시기: 유년에 익혀 장년에 제자를 기르며 쓴다'
  expect(check(mutate(bloom, '꽃피는 시기: 제자를 기르며 쓴다'))).toContain(`${lineOf(bloom)}: 재능과 생업 > 보조 재능: 꽃피는 시기에 생애 단계 이름이 없다`)
})

test('갈림길 may be empty, but a written fork needs every field', () => {
  expect(check(valid.slice(0, valid.indexOf('### 노년의 길')))).toEqual([])
  const condition = '갈리는 조건: 등을 돌렸던 동료가 먼저 찾아오는가, 주인공이 먼저 길을 나서는가\n'
  expect(check(mutate(condition, ''))).toEqual(['갈림길 > 노년의 길: 갈리는 조건 필드가 없다'])
})

test('citations must name items of the three life documents', () => {
  const evidence = '근거: [saju:장년] [ziwei:장년] [natal:주 재능]'
  const replace = (to: string) => check(mutate(evidence, to))
  expect(replace('근거: [saju:장년] [ziwei:장년] [natal:중년]')).toEqual([`${lineOf(evidence)}: 생애 연표 > 장년: natal-life.md에 없는 항목 [natal:중년]`])
  expect(replace('근거: [saju:장년] [ziwei:장년] [facts:육친]')).toEqual([`${lineOf(evidence)}: 생애 연표 > 장년: 통합 해석에 쓰지 않는 인용 [facts:육친]`])
  expect(replace('근거: 공동체의 일을 맡는다')).toContain(`${lineOf(evidence)}: 생애 연표 > 장년: 근거에 인용이 없다`)
  const main = '본선: 이끄는 자리를 내려놓고 먼 길을 떠나 넓은 세상을 본다 [ziwei:노년]'
  expect(check(mutate(main, '본선: 이끄는 자리를 내려놓고 먼 길을 떠나 넓은 세상을 본다')))
    .toEqual([`${lineOf(main)}: 갈림길 > 노년의 길: 본선에 인용이 없다`])
})

test('every same-name stage and cast item is cited somewhere in the document', () => {
  const oldAge = '근거: [saju:노년] [ziwei:노년]'
  // 노년의 두 원본 항목은 갈림길에서도 인용되므로 노년 근거에서 빼도 된다.
  expect(check(mutate(oldAge, '근거: [natal:회복]'))).toEqual([])
  const withoutFork = valid.slice(0, valid.indexOf('### 노년의 길'))
  expect(check(withoutFork.replace(oldAge, '근거: [natal:회복]')))
    .toEqual(['같은 이름의 원본 항목을 인용하지 않았다: [saju:노년] [ziwei:노년]'])
  expect(check(mutate('근거: [saju:형제·또래] [ziwei:형제·또래] [natal:형제·또래]', '근거: [saju:형제·또래] [ziwei:형제·또래]')))
    .toEqual(['같은 이름의 원본 항목을 인용하지 않았다: [natal:형제·또래]'])
})

test('talents and wounds each cite all three systems within the section', () => {
  const talent = '근거: [saju:주 재능] [ziwei:주 재능] [natal:주 재능]\n### 보조 재능'
  expect(check(mutate(talent, '근거: [saju:주 재능] [ziwei:주 재능]\n### 보조 재능')))
    .toEqual(['재능과 생업: 인용하지 않은 체계가 있다: natal'])
  const wounds = valid.replace('근거: [saju:상실] [ziwei:상실] [natal:상실]', '근거: [saju:상실] [ziwei:상실]')
    .replace('근거: [saju:회복] [ziwei:회복] [natal:회복]', '근거: [saju:회복] [ziwei:회복]')
  expect(check(wounds)).toEqual(['상처와 회복: 인용하지 않은 체계가 있다: natal'])
})

test('a fork\'s other path cites a system the main path does not', () => {
  const other = '다른 길: 떠나지 않고 남아 흩어진 인연을 다시 잇는 데 남은 힘을 쓴다 [saju:노년]'
  expect(check(mutate(other, '다른 길: 떠나지 않고 남아 흩어진 인연을 다시 잇는 데 남은 힘을 쓴다 [ziwei:장년]')))
    .toEqual([`${lineOf(other)}: 갈림길 > 노년의 길: 다른 길이 본선에 없는 체계를 인용하지 않는다`])
})

test('CLI reads life.md and the three life documents from the directory', () => {
  const script = join(import.meta.dir, 'check-life-integration.ts')
  const dir = mkdtempSync(join(tmpdir(), 'life-integration-'))
  try {
    for (const [system, path] of Object.entries(sourcePaths)) copyFileSync(path, join(dir, `${system}-life.md`))
    copyFileSync(lifePath, join(dir, 'life.md'))
    const ok = Bun.spawnSync(['bun', script, dir])
    expect([ok.exitCode, ok.stdout.toString()]).toEqual([0, ''])

    rmSync(join(dir, 'natal-life.md'))
    const missing = Bun.spawnSync(['bun', script, dir])
    expect(missing.exitCode).toBe(1)
    expect(missing.stderr.toString()).toContain('natal-life.md')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
  expect(Bun.spawnSync(['bun', script]).stderr.toString()).toContain('usage')
})
