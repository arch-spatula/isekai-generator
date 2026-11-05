import { prepareSpecialistAttempt, finishSpecialistAttempt } from './artifacts/specialist-attempt'
import type { ChartSystem } from '../.agents/skills/interpret-chart-system/scripts/validate-system-interpretation'

if (import.meta.main) {
  try {
    const [action, run, system, attempt, ...extra] = process.argv.slice(2)
    if (!run || !system || !['prepare', 'finish', 'error'].includes(action) || extra.length || (action === 'prepare' ? attempt != null : !/^[1-3]$/.test(attempt ?? ''))) {
      throw new Error('Usage: bun scripts/manage-specialist-attempt.ts <prepare|finish|error> <run-directory> <saju|ziwei|natal> [attempt]')
    }
    const result = action === 'prepare'
      ? prepareSpecialistAttempt(run, system as ChartSystem)
      : finishSpecialistAttempt(run, system as ChartSystem, Number(attempt), action === 'error')
    console.log(JSON.stringify(result, null, 2))
    // Recorded validation failures are normal recovery outcomes, not tool failures.
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
