import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkTranslationBrief } from './check-translation-brief.ts'
import { companionCandidates } from './companion-candidates.ts'

// fixture: life-integration/life.md(합성 통합 문서)를 입력으로 직접 쓴 번역 브리프. 그 문서의 인물 사전에서 영향이 크고 함께 한 일과
// 곁에 있던 시기가 있는 사람은 부모(유년·소년), 연인·배우자(청년), 스승·후원자(소년)이다. 기대 위반은
// docs/spec/life-to-game-translation.md 3.2·5절에서 정했다.
const fixtures = join(import.meta.dir, 'fixtures')
const life = readFileSync(join(fixtures, 'life-integration/life.md'), 'utf8')
const brief = readFileSync(join(fixtures, 'translation-brief/translation-brief.md'), 'utf8')

function replaceOnce(text: string, from: string, to: string): string {
  expect(text.split(from)).toHaveLength(2)
  return text.replace(from, to)
}
const check = (changes: { brief?: string; life?: string } = {}) => checkTranslationBrief({ brief: changes.brief ?? brief, life: changes.life ?? life })
const lineOf = (text: string) => brief.split('\n').indexOf(text) + 1

/** 인물 칸 하나의 영향을 바꾼다 */
const withImpact = (text: string, person: string, from: string, to: string) => {
  const start = text.indexOf(`### ${person}\n`)
  const end = text.indexOf('\n### ', start + 1)
  return text.slice(0, start) + replaceOnce(text.slice(start, end), `영향: ${from}`, `영향: ${to}`) + text.slice(end)
}
const noCandidates = ['부모', '연인·배우자', '스승·후원자'].reduce((text, person) => withImpact(text, person, '큼', '보통'), life)

test('동료 후보는 상태가 없음이 아니고 영향이 크며 함께 한 일과 곁에 있던 시기가 있는 인물이다', () => {
  expect(companionCandidates(life)).toEqual([
    { name: '부모', stages: ['유년', '소년'] },
    { name: '연인·배우자', stages: ['청년'] },
    { name: '스승·후원자', stages: ['소년'] },
  ])
  expect(companionCandidates(noCandidates)).toEqual([])
  expect(companionCandidates(withImpact(life, '제자', '작음', '큼')).map(({ name }) => name)).not.toContain('제자')
  const together = replaceOnce(life, '함께 한 일: 따라다니며 손기술을 배웠다', '함께 한 일: 없음')
  expect(companionCandidates(together).map(({ name }) => name)).toEqual(['부모', '연인·배우자'])
  const period = replaceOnce(life, '곁에 있던 시기: 청년\n', '곁에 있던 시기: 없음\n')
  expect(companionCandidates(period).map(({ name }) => name)).toEqual(['부모', '스승·후원자'])
})

test('정상 브리프는 통과한다', () => {
  expect(check()).toEqual([])
})

test('후보가 없으면 혼자 모험하는 브리프가 통과하고 동료를 쓰면 거부한다', () => {
  const companions = brief.slice(brief.indexOf('## 동료'), brief.indexOf('## 배경'))
  const alone = brief.replace(companions, '## 동료\n후보: 없음\n혼자: 영향이 큰 사람 가운데 곁에서 함께 한 사람이 없다\n\n')
    .replace('- 제자:', '- 연인·배우자: 영향 보통\n- 스승·후원자: 영향 보통\n- 제자:')
  expect(check({ brief: alone, life: noCandidates })).toEqual([])
  const errors = check({ life: noCandidates })
  expect(errors).toContain(`${lineOf('후보: 부모, 연인·배우자, 스승·후원자')}: 동료: 후보 '부모, 연인·배우자, 스승·후원자' — 계산 결과 '없음'`)
  expect(errors).toContain(`${lineOf('### 스승·후원자')}: 동료 > 스승·후원자: 동료 후보가 아니다 (후보: 없음)`)
})

test('후보가 아닌 인물을 동료로 쓰면 거부한다', () => {
  const changed = replaceOnce(brief, '### 스승·후원자\n동행하는 장: 소년', '### 벗·동료\n동행하는 장: 소년')
    .replace('근거: [life:스승·후원자] [life:소년]', '근거: [life:벗·동료] [life:소년]')
  expect(check({ brief: changed })).toContain(`${lineOf('### 스승·후원자')}: 동료 > 벗·동료: 동료 후보가 아니다 (후보: 부모, 연인·배우자, 스승·후원자)`)
})

test('동행하는 장이 곁에 있던 시기 밖이면 거부한다', () => {
  const changed = replaceOnce(brief, '동행하는 장: 소년', '동행하는 장: 소년, 청년')
  expect(check({ brief: changed })).toEqual([`${lineOf('동행하는 장: 소년')}: 동료 > 스승·후원자: 청년는 곁에 있던 시기(소년) 밖이다`])
})

