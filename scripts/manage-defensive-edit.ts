import { prepareDefensiveEdit, finishDefensiveEdit } from './artifacts/defensive-edit'
import type { ChartSystem } from '../.agents/skills/interpret-chart-system/scripts/validate-system-interpretation'

if (import.meta.main) {
  try {
    const [action, run, system, attempt, ...extra] = process.argv.slice(2)
    if (!run || !system || !['prepare', 'finish', 'error'].includes(action) || extra.length || (action === 'prepare' ? attempt != null : !/^[1-3]$/.test(attempt ?? ''))) throw new Error('Usage: bun scripts/manage-defensive-edit.ts <prepare|finish|error> <run-directory> <saju|ziwei|natal> [attempt]')
    console.log(JSON.stringify(action === 'prepare' ? prepareDefensiveEdit(run, system as ChartSystem) : finishDefensiveEdit(run, system as ChartSystem, Number(attempt), action === 'error'), null, 2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
