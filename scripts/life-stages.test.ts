import { expect, test } from 'bun:test'

import { LIFE_STAGES, overlaps, stageLabel } from './life-stages.ts'

const stage = (name: string) => LIFE_STAGES.find((candidate) => candidate.name === name)!

test('stages cover every age without gaps and the last stage is open-ended', () => {
  expect(LIFE_STAGES.map(stageLabel)).toEqual(['유년 0–12', '소년 13–19', '청년 20–34', '장년 35–54', '노년 55–'])
})

test('a period overlaps a stage when it touches either boundary age', () => {
  expect(overlaps(stage('소년'), 19, 28)).toBe(true)
  expect(overlaps(stage('소년'), 4, 13)).toBe(true)
  expect(overlaps(stage('소년'), 20, 29)).toBe(false)
  expect(overlaps(stage('소년'), 3, 12)).toBe(false)
  expect(overlaps(stage('노년'), 91, 100)).toBe(true)
  expect(overlaps(stage('노년'), 45, 54)).toBe(false)
})
