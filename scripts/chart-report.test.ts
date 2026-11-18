import { expect, test } from 'bun:test'
import type { BirthInput } from '@orrery/core/types'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
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

test('--out writes exactly the report stdout would print and prints nothing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'chart-report-'))
  const out = join(dir, 'chart-report.md')

  const written = runCli([...cliArguments, `--out=${out}`])
  const printed = runCli(cliArguments)

  expect(written.exitCode).toBe(0)
  expect(written.stdout.toString()).toBe('')
  expect(readFileSync(out, 'utf8')).toBe(printed.stdout.toString())
})

test('--out creates no file when the calculation fails', () => {
  const dir = mkdtempSync(join(tmpdir(), 'chart-report-'))
  const out = join(dir, 'chart-report.md')

  const result = runCli([...cliArguments.filter((arg) => !arg.startsWith('--gender')), `--out=${out}`])

  expect(result.exitCode).toBe(1)
  expect(result.stderr.toString()).toContain('Missing required option: --gender')
  expect(existsSync(out)).toBe(false)
})
