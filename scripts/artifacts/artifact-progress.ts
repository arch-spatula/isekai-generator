import { resolve, basename } from 'node:path'
import { ArtifactState, DAG } from './artifact-state-store'
import type { RunManifest } from './artifact-run'
export const PROGRESS_STAGES = Object.fromEntries(Object.entries(DAG).map(([stage,dependencies]) => [stage,{label:stage,dependencies,outputs:[]}]))
export type ProgressStage = keyof typeof DAG
export type StageProgress = { status: 'pending'|'running'|'blocked'|'succeeded'|'failed'; updatedAt: string; agentId?: string; attempt?: number; editing?: { attempt:number;sourceSha256:string;status:string;result:string } }
export function readStageProgress(run: string, _manifest: RunManifest): Partial<Record<ProgressStage,StageProgress>> {
  const state=new ArtifactState(resolve(run,'../..'),false,true)
  try {const row=state.run(basename(run));return Object.fromEntries(state.all('SELECT stage,status FROM stages WHERE run_id=?',row.id).map(item=>[item.stage,{status:item.status,updatedAt:row.created_at}]))}finally{state.close()}
}
export function initializeProgress(_run:string,_manifest:RunManifest):void {}
export function refreshProgress(_run:string,_manifest:RunManifest):void {}
export function recordStageProgress(run:string,_manifest:RunManifest,stage:ProgressStage,status:StageProgress['status'],_details: {agentId?:string;attempt?:number;editing?:StageProgress['editing']}={}):void {
  const state=new ArtifactState(resolve(run,'../..'))
  try{const row=state.run(basename(run));const current=state.one('SELECT status FROM stages WHERE run_id=? AND stage=?',row.id,stage);if(!current)throw new Error('Unknown stage');if(status==='succeeded'&&current.status!=='succeeded')throw new Error('Use validated finish; direct success is forbidden');if(current.status!==status)throw new Error('Use artifact-state lifecycle commands')}finally{state.close()}
}
