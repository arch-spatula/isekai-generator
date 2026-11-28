import { expect, test } from 'bun:test'

import { checkGdd } from './check-gdd.ts'

test('a GDD written in plain genre words passes', () => {
  expect(checkGdd('# 화덕과 망치\n\n상업도시에서 산적을 막는 호위 런이다.\n')).toEqual([])
})

test('chart names are rejected with their line', () => {
  expect(checkGdd('# 제목\n\n紫微의 힘으로 싸운다.\n')).toEqual(["3: 차트 명칭 '紫微'"])
})

test('a genre title that contains a chart word inside it is not rejected', () => {
  expect(checkGdd('요새의 집정관과 맞선다.\n')).toEqual([])
})
