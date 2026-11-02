import { describe, expect, test } from 'bun:test'

import { isValidGdd } from './validate-gdd'

describe('isValidGdd', () => {
  test('accepts any non-empty document structure', () => {
    expect(isValidGdd('# 자유로운 제목\n\n자유로운 내용')).toBe(true)
  })

  test('rejects an empty document', () => {
    expect(isValidGdd(' \n\t')).toBe(false)
  })
})
