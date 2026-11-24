import { expect, test } from 'bun:test'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { duplicateItemNames, lifeMaterial } from './assemble-life-material.ts'
import { median } from './life-relations.ts'

// 입력은 세 일생 해석 fixture(서로 다른 합성 출생 입력)다. 재료표는 이름 기준 병합이라 같은 사람일 필요가 없다.
// 기대 줄은 fixture 문서에서 손으로 옮겼고 배치는 docs/spec/life-integration.md §4에서 정했다.
const fixtures = { saju: 'saju-life', ziwei: 'ziwei-life', natal: 'natal-life' }
const fixtureDir = (system: keyof typeof fixtures) => join(import.meta.dir, 'fixtures', fixtures[system])
const lives = {
  saju: readFileSync(join(fixtureDir('saju'), 'saju-life.md'), 'utf8'),
  ziwei: readFileSync(join(fixtureDir('ziwei'), 'ziwei-life.md'), 'utf8'),
  natal: readFileSync(join(fixtureDir('natal'), 'natal-life.md'), 'utf8'),
}
const script = join(import.meta.dir, 'assemble-life-material.ts')

test('lays out sections and items: background, timeline and cast side by side, talents and wounds per system', () => {
  const headings = lifeMaterial(lives).split('\n').filter((line) => line.startsWith('#'))
  const perSystem = (items: string[]) => ['saju', 'ziwei', 'natal'].flatMap((system) => items.map((item) => `### ${system} ${item}`))
  expect(headings).toEqual([
    '## 배경', ...['뿌리', '자란 집', '떠남의 조건'].map((item) => `### ${item}`),
    '## 생애 연표', ...['유년', '소년', '청년', '장년', '노년'].map((stage) => `### ${stage}`),
    '## 인물 사전', ...['부모', '형제·또래', '연인·배우자', '자녀', '제자', '벗·동료', '스승·후원자', '경쟁자·적대자'].map((name) => `### ${name}`),
    '## 재능과 생업', ...['saju 주 재능', 'saju 보조 재능', 'saju 생업: 목수', 'saju 생업: 공방 선생', 'ziwei 주 재능', 'ziwei 보조 재능', 'ziwei 생업: 마을 관리인',
      'natal 주 재능', 'natal 보조 재능', 'natal 생업: 기록관'].map((item) => `### ${item}`),
    '## 상처와 회복', ...perSystem(['반복되는 실패', '상실', '회복']),
  ])
})

test('puts each field of the same-name item next to each other and drops 근거', () => {
  const lines = lifeMaterial(lives).split('\n')
  expect(lines.slice(0, 7)).toEqual([
    '일생 통합 재료 (세 체계 일생 해석을 항목 이름으로 모은 것 · 해석 아님)',
    '─────',
    '## 배경',
    '### 뿌리',
    '모습 [saju]: 윗대부터 바깥을 오가며 물건을 사고팔아 살림을 일으킨 집안이다',
    '모습 [ziwei]: 윗대는 사람 좋기로 알려졌지만 맺은 약속이 자주 흐지부지되는 집안이다',
    '모습 [natal]: 집안의 내력이 멀리 있는 사람들과 맺은 인연과 약속에 기대 있다',
  ])
  const childhood = lines.indexOf('### 유년')
  expect(lines.slice(childhood + 1, childhood + 3)).toEqual([
    '운 [saju]: 대운 이전 0–7, 1運 庚辰 8–17',
    '운 [ziwei]: 大限 이전 1–1歲, 命宮 乙酉 2–11歲, 父母 丙戌 12–21歲',
  ])
  const parents = lines.indexOf('### 부모')
  expect(lines.slice(parents + 1, parents + 4)).toEqual([
    '성향 [saju]: 어머니는 품이 넓고 아버지는 바깥일로 바쁘다',
    '성향 [ziwei]: 다정하지만 약속을 자주 어기는 윗사람이다',
    '성향 [natal]: 집안의 중심은 멀리 있는 사람과의 약속에 마음을 두어, 집 안보다 바깥에서 더 자주 모습을 보인다',
  ])
  const natalTalent = lines.indexOf('### natal 주 재능')
  expect(lines.slice(natalTalent + 1, natalTalent + 5)).toEqual([
    '내용: 사람 사이의 균형을 읽고 흩어진 사람들을 하나의 자리에 모은다',
    '다루는 것: 사람과 무리',
    '꽃피는 시기: 많은 사람 앞에서 책임을 맡았을 때 드러난다',
    '막히는 조건: 혼자 결정해야 하는 일만 남을 때',
  ])
  expect(lines.filter((line) => line.startsWith('근거'))).toEqual([])
})

