import { randomUUID } from 'node:crypto'
import { ArtifactState } from '../../../../scripts/artifacts/artifact-state-store'
import { writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { failRun, updateRun } from '../../../../scripts/artifacts/artifact-run'



class ChartCalculationError extends Error {}
const REQUIRED_SECTIONS = ['四柱八字', '紫微斗數 命盤', 'Natal Chart'] as const

/** Return whether calculator output contains all supported chart systems. */
export function isCompleteChartReport(report: string): boolean {
  return report.trim().length > 0 && REQUIRED_SECTIONS.every(section => report.includes(section))
}

/** Run the repository calculator and save its stdout without modification. */
export async function runChartReport(repositoryRoot:string,outputPath:string,chartArguments:string[]):Promise<void> {
 const root=resolve(repositoryRoot),runDirectory=resolve(dirname(outputPath),'../..'),state=new ArtifactState(root)
 let activeRun:any
 try {
  const run=state.run(runDirectory.split('/').at(-1)!)
  if(resolve(outputPath)!==join(root,'artifacts',run.version,'docs/GDD/chart-report.md'))throw new Error('Chart output must belong to reserved run')
  if(run.kind==='chart-report'&&run.status==='allocated')updateRun(runDirectory,'running')
  else if(run.status!=='running')throw new Error('Parent GDD run must be running before chart calculation')
  activeRun=run
  const prepared=state.prepare(run.id,'chart-report','generate',randomUUID()).data
  const child=Bun.spawn(['bun',join(root,'scripts/chart-report.ts'),...chartArguments],{cwd:root,stdout:'pipe',stderr:'pipe'})
  const [exitCode,stdout,stderr]=await Promise.all([child.exited,new Response(child.stdout).text(),new Response(child.stderr).text()])
  if(exitCode!==0)throw new ChartCalculationError(stderr.trim()||'Chart calculator failed')
  if(!isCompleteChartReport(stdout))throw new ChartCalculationError('Chart calculator returned incomplete output')
  await writeFile(prepared.output,stdout,{flag:'wx'})
  state.submit(prepared.attemptId,prepared.claim,{},randomUUID());state.finish(prepared.attemptId,prepared.claim,randomUUID())
  if(run.kind==='chart-report')state.finalize(run.id,randomUUID())
 }catch(error){
  if(activeRun){if(activeRun.kind==='chart-report'&&error instanceof ChartCalculationError)failRun(runDirectory,'chart-report','Chart calculation or evidence validation failed.',error)
  try{state.blockFailure('chart-calculation-failed',activeRun.id)}catch(recordError){throw new AggregateError([error,recordError],'Chart failed; recording blocked state also failed')}}
  throw error
 }finally{state.close()}
}

if (import.meta.main) {
  const separator = process.argv.indexOf('--', 2)
  const repositoryRoot = process.argv[2]
  const outputPath = process.argv[3]
  if (repositoryRoot == null || outputPath == null || separator !== 4) {
    console.error('Usage: bun run-chart-report.ts <repository-root> <output-path> -- <chart flags>')
    process.exitCode = 2
  } else {
    try {
      await runChartReport(repositoryRoot, outputPath, process.argv.slice(separator + 1))
      console.log(outputPath)
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      if (error instanceof AggregateError) {
        for (const cause of error.errors) console.error(cause instanceof Error ? cause.message : String(cause))
      }
      process.exitCode = 1
    }
  }
}
