import { expect, test } from 'bun:test'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { checkLifeDocument } from './check-life-document.ts'

// fixture: 합성 입력(2000-03-09 10:00 서울 남)의 chart-report 출력, 합성 1차 판단, 그 판단 파생 사실,
// 손으로 쓴 일생 해석. 변형은 한 곳만 바꾸고 기대 위반은 docs/spec/life-narrative-interpretation.md §3·§5에서 정했다.
const fixtureDir = join(import.meta.dir, 'fixtures/saju-life')
const read = (file: string) => readFileSync(join(fixtureDir, file), 'utf8')
const texts = {
  chart: read('saju-chart.md'),
  facts: read('saju-facts.md'),
  judgment: read('saju-judgment.md'),
  derived: read('saju-derived-facts.md'),
}
const valid = read('saju-life.md')

function check(life: string): string[] {
  return checkLifeDocument('saju', { ...texts, life })
}

/** 정상 문서에서 정확히 한 곳을 바꾼다. */
function mutate(from: string, to: string): string {
  expect(valid.split(from)).toHaveLength(2)
  return valid.replace(from, to)
}

function lineOf(text: string): number {
  return valid.split('\n').indexOf(text) + 1
}

test('the hand-written fixture passes', () => {
  expect(check(valid)).toEqual([])
})

test('checks the title, 원국 and section order', () => {
  expect(check(mutate('# 四柱 일생 해석', '# 四柱 1차 판단'))).toContain("1: 첫 줄은 '# 四柱 일생 해석'이어야 한다")
  expect(check(mutate('원국: 癸巳 丙寅 己卯 庚辰', '원국: 庚辰 己卯 丙寅 癸巳')))
    .toContain('3: 원국 불일치 — 문서 庚辰 己卯 丙寅 癸巳, saju-chart.md 癸巳 丙寅 己卯 庚辰')
  const swapped = mutate('## 재능과 생업', '## X').replace('## 상처와 회복', '## 재능과 생업').replace('## X', '## 상처와 회복')
  expect(check(swapped)).toContain('섹션은 생애 연표, 인물 사전, 재능과 생업, 상처와 회복 순서여야 한다 (실제: 생애 연표, 인물 사전, 상처와 회복, 재능과 생업)')
})

