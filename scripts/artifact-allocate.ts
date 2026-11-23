/**
 * 활성 series의 다음 버전 폴더를 만들고 run.md를 쓴다. 상태 DB는 만들지 않는다.
 * 계약: docs/spec/remove-sqlite-state.md
 */
import { resolve } from 'node:path'
import { ActionError } from './artifacts/pipeline-actions'
import { allocateRun } from './artifacts/pipeline-run'

if (import.meta.main) {
  const [kind, mode = 'light', purpose = 'experiment', root = '.'] = process.argv.slice(2)
  if (kind == null) {
    console.error('usage: bun scripts/artifact-allocate.ts <chart-report|personalized-gdd> [light|deep] [purpose] [repository-root]')
    process.exit(2)
  }
  try {
    console.log(JSON.stringify(allocateRun(resolve(root), kind, mode, purpose)))
  } catch (error) {
    if (!(error instanceof ActionError)) throw error
    console.error(JSON.stringify({ error: error.code, message: error.message }))
    process.exit(1)
  }
}
