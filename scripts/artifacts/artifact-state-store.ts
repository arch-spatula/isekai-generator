import { Database } from 'bun:sqlite'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, linkSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, isAbsolute } from 'node:path'
import { readSeriesConfig, repositoryState, KINDS, MODES, PURPOSES } from './artifact-run'
import { buildEvidenceManifest, type ChartEvidenceManifest } from '../../.agents/skills/generate-chart-report/scripts/chart-evidence'
import { diagnoseSystemInterpretation } from '../../.agents/skills/interpret-chart-system/scripts/validate-system-interpretation'
import { isValidInterpretation } from '../../.agents/skills/interpret-chart-report/scripts/validate-interpretation'
import { validateConceptBrief, parseFinalFingerprint, parseSelectedCandidateId } from '../../.agents/skills/select-gameplay-concept/scripts/validate-concept-brief'
import { validateWorldBrief } from '../../.agents/skills/select-world-concept/scripts/validate-world-brief'
import { parseWorldBrief, selectedWorld } from '../../.agents/skills/select-world-concept/scripts/world-contract'
import { isValidGdd } from '../../.agents/skills/generate-gdd-from-interpretation/scripts/validate-gdd'

export type Reply = { schemaVersion: 1; outcome: string; data: Record<string, any>; nextAction?: string }
export class StateError extends Error { constructor(public code: string, message = code, public exitCode = 1) { super(message) } }
export const DAG: Record<string, string[]> = { 'chart-report': [], saju: ['chart-report'], ziwei: ['chart-report'], natal: ['chart-report'], integration: ['saju', 'ziwei', 'natal'], selection: ['integration'], 'world-selection': ['selection'], gdd: ['world-selection'], 'final-validation': ['gdd'], 'fingerprint-registration': ['final-validation'] }
const systems = ['saju', 'ziwei', 'natal']
const finalNames: Record<string, string> = { 'chart-report': 'chart-report.md', saju: 'saju-interpretation.md', ziwei: 'ziwei-interpretation.md', natal: 'natal-interpretation.md', integration: 'chart-interpretation.md', selection: 'gameplay-concept-brief.md', 'world-selection': 'world-concept-brief.md', gdd: 'personalized-action-rpg-concept.md' }
const hash = (value: string | Uint8Array): string => createHash('sha256').update(value).digest('hex')
const json = (value: any): string => JSON.stringify(value)
const parse = (value: string | null): any => value == null ? null : JSON.parse(value)
const now = (): string => new Date().toISOString()
const reply = (outcome: string, data: Record<string, any> = {}, nextAction?: string): Reply => ({ schemaVersion: 1, outcome, data, ...(nextAction ? { nextAction } : {}) })
function requireState(value: unknown, code: string): asserts value { if (!value) throw new StateError(code) }
const terminal = (status: string): boolean => ['succeeded', 'failed', 'cancelled'].includes(status)

