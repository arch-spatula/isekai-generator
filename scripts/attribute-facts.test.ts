import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { attributeFacts } from './attribute-facts.ts'
import { chartNameErrors } from './chart-names.ts'

// fixture: 체계별 1차 판단 fixture의 사실 파일. 세 파일은 서로 다른 합성 명식이지만 이 계산은 체계마다 따로 읽으므로 상관없다.
// 기대값은 각 사실 파일의 줄(오행 분포, 일간, 월령, 오행국, 삼방사정 보조성 수, 원소·양태 분포, 섹트 소속, 본질적 품위)을 손으로 옮겨 정했다.
const fixtures = join(import.meta.dir, 'fixtures')
const read = (path: string) => readFileSync(join(fixtures, path), 'utf8')
const texts = { saju: read('saju-judgment/saju-facts.md'), ziwei: read('ziwei-judgment/ziwei-facts.md'), natal: read('natal-judgment/natal-facts.md') }

test('세 체계의 기운 사실을 차트 명칭 없이 계산한다', () => {
  expect(attributeFacts(texts)).toBe([
    '세 체계의 기운 (규칙 계산값, 판정 아님)',
    '동양 다섯 기운 (여덟 자리): 나무 2 · 불 2 · 흙 2 · 쇠 1 · 물 1',
    '중심 기운: 불 · 태어난 계절: 봄',
    '두 번째 체계의 바탕 기운: 물',
    '서양 네 원소: 불 3 · 흙 2 · 공기 5 · 물 0',
    '서양 움직임: 시작 1 · 고정 3 · 변화 6',
    '삶의 중심 둘레의 결: 길한 기운 3 · 거친 기운 2',
    '길한 별: 힘을 얻음 1 · 힘을 잃음 1',
    '거친 별: 힘을 얻음 0 · 힘을 잃음 0',
  ].join('\n'))
  expect(chartNameErrors(attributeFacts(texts))).toEqual([])
})

// 길한 별·거친 별은 사실 파일의 섹트 소속 줄이 정한 이름을 따른다. 품위 이름이 둘 이상이어도 한 번만 센다.
test('품위는 섹트 소속 줄이 길성·흉성으로 정한 별만 센다', () => {
  const natal = texts.natal.replace('  Mars in Leo: 없음', '  Mars in Leo: 폴·데트리먼트').replace('  Saturn in Gemini: 없음', '  Saturn in Gemini: 엑잘테이션')
  expect(attributeFacts({ ...texts, natal }).split('\n').at(-1)).toBe('거친 별: 힘을 얻음 1 · 힘을 잃음 1')
})

test('필요한 줄이 없으면 어느 파일의 무엇이 없는지 알린다', () => {
  expect(() => attributeFacts({ ...texts, ziwei: texts.ziwei.replace(/^오행국:.*\n/m, '') })).toThrow('ziwei-facts.md: 오행국 줄이 없다')
})
