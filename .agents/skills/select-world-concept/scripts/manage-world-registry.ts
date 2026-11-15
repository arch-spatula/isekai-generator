import { ArtifactState } from '../../../../scripts/artifacts/artifact-state-store'
import type { WorldRegistry, WorldEntry } from './world-contract'
export function loadWorldRegistry(repositoryRoot:string):WorldRegistry{const state=new ArtifactState(repositoryRoot,false,true);try{return state.registry('world')}finally{state.close()}}
export function initializeWorldRegistry(_path:string):void{throw new Error('Registry initialization belongs to artifact-state allocate')}
export function registerWorldFingerprint(_path:string,_entry:WorldEntry):void{throw new Error('Use artifact-state finalize for atomic combat and world registration')}
if(import.meta.main){console.error('Use read-artifact-state fingerprints or artifact-state finalize');process.exitCode=2}