// docs/spec/life-shape-and-relationship-status.md §5.3·§5.4: 상태·영향은 세 체계 값과 중앙값(큰 쪽부터 있음 > 약함 > 없음, 큼 > 보통 > 작음)을 쓴다.
test('writes each system relation status and impact with their median', () => {
  const lines = lifeMaterial(lives).split('\n')
  const child = lines.slice(lines.indexOf('### 자녀'), lines.indexOf('### 제자'))
  expect(child).toEqual(expect.arrayContaining(['상태 [saju]: 약함', '상태 [ziwei]: 약함', '상태 [natal]: 약함', '상태 본선: 약함', '영향 본선: 보통']))
  const parent = lines.slice(lines.indexOf('### 부모'), lines.indexOf('### 형제·또래'))
  expect(parent.filter((line) => line.startsWith('상태'))).toEqual([])
  const split = { ...lives,
    ziwei: lives.ziwei.replace('상태: 있음', '상태: 없음').replace(/(### 연인·배우자[\s\S]*?)영향: 큼/, '$1영향: 작음'),
    natal: lives.natal.replace('상태: 있음', '상태: 약함') }
  const spouse = lifeMaterial(split).split('\n')
  const block = spouse.slice(spouse.indexOf('### 연인·배우자'), spouse.indexOf('### 자녀'))
  expect(block).toEqual(expect.arrayContaining(['상태 본선: 약함', '영향 본선: 큼']))
})

test('median picks the middle of three ordered values', () => {
  expect(median(['있음', '없음', '약함'], ['있음', '약함', '없음'])).toBe('약함')
  expect(median(['큼', '큼', '작음'], ['큼', '보통', '작음'])).toBe('큼')
  expect(median(['작음', '보통', '작음'], ['큼', '보통', '작음'])).toBe('작음')
})

const extraTalent = (name: string) => lives.natal.replace('## 상처와 회복',
  `### ${name}\n내용: 길을 잃은 사람에게 방향을 짚어 준다\n꽃피는 시기: 낯선 땅에 들어섰을 때\n막히는 조건: 스스로 길을 잃었을 때\n근거: [chart:Jupiter]\n\n## 상처와 회복`)

test('keeps an extra talent under its own name and reports names repeated across sections', () => {
  const lines = lifeMaterial({ ...lives, natal: extraTalent('길잡이') }).split('\n')
  expect(lines.slice(lines.indexOf('### natal 길잡이'), lines.indexOf('### natal 길잡이') + 2))
    .toEqual(['### natal 길잡이', '내용: 길을 잃은 사람에게 방향을 짚어 준다'])
  expect(duplicateItemNames(lives.natal)).toEqual([])
  expect(duplicateItemNames(extraTalent('회복'))).toEqual(['회복'])
})

function run(dir?: string) {
  const result = Bun.spawnSync(['bun', script, ...(dir == null ? [] : [dir])])
  return { exitCode: result.exitCode, stderr: result.stderr.toString() }
}

test('CLI writes life-material.md only when all three life documents pass and the file is absent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'life-material-'))
  const output = join(dir, 'life-material.md')
  try {
    for (const system of ['saju', 'ziwei', 'natal'] as const) cpSync(fixtureDir(system), dir, { recursive: true })

    writeFileSync(join(dir, 'natal-life.md'), lives.natal.replace('### 스승·후원자', '### 스승'))
    const invalid = run(dir)
    expect(invalid.exitCode).toBe(1)
    expect(invalid.stderr).toContain('natal-life.md가 검증을 통과하지 못해 재료표를 만들지 않았다')
    expect(existsSync(output)).toBe(false)

    writeFileSync(join(dir, 'natal-life.md'), extraTalent('회복'))
    const duplicate = run(dir)
    expect(duplicate.exitCode).toBe(1)
    expect(duplicate.stderr).toContain('항목 이름이 섹션을 넘어 겹친다: 회복')
    expect(existsSync(output)).toBe(false)

    writeFileSync(join(dir, 'natal-life.md'), lives.natal)
    expect(run(dir)).toEqual({ exitCode: 0, stderr: '' })
    expect(readFileSync(output, 'utf8')).toBe(`${lifeMaterial(lives)}\n`)

    const again = run(dir)
    expect(again.exitCode).toBe(1)
    expect(again.stderr).toContain(`이미 있음: ${output}`)

    rmSync(output)
    rmSync(join(dir, 'ziwei-life.md'))
    const missing = run(dir)
    expect(missing.exitCode).toBe(1)
    expect(missing.stderr).toContain('ziwei-life.md')
    expect(existsSync(output)).toBe(false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
  expect(run().stderr).toContain('usage')
})