test('동료 항목과 혼자를 함께 쓰면 거부한다', () => {
  const changed = replaceOnce(brief, '후보: 부모, 연인·배우자, 스승·후원자\n', '후보: 부모, 연인·배우자, 스승·후원자\n혼자: 혼자 다닌다\n')
  expect(check({ brief: changed })).toEqual([`${lineOf('### 스승·후원자')}: 동료: 동료 항목과 혼자를 함께 쓸 수 없다`])
})

test('능력의 출처가 재능 항목이 아니면 거부한다', () => {
  const changed = replaceOnce(brief, '출처: [life:보조 재능]', '출처: [life:벗·동료]')
  expect(check({ brief: changed })).toEqual([`${lineOf('출처: [life:보조 재능]')}: 주인공 능력 > 고칠 곳을 짚는 눈: 출처 [life:벗·동료]는 재능 항목이 아니다 (관계는 능력의 출처가 아니다)`])
  const notChosen = replaceOnce(brief, '출처: [life:보조 재능]', '출처: [life:부모]')
  expect(check({ brief: notChosen })).toEqual([`${lineOf('출처: [life:보조 재능]')}: 주인공 능력 > 고칠 곳을 짚는 눈: 출처 [life:부모]는 재능 항목이 아니다 (관계는 능력의 출처가 아니다)`])
})

