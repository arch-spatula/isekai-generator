import { expect, test } from 'bun:test'
import { LUCKY_STAR_NAMES, MAIN_STAR_NAMES, PALACE_NAMES, SHA_STAR_NAMES } from '@orrery/core/constants'
import { chartNameErrors, ZIWEI_READINGS } from './chart-names.ts'

// 기대값은 docs/spec/claude-game-design-flow.md 4.1의 표에서 정했다: 한자 표기·고유한 한글 독음·차트 문법은 거부하고,
// 일상어와 겹치는 말은 잡지 않는다. 문장은 직접 쓴 합성 예시다.
const names = (text: string) => chartNameErrors(text).map((error) => error.split("'")[1])

test('한자 이름은 별·궁·십신·신살·천간·운 이름 모두 거부한다', () => {
  expect(names('출신지는 武曲이 다스리는 곳이다')).toEqual(['武曲'])
  expect(names('命宮에서 시작한다')).toEqual(['命宮'])
  expect(names('偏財를 따라간다')).toEqual(['偏財'])
  expect(names('驛馬처럼 떠돈다')).toEqual(['驛馬'])
  expect(names('甲 년에 태어났다')).toEqual(['甲'])
  expect(names('大運이 바뀐다')).toEqual(['大運'])
})

test('일상어와 겹치지 않는 한글 독음을 거부한다', () => {
  expect(names('무곡의 도시에서 자랐다')).toEqual(['무곡'])
  expect(names('탐랑과 칠살의 기운')).toEqual(['탐랑', '칠살'])
  expect(names('겁재처럼 빼앗는다')).toEqual(['겁재'])
  expect(names('식신의 손맛')).toEqual(['식신'])
  expect(names('도화살이 낀 사람')).toEqual(['도화살'])
})

test('궁·자리·하우스가 붙은 차트 문법을 거부한다', () => {
  expect(names('천이궁의 길을 나선다')).toEqual(['천이궁'])
  expect(names('관록궁이 강하다')).toEqual(['관록궁'])
  expect(names('전갈자리의 집념')).toEqual(['전갈자리'])
  expect(names('제10하우스의 명예')).toEqual(['제10하우스'])
  expect(names('Mars의 분노')).toEqual(['Mars'])
})

test('일상어와 겹치는 말은 잡지 않는다', () => {
  for (const sentence of [
    '달이 뜬 밤에 길을 나선다', '태양 아래 마른 땅', '그 일은 상관없다', '어깨를 나란히 비견할 사람', '정인이라는 이름의 친구',
    '이름난 명궁이 활을 당긴다', '천부적인 손재주', '거문고 소리', '천기를 누설한다', '형제와 부모를 떠난다',
    '성벽 위의 화성', '빈자리에 앉는다', '오래 장생한 노인', 'The Sun rises', '천이백 걸음',
  ]) expect(chartNameErrors(sentence)).toEqual([])
})

test('오류는 줄 번호와 이름을 알린다', () => {
  expect(chartNameErrors('첫 줄\n둘째 줄 武曲')).toEqual(["2: 차트 명칭 '武曲'"])
})

test('자미두수 상수의 모든 이름에 독음이 있다', () => {
  for (const name of [...MAIN_STAR_NAMES, ...LUCKY_STAR_NAMES, ...SHA_STAR_NAMES, ...PALACE_NAMES]) {
    expect(ZIWEI_READINGS[name]).toBeString()
  }
})
