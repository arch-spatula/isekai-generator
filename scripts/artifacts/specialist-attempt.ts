import { randomUUID } from 'node:crypto'
import { resolve, basename, relative } from 'node:path'
import type { ChartSystem, InterpretationDiagnostic } from '../../.agents/skills/interpret-chart-system/scripts/validate-system-interpretation'
import { ArtifactState } from './artifact-state-store'
export const MAX_SPECIALIST_ATTEMPTS = 3
export type AttemptInput = {
  system: ChartSystem; attempt: number; mode: 'generate' | 'repair'; startedAt: string
  output: string; previous?: { output: string; result: string }
}
export type AttemptResult = {
  system: ChartSystem; attempt: number; mode: AttemptInput['mode']; finishedAt: string
  status: 'editing-required' | 'validation-failed' | 'execution-failed'; output: string
  errors: InterpretationDiagnostic[]
}

export function prepareSpecialistAttempt(runDirectory: string, system: ChartSystem): AttemptInput & { attemptId:string;claim:string } {
 const state = new ArtifactState(resolve(runDirectory,'../..'))
 try { const result=state.prepare(basename(runDirectory),system,'generate',randomUUID()).data; return { system,attempt:result.number,mode:'generate',startedAt:new Date().toISOString(),output:relative(runDirectory,result.output),attemptId:result.attemptId,claim:result.claim } }finally{state.close()}
}
export function finishSpecialistAttempt(runDirectory:string,system:ChartSystem,attempt:number,executionFailed=false):AttemptResult {
 const state=new ArtifactState(resolve(runDirectory,'../..'))
 try {const run=state.run(basename(runDirectory)),a=state.one("SELECT * FROM attempts WHERE run_id=? AND stage=? AND kind='generate' AND number=?",run.id,system,attempt);if(!a)throw new Error('Attempt not found');if(executionFailed)throw new Error('Record confirmed termination through resume');state.submit(a.id,a.claim,{},randomUUID());const result=state.finish(a.id,a.claim,randomUUID());return {system,attempt,mode:'generate',finishedAt:new Date().toISOString(),output:relative(runDirectory,state.path(a.output)),status:result.outcome as AttemptResult['status'],errors:result.data.result?.errors??[]} }finally{state.close()}
}
