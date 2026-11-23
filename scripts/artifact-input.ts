/**
 * 시도 하나가 읽어도 되는 입력(체계별 차트 구간, 근거, 이전 진단, 편집 source)을 stdout JSON으로 돌려준다. 읽기 전용이다.
 * 계약: docs/spec/remove-sqlite-state.md
 */
import { resolve } from 'node:path'
import { ActionError } from './artifacts/pipeline-actions'
import { attemptInput } from './artifacts/pipeline-run'

if (import.meta.main) {
  const [dir, attempt] = process.argv.slice(2)
  if (dir == null || attempt == null) {
    console.error('usage: bun scripts/artifact-input.ts <version-dir> <attempt>')
    process.exit(2)
  }
  try {
    console.log(JSON.stringify(attemptInput(resolve(dir), attempt)))
  } catch (error) {
    if (!(error instanceof ActionError)) throw error
    console.error(JSON.stringify({ error: error.code, message: error.message }))
    process.exit(1)
  }
}
