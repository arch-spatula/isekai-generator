/**
 * GDD(`gdd.md`)에 차트 명칭이 없는지만 검사한다. 절 구성·인용·장 대응은 검사하지 않는다.
 * 계약: docs/ADR/2026-11-28-minimal-gdd-agent.md
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { chartNameErrors } from './chart-names.ts'

export function checkGdd(gdd: string): string[] {
  return chartNameErrors(gdd)
}

if (import.meta.main) {
  const [dir] = process.argv.slice(2)
  if (dir == null) {
    console.error('usage: bun scripts/check-gdd.ts <차트 디렉터리>')
    process.exit(1)
  }
  let gdd: string
  try {
    gdd = readFileSync(join(dir, 'gdd.md'), 'utf8')
  } catch {
    console.error(`읽을 수 없음: ${join(dir, 'gdd.md')}`)
    process.exit(1)
  }
  const errors = checkGdd(gdd)
  for (const error of errors) console.log(error)
  process.exit(errors.length === 0 ? 0 : 1)
}
