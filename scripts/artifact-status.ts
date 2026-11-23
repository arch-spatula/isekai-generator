/**
 * 버전 폴더의 진행 상태를 계산해 stdout JSON으로 출력한다. 읽기 전용이다.
 * 계약: docs/spec/remove-sqlite-state.md
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pipelineStatus } from './artifacts/pipeline-status'

if (import.meta.main) {
  const [dir] = process.argv.slice(2)
  if (dir == null || !existsSync(dir)) {
    console.error('usage: bun scripts/artifact-status.ts <version-dir>')
    process.exit(2)
  }
  console.log(JSON.stringify(pipelineStatus(resolve(dir)), null, 2))
}
