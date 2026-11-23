/**
 * 상태 명령이 `ready`나 `edit`로 안내한 단계의 다음 시도 폴더를 만든다.
 * 계약: docs/spec/remove-sqlite-state.md
 */
import { resolve } from 'node:path'
import { ActionError, createAttempt } from './artifacts/pipeline-actions'
import type { StepId } from './artifacts/pipeline-status'

if (import.meta.main) {
  const args = process.argv.slice(2)
  const replaceUnfinished = args.includes('--replace-unfinished')
  const [dir, step] = args.filter(arg => arg !== '--replace-unfinished')
  if (dir == null || step == null) {
    console.error('usage: bun scripts/artifact-attempt.ts <version-dir> <step> [--replace-unfinished]')
    process.exit(2)
  }
  try {
    console.log(JSON.stringify(createAttempt(resolve(dir), step as StepId, { replaceUnfinished })))
  } catch (error) {
    if (!(error instanceof ActionError)) throw error
    console.error(JSON.stringify({ error: error.code, message: error.message }))
    process.exit(1)
  }
}
