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

test('배경 항목이 빠지거나 경로가 두 단계가 아니면 거부한다', () => {
  const missing = brief.replace(/### 가족 구조\n[^#]*/, '')
  expect(check({ brief: missing })).toContain(`${lineOf('## 배경')}: 배경: 항목은 출신지, 성장 환경, 가족 구조, 떠남의 계기 순서여야 한다 (실제: 출신지, 성장 환경, 떠남의 계기)`)
  // #86: 셋째 단계(장소·공동체의 성격)는 쓰지 않는다. 장소는 정체성 단계가 만든다.
  const threeSteps = replaceOnce(brief, '경로: 품이 넓은 어머니와 자주 자리를 비우는 아버지 → 기대와 실망을 번갈아 품음',
    '경로: 품이 넓은 어머니와 자주 자리를 비우는 아버지 → 기대와 실망을 번갈아 품음 → 한쪽 기둥이 늘 비어 있는 집')
  expect(check({ brief: threeSteps })).toEqual([`${lineOf('### 가족 구조') + 1}: 배경 > 가족 구조: 경로는 '→'로 이은 두 단계(삶의 사실 → 반복되는 행동·감정)여야 한다`])
  const originPath = '경로: 장사로 일어섰지만 멀리 맺은 약속이 자주 흐지부지되는 집안에서 태어남 → 말로 한 약속보다 손에 쥔 것을 믿는 습관\n'
  const place = replaceOnce(brief, originPath, `${originPath}장소의 사정: 결과만 믿는 마을\n`)
  expect(check({ brief: place })).toEqual([`${lineOf(originPath.trim()) + 1}: 배경 > 출신지: 허용하지 않는 필드 '장소의 사정'`])
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
  const system = replaceOnce(brief, '근거: [life:뿌리] [life:부모]', '근거: [life:뿌리] [saju:부모]')
  expect(check({ brief: system })).toEqual([`${lineOf('근거: [life:뿌리] [life:부모]')}: [saju:부모] — 번역 브리프는 [life:<항목>]만 인용한다`])
})

test('차트 명칭을 거부한다', () => {
  const changed = replaceOnce(brief, '말로 한 약속보다 손에 쥔 것을 믿는 습관', '무곡을 닮은 셈 습관')
  expect(check({ brief: changed })).toEqual([`${brief.split('\n').findIndex((line) => line.includes('말로 한 약속보다 손에 쥔 것을 믿는 습관')) + 1}: 차트 명칭 '무곡'`])
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
  const swapped = replaceOnce(brief, '### 소년\n일생 국면:', '### 소년_\n일생 국면:').replace('### 장년\n일생 국면:', '### 소년\n일생 국면:').replace('### 소년_\n일생 국면:', '### 장년\n일생 국면:')
  expect(check({ brief: swapped })).toContain(`${lineOf('## 장')}: 장: 생애 단계는 연표 순서로 한 번씩 쓴다 (실제: 장년, 청년, 소년)`)
  const notStage = replaceOnce(brief, '### 장년\n일생 국면:', '### 중년\n일생 국면:')
  expect(check({ brief: notStage })).toContain(`${lineOf('### 장년')}: 장 > 중년: 생애 단계 이름이 아니다`)
  const basis = replaceOnce(brief, '근거: [life:장년]', '근거: [life:노년]')
  expect(check({ brief: basis })).toEqual([`${lineOf('근거: [life:장년]')}: 장 > 장년: 근거에 [life:장년]이 없다`])
})

test('동료의 동행하는 장이 브리프의 장에 없으면 거부한다', () => {
  const noYouth = brief.replace(/### 청년\n일생 국면:[^#]*/, '')
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

// #86: 브리프는 life.md의 생업을 옮겨 정체성 단계에 넘긴다.
test('생업 절이 비었거나 생업 항목이 life.md의 생업을 인용하지 않으면 거부한다', () => {
  const start = brief.indexOf('### 목수'), end = brief.indexOf('\n## 동료')
  expect(check({ brief: brief.slice(0, start) + brief.slice(end + 1) })).toEqual([`${lineOf('## 생업')}: 생업: 생업 항목이 없다`])
  const basis = replaceOnce(brief, '근거: [life:생업: 목수]', '근거: [life:주 재능]')
  expect(check({ brief: basis })).toEqual([`${lineOf('근거: [life:생업: 목수]')}: 생업 > 목수: 근거에 [life:생업: <이름>] 인용이 없다`])
})

// 배경(#97): 출신지·성장 환경·떠남의 계기는 life.md 배경(차트의 환경 자리에서 읽은 것)을 옮긴다. 인물 칸과 생애 연표만으로는
// 주인공 성향이 환경 자리에 들어간다. 대응은 docs/spec/life-to-game-translation.md 3.4절에서 정했다.
test('출신지·성장 환경·떠남의 계기는 life.md 배경 항목을 인용해야 한다', () => {
  const origin = '근거: [life:뿌리] [life:부모]'
  expect(check({ brief: replaceOnce(brief, origin, '근거: [life:유년] [life:부모]') }))
    .toEqual([`${lineOf(origin)}: 배경 > 출신지: 근거에 life.md 배경의 [life:뿌리] [life:자란 집] 중 하나가 없다`])
  expect(check({ brief: replaceOnce(brief, origin, '근거: [life:자란 집]') })).toEqual([])
  const leaving = '근거: [life:떠남의 조건] [life:소년] [life:스승·후원자]'
  expect(check({ brief: replaceOnce(brief, leaving, '근거: [life:소년] [life:스승·후원자]') }))
    .toEqual([`${lineOf(leaving)}: 배경 > 떠남의 계기: 근거에 life.md 배경의 [life:떠남의 조건] 중 하나가 없다`])
  // 가족 구조는 인물 사전에서 읽으므로 배경 항목을 요구하지 않는다.
  expect(check({ brief: replaceOnce(brief, '근거: [life:부모] [life:형제·또래]', '근거: [life:부모]') })).toEqual([])
})

// 환경 항목은 life.md 배경의 필드를 한 줄로 줄이지 않고 옮긴다. 한 줄 경로만 두면 한 체계의 재료만 남는다(#97 재생성 관찰).
test('출신지·성장 환경·떠남의 계기는 터전·가세·준 것·막은 것(떠남은 모습)을 필드로 옮긴다', () => {
  const wealth = '가세: 넉넉함\n'
  expect(check({ brief: replaceOnce(brief, wealth, '') })).toEqual([`${lineOf('### 성장 환경')}: 배경 > 성장 환경: 가세 필드가 없다`])
  const leaving = '막은 것: 떠난 뒤 돌아올 자리를 스스로 만들어야 한다\n'
  expect(check({ brief: replaceOnce(brief, leaving, '') })).toEqual([`${lineOf('### 떠남의 계기')}: 배경 > 떠남의 계기: 막은 것 필드가 없다`])
  // 가족 구조는 인물 사전에서 읽으므로 경로와 근거만 둔다.
  const family = '근거: [life:부모] [life:형제·또래]'
  expect(check({ brief: replaceOnce(brief, family, `가세: 보통\n${family}`) })).toEqual([`${lineOf(family)}: 배경 > 가족 구조: 허용하지 않는 필드 '가세'`])
})

// 터전·가세는 정해진 값만 쓴다. 집안의 생업을 쓰면 같은 별에서 나온 재능과 거울이 된다(#122).
test('터전·가세가 정해진 값이 아니면 거부한다', () => {
  const place = '터전: 오감'
  expect(check({ brief: replaceOnce(brief, place, '터전: 장마다 곡식과 소금을 떼어다 판다') }))
    .toEqual([`${lineOf(place)}: 배경 > 출신지: 터전은 머묾, 오감 중 하나다 (실제: 장마다 곡식과 소금을 떼어다 판다)`])
})

// 능력은 재능의 다루는 것과 하는 일을 함께 옮긴다. 다루는 것만 남으면 무엇을 하는 능력인지가 사라진다(#99).
test('주인공 능력은 하는 일을 옮겨야 한다', () => {
  const doing = '하는 일: 남의 표정과 서툰 솜씨를 읽고 고칠 곳과 다툼의 씨앗을 미리 짚어 준다\n'
  expect(check({ brief: replaceOnce(brief, doing, '') })).toEqual([`${lineOf('### 고칠 곳을 짚는 눈')}: 주인공 능력 > 고칠 곳을 짚는 눈: 하는 일 필드가 없다`])
})

// 동료의 재주는 life.md 인물 사전의 다루는 것이다. 전투 단계가 동료의 행동을 만드는 재료라 비울 수 없다(재료 부족 정리).
test('동료 항목에는 재주가 있어야 한다', () => {
  const skill = '재주: 재료와 도구, 글과 셈\n'
  expect(check({ brief: replaceOnce(brief, skill, '') })).toEqual([`${lineOf('### 스승·후원자')}: 동료 > 스승·후원자: 재주 필드가 없다`])
})

// #109: 장은 그 시기의 사건만이 아니라 고민(생애 연표의 주제)과 시련을 넘긴다. 사건 한 줄만 두면 장마다 다른 고민이 사라지고
// 반복되는 실패 하나가 모든 장을 대표한다.
test('장 항목에는 고민과 시련이 있어야 한다', () => {
  const worry = '고민: 넘치는 힘과 채워지지 않는 허기 사이에서 머물 곳을 찾는다\n'
  expect(check({ brief: replaceOnce(brief, worry, '') })).toEqual([`${lineOf('### 청년')}: 장 > 청년: 고민 필드가 없다`])
  const trial = '시련: 이끄는 자리에 오르자 오래 믿은 기반이 흔들리고 함께한 벗과 뜻이 갈린다\n'
  expect(check({ brief: replaceOnce(brief, trial, '') })).toEqual([`${lineOf('### 장년')}: 장 > 장년: 시련 필드가 없다`])
})

// #109: life.md의 갈림길은 모두 브리프의 갈림길로 넘어간다. 퀘스트 재료로만 쓰면 일부만 남고 GDD에서 사라졌다(v0.5.16 관찰).
// 플레이어 선택으로 바꾸는 일은 #113이 맡으므로 여기서는 본선·다른 길·갈리는 조건을 옮기는 것만 본다.
test('life.md의 갈림길이 브리프에 없으면 거부한다', () => {
  const forks = brief.slice(brief.indexOf('## 갈림길'), brief.indexOf('## 동기와 퀘스트'))
  expect(check({ brief: brief.replace(forks, '## 갈림길\n\n') })).toEqual([`${lineOf('## 갈림길')}: 갈림길: life.md의 갈림길 '노년의 길'이 없다`])
})

test('life.md에 없는 갈림길과 다른 갈림길을 인용한 근거를 거부한다', () => {
  const renamed = replaceOnce(brief, '### 노년의 길\n본선:', '### 먼 길\n본선:')
  expect(check({ brief: renamed })).toEqual([
    `${lineOf('### 노년의 길')}: 갈림길 > 먼 길: life.md의 갈림길이 아니다`,
    `${lineOf('## 갈림길')}: 갈림길: life.md의 갈림길 '노년의 길'이 없다`,
  ])
  const basis = '근거: [life:노년의 길]'
  expect(check({ brief: replaceOnce(brief, basis, '근거: [life:노년]') })).toEqual([`${lineOf(basis)}: 갈림길 > 노년의 길: 근거에 [life:노년의 길]이 없다`])
})

test('갈림길 항목에는 본선·다른 길·갈리는 조건이 있어야 한다', () => {
  const condition = '갈리는 조건: 등을 돌렸던 동료가 먼저 찾아오는가, 주인공이 먼저 길을 나서는가\n'
  expect(check({ brief: replaceOnce(brief, condition, '') })).toEqual([`${lineOf('### 노년의 길')}: 갈림길 > 노년의 길: 갈리는 조건 필드가 없다`])
})

// life.md는 갈림길을 0개 이상 둔다(docs/spec/life-integration.md 8.1). 갈림길이 없으면 브리프의 갈림길 절도 비어 있어도 된다.
test('life.md에 갈림길이 없으면 빈 갈림길 절이 통과한다', () => {
  const noForks = life.slice(0, life.indexOf('\n### 노년의 길')) + '\n'
  const forks = brief.slice(brief.indexOf('## 갈림길'), brief.indexOf('## 동기와 퀘스트'))
  const changed = brief.replace(forks, '## 갈림길\n\n').replace('재료: [life:경쟁자·적대자] [life:노년의 길]', '재료: [life:경쟁자·적대자] [life:노년]')
  expect(check({ brief: changed, life: noForks })).toEqual([])
})

// #117: 동료마다 합류와 이별을 사건으로 쓴다. 이별은 정해진 모양 하나로 시작해 장이 바뀌어도 조용히 사라지지 않게 한다.
test('동료에 합류나 이별이 없거나 이별의 모양이 목록 밖이면 거부한다', () => {
  const join = '합류: 소년의 장에 솜씨를 알아보고 부모의 반대를 무릅쓴 주인공을 제자로 거둔다'
  expect(check({ brief: replaceOnce(brief, `${join}\n`, '') })).toEqual([`${lineOf('### 스승·후원자')}: 동료 > 스승·후원자: 합류 필드가 없다`])
  const parting = '이별: 떠나보냄 — 청년의 장으로 넘어갈 때 더 가르칠 것이 없다며 주인공을 세상으로 내보낸다'
  expect(check({ brief: replaceOnce(brief, parting, '이별: 청년이 되자 떠난다') })).toEqual([
    `${lineOf(parting)}: 동료 > 스승·후원자: 이별은 '<떠나보냄 | 갈라섬 | 잃음 | 남겨 둠 | 끝까지 함께> — <어떻게>'이다`,
  ])
})

test('끝까지 함께하는 동료는 마지막 장까지 동행한다', () => {
  const parting = '이별: 갈라섬 — 청년의 끝에 터를 두고 크게 엇갈려 각자의 길로 갈라선다'
  const together = replaceOnce(brief, parting, '이별: 끝까지 함께 — 엇갈림을 지나 마지막까지 곁에 남는다')
  expect(check({ brief: together })).toEqual([`${lineOf(parting)}: 동료 > 연인·배우자: 끝까지 함께하는 동료는 마지막 장 '장년'까지 동행한다`])
})

// #118: 힘의 출처를 정한다. 스승에게 받은 힘은 가르친 사람을 인물 사전에서 인용하고, 없던 사람(상태 없음)은 스승이 될 수 없다.
test('얻은 길이 목록 밖이거나 스승에게 받은 힘이 가르친 사람을 인용하지 않으면 거부한다', () => {
  const path = '얻은 길: 스승 — 소년에 솜씨를 알아본 어른을 따라다니며 손기술을 배운다 [life:스승·후원자]'
  expect(check({ brief: replaceOnce(brief, path, '얻은 길: 배움 — 손기술을 배운다') })).toEqual([
    `${lineOf(path)}: 주인공 능력 > 성질을 읽고 빚는 손: 얻은 길은 '<스승 | 축복 | 길러냄> — <어떻게>'이다`,
  ])
  expect(check({ brief: replaceOnce(brief, path, '얻은 길: 스승 — 손기술을 배운다 [life:주 재능]') })).toEqual([
    `${lineOf(path)}: 주인공 능력 > 성질을 읽고 빚는 손: 스승에게 받은 힘은 가르친 사람 [life:<인물 칸>]을 인용한다`,
  ])
  expect(check({ brief: replaceOnce(brief, path, '얻은 길: 스승 — 손기술을 배운다 [life:제자]') })).toEqual([
    `${lineOf(path)}: 주인공 능력 > 성질을 읽고 빚는 손: 스승에게 받은 힘은 가르친 사람 [life:<인물 칸>]을 인용한다`,
  ])
  expect(check({ brief: replaceOnce(brief, path, '얻은 길: 축복 — 소년의 어느 밤 재료의 결이 한꺼번에 보이기 시작한다') })).toEqual([])
})

test('주인공 능력에 꽃피는 시기가 없으면 거부한다', () => {
  const bloom = '꽃피는 시기: 유년에 익혀 장년에 제자를 기르며 쓴다\n'
  expect(check({ brief: replaceOnce(brief, bloom, '') })).toEqual([`${lineOf('### 고칠 곳을 짚는 눈')}: 주인공 능력 > 고칠 곳을 짚는 눈: 꽃피는 시기 필드가 없다`])
})

// #113: 갈림길은 플레이어의 선택이 된다. 선택지는 주인공의 행동이고 본선과 다른 길로 하나 이상씩 간다. 장면은 브리프의 장에 놓인다.
test('선택지가 하나뿐이거나 결과가 본선·다른 길이 아니거나 한쪽으로만 가면 거부한다', () => {
  const options = '선택지: 자리를 내려놓고 먼 길을 나선다 → 본선 / 남아서 등을 돌렸던 벗을 먼저 찾아간다 → 다른 길'
  const format = `${lineOf(options)}: 갈림길 > 노년의 길: 선택지는 '<주인공의 행동> → <본선 | 다른 길>'을 ' / '로 둘 이상 잇는다`
  expect(check({ brief: replaceOnce(brief, options, '선택지: 자리를 내려놓고 먼 길을 나선다 → 본선') })).toEqual([format])
  expect(check({ brief: replaceOnce(brief, options, '선택지: 먼 길을 나선다 → 떠남 / 남는다 → 다른 길') })).toEqual([format])
  expect(check({ brief: replaceOnce(brief, options, '선택지: 먼 길을 나선다 → 본선 / 혼자 떠난다 → 본선') })).toEqual([
    `${lineOf(options)}: 갈림길 > 노년의 길: 선택지는 본선과 다른 길로 가는 행동을 하나 이상씩 둔다`,
  ])
  expect(check({ brief: replaceOnce(brief, options, `${options} / 편지를 태우고 아무에게도 답하지 않는다 → 다른 길`) })).toEqual([])
})

test('선택 장면의 장이 브리프의 장이 아니면 거부한다', () => {
  expect(check({ brief: replaceOnce(brief, '장: 장년\n상황:', '장: 노년\n상황:') })).toEqual([`${lineOf('장: 장년')}: 갈림길 > 노년의 길: 장 '노년'는 브리프의 장이 아니다`])
})

// #107: 장 하나가 여정 한 바퀴(고민 → 부름 → 문턱 → 시련 → 귀환)이고, 장마다 일생 여정의 서로 다른 국면을 연표 순서로 맡는다.
test('장에 부름·문턱·귀환이 없으면 거부한다', () => {
  const threshold = '문턱: 스승 곁을 떠나 함께 사는 사람과 새 터를 꾸린다\n'
  expect(check({ brief: replaceOnce(brief, threshold, '') })).toEqual([`${lineOf('### 청년')}: 장 > 청년: 문턱 필드가 없다`])
})

test('일생 국면이 목록 밖이거나 앞 장과 같거나 앞서면 거부한다', () => {
  const phase = '일생 국면: 시험과 동맹'
  expect(check({ brief: replaceOnce(brief, phase, '일생 국면: 방황') })).toEqual([
    `${lineOf(phase)}: 장 > 청년: 일생 국면은 일상 세계 | 모험에의 부름 | 부름의 거부 | 스승과의 만남 | 첫 문턱 | 시험과 동맹 | 가장 깊은 동굴 | 시련 | 보상 | 귀환의 길 | 부활 | 영약을 들고 귀환 가운데 하나다`,
  ])
  expect(check({ brief: replaceOnce(brief, phase, '일생 국면: 모험에의 부름') })).toEqual([
    `${lineOf(phase)}: 장 > 청년: 일생 국면은 장마다 다르고 앞 장보다 뒤의 국면이다 (앞 장: 모험에의 부름)`,
  ])
  expect(check({ brief: replaceOnce(brief, phase, '일생 국면: 일상 세계') })).toEqual([
    `${lineOf(phase)}: 장 > 청년: 일생 국면은 장마다 다르고 앞 장보다 뒤의 국면이다 (앞 장: 모험에의 부름)`,
  ])
  expect(check({ brief: replaceOnce(brief, phase, '일생 국면: 가장 깊은 동굴') })).toEqual([])
})