test('requires every stage and cast member in order, and the required talents first', () => {
  const withoutYouth = valid.replace(/### 소년\n[\s\S]*?(?=### 청년)/, '')
  expect(check(withoutYouth)).toContain('생애 연표: 항목은 유년, 소년, 청년, 장년, 노년 순서여야 한다 (실제: 유년, 청년, 장년, 노년)')
  expect(check(mutate('### 스승·후원자', '### 스승'))).toContain(
    '인물 사전: 항목은 부모, 형제·또래, 연인·배우자, 자녀·제자, 벗·동료, 스승·후원자, 경쟁자·적대자 순서여야 한다 (실제: 부모, 형제·또래, 연인·배우자, 자녀·제자, 벗·동료, 스승, 경쟁자·적대자)')
  // 재능은 필수 두 항목 뒤에 자유 항목을 더할 수 있다.
  const extra = '### 생활 기술\n내용: 낡은 도구를 고쳐 쓴다\n꽃피는 시기: 노년에 손이 느려진 뒤에도 남는다\n막히는 조건: 도구가 없을 때\n근거: [facts:통근]\n\n## 상처와 회복'
  expect(check(mutate('## 상처와 회복', extra))).toEqual([])
  expect(check(mutate('### 주 재능', '### 큰 재능'))).toContain('재능과 생업: 항목은 주 재능, 보조 재능으로 시작해야 한다 (실제: 큰 재능, 보조 재능)')
})

test('requires each field once with a value and rejects other lines', () => {
  const trial = '시련: 힘이 넘쳐 다른 사람의 말을 듣지 않다가 큰 실수를 한다'
  expect(check(mutate(`${trial}\n`, ''))).toContain('생애 연표 > 청년: 시련 필드가 없다')
  expect(check(mutate(`${trial}\n`, `${trial}\n${trial}\n`))).toContain(`${lineOf(trial) + 1}: 생애 연표 > 청년: 시련 필드가 두 번 이상 있다`)
  expect(check(mutate(trial, '시련: '))).toContain(`${lineOf(trial)}: 생애 연표 > 청년: 시련 값이 비어 있다`)
  expect(check(mutate(`${trial}\n`, `${trial}\n확신도: 높음\n`))).toContain(`${lineOf(trial) + 1}: 생애 연표 > 청년: 알 수 없는 필드 '확신도'`)
  expect(check(mutate(`${trial}\n`, `${trial}\n그리고 많은 일이 있었다\n`))).toContain(`${lineOf(trial) + 1}: 생애 연표 > 청년: '키: 값' 필드가 아닌 줄이다`)
  expect(check(mutate('## 인물 사전\n', '## 인물 사전\n이 사람의 주변 인물이다\n'))).toContain(`${lineOf('## 인물 사전') + 1}: 인물 사전: 항목 밖의 줄이다`)
})

test('운 must equal the stage line of 생애 단계별 大運', () => {
  const luck = '운: 대운 이전 0–7, 1運 庚辰 8–17'
  // 나이를 잘못 세어 2運까지 유년에 넣은 경우
  expect(check(mutate(luck, '운: 대운 이전 0–7, 1運 庚辰 8–17, 2運 辛巳 18–27')))
    .toContain(`${lineOf(luck)}: 생애 연표 > 유년: 운 불일치 — 문서 대운 이전 0–7, 1運 庚辰 8–17, 2運 辛巳 18–27, saju-facts.md 대운 이전 0–7, 1運 庚辰 8–17`)
})

test('인연 must name cast members, and timeline fields must name a life stage', () => {
  const ties = '인연: 스승·후원자, 벗·동료'
  expect(check(mutate(ties, '인연: 스승, 벗·동료'))).toContain(`${lineOf(ties)}: 생애 연표 > 소년: 인물 사전에 없는 인연 '스승'`)
  const change = '관계의 변화: 유년에는 어머니 곁을 떠나지 못하다가 청년에 아버지와 같은 길을 걷게 된다'
  expect(check(mutate(change, '관계의 변화: 어머니 곁을 떠나지 못하다가 아버지와 같은 길을 걷게 된다')))
    .toContain(`${lineOf(change)}: 인물 사전 > 부모: 관계의 변화에 생애 단계 이름이 없다`)
  const bloom = '꽃피는 시기: 장년에 제자를 기르며 드러난다'
  expect(check(mutate(bloom, '꽃피는 시기: 제자를 기르며 드러난다'))).toContain(`${lineOf(bloom)}: 재능과 생업 > 보조 재능: 꽃피는 시기에 생애 단계 이름이 없다`)
})

test('resolves facts, chart, judgment and derived citations', () => {
  // 보조 재능 근거도 '[facts:십신 분포]'로 시작하므로 줄 전체로 바꾼다.
  const evidence = '근거: [facts:십신 분포]'
  const replace = (to: string) => check(mutate(`\n${evidence}\n`, `\n${to}\n`))
  expect(replace('근거: 말수가 적다')).toContain(`${lineOf(evidence)}: 인물 사전 > 벗·동료: 근거에 인용이 없다`)
  expect(replace('근거: [facts:친구운]')).toContain(`${lineOf(evidence)}: 인물 사전 > 벗·동료: saju-facts.md에 없는 항목 [facts:친구운]`)
  expect(replace('근거: [chart:交友]')).toContain(`${lineOf(evidence)}: 인물 사전 > 벗·동료: saju-chart.md에 없는 절·위치 [chart:交友]`)
  expect(replace('근거: [judgment:강점 궁]')).toContain(`${lineOf(evidence)}: 인물 사전 > 벗·동료: saju-judgment.md에 없는 섹션 [judgment:강점 궁]`)
  expect(replace('근거: [derived:4運]')).toContain(`${lineOf(evidence)}: 인물 사전 > 벗·동료: saju-derived-facts.md에 없는 항목 [derived:4運]`)
})

test('every first-pass judgment section and the derived facts must be cited somewhere', () => {
  // 조후는 청년 근거에서 한 번만 인용된다.
  expect(check(mutate('[judgment:일간 강약] [judgment:조후] [facts:득령]', '[judgment:일간 강약] [facts:득령]')))
    .toContain('1차 판단 섹션을 인용하지 않았다: 조후')
  const withoutDerived = valid.replaceAll('[derived:大運별 용신·희신·기신] ', '').replaceAll(' [derived:大運별 용신·희신·기신]', '')
  expect(check(withoutDerived)).toContain('판단 파생 사실을 인용하지 않았다')
})

test('CLI reads the directory and exits by result', () => {
  const script = join(import.meta.dir, 'check-life-document.ts')
  const ok = Bun.spawnSync(['bun', script, 'saju', fixtureDir])
  expect([ok.exitCode, ok.stdout.toString()]).toEqual([0, ''])

  const dir = mkdtempSync(join(tmpdir(), 'saju-life-'))
  try {
    cpSync(fixtureDir, dir, { recursive: true })
    writeFileSync(join(dir, 'saju-life.md'), valid.replace('인연: 스승·후원자, 벗·동료', '인연: 스승, 벗·동료'))
    const bad = Bun.spawnSync(['bun', script, 'saju', dir])
    expect(bad.exitCode).toBe(1)
    expect(bad.stdout.toString()).toContain("인물 사전에 없는 인연 '스승'")

    rmSync(join(dir, 'saju-derived-facts.md'))
    const missing = Bun.spawnSync(['bun', script, 'saju', dir])
    expect(missing.exitCode).toBe(1)
    expect(missing.stderr.toString()).toContain('saju-derived-facts.md')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }

  const unknown = Bun.spawnSync(['bun', script, 'tarot', fixtureDir])
  expect(unknown.exitCode).toBe(1)
  expect(unknown.stderr.toString()).toContain('usage')
})

// 자미두수: 합성 입력(2000-03-03 10:00 서울 남)의 현재 사실 파일, 합성 1차 판단, 그 판단 파생 사실, 손으로 쓴 일생 해석.
// 공통 구조 규칙은 위 사주 테스트가 다루고, 여기서는 자미두수 설정(명반, 大限 대응, 금지 절, 파생 사실 이름)만 확인한다.
const ziweiDir = join(import.meta.dir, 'fixtures/ziwei-life')
const readZiwei = (file: string) => readFileSync(join(ziweiDir, file), 'utf8')
const ziweiTexts = {
  chart: readZiwei('ziwei-chart.md'),
  facts: readZiwei('ziwei-facts.md'),
  judgment: readZiwei('ziwei-judgment.md'),
  derived: readZiwei('ziwei-derived-facts.md'),
}
const ziweiValid = readZiwei('ziwei-life.md')
const checkZiwei = (life: string) => checkLifeDocument('ziwei', { ...ziweiTexts, life })
const mutateZiwei = (from: string, to: string) => {
  expect(ziweiValid.split(from)).toHaveLength(2)
  return ziweiValid.replace(from, to)
}
const ziweiLine = (text: string) => ziweiValid.split('\n').indexOf(text) + 1

test('ziwei: the hand-written fixture passes, citing 大限 and palace positions', () => {
  expect(checkZiwei(ziweiValid)).toEqual([])
  const result = Bun.spawnSync(['bun', join(import.meta.dir, 'check-life-document.ts'), 'ziwei', ziweiDir])
  expect([result.exitCode, result.stdout.toString()]).toEqual([0, ''])
})

test('ziwei: checks the title and 명반 against the chart header', () => {
  expect(checkZiwei(mutateZiwei('# 紫微斗數 일생 해석', '# 四柱 일생 해석'))).toContain("1: 첫 줄은 '# 紫微斗數 일생 해석'이어야 한다")
  expect(checkZiwei(mutateZiwei('身宮 夫妻 (未)', '身宮 遷移 (卯)')))
    .toContain('3: 명반 불일치 — 문서 命宮 乙酉 · 身宮 遷移 (卯) · 水二局, ziwei-chart.md 命宮 乙酉 · 身宮 夫妻 (未) · 水二局')
})

test('ziwei: 운 must equal the stage line of 생애 단계별 大限', () => {
  const luck = '운: 父母 丙戌 12–21歲'
  // 세는나이를 그대로 써서 福德 22–31歲까지 소년(13–19)에 넣은 경우
  // 청년 운도 같은 문자열로 시작하므로 줄 전체로 바꾼다.
  expect(checkZiwei(mutateZiwei(`${luck}\n`, '운: 父母 丙戌 12–21歲, 福德 丁亥 22–31歲\n')))
    .toContain(`${ziweiLine(luck)}: 생애 연표 > 소년: 운 불일치 — 문서 父母 丙戌 12–21歲, 福德 丁亥 22–31歲, ziwei-facts.md 父母 丙戌 12–21歲`)
})

test('ziwei: 流年 and 流月 stay forbidden while 大限 is allowed', () => {
  const evidence = '근거: [facts:생애 단계별 大限] [chart:遷移] [chart:大限]'
  for (const section of ['流年', '流月']) {
    expect(checkZiwei(mutateZiwei(evidence, `근거: [facts:생애 단계별 大限] [chart:遷移] [chart:${section}]`)))
      .toEqual([`${ziweiLine(evidence)}: 생애 연표 > 노년: 일생 해석에 쓰지 않는 절 [chart:${section}]`])
  }
})

test('ziwei: derived facts are cited by their item name including the palace', () => {
  const evidence = '근거: [derived:과제 궁 父母]'
  // 소년 근거도 같은 문자열로 시작하므로 줄 전체로 바꾼다.
  expect(checkZiwei(mutateZiwei(`${evidence}\n`, '근거: [derived:과제 궁]\n')))
    .toContain(`${ziweiLine(evidence)}: 상처와 회복 > 상실: ziwei-derived-facts.md에 없는 항목 [derived:과제 궁]`)
  // 격국은 청년과 회복에서만 인용된다.
  const uncited = ziweiValid.replace(' [judgment:격국]', '').replace(' [judgment:격국]', '')
  expect(checkZiwei(uncited)).toContain('1차 판단 섹션을 인용하지 않았다: 격국')
})

test('ziwei: a facts file without the life-stage table is reported, not silently skipped', () => {
  // 생애 단계 사실이 생기기 전에 만든 폴더의 사실 파일
  const oldFacts = ziweiTexts.facts.slice(0, ziweiTexts.facts.indexOf('생애 단계별 大限'))
  const errors = checkLifeDocument('ziwei', { ...ziweiTexts, facts: oldFacts, life: ziweiValid })
  expect(errors).toContain(`${ziweiLine('운: 父母 丙戌 12–21歲')}: 생애 연표 > 소년: ziwei-facts.md에 이 단계의 운 대응 줄이 없다`)
})

// 네이탈: 합성 입력(2000-09-05 12:00 서울 남, Placidus)의 현재 사실 파일, 네이탈 1차 판단 fixture와 같은 판단 문서,
// 손으로 쓴 일생 해석. 네이탈 설정(생애 연표·판단 파생 사실 없음, 단계 이름 불요, 차트 인용 이름)만 확인한다.
const natalDir = join(import.meta.dir, 'fixtures/natal-life')
const readNatal = (file: string) => readFileSync(join(natalDir, file), 'utf8')
const natalTexts = { chart: readNatal('natal-chart.md'), facts: readNatal('natal-facts.md'), judgment: readNatal('natal-judgment.md') }
const natalValid = readNatal('natal-life.md')
const checkNatal = (life: string) => checkLifeDocument('natal', { ...natalTexts, life })
const mutateNatal = (from: string, to: string) => {
  expect(natalValid.split(from)).toHaveLength(2)
  return natalValid.replace(from, to)
}
const natalLine = (text: string) => natalValid.split('\n').indexOf(text) + 1

test('natal: the fixture passes without a timeline, stage names or a derived facts file', () => {
  expect(checkNatal(natalValid)).toEqual([])
  // fixture 디렉터리에는 natal-derived-facts.md가 없다.
  const result = Bun.spawnSync(['bun', join(import.meta.dir, 'check-life-document.ts'), 'natal', natalDir])
  expect([result.exitCode, result.stdout.toString()]).toEqual([0, ''])
})

test('natal: checks the title and 차트 identity', () => {
  expect(checkNatal(mutateNatal('# Natal 일생 해석', '# Natal 1차 판단'))).toContain("1: 첫 줄은 '# Natal 일생 해석'이어야 한다")
  expect(checkNatal(mutateNatal('Moon Sagittarius', 'Moon Virgo')))
    .toContain('3: 차트 불일치 — 문서 ASC Scorpio · Sun Virgo · Moon Virgo · Placidus, natal-chart.md ASC Scorpio · Sun Virgo · Moon Sagittarius · Placidus')
})

test('natal: a timeline section is not part of the document', () => {
  const timeline = '## 생애 연표\n### 유년\n운: 없음\n\n## 인물 사전'
  expect(checkNatal(mutateNatal('## 인물 사전', timeline)))
    .toContain('섹션은 인물 사전, 재능과 생업, 상처와 회복 순서여야 한다 (실제: 생애 연표, 인물 사전, 재능과 생업, 상처와 회복)')
})

test('natal: chart citations accept planets and angles only, and derived citations are rejected', () => {
  const evidence = '근거: [facts:섹트 소속] [chart:Venus]'
  const replace = (to: string) => checkNatal(mutateNatal(evidence, to))
  expect(replace('근거: [facts:섹트 소속] [chart:ASC] [chart:Houses]')).toEqual([])
  expect(replace('근거: [facts:섹트 소속] [chart:Chiron]')).toEqual([`${natalLine(evidence)}: 상처와 회복 > 회복: natal-chart.md에 없는 절·위치 [chart:Chiron]`])
  expect(replace('근거: [facts:섹트 소속] [derived:강점 궁 疾厄]'))
    .toEqual([`${natalLine(evidence)}: 상처와 회복 > 회복: 판단 파생 사실에 없는 항목 [derived:강점 궁 疾厄]`])
})

test('natal: every first-pass judgment section must be cited', () => {
  // 우세 원소는 보조 재능에서만 인용된다.
  expect(checkNatal(mutateNatal('[judgment:우세 원소] ', ''))).toEqual(['1차 판단 섹션을 인용하지 않았다: 우세 원소'])
})