test('배경 항목이 빠지거나 해석 경로가 세 단계가 아니면 거부한다', () => {
  const missing = brief.replace(/### 가족 구조\n[^#]*/, '')
  expect(check({ brief: missing })).toContain(`${lineOf('## 배경')}: 배경: 항목은 출신지, 성장 환경, 가족 구조, 떠남의 계기 순서여야 한다 (실제: 출신지, 성장 환경, 떠남의 계기)`)
  const twoSteps = replaceOnce(brief, '경로: 품이 넓은 어머니와 자주 자리를 비우는 아버지 → 기대와 실망을 번갈아 품음 → 한쪽 기둥이 늘 비어 있는 집',
    '경로: 품이 넓은 어머니와 자주 자리를 비우는 아버지 → 한쪽 기둥이 늘 비어 있는 집')
  expect(check({ brief: twoSteps })).toEqual([`${lineOf('### 가족 구조') + 1}: 배경 > 가족 구조: 경로는 '→'로 이은 세 단계여야 한다`])
  const noPlace = replaceOnce(brief, '장소의 사정: 바깥과의 약속이 자주 깨져 마을 사람들은 손에 쥔 결과만 믿고 서로의 몫을 엄격히 셈한다\n', '')
  expect(check({ brief: noPlace })).toEqual([`${lineOf('### 출신지')}: 배경 > 출신지: 장소의 사정 필드가 없다`])
})

test('짧지만 완결된 값은 길이를 이유로 거부하지 않는다', () => {
  const short = replaceOnce(brief, '약점: 자기 자리와 마음을 돌보지 않으면 남의 틈만 보고 자기 틈을 놓친다', '약점: 제 틈을 못 본다')
  expect(check({ brief: short })).toEqual([])
})

test('인물 사전의 칸이 어디에도 없으면 거부하고, 부재한 인물을 동기로 쓰면 통과한다', () => {
  const dropped = replaceOnce(brief, '- 제자: 관계 상태 없음, 영향 작음\n', '')
  expect(check({ brief: dropped })).toEqual(['인물 사전 > 제자: 동료·퀘스트 재료·옮기지 않은 인물 어디에도 없다'])
  const absence = replaceOnce(dropped, '## 옮기지 않은 인물', '### 끊긴 손\n내용: 손기술을 이어받을 사람이 없어 주인공 대에서 멈출 일을 붙잡는다\n재료: [life:제자] [life:회복]\n\n## 옮기지 않은 인물')
  expect(check({ brief: absence })).toEqual([])
})

test('life.md에 없는 항목과 다른 체계 인용을 거부한다', () => {
  const unknown = replaceOnce(brief, '재료: [life:부모] [life:상실]', '재료: [life:부모] [life:실패]')
  expect(check({ brief: unknown })).toEqual([`${lineOf('재료: [life:부모] [life:상실]')}: [life:실패] — life.md에 없는 항목`])
  const system = replaceOnce(brief, '근거: [life:유년] [life:부모]', '근거: [saju:유년] [life:부모]')
  expect(check({ brief: system })).toEqual([`${lineOf('근거: [life:유년] [life:부모]')}: [saju:유년] — 번역 브리프는 [life:<항목>]만 인용한다`])
})

test('차트 명칭을 거부한다', () => {
  const changed = replaceOnce(brief, '말보다 만든 것으로 서로를 믿는 작은 일꾼 마을', '무곡이 다스리는 장부 도시')
  expect(check({ brief: changed })).toEqual([`${lineOf('### 출신지') + 1}: 차트 명칭 '무곡'`])
})

test('필드 줄이 아닌 문장과 빈 필드를 거부한다', () => {
  const prose = replaceOnce(brief, '약점: 자기 방식만', '자기 방식만')
  expect(check({ brief: prose })[0]).toBe(`${lineOf('약점: 자기 방식만 고집하거나 한곳에 머물지 못하면 손이 무뎌진다')}: \`키: 값\` 필드 줄이 아니다`)
  const empty = replaceOnce(brief, '함께 하는 일: 말 대신 결과로 손기술을 가르치며 주인공의 기준을 세운다', '함께 하는 일:')
  expect(check({ brief: empty })).toEqual([`${lineOf('함께 하는 일: 말 대신 결과로 손기술을 가르치며 주인공의 기준을 세운다')}: 동료 > 스승·후원자: 함께 하는 일가 비었다`])
})

test('주인공 절은 축과 반복되는 실패를 같은 이름의 life.md 항목으로 인용한다', () => {
  const missing = brief.replace(/### 반복되는 실패\n[^#]*/, '')
  expect(check({ brief: missing })).toEqual([`${lineOf('## 주인공')}: 주인공: 항목은 축, 반복되는 실패 순서여야 한다 (실제: 축)`])
  const wrong = replaceOnce(brief, '근거: [life:반복되는 실패]', '근거: [life:상실]')
  expect(check({ brief: wrong })).toEqual([`${lineOf('근거: [life:반복되는 실패]')}: 주인공 > 반복되는 실패: 근거에 [life:반복되는 실패]이 없다`])
})

test('장은 생애 단계를 연표 순서로 쓰고 그 단계를 인용한다', () => {
  const swapped = replaceOnce(brief, '### 소년\n사건:', '### 소년_\n사건:').replace('### 장년\n사건:', '### 소년\n사건:').replace('### 소년_\n사건:', '### 장년\n사건:')
  expect(check({ brief: swapped })).toContain(`${lineOf('## 장')}: 장: 생애 단계는 연표 순서로 한 번씩 쓴다 (실제: 장년, 청년, 소년)`)
  const notStage = replaceOnce(brief, '### 장년\n사건:', '### 중년\n사건:')
  expect(check({ brief: notStage })).toContain(`${lineOf('### 장년')}: 장 > 중년: 생애 단계 이름이 아니다`)
  const basis = replaceOnce(brief, '근거: [life:장년]', '근거: [life:노년]')
  expect(check({ brief: basis })).toEqual([`${lineOf('근거: [life:장년]')}: 장 > 장년: 근거에 [life:장년]이 없다`])
})

test('동료의 동행하는 장이 브리프의 장에 없으면 거부한다', () => {
  const noYouth = brief.replace(/### 청년\n사건:[^#]*/, '')
  expect(check({ brief: noYouth })).toEqual([`${lineOf('동행하는 장: 청년')}: 동료 > 연인·배우자: 청년는 브리프의 장이 아니다`])
})

// #70: 주인공 능력은 재능이 다루는 대상·매체를 남긴다.
test('주인공 능력에 다루는 것이 없으면 거부한다', () => {
  const changed = replaceOnce(brief, '다루는 것: 나무와 쇠 같은 재료와 도구\n', '')
  expect(check({ brief: changed })).toEqual([`${lineOf('### 성질을 읽고 빚는 손')}: 주인공 능력 > 성질을 읽고 빚는 손: 다루는 것 필드가 없다`])
})

// #71: 관계는 능력의 출처가 아니다. 동료로 고른 인물도 마찬가지다.
test('동료로 고른 인물을 능력의 출처로 쓰면 거부한다', () => {
  const changed = replaceOnce(brief, '출처: [life:보조 재능]', '출처: [life:연인·배우자]')
  expect(check({ brief: changed })).toEqual([`${lineOf('출처: [life:보조 재능]')}: 주인공 능력 > 고칠 곳을 짚는 눈: 출처 [life:연인·배우자]는 재능 항목이 아니다 (관계는 능력의 출처가 아니다)`])
})

// #85: 생업 항목은 능력의 출처가 아니다. 생업을 전투 능력으로 직역하지 않는다.
test('생업 항목을 능력의 출처로 쓰면 거부한다', () => {
  const changed = replaceOnce(brief, '출처: [life:보조 재능]', '출처: [life:생업: 목수]')
  expect(check({ brief: changed })).toEqual([`${lineOf('출처: [life:보조 재능]')}: 주인공 능력 > 고칠 곳을 짚는 눈: 출처 [life:생업: 목수]는 생업 항목이다 (생업은 능력의 출처가 아니다)`])
})
