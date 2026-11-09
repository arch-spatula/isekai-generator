import { spawn } from 'node:child_process'
import { basename } from 'node:path'
import { appendArtifactEvent, validateArtifactEvent, type ArtifactIssue } from './artifacts/artifact-events'
import { readRunManifest } from './artifacts/artifact-run'

export async function runLoggedStep(run: string, stage: string, attempt: number, command: string, args: string[]): Promise<number> {
  if (readRunManifest(run).status !== 'running') throw new Error('Logged steps require a running run')
  const base = { stage, attempt, operation: ['bun', 'node', 'nodejs'].includes(basename(command)) && args[0] && !args[0].startsWith('-') ? basename(args[0]) : basename(command) }
  validateArtifactEvent({ ...base, event: 'validation_succeeded' })
  return await new Promise<number>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    child.stdout.on('data', data => process.stdout.write(data))
    child.stderr.on('data', data => { stderr += data.toString(); process.stderr.write(data) })
    child.on('error', error => {
      try { appendArtifactEvent(run, { ...base, event: 'execution_failed', reason: error.message }); reject(error) }
      catch (loggingError) { reject(new AggregateError([error, loggingError], 'Execution failed; recording failure also failed')) }
    })
    child.on('close', (code, signal) => {
      if (child.pid == null) return
      const exitCode = code ?? 1
      try {
        if (exitCode === 0) appendArtifactEvent(run, { ...base, event: 'validation_succeeded', exitCode })
        else {
          let issues: ArtifactIssue[] = [{ code: 'command-failed', message: stderr.trim() || `Diagnostic unavailable${signal ? ` (signal ${signal})` : ''}` }]
          try {
            const parsed = JSON.parse(stderr.trim())
            if (Array.isArray(parsed.issues) && parsed.issues.length > 0) {
              validateArtifactEvent({ ...base, event: 'validation_failed', issues: parsed.issues })
              issues = parsed.issues
            } else if (Array.isArray(parsed.issues)) {
              issues = [{ code: 'diagnostic-unavailable', message: 'Diagnostic unavailable: validator returned no issues.' }]
            }
          } catch { /* Non-JSON validator diagnostics remain available verbatim. */ }
          appendArtifactEvent(run, { ...base, event: 'validation_failed', exitCode, reason: issues.map(issue => issue.message).join('; '), issues })
        }
        resolve(exitCode)
      } catch (error) { reject(error) }
    })
  })
}

if (import.meta.main) {
  try {
    const [run, stage, rawAttempt, separator, command, ...args] = process.argv.slice(2)
    if (!run || !stage || separator !== '--' || !command) throw new Error('Usage: bun scripts/run-logged-step.ts <run> <stage> <attempt> -- <command> [args...]')
    process.exitCode = await runLoggedStep(run, stage, Number(rawAttempt), command, args)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