const schema = `
CREATE TABLE store_meta(schema_version INTEGER NOT NULL, repository TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE series_counters(series TEXT PRIMARY KEY, patch INTEGER NOT NULL);
CREATE TABLE runs(id TEXT PRIMARY KEY, version TEXT UNIQUE NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('chart-report','personalized-gdd')),mode TEXT NOT NULL,purpose TEXT NOT NULL,source_revision TEXT NOT NULL,baseline_revision TEXT NOT NULL,dirty INTEGER NOT NULL,config TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('allocated','running','blocked','succeeded','failed','cancelled')),reason TEXT,failure_stage TEXT,created_at TEXT NOT NULL,started_at TEXT,finished_at TEXT,directory_ready INTEGER NOT NULL DEFAULT 0,CHECK((status IN ('succeeded','failed','cancelled'))=(finished_at IS NOT NULL)));
CREATE TABLE stages(run_id TEXT REFERENCES runs(id),stage TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('pending','running','blocked','succeeded','failed')),current_attempt TEXT,accepted_attempt TEXT,accepted_document TEXT,reason TEXT,PRIMARY KEY(run_id,stage),FOREIGN KEY(current_attempt,run_id,stage) REFERENCES attempts(id,run_id,stage),FOREIGN KEY(accepted_attempt,run_id,stage) REFERENCES attempts(id,run_id,stage),FOREIGN KEY(accepted_document,run_id,stage) REFERENCES documents(id,run_id,role));
CREATE TABLE attempts(id TEXT PRIMARY KEY,run_id TEXT NOT NULL REFERENCES runs(id),stage TEXT NOT NULL,kind TEXT NOT NULL,number INTEGER NOT NULL,scope TEXT,status TEXT NOT NULL CHECK(status IN ('prepared','dispatching','running','submitted','interrupted','completed')),claim TEXT NOT NULL,generation INTEGER NOT NULL DEFAULT 1,input TEXT NOT NULL,payload TEXT,payload_hash TEXT,result TEXT,worker TEXT,output TEXT NOT NULL,source_document TEXT,source_hash TEXT,registry_revision INTEGER NOT NULL,created_at TEXT NOT NULL,UNIQUE(run_id,stage,kind,number),UNIQUE(id,run_id,stage),FOREIGN KEY(run_id,stage) REFERENCES stages(run_id,stage));
CREATE UNIQUE INDEX active_attempt ON attempts(run_id,stage) WHERE status IN ('prepared','dispatching','running','submitted');
CREATE TABLE operations(request_id TEXT PRIMARY KEY,command TEXT NOT NULL,args_hash TEXT NOT NULL,target TEXT,status TEXT NOT NULL CHECK(status IN ('pending','completed')),response TEXT);
CREATE TABLE events(id INTEGER PRIMARY KEY AUTOINCREMENT,run_id TEXT NOT NULL REFERENCES runs(id),stage TEXT,attempt_id TEXT,event TEXT NOT NULL,operation TEXT,reason TEXT,diagnostics TEXT,created_at TEXT NOT NULL);
CREATE INDEX event_cursor ON events(run_id,id);
CREATE TABLE documents(id TEXT PRIMARY KEY,run_id TEXT NOT NULL REFERENCES runs(id),attempt_id TEXT NOT NULL REFERENCES attempts(id),role TEXT NOT NULL,path TEXT NOT NULL,sha256 TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('prepared','ready-to-publish','published')),final_path TEXT UNIQUE NOT NULL,UNIQUE(id,run_id,role),FOREIGN KEY(attempt_id,run_id,role) REFERENCES attempts(id,run_id,stage));
CREATE TABLE validations(id TEXT PRIMARY KEY,document_id TEXT NOT NULL REFERENCES documents(id),sha256 TEXT NOT NULL,validator_id TEXT NOT NULL,revision TEXT NOT NULL,result TEXT NOT NULL,diagnostics TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE evidence(run_id TEXT NOT NULL REFERENCES runs(id),system TEXT NOT NULL,evidence_id TEXT NOT NULL,text TEXT NOT NULL,chart_hash TEXT NOT NULL,PRIMARY KEY(run_id,system,evidence_id));
CREATE TABLE fingerprints(run_id TEXT NOT NULL REFERENCES runs(id),kind TEXT NOT NULL CHECK(kind IN ('combat','world')),candidate_id TEXT NOT NULL,axes TEXT NOT NULL,comparison_revision INTEGER NOT NULL,PRIMARY KEY(run_id,kind));
`
export class ArtifactState {
  readonly root: string
  readonly db: Database
  constructor(root: string, initialize = false, readonly = false) {
    this.root = realpathSync(resolve(root))
    const path = join(this.root, 'artifacts/state.sqlite')
    if (!existsSync(path) && !initialize) throw new StateError('state-missing')
    if (initialize) mkdirSync(dirname(path), { recursive: true })
    try {
      this.db = new Database(path, readonly ? { readonly: true } : { readwrite: true, create: initialize })
      this.db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;')
      requireState((this.db.query('PRAGMA foreign_keys').get() as any).foreign_keys === 1 && (this.db.query('PRAGMA busy_timeout').get() as any).timeout===5000, 'state-configuration')
      if (!readonly) {this.db.exec('PRAGMA synchronous=FULL');requireState((this.db.query('PRAGMA synchronous').get() as any).synchronous===2,'state-configuration')}
      if (initialize) {
        this.db.exec('PRAGMA journal_mode=WAL')
        this.tx(() => {
          if (!(this.db.query("SELECT name FROM sqlite_master WHERE name='store_meta'").get())) {
            this.db.exec(schema)
            this.db.query('INSERT INTO store_meta VALUES(1,?,?)').run(this.root, now())
          }
        })
      }
      const meta = this.db.query('SELECT * FROM store_meta').get() as any
      requireState(meta?.schema_version === 1, 'schema-version-mismatch')
      requireState(meta.repository === this.root, 'repository-mismatch')
    } catch (error) { this.db?.close(); this.translate(error) }
  }
  blockFailure(code:string, reference:string, isAttempt=false):void {
    const a=isAttempt?this.attempt(reference):null, run=this.run(a?.run_id??reference)
    if(terminal(run.status))return
    this.tx(()=>{this.db.query("UPDATE runs SET status='blocked',reason=? WHERE id=?").run(code,run.id);if(a)this.db.query("UPDATE stages SET status='blocked',reason=? WHERE run_id=? AND stage=?").run(code,run.id,a.stage);if(code==='registry-stale')this.db.query("UPDATE stages SET status='blocked',reason='registry-stale' WHERE run_id=? AND stage IN ('selection','world-selection','gdd','final-validation','fingerprint-registration')").run(run.id);this.event(run.id,'blocked','failure',a?.stage??null,a?.id??null,code)})
  }
  close(): void { this.db.close() }
  translate(error: unknown): never {
    if (error instanceof StateError) throw error
    if (/locked|busy/i.test(String(error))) throw new StateError('state-busy')
    throw new StateError('state-error', String(error))
  }
  tx<T>(action: () => T): T {
    this.db.exec('BEGIN IMMEDIATE')
    try { const value = action(); this.db.exec('COMMIT'); return value } catch (error) { this.db.exec('ROLLBACK'); throw error }
  }
  one(sql: string, ...args: any[]): any { return this.db.query(sql).get(...args) }
  all(sql: string, ...args: any[]): any[] { return this.db.query(sql).all(...args) }
  run(id: string): any { const row = this.one('SELECT * FROM runs WHERE id=? OR version=?', id, id); requireState(row, 'run-not-managed'); return row }
  attempt(id: string): any { const row = this.one('SELECT * FROM attempts WHERE id=?', id); requireState(row, 'attempt-not-found'); return row }
  live(attempt: any, claim: string): any { const run = this.run(attempt.run_id); requireState(!terminal(run.status), 'run-terminal'); requireState(attempt.claim === claim && attempt.generation > 0, 'stale-claim'); return run }
  event(run: string, event: string, operation: string, stage: string | null = null, attempt: string | null = null, reason: string | null = null, diagnostics: any = []): void { this.db.query('INSERT INTO events(run_id,stage,attempt_id,event,operation,reason,diagnostics,created_at) VALUES(?,?,?,?,?,?,?,?)').run(run, stage, attempt, event, operation, reason, json(diagnostics), now()) }
  operation(request: string, command: string, args: any, action: () => Reply, resumePending=false): Reply {
    requireState(typeof request === 'string' && request.length > 0, 'request-required')
    const digest = hash(json(args))
    return this.tx(() => {
      const old = this.one('SELECT * FROM operations WHERE request_id=?', request)
      if (old) { requireState(old.command === command && old.args_hash === digest, 'request-conflict'); if (old.response) return parse(old.response); if(!resumePending)return reply('pending', { requestId: request }, 'reconcile') }
      if(!old)this.db.query("INSERT INTO operations VALUES(?,?,?,NULL,'pending',NULL)").run(request, command, digest)
      const result = action()
      this.db.query("UPDATE operations SET status='completed',response=?,target=? WHERE request_id=?").run(json(result), result.data.attemptId ?? result.data.runId ?? null, request)
      return result
    })
  }
  allocate(kind: string, mode: string, purpose: string, request: string): Reply {
    requireState(KINDS.includes(kind as never) && MODES.includes(mode as never) && PURPOSES.includes(purpose as never), 'invalid-arguments')
    const config = readSeriesConfig(this.root), state = repositoryState(this.root)
    requireState(purpose !== 'release-candidate' || !state.dirty, 'dirty-release-candidate')
    const result = this.operation(request, 'allocate', { kind, mode, purpose }, () => {
      let patch = this.one('SELECT patch FROM series_counters WHERE series=?', config.activeSeries)?.patch ?? -1
      for (const name of readdirSync(join(this.root, 'artifacts'))) { const match = /^v(0\.(?:0|[1-9]\d*))\.(0|[1-9]\d*)$/.exec(name); if (match?.[1] === config.activeSeries) patch = Math.max(patch, Number(match[2])) }
      patch++; requireState(Number.isSafeInteger(patch), 'version-overflow')
      const version = `v${config.activeSeries}.${patch}`, id = randomUUID()
      this.db.query('INSERT INTO series_counters VALUES(?,?) ON CONFLICT(series) DO UPDATE SET patch=excluded.patch').run(config.activeSeries, patch)
      this.db.query("INSERT INTO runs(id,version,kind,mode,purpose,source_revision,baseline_revision,dirty,config,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,'allocated',?)").run(id, version, kind, mode, purpose, state.revision, config.baselineRevision, +state.dirty, json(config), now())
      for (const stage of kind === 'chart-report' ? ['chart-report'] : Object.keys(DAG)) this.db.query("INSERT INTO stages(run_id,stage,status) VALUES(?,?,'pending')").run(id, stage)
      this.event(id, 'allocated', request)
      return reply('allocated', { runId: id, version, directory: join(this.root, 'artifacts', version) })
    })
    this.ensureDirectory(this.run(result.data.runId))
    return result
  }
  ensureDirectory(run: any): void {
    const path = join(this.root, 'artifacts', run.version)
    if (!run.directory_ready) {
      requireState(!existsSync(path), 'output-path-conflict')
      mkdirSync(path)
      this.tx(() => this.db.query('UPDATE runs SET directory_ready=1 WHERE id=?').run(run.id))
    }
  }
  registry(kind: string): any { const entries = this.all("SELECT f.*,r.version FROM fingerprints f JOIN runs r ON r.id=f.run_id WHERE f.kind=? AND r.status='succeeded' ORDER BY r.version", kind).map(row => kind === 'combat' ? { version: row.version, candidateId: row.candidate_id, fingerprint: parse(row.axes) } : { version: row.version, candidateId: row.candidate_id, ...parse(row.axes) }); return { schemaVersion: 1, entries } }
  revision(): number { return this.one('SELECT count(*) AS n FROM fingerprints').n }
  document(run: string, stage: string): any { return this.one('SELECT d.* FROM stages s JOIN documents d ON d.id=s.accepted_document WHERE s.run_id=? AND s.stage=?', run, stage) }
  text(run: string, stage: string): string { const document = this.document(run, stage); requireState(this.one('SELECT status FROM stages WHERE run_id=? AND stage=?',run,stage)?.status==='succeeded' && document?.status === 'published', 'prerequisite-incomplete'); return this.checked(document.path, document.sha256) }
  checked(path: string, expected: string): string { const full = this.path(path); const bytes = readFileSync(full); requireState(hash(bytes) === expected, 'integrity-error'); return bytes.toString('utf8') }
  path(path: string): string { const full = resolve(this.root, path); requireState(!isAbsolute(relative(this.root, full)) && !relative(this.root, full).startsWith('..'), 'invalid-path'); let ancestor=full; while(!existsSync(ancestor)&&ancestor!==dirname(ancestor))ancestor=dirname(ancestor); requireState(!relative(this.root,realpathSync(ancestor)).startsWith('..'), 'invalid-path'); return full }
  evidence(run: string): ChartEvidenceManifest { const document=this.document(run,'chart-report');requireState(document?.status==='published','prerequisite-incomplete');const expected=buildEvidenceManifest(this.checked(document.path,document.sha256));this.checked(document.final_path,document.sha256);const result: ChartEvidenceManifest = { version: 1, systems: { saju: [], ziwei: [], natal: [] } }; for (const row of this.all('SELECT * FROM evidence WHERE run_id=? ORDER BY rowid', run)) {requireState(row.chart_hash===document.sha256&&Object.hasOwn(result.systems,row.system),'integrity-error'); result.systems[row.system as keyof typeof result.systems].push({ id: row.evidence_id, text: row.text })}requireState(json(result)===json(expected),'integrity-error'); return result }
  prepare(id: string, stage: string, kind: string, request: string): Reply {
    const contractRevision=validatorRevision()
    const preflightRun=this.run(id), preflightEvidence=systems.includes(stage)?this.evidence(preflightRun.id):null
    const sourceDiagnostics=new Map<string,any[]>()
    if(kind==='edit')for(const previous of this.all('SELECT payload FROM attempts WHERE run_id=? AND stage=? AND payload IS NOT NULL',preflightRun.id,stage)){const payload=parse(previous.payload);if(payload.path&&payload.sha256)sourceDiagnostics.set(`${payload.path}:${payload.sha256}`,diagnoseSystemInterpretation(stage as 'saju',this.checked(payload.path,payload.sha256),preflightEvidence!))}
    const result = this.operation(request, 'prepare', { id, stage, kind }, () => {
      const run = this.run(id); requireState(run.status === 'running', 'run-not-running')
      const row = this.one('SELECT * FROM stages WHERE run_id=? AND stage=?', run.id, stage); requireState(row && row.status !== 'succeeded' && !['final-validation','fingerprint-registration'].includes(stage), 'stage-not-available')
      for (const dependency of DAG[stage]) requireState(this.one('SELECT status FROM stages WHERE run_id=? AND stage=?',run.id,dependency)?.status==='succeeded' && this.document(run.id, dependency)?.status === 'published', 'prerequisite-incomplete')
      requireState(!this.one("SELECT id FROM attempts WHERE run_id=? AND stage=? AND status IN ('prepared','dispatching','running','submitted')", run.id, stage), 'attempt-active')
      const prior = this.all('SELECT * FROM attempts WHERE run_id=? AND stage=? AND kind=? ORDER BY number', run.id, stage, kind)
      const specialist = systems.includes(stage), isEdit = kind === 'edit'
      requireState((specialist && ['generate','edit'].includes(kind)) || (!specialist && kind === 'generate'), 'invalid-attempt-kind')
      const number = prior.length + 1; requireState(number <= (specialist ? 3 : 2), 'attempt-budget-exhausted')
      const previous = prior.at(-1), previousResult = parse(previous?.result ?? null)
      if (previous && row.reason!=='registry-stale') requireState(['validation-failed','execution-failed','editing-failed','interrupted'].includes(previousResult?.status ?? previous.status), 'retry-not-allowed')
      const source = isEdit ? this.one("SELECT * FROM attempts WHERE run_id=? AND stage=? AND result LIKE '%editing-required%' ORDER BY number DESC LIMIT 1", run.id, stage) : null
      requireState(!isEdit || source, 'editing-source-missing')
      const scope = isEdit ? previous?.status === 'interrupted' ? previous.scope : ['sentence','item','system'][prior.filter(a => parse(a.result)?.status === 'editing-failed').length] : null
      const attemptId = randomUUID(), claim = randomUUID(), output = join('artifacts', run.version, 'garbage', attemptId, isEdit ? 'candidate.md' : 'interpretation.md')
      const mode = previousResult?.status === 'validation-failed' ? 'repair' : 'generate'
      const inputs: any = { registry: stage === 'selection' ? this.registry('combat') : stage === 'world-selection' ? this.registry('world') : null, mode, ...(previous ? { previous: { output: previous.output, result: previousResult } } : {}), documents: [], validatorRevision: contractRevision, registryRevision: this.revision() }
      const allowed = specialist ? ['chart-report'] : stage === 'integration' ? systems : stage === 'selection' ? ['integration'] : stage === 'world-selection' ? ['integration', 'selection'] : stage === 'gdd' ? ['chart-report','integration','selection','world-selection'] : DAG[stage]
      for (const dependency of allowed) { const doc = this.document(run.id, dependency); if (doc) inputs.documents.push({ stage: dependency, id: doc.id, path: doc.path, sha256: doc.sha256 }) }
      if (source) { const original = parse(source.payload), payload = previous?.payload && parse(previous.payload).path ? parse(previous.payload) : previous?.input && parse(previous.input).source ? parse(previous.input).source : original; inputs.originalSource={attemptId:source.id,path:original.path,sha256:original.sha256}; inputs.source = { attemptId: source.id, path: payload.path, sha256: payload.sha256 }; inputs.diagnostics = sourceDiagnostics.get(`${payload.path}:${payload.sha256}`); requireState(inputs.diagnostics,'input-revision-mismatch'); if (previous) inputs.previous = { payload: parse(previous.payload), result: previousResult } }
      this.db.query("INSERT INTO attempts(id,run_id,stage,kind,number,scope,status,claim,input,output,source_hash,registry_revision,created_at) VALUES(?,?,?,?,?,?,'prepared',?,?,?,?,?,?)").run(attemptId, run.id, stage, kind, number, scope, claim, json(inputs), output, inputs.source?.sha256 ?? null, this.revision(), now())
      this.db.query("UPDATE stages SET status='running',current_attempt=?,reason=NULL WHERE run_id=? AND stage=?").run(attemptId, run.id, stage)
      this.event(run.id, 'prepared', request, stage, attemptId)
      return reply('prepared', { attemptId, claim, stage, kind, number, ...(scope ? { scope } : {}), output: this.path(output), mode, ...(previous ? { previous: inputs.previous } : {}) }, 'dispatch')
    })
    mkdirSync(dirname(result.data.output), { recursive: true }); return result
  }
  input(id: string, claim: string): Reply {
    const a = this.attempt(id); this.live(a, claim); const snapshot = parse(a.input); requireState(snapshot.validatorRevision===validatorRevision(),'validator-revision-mismatch')
    const documents = snapshot.documents.map((doc: any) => ({ stage: doc.stage, sha256: doc.sha256, text: this.checked(doc.path, doc.sha256) }))
    if (systems.includes(a.stage)) {
      const markers: any = { saju: ['四柱八字','紫微斗數 命盤'], ziwei: ['紫微斗數 命盤','Natal Chart'], natal: ['Natal Chart',null] }
      for (const doc of documents) { const [start,end] = markers[a.stage]; const offset = doc.text.indexOf(start); doc.text = doc.text.slice(offset, end ? doc.text.indexOf(end, offset + start.length) : undefined) }
    }
    return reply('input', { attemptId: id, stage: a.stage, kind: a.kind, number: a.number, scope: a.scope, mode:snapshot.mode, ...(snapshot.previous && !snapshot.source ? {previous:snapshot.previous} : {}), documents, ...(systems.includes(a.stage) ? { evidence: { version: 1, systems: { [a.stage]: this.evidence(a.run_id).systems[a.stage as 'saju'] } } } : {}), ...(snapshot.source ? { source: { ...snapshot.source, text: this.checked(snapshot.source.path, snapshot.source.sha256) }, diagnostics: snapshot.diagnostics, previous: snapshot.previous } : {}) })
  }
  submit(id: string, claim: string, payload: any, request: string): Reply {
    const a = this.attempt(id); this.live(a, claim)
    requireState(['prepared','running','submitted'].includes(a.status), 'attempt-completed')
    const snapshot = parse(a.input); for (const doc of snapshot.documents) this.checked(doc.path, doc.sha256)
    if(snapshot.originalSource)this.checked(snapshot.originalSource.path,snapshot.originalSource.sha256)
    if (snapshot.source) { this.checked(snapshot.source.path, snapshot.source.sha256); requireState(!payload.sourceSha256 || payload.sourceSha256 === snapshot.source.sha256, 'integrity-error') }
    const edit = !!a.scope
    let normalized: any = payload.executionFailed ? {executionFailed:true} : payload
    if (!edit && !payload.executionFailed) {
      const path = relative(this.root, this.path(payload.path ?? a.output)); requireState(path === a.output, 'output-path-mismatch')
      const digest = hash(readFileSync(this.path(path))); requireState(!payload.sha256 || payload.sha256 === digest, 'integrity-error'); normalized = { path, sha256: digest }
    }
    return this.operation(request, 'submit', { id, claim, payload: normalized }, () => {
      const current = this.attempt(id); this.live(current, claim)
      requireState(!current.payload || current.payload_hash === hash(json(normalized)), 'submission-immutable')
      this.db.query("UPDATE attempts SET status='submitted',payload=?,payload_hash=? WHERE id=?").run(json(normalized), hash(json(normalized)), id)
      this.event(a.run_id, 'submitted', request, a.stage, id)
      return reply('submitted', { attemptId: id, payloadHash: hash(json(normalized)) }, 'validate')
    })
  }
  finish(id: string, claim: string, request: string): Reply {
    const priorOperation = this.one('SELECT * FROM operations WHERE request_id=?', request)
    if (priorOperation?.response) { requireState(priorOperation.command === 'finish' && priorOperation.args_hash === hash(json({id,claim})), 'request-conflict'); const response=parse(priorOperation.response); return response.data.documentId && response.outcome === 'ready-to-publish' ? this.publish(response.data.documentId,request) : response }
    const a = this.attempt(id); this.live(a, claim)
    if (a.status === 'completed') return reply(parse(a.result).status, { attemptId: id, result: parse(a.result) })
    requireState(a.status === 'submitted', 'submission-required')
    this.tx(()=>{const old=this.one('SELECT * FROM operations WHERE request_id=?',request);if(old)requireState(old.command==='finish'&&old.args_hash===hash(json({id,claim})),'request-conflict');else this.db.query("INSERT INTO operations VALUES(?,?,?,?,'pending',NULL)").run(request,'finish',hash(json({id,claim})),id);})
    const snapshot = parse(a.input)
    requireState(snapshot.validatorRevision === validatorRevision(), 'validator-revision-mismatch')
    for (const doc of snapshot.documents) this.checked(doc.path, doc.sha256)
    let payload = parse(a.payload), markdown: string, errors: any[] = [], unresolved:string[]=[], status = 'passed'
    if(snapshot.originalSource)this.checked(snapshot.originalSource.path,snapshot.originalSource.sha256)
    if(payload.executionFailed){markdown='';errors=[{code:'agent-execution',message:'Worker produced no document or submission'}];status='execution-failed'}else if (a.scope) {
      const source = this.checked(snapshot.source.path, snapshot.source.sha256)
      try {
        const result = evaluateDefensivePayload(source, { system: a.stage, attempt: a.number, scope: a.scope, diagnostics: snapshot.diagnostics }, payload)
        unresolved=result.unresolved; markdown = result.candidate; errors = diagnoseSystemInterpretation(a.stage as 'saju', markdown, this.evidence(a.run_id)); status = result.passed && !errors.length ? 'passed' : 'editing-failed'
      } catch (error) { markdown = source; errors = [{ code: 'editing-contract', message: String(error) }]; status = 'editing-failed' }
      const output = this.path(a.output)
      if (existsSync(output)) requireState(hash(readFileSync(output)) === hash(markdown), 'integrity-error')
      else writeFileSync(output, markdown, { flag: 'wx' })
      payload = { ...payload, path: a.output, sha256: hash(markdown) }
    } else {
      markdown = this.checked(payload.path, payload.sha256)
      errors = systems.includes(a.stage) ? diagnoseSystemInterpretation(a.stage as 'saju', markdown, this.evidence(a.run_id)) : this.validate(a.stage, markdown, a.run_id)
      status = errors.some(error => error.code !== 'responsibility-avoidance') ? 'validation-failed' : systems.includes(a.stage) ? 'editing-required' : 'passed'
    }
    const result = { status, errors, ...(a.scope ? {unresolved,sourceSha256:snapshot.source.sha256,calls:a.number,usage:payload.review?.usage??null} : {}) }
    const response = this.operation(request, 'finish', { id, claim }, () => {
      const current = this.attempt(id); this.live(current, claim); requireState(current.status === 'submitted', 'attempt-completed')
      if (status !== 'passed') {
        this.db.query("UPDATE attempts SET status='completed',result=?,payload=? WHERE id=?").run(json(result), json(payload), id)
        this.event(a.run_id, status, request, a.stage, id, null, errors)
        return reply(status, { attemptId: id, result }, status === 'editing-required' ? 'prepare-edit' : 'prepare-retry')
      }
      const documentId = randomUUID(), existing=this.document(a.run_id,a.stage), final = join('artifacts', this.run(a.run_id).version, 'docs/GDD', ...(existing ? ['revisions',a.id,finalNames[a.stage]] : [finalNames[a.stage]]))
      this.db.query("INSERT INTO documents VALUES(?,?,?,?,?,?,'ready-to-publish',?)").run(documentId, a.run_id, id, a.stage, payload.path, payload.sha256, final)
      this.db.query('INSERT INTO validations VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(), documentId, payload.sha256, a.stage, snapshot.validatorRevision, 'passed', '[]', now())
      this.db.query('UPDATE attempts SET result=?,payload=? WHERE id=?').run(json(result), json(payload), id)
      this.event(a.run_id, 'ready-to-publish', request, a.stage, id)
      return reply('ready-to-publish', { attemptId: id, documentId }, 'reconcile-publication')
    },true)
    if (response.data.documentId) return this.publish(response.data.documentId, request)
    return response
  }
  validate(stage: string, text: string, run: string): any[] {
    let errors: any[] = []
    if (stage === 'chart-report') { try { buildEvidenceManifest(text) } catch { errors = ['Missing chart systems'] } }
    else if (systems.includes(stage)) return diagnoseSystemInterpretation(stage as 'saju', text, this.evidence(run)).filter(error => error.code !== 'responsibility-avoidance')
    else if (stage === 'integration') { const ids = Object.fromEntries(systems.map(system => [({saju:'S',ziwei:'Z',natal:'N'} as any)[system],new Set([...this.text(run,system).matchAll(/^### ([SZN]-\d{2})/gm)].map(match=>match[1]))])); errors = isValidInterpretation(text, ids as any) ? [] : ['Invalid integrated interpretation'] }
    else if (stage === 'selection') errors = validateConceptBrief(text, this.text(run, 'integration'), this.registry('combat'))
    else if (stage === 'world-selection') errors = validateWorldBrief(text, this.text(run, 'integration'), this.text(run, 'selection'), this.registry('world'))
    else if (stage === 'gdd') errors = isValidGdd(text, this.text(run, 'chart-report'), this.text(run, 'integration'), this.text(run, 'selection'), this.text(run, 'world-selection')) ? [] : ['Invalid GDD']
    return errors.map(message => ({ code: 'validation', message }))
  }
  publish(id: string, request: string): Reply {
    const doc = this.one('SELECT * FROM documents WHERE id=?', id); requireState(doc, 'document-not-found')
    requireState(!terminal(this.run(doc.run_id).status), 'run-terminal')
    this.checked(doc.path, doc.sha256)
    const destination = this.path(doc.final_path); mkdirSync(dirname(destination), { recursive: true })
    if (!existsSync(destination)) { try { linkSync(this.path(doc.path), destination) } catch (error) { if (!existsSync(destination)) throw error } }
    this.checked(doc.final_path, doc.sha256)
    const chartEvidence=doc.role==='chart-report'?buildEvidenceManifest(this.checked(doc.path,doc.sha256)):null
    return this.tx(() => {
      const a = this.attempt(doc.attempt_id); requireState(!terminal(this.run(doc.run_id).status), 'run-terminal')
      if (doc.status !== 'published') {
        this.db.query("UPDATE documents SET status='published' WHERE id=?").run(id)
        this.db.query("UPDATE attempts SET status='completed' WHERE id=?").run(a.id)
        this.db.query("UPDATE stages SET status='succeeded',accepted_document=?,accepted_attempt=?,reason=NULL WHERE run_id=? AND stage=?").run(id, a.id, doc.run_id, a.stage)
        if (a.stage === 'chart-report') for (const [system, items] of Object.entries(chartEvidence!.systems)) for (const item of items) this.db.query('INSERT INTO evidence VALUES(?,?,?,?,?)').run(doc.run_id, system, item.id, item.text, doc.sha256)
        this.event(doc.run_id, 'published', request, a.stage, a.id)
      }
      const response = reply('passed', { attemptId: a.id, documentId: id, path: destination })
      this.db.query('UPDATE operations SET response=? WHERE request_id=?').run(json(response), request)
      return response
    })
  }
  next(id: string): Reply {
    const run = this.run(id), actions: any[] = []
    if (terminal(run.status)) return reply('next', { actions: [{ action: run.status === 'succeeded' ? 'done' : 'terminal', reason: run.status }] })
    for (const stage of this.all('SELECT * FROM stages WHERE run_id=?', run.id)) {
      if (stage.status === 'succeeded') continue
      if (DAG[stage.stage].some(dependency => this.one('SELECT status FROM stages WHERE run_id=? AND stage=?', run.id, dependency)?.status !== 'succeeded')) continue
      const a = stage.current_attempt ? this.attempt(stage.current_attempt) : null
      const publication = a && this.one("SELECT id FROM documents WHERE attempt_id=? AND status='ready-to-publish'", a.id)
      const action = stage.reason==='worker-unknown' ? 'verify-worker' : publication ? 'reconcile-publication' : !a || ['completed','interrupted'].includes(a.status) ? stage.stage === 'chart-report' ? 'request-input' : stage.stage === 'fingerprint-registration' || stage.stage === 'final-validation' ? 'finalize' : 'prepare-retry' : ({ prepared: 'dispatch', dispatching: 'verify-worker', running: 'wait', submitted: 'validate' } as any)[a.status]
      const result=a?.result?parse(a.result):null;const kind=result?.status==='editing-required'?'edit':a?.kind??'generate';const mode=result?.status==='validation-failed'?'repair':'generate'
      const used=this.one('SELECT count(*) AS n FROM attempts WHERE run_id=? AND stage=? AND kind=?',run.id,stage.stage,kind).n
      actions.push({ kind, mode, ...(a?.scope?{scope:a.scope}:{}), action: action==='prepare-retry' && used >= (systems.includes(stage.stage)?3:2) ? 'terminal' : action, stage: stage.stage, ...(a ? { attemptId: a.id } : {}), ...(stage.reason ? { reason: stage.reason } : {}) })
    }
    return reply('next', { actions })
  }
  summary(id: string): Reply {
    const run = this.run(id)
    return reply('summary', { run: { runId: run.id, version: run.version, kind: run.kind, status: run.status, reason: run.reason }, stages: this.all('SELECT s.stage,s.status,s.current_attempt AS attemptId,s.reason,d.final_path AS path,a.number,a.scope,a.kind FROM stages s LEFT JOIN documents d ON d.id=s.accepted_document LEFT JOIN attempts a ON a.id=s.current_attempt WHERE s.run_id=?', run.id).map(stage=>({...stage,attempts:this.all('SELECT kind,count(*) AS used FROM attempts WHERE run_id=? AND stage=? GROUP BY kind',run.id,stage.stage).map(a=>({...a,remaining:(systems.includes(stage.stage)?3:2)-a.used}))})) })
  }
  resume(id: string, observation: any, request: string): Reply {
    const args = { id, observation }
    const prior = this.one('SELECT * FROM operations WHERE request_id=?', request)
    if (prior?.response) {
      requireState(prior.command === 'resume' && prior.args_hash === hash(json(args)), 'request-conflict')
      return parse(prior.response)
    }
    this.reconcile(id, request)
    const run = this.run(id)
    requireState(Array.isArray(observation.workers ?? []), 'invalid-observation')
    const recoveredOutputs = new Map<string, { path: string; sha256: string }>()
    for (const worker of observation.workers ?? []) {
      const attempt = this.attempt(worker.attemptId)
      requireState(attempt.run_id === run.id && ['running', 'dispatching'].includes(attempt.status)
        && ['terminated', 'alive', 'unknown'].includes(worker.status)
        && worker.observer && worker.reference, 'invalid-observation')
      if (worker.status === 'terminated' && !attempt.scope && existsSync(this.path(attempt.output))) {
        recoveredOutputs.set(attempt.id, { path: attempt.output, sha256: hash(readFileSync(this.path(attempt.output))) })
      }
    }
    return this.operation(request, 'resume', args, () => {
      requireState(!terminal(this.run(run.id).status), 'run-terminal')
      for (const worker of observation.workers ?? []) {
        const attempt = this.attempt(worker.attemptId)
        requireState(attempt.run_id === run.id && ['running', 'dispatching'].includes(attempt.status), 'invalid-observation')
        if (worker.status === 'terminated') {
          const payload = recoveredOutputs.get(attempt.id)
          if (payload) {
            this.db.query("UPDATE attempts SET status='submitted',payload=?,payload_hash=? WHERE id=?")
              .run(json(payload), hash(json(payload)), attempt.id)
          } else {
            this.db.query("UPDATE attempts SET status='interrupted',claim=?,generation=generation+1,result=? WHERE id=?")
              .run(randomUUID(), json({ status: 'interrupted' }), attempt.id)
          }
          this.db.query('UPDATE stages SET reason=NULL WHERE run_id=? AND stage=?').run(run.id, attempt.stage)
          this.event(run.id, payload ? 'worker-output-recovered' : 'worker-terminated', request, attempt.stage, attempt.id)
        } else if (worker.status === 'unknown') {
          this.db.query("UPDATE runs SET status='blocked',reason='worker-unknown' WHERE id=?").run(run.id)
          this.db.query("UPDATE stages SET reason='worker-unknown' WHERE run_id=? AND stage=?").run(run.id, attempt.stage)
        } else {
          this.db.query("UPDATE stages SET reason=NULL WHERE run_id=? AND stage=? AND reason='worker-unknown'").run(run.id, attempt.stage)
        }
      }
      if (!this.one("SELECT id FROM attempts WHERE run_id=? AND status IN ('running','dispatching')", run.id)) {
        this.db.query("UPDATE runs SET status='running',reason=NULL WHERE id=?").run(run.id)
      }
      const resumedAttempts = this.all("SELECT * FROM attempts WHERE run_id=? AND status IN ('prepared','submitted')", run.id).map(attempt => {
        const claim = randomUUID()
        this.db.query('UPDATE attempts SET claim=?,generation=generation+1 WHERE id=?').run(claim, attempt.id)
        this.event(run.id, 'claim-renewed', request, attempt.stage, attempt.id)
        return { attemptId: attempt.id, claim, output: resolve(this.root, attempt.output), stage: attempt.stage,
          kind: attempt.kind, number: attempt.number, status: attempt.status, ...(attempt.scope ? { scope: attempt.scope } : {}) }
      })
      const result = this.next(run.id)
      result.data.resumedAttempts = resumedAttempts
      return result
    })
  }
  reconcile(id: string, request: string): Reply {
    const run = this.run(id); requireState(!terminal(run.status), 'run-terminal'); this.ensureDirectory(run)
    for (const doc of this.all('SELECT * FROM documents WHERE run_id=?', run.id)) {
      this.checked(doc.path, doc.sha256)
      const validation = this.one('SELECT * FROM validations WHERE document_id=? ORDER BY created_at DESC LIMIT 1', doc.id)
      requireState(validation?.revision === validatorRevision(), 'validator-revision-mismatch')
      if (doc.status === 'ready-to-publish') this.publish(doc.id, request)
      else this.checked(doc.final_path, doc.sha256)
    }
    return this.next(id)
  }
  finalize(id: string, request: string): Reply {
    const run = this.run(id)
    if (run.status === 'succeeded') return reply('succeeded', { runId: run.id })
    this.reconcile(id, request)
    const finalContractRevision=validatorRevision(),registrySnapshot=this.revision()
    const snapshots = this.all("SELECT d.*,v.revision FROM stages s JOIN documents d ON d.id=s.accepted_document JOIN validations v ON v.document_id=d.id WHERE s.run_id=?", run.id)
    let combat: any, world: any
    if (run.kind === 'personalized-gdd') {
      for(const stage of ['selection','world-selection']){const accepted=this.one('SELECT accepted_attempt FROM stages WHERE run_id=? AND stage=?',run.id,stage);if(accepted?.accepted_attempt)requireState(this.attempt(accepted.accepted_attempt).registry_revision===this.revision(),'registry-stale')}
      for (const stage of ['chart-report',...systems,'integration','selection','world-selection','gdd']) this.text(run.id, stage)
      for (const stage of ['chart-report',...systems,'integration','selection','world-selection','gdd']) requireState(this.validate(stage,this.text(run.id,stage),run.id).length===0,'final-validation-failed')
      const selection = this.text(run.id, 'selection'), selected = selectedWorld(parseWorldBrief(this.text(run.id, 'world-selection')))
      combat = { candidate: parseSelectedCandidateId(selection), axes: parseFinalFingerprint(selection) }
      world = { candidate: selected.id, axes: { fingerprint: selected.fingerprint, spatialPlay: selected.spatialPlay } }
      requireState(combat.axes && combat.candidate, 'fingerprint-invalid')
    } else this.text(run.id, 'chart-report')
    return this.operation(request, 'finalize', { id }, () => {
      requireState(!terminal(this.run(id).status), 'run-terminal')
      for (const doc of snapshots) {requireState(doc.revision === finalContractRevision, 'validator-revision-mismatch');this.db.query('INSERT INTO validations VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),doc.id,doc.sha256,`final:${doc.role}`,finalContractRevision,'passed','[]',now())}
      if (combat) {
        for (const stage of ['selection','world-selection']) { const a = this.attempt(this.one('SELECT accepted_attempt FROM stages WHERE run_id=? AND stage=?', run.id, stage).accepted_attempt); requireState(a.registry_revision === this.revision(), 'registry-stale') }
        for (const [kind, value] of [['combat',combat],['world',world]] as const) this.db.query('INSERT INTO fingerprints VALUES(?,?,?,?,?)').run(run.id, kind, value.candidate, json(value.axes), registrySnapshot)
        this.db.query("UPDATE stages SET status='succeeded' WHERE run_id=? AND stage IN ('final-validation','fingerprint-registration')").run(run.id)
      }
      this.db.query("UPDATE runs SET status='succeeded',reason=NULL,finished_at=? WHERE id=?").run(now(), run.id)
      this.event(run.id, 'succeeded', request)
      return reply('succeeded', { runId: run.id })
    })
  }
}
function validatorRevision(): string {
  const paths = ['../../.agents/skills/interpret-chart-system/scripts/validate-system-interpretation.ts','../../.agents/skills/interpret-chart-report/scripts/validate-interpretation.ts','../../.agents/skills/select-gameplay-concept/scripts/validate-concept-brief.ts','../../.agents/skills/select-world-concept/scripts/validate-world-brief.ts','../../.agents/skills/generate-gdd-from-interpretation/scripts/validate-gdd.ts','../../.agents/skills/generate-chart-report/scripts/chart-evidence.ts','artifact-state-store.ts','../../scripts/game-presentation.ts','../../.agents/skills/select-world-concept/scripts/world-contract.ts','../../docs/prompts/game-presentation-contract.md','../../docs/prompts/interpretation-guidelines.md','../../docs/prompts/saju-interpretation.md','../../docs/prompts/ziwei-interpretation.md','../../docs/prompts/natal-interpretation.md','../../docs/prompts/personalized-action-rpg-concept.md']
  return hash(paths.map(path => readFileSync(new URL(path, import.meta.url))).join('\0'))
}
import { evaluateDefensivePayload } from './defensive-edit'
