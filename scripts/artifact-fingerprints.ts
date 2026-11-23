/**
 * 선택 시도 폴더의 레지스트리 스냅샷과 후보 지문을 비교해 stdout JSON으로 출력한다. 읽기 전용이다.
 * 계약: docs/spec/remove-sqlite-state.md
 */
import { resolve } from 'node:path'
import { ActionError } from './artifacts/pipeline-actions'
import { compareFingerprint } from './artifacts/pipeline-fingerprints'

if (import.meta.main) {
  const args = process.argv.slice(2)
  const flag = args.indexOf('--candidate')
  const candidateText = flag >= 0 ? args[flag + 1] : undefined
  const [dir, attempt] = args.filter((_, index) => flag < 0 || (index !== flag && index !== flag + 1))
  if (dir == null || attempt == null || (flag >= 0 && candidateText == null)) {
    console.error("usage: bun scripts/artifact-fingerprints.ts <version-dir> <attempt> [--candidate '<JSON axes>']")
    process.exit(2)
  }
  try {
    let candidate: unknown
    if (candidateText != null) {
      try { candidate = JSON.parse(candidateText) } catch { throw new ActionError('invalid-fingerprint', 'Candidate is not valid JSON') }
    }
    console.log(JSON.stringify(compareFingerprint(resolve(dir), attempt, candidate)))
  } catch (error) {
    if (!(error instanceof ActionError)) throw error
    console.error(JSON.stringify({ error: error.code, message: error.message }))
    process.exit(1)
  }
}
