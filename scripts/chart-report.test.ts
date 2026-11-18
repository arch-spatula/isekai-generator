import { expect, test } from 'bun:test'
import type { BirthInput } from '@orrery/core/types'
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { allChartsToText, parseCliArguments } from './chart-report.ts'

const firstInput: BirthInput = {
  year: 1993,
  month: 3,
  day: 12,
  hour: 9,
  minute: 45,
  gender: 'M',
  latitude: 37.5665,
  longitude: 126.978,
  timezone: 'Asia/Seoul',
}

const secondInput: BirthInput = {
  year: 2000,
  month: 1,
  day: 1,
  hour: 12,
  minute: 0,
  gender: 'F',
  latitude: 40.7128,
  longitude: -74.006,
  timezone: 'America/New_York',
}

test('produces complete and different reports for different birth profiles', async () => {
  const first = await allChartsToText(firstInput, { ziweiYear: 2026, houseSystem: 'P' })
  const second = await allChartsToText(secondInput, { ziweiYear: 2026, houseSystem: 'P' })

  for (const report of [first, second]) {
    expect(report).toContain('四柱八字')
    expect(report).toContain('紫微斗數 命盤')
    expect(report).toContain('流年 (2026年 丙午年)')
    expect(report).toContain('Natal Chart')
    expect(report).toContain('Major Aspects')
  }
  expect(first).not.toBe(second)
  expect(first).toContain('乙巳')
  expect(second).toContain('四柱八字 (女)')
})

test('requires birth profile arguments instead of using an embedded profile', () => {
  expect(() => parseCliArguments([])).toThrow('Missing required option')

  const request = parseCliArguments([
    '--year', '1993', '--month', '3', '--day', '12',
    '--hour', '9', '--minute', '45', '--gender', 'M',
    '--latitude', '37.5665', '--longitude', '126.978',
    '--timezone', 'Asia/Seoul', '--flow-year', '2030',
  ])

  expect(request.input).toEqual({ ...firstInput, jasiMethod: 'unified' })
  expect(request.ziweiYear).toBe(2030)
  expect(request.houseSystem).toBe('P')
})

const cliArguments = [
  '--year=2000', '--month=1', '--day=1', '--hour=12', '--minute=0', '--gender=F',
  '--latitude=40.7128', '--longitude=-74.006', '--timezone=America/New_York', '--flow-year=2026',
]

function runCli(args: string[]) {
  return Bun.spawnSync(['bun', join(import.meta.dir, 'chart-report.ts'), ...args])
}

const SYSTEM_FILES = ['saju-chart.md', 'ziwei-chart.md', 'natal-chart.md']

test('--out-dir splits stdout into one file per system and prints nothing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'chart-report-'))

  const written = runCli([...cliArguments, `--out-dir=${dir}`])
  const printed = runCli(cliArguments).stdout.toString()

  expect(written.exitCode).toBe(0)
  expect(written.stdout.toString()).toBe('')
  expect(readdirSync(dir).sort()).toEqual([...SYSTEM_FILES].sort())
  const [saju, ziwei, natal] = SYSTEM_FILES.map((name) => readFileSync(join(dir, name), 'utf8'))
  for (const file of [saju, ziwei, natal]) expect(file.endsWith('\n')).toBe(true)
  // 세 파일을 보고서의 구분자(빈 줄)로 이어 붙이면 stdout과 바이트 단위로 같아야 한다.
  expect([saju, ziwei, natal].map((file) => file.slice(0, -1)).join('\n\n') + '\n').toBe(printed)
})

test('--out-dir files each contain only their own system', () => {
  const dir = mkdtempSync(join(tmpdir(), 'chart-report-'))
  runCli([...cliArguments, `--out-dir=${dir}`])
  const read = (name: string) => readFileSync(join(dir, name), 'utf8')
  const headers = { saju: '四柱八字', ziwei: '紫微斗數 命盤', natal: 'Natal Chart' }

  expect(read('saju-chart.md').startsWith(headers.saju)).toBe(true)
  expect(read('saju-chart.md')).not.toContain(headers.ziwei)
  expect(read('saju-chart.md')).not.toContain(headers.natal)
  expect(read('ziwei-chart.md').startsWith(headers.ziwei)).toBe(true)
  expect(read('ziwei-chart.md')).not.toContain(headers.saju)
  expect(read('ziwei-chart.md')).not.toContain(headers.natal)
  expect(read('natal-chart.md').startsWith(headers.natal)).toBe(true)
  expect(read('natal-chart.md')).not.toContain(headers.saju)
  expect(read('natal-chart.md')).not.toContain(headers.ziwei)
})

test('--out-dir creates no file when the calculation fails', () => {
  const dir = mkdtempSync(join(tmpdir(), 'chart-report-'))

  const result = runCli([...cliArguments.filter((arg) => !arg.startsWith('--gender')), `--out-dir=${dir}`])

  expect(result.exitCode).toBe(1)
  expect(result.stderr.toString()).toContain('Missing required option: --gender')
  expect(readdirSync(dir)).toEqual([])
})
