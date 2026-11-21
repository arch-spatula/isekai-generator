import { expect, test } from 'bun:test'
import { KOREAN_CITIES, WORLD_CITIES, formatCityName } from '@orrery/core/cities'

import { resolveCity } from './resolve-city.ts'

test('resolves a Korean city to Seoul timezone and its coordinates', () => {
  const result = resolveCity('서울')
  expect(result.status).toBe('resolved')
  if (result.status !== 'resolved') return
  expect(result.city.timezone).toBe('Asia/Seoul')
  expect(result.city.latitude).toBeCloseTo(37.57, 1)
  expect(result.city.longitude).toBeCloseTo(126.98, 1)
})

test('resolves cities in multi-timezone countries to their own zone', () => {
  const expected: Record<string, string> = {
    뉴욕: 'America/New_York',
    로스앤젤레스: 'America/Los_Angeles',
    퍼스: 'Australia/Perth',
    블라디보스토크: 'Asia/Vladivostok',
  }
  for (const [name, timezone] of Object.entries(expected)) {
    const result = resolveCity(name)
    expect(result.status === 'resolved' && result.city.timezone).toBe(timezone)
  }
})

test('returns both candidates for a duplicated city name instead of picking one', () => {
  const result = resolveCity('광주')
  expect(result.status).toBe('ambiguous')
  if (result.status !== 'ambiguous') return
  expect(result.candidates).toHaveLength(2)
  expect(result.candidates).toContain('광주 (경기도)')
})

test('resolves a disambiguated display label', () => {
  const result = resolveCity('광주 (경기도)')
  expect(result.status).toBe('resolved')
  if (result.status !== 'resolved') return
  expect(result.city.latitude).toBeCloseTo(37.41, 1)
})

test('does not resolve a partial match; offers it as a candidate', () => {
  const result = resolveCity('워싱턴')
  expect(result.status).toBe('not-found')
  if (result.status !== 'not-found') return
  expect(result.candidates).toContain('워싱턴 D.C., 미국')
})

test('reports not-found with no candidates for an unknown city', () => {
  expect(resolveCity('없는도시이름')).toEqual({ status: 'not-found', candidates: [] })
})

/** 2024-01-15 정오 UTC 기준 해당 timezone의 UTC 오프셋(시간). */
function utcOffsetHours(timezone: string): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'longOffset' })
    .formatToParts(new Date(Date.UTC(2024, 0, 15, 12)))
    .find((part) => part.type === 'timeZoneName')!.value
  const match = /GMT(?:([+-])(\d{2}):(\d{2}))?/.exec(name)!
  if (match[1] == null) return 0
  return (match[1] === '-' ? -1 : 1) * (Number(match[2]) + Number(match[3]) / 60)
}

test('every orrery city resolves to a valid timezone whose offset is near its longitude', () => {
  // 경도 15°당 1시간이 태양시 기준이다. 정치적 timezone은 이와 최대 약 2시간 어긋나므로
  // 2시간을 넘으면 표 오기재(예: 다른 대륙 timezone)로 본다. 같은 오프셋끼리의 혼동은 잡지 못한다.
  for (const city of [...KOREAN_CITIES, ...WORLD_CITIES]) {
    const label = formatCityName(city)
    const result = resolveCity(label)
    expect(result.status, label).toBe('resolved')
    if (result.status !== 'resolved') continue
    const drift = Math.abs(utcOffsetHours(result.city.timezone) - city.lon / 15)
    expect(drift, `${label} ${result.city.timezone}`).toBeLessThanOrEqual(2)
  }
})
