/**
 * stdin의 방어 편집 제안을 판정해 편집 시도 폴더에 candidate.md와 result.md를 쓴다.
 * 편집 에이전트가 제안 없이 끝났으면 --execution-failed로 실행 실패를 기록한다.
 * 계약: docs/spec/remove-sqlite-state.md
 */
import { resolve } from 'node:path'
import { ActionError } from './artifacts/pipeline-actions'
import { finishEdit } from './artifacts/pipeline-run'

if (import.meta.main) {
  const args = process.argv.slice(2)
  const executionFailed = args.includes('--execution-failed')
  const [dir, attempt] = args.filter(arg => arg !== '--execution-failed')
  if (dir == null || attempt == null) {
    console.error('usage: bun scripts/artifact-edit.ts <version-dir> <edit-attempt> [--execution-failed] < proposal.json')
    process.exit(2)
  }
  try {
    let proposal: any = { executionFailed: true }
    if (!executionFailed) {
      try { proposal = JSON.parse(await Bun.stdin.text()) } catch { proposal = { edits: null } }
    }
    const result = finishEdit(resolve(dir), attempt, proposal)
    console.log(JSON.stringify(result))
  } catch (error) {
    if (!(error instanceof ActionError)) throw error
    console.error(JSON.stringify({ error: error.code, message: error.message }))
    process.exit(1)
  }
}
