/**
 * 상태 명령이 `publish`로 안내한 단계의 후보를 정식 경로에 게시한다. 이미 있는 파일은 덮어쓰지 않는다.
 * 계약: docs/spec/remove-sqlite-state.md
 */
import { resolve } from 'node:path'
import { ActionError, publishStep } from './artifacts/pipeline-actions'
import type { StepId } from './artifacts/pipeline-status'

if (import.meta.main) {
  const [dir, step] = process.argv.slice(2)
  if (dir == null || step == null) {
    console.error('usage: bun scripts/artifact-publish.ts <version-dir> <step>')
    process.exit(2)
  }
  try {
    console.log(JSON.stringify(publishStep(resolve(dir), step as StepId)))
  } catch (error) {
    if (!(error instanceof ActionError)) throw error
    console.error(JSON.stringify({ error: error.code, message: error.message }))
    process.exit(1)
  }
}
