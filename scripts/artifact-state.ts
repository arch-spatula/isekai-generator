import { AXIS_KEYS } from '../.agents/skills/select-gameplay-concept/scripts/fingerprint-registry'
import { WORLD_KEYS } from '../.agents/skills/select-world-concept/scripts/world-contract'
import { ArtifactState, StateError, type Reply } from './artifacts/artifact-state-store'
import { KINDS, MODES, PURPOSES, readSeriesConfig, repositoryState } from './artifacts/artifact-run'
import { resolve } from 'node:path'

export async function main(args: string[], reading = false): Promise<void> {
  let store: ArtifactState | undefined
  try {
    if(args[0] !== 'allocate') args = args.map(arg => arg === '--version' ? '--run' : arg)
    const command = args.shift(), flags: Record<string,string> = {}
    for (let i=0;i<args.length;i++) {
      const flag = args[i]; if (!flag?.startsWith('--') || flags[flag] != null) throw new StateError('invalid-arguments','Invalid or duplicate flag',2)
      if (flag === '--unfinished') flags[flag] = 'true'
      else { const value = args[++i]; if (!value || value.startsWith('--')) throw new StateError('invalid-arguments','Missing flag value',2); flags[flag] = value }
    }
    const allowed: Record<string,string[]> = { allocate:['kind','mode','purpose'], start:['run'],prepare:['run','stage','kind'],dispatch:['attempt','claim'],'bind-worker':['attempt','claim','agent'],submit:['attempt','claim'],finish:['attempt','claim'],reconcile:['run'],resume:['run'],cancel:['run','reason'],fail:['run','reason'],finalize:['run'],runs:['unfinished'],summary:['run'],next:['run'],input:['attempt','claim'],issues:['attempt'],events:['run','after','limit'],fingerprints:['attempt','kind','candidate'] }
    const readCommands = ['runs','summary','next','input','issues','events','fingerprints']
    if (!command || !allowed[command] || reading !== readCommands.includes(command)) throw new StateError('invalid-arguments','Unknown command',2)
    if (Object.keys(flags).some(flag => !['root',...allowed[command],...(!reading ? ['request'] : [])].includes(flag.slice(2)))) throw new StateError('invalid-arguments','Unknown flag',2)
    const get = (key: string): string => { const value=flags[`--${key}`]; if (!value) throw new StateError('invalid-arguments',`Missing --${key}`,2); return value }
    if (!reading) get('request')
    if (command === 'allocate' && (!KINDS.includes(get('kind') as never) || !MODES.includes(get('mode') as never) || !PURPOSES.includes(get('purpose') as never))) throw new StateError('invalid-arguments','Invalid allocation options',2)
    const root = resolve(flags['--root'] ?? process.cwd())
    if(command==='allocate'){readSeriesConfig(root);const source=repositoryState(root);if(get('purpose')==='release-candidate'&&source.dirty)throw new StateError('dirty-release-candidate')}
    store = new ArtifactState(root, command === 'allocate', reading)
    const s = store, request = flags['--request']!, id = flags['--run']
    let output: Reply
    const stdin = async (): Promise<any> => { const text=await Bun.stdin.text(); try { return text.trim() ? JSON.parse(text) : {} } catch { if(command==='submit')return { invalidEditingPayload: true }; throw new StateError('invalid-arguments','Invalid stdin JSON',2) } }
    if (command === 'allocate') output=s.allocate(get('kind'),get('mode'),get('purpose'),request)
    else if (command === 'prepare') output=s.prepare(get('run'),get('stage'),get('kind'),request)
    else if (command === 'submit') output=s.submit(get('attempt'),get('claim'),await stdin(),request)
    else if (command === 'finish') output=s.finish(get('attempt'),get('claim'),request)
    else if (command === 'summary') output=s.summary(get('run'))
    else if (command === 'next') output=s.next(get('run'))
    else if (command === 'input') output=s.input(get('attempt'),get('claim'))
    else if (command === 'reconcile') output=s.reconcile(get('run'),request)
    else if (command === 'finalize') output=s.finalize(get('run'),request)
    else if (command === 'runs') output={schemaVersion:1,outcome:'runs',data:{runs:s.all(`SELECT id AS runId,version,kind,status FROM runs ${flags['--unfinished'] ? "WHERE status NOT IN ('succeeded','failed','cancelled')" : ''} ORDER BY created_at` )}}
    else if (command === 'issues') { const a=s.attempt(get('attempt'));output={schemaVersion:1,outcome:'issues',data:{attemptId:a.id,result:a.result?JSON.parse(a.result):null}} }
    else if (command === 'events') { const run=s.run(get('run')), limit=Number(flags['--limit']??20), after=Number(flags['--after']??0); if(!Number.isSafeInteger(limit)||limit<1||limit>100||!Number.isSafeInteger(after)||after<0)throw new StateError('invalid-arguments','Invalid cursor',2); const rows=s.all('SELECT id,stage,attempt_id AS attemptId,event,reason,diagnostics,created_at AS createdAt FROM events WHERE run_id=? AND id>? ORDER BY id LIMIT ?',run.id,after,limit);output={schemaVersion:1,outcome:'events',data:{events:rows.map(r=>({...r,diagnostics:JSON.parse(r.diagnostics)})),total:s.one('SELECT count(*) AS n FROM events WHERE run_id=? AND id>?',run.id,after).n,nextCursor:rows.at(-1)?.id??after}} }
    else if (command === 'fingerprints') { const a=s.attempt(get('attempt')),kind=get('kind'); if((kind==='combat'&&a.stage!=='selection')||(kind==='world'&&a.stage!=='world-selection')||!['combat','world'].includes(kind))throw new StateError('input-not-allowed');const registry=JSON.parse(a.input).registry;let comparison:any={};if(flags['--candidate']){const candidate=JSON.parse(flags['--candidate']);const axes=kind==='combat'?AXIS_KEYS:WORLD_KEYS;if(!candidate||Object.keys(candidate).length!==axes.length||axes.some((axis:string)=>typeof candidate[axis]!=='string'))throw new StateError('invalid-arguments','Invalid fingerprint axes',2);const matches=registry.entries.map((entry:any)=>({...entry,equalAxes:axes.filter((axis:string)=>entry.fingerprint[axis]===candidate[axis]).length}));const maximum=Math.max(-1,...matches.map((entry:any)=>entry.equalAxes));const closest=matches.filter((entry:any)=>entry.equalAxes===maximum);comparison={closest,requiresChallenger:maximum>=(kind==='combat'?5:4),registryReview:{comparedEntries:registry.entries.length,closest:closest.map(({version,candidateId,equalAxes}:any)=>({version,candidateId,equalAxes}))}}}output={schemaVersion:1,outcome:'fingerprints',data:{kind,revision:a.registry_revision,comparedEntries:registry.entries.length,...comparison}} }
    else if (command === 'dispatch' || command === 'bind-worker') output=s.operation(request,command,{attempt:get('attempt'),claim:get('claim'),...(command==='bind-worker'?{agent:get('agent')}:{})},()=>{const a=s.attempt(get('attempt'));s.live(a,get('claim'));if(command==='dispatch'){if(a.status!=='prepared')throw new StateError('dispatch-not-allowed');s.db.query("UPDATE attempts SET status='dispatching' WHERE id=?").run(a.id)}else{if(a.status!=='dispatching')throw new StateError('bind-not-allowed');s.db.query("UPDATE attempts SET status='running',worker=? WHERE id=?").run(get('agent'),a.id)}s.event(a.run_id,command,request,a.stage,a.id);return{schemaVersion:1,outcome:command==='dispatch'?'dispatching':'running',data:{attemptId:a.id}}})
    else if (command === 'resume') {
      output=s.resume(get('run'),await stdin(),request)
    } else output=s.operation(request,command,{id:get('run'),reason:flags['--reason']},()=>{const run=s.run(get('run'));if(['succeeded','failed','cancelled'].includes(run.status))throw new StateError('run-terminal');if(command==='start'){if(run.status!=='allocated')throw new StateError('start-not-allowed');s.db.query("UPDATE runs SET status='running',started_at=? WHERE id=?").run(new Date().toISOString(),run.id)}else{const reason=get('reason');if(!/^[^\r\n]{1,240}$/.test(reason))throw new StateError('invalid-arguments','Invalid safe reason',2);s.db.query('UPDATE runs SET status=?,reason=?,finished_at=? WHERE id=?').run(command==='cancel'?'cancelled':'failed',reason,new Date().toISOString(),run.id);s.db.query('UPDATE attempts SET claim=?,generation=generation+1 WHERE run_id=?').run(crypto.randomUUID(),run.id)}s.event(run.id,command,request);return{schemaVersion:1,outcome:command==='start'?'running':command==='cancel'?'cancelled':'failed',data:{runId:run.id}}})
    console.log(JSON.stringify(output))
  } catch(error) {const failure=error instanceof StateError?error:new StateError(/locked|busy/i.test(String(error))?'state-busy':'state-error','Artifact state operation failed');let recordFailure:string|undefined;if(store&&['integrity-error','validator-revision-mismatch','registry-stale','state-error'].includes(failure.code)){const attemptIndex=args.indexOf('--attempt'),runIndex=args.indexOf('--run');const target=attemptIndex>=0?args[attemptIndex+1]:runIndex>=0?args[runIndex+1]:undefined;if(target)try{store.blockFailure(failure.code,target,attemptIndex>=0)}catch{recordFailure='Recording blocked state also failed'}}console.error(JSON.stringify({schemaVersion:1,error:{code:failure.code,message:failure.message,...(recordFailure?{recordFailure}:{})}}));process.exitCode=failure.exitCode} finally {store?.close()}
}
if(import.meta.main)await main(process.argv.slice(2))
