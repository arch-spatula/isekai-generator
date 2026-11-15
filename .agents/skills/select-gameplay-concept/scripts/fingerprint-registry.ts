
export const AXIS_KEYS = [
  'combatRange',
  'powerMedium',
  'initiative',
  'spaceUse',
  'combatRhythm',
  'mastery',
  'risk',
] as const

export type AxisKey = typeof AXIS_KEYS[number]
export type Axes = Record<AxisKey, string>

export type RegistryEntry = {
  version: string
  candidateId: string
  fingerprint: Axes
}

export type FingerprintRegistry = {
  schemaVersion: 1
  entries: RegistryEntry[]
}

const VERSION_PATTERN = /^v\d+\.\d+\.\d+$/

export function equalAxes(left: Axes, right: Axes): number {
  return AXIS_KEYS.filter(key => left[key] === right[key]).length
}

export function closestEntries(fingerprint: Axes, entries: RegistryEntry[]): Array<RegistryEntry & { equalAxes: number }> {
  if (entries.length === 0) return []
  const compared = entries.map(entry => ({ ...entry, equalAxes: equalAxes(fingerprint, entry.fingerprint) }))
  const maximum = Math.max(...compared.map(entry => entry.equalAxes))
  return compared.filter(entry => entry.equalAxes === maximum)
}

export function parseRegistry(value: string): FingerprintRegistry {
  const parsed: unknown = JSON.parse(value)
  if (typeof parsed !== 'object' || parsed == null || Array.isArray(parsed)) {
    throw new Error('Fingerprint registry must be an object.')
  }
  const registry = parsed as Partial<FingerprintRegistry>
  if (registry.schemaVersion !== 1 || !Array.isArray(registry.entries)) {
    throw new Error('Fingerprint registry must use schemaVersion 1 and an entries array.')
  }
  const versions = new Set<string>()
  for (const entry of registry.entries) {
    if (typeof entry !== 'object' || entry == null || Array.isArray(entry)) {
      throw new Error('Fingerprint registry entries must be objects.')
    }
    if (!VERSION_PATTERN.test(entry.version) || !/^C-\d{2}$/.test(entry.candidateId)) {
      throw new Error('Fingerprint registry entry has an invalid version or candidate ID.')
    }
    if (versions.has(entry.version)) throw new Error(`Duplicate fingerprint registry version: ${entry.version}`)
    versions.add(entry.version)
    if (typeof entry.fingerprint !== 'object' || entry.fingerprint == null) {
      throw new Error(`Fingerprint registry entry ${entry.version} has no fingerprint.`)
    }
    const keys = Object.keys(entry.fingerprint)
    if (keys.length !== AXIS_KEYS.length || keys.some(key => !AXIS_KEYS.includes(key as AxisKey))) {
      throw new Error(`Fingerprint registry entry ${entry.version} has invalid axes.`)
    }
    if (AXIS_KEYS.some(key => typeof entry.fingerprint[key] !== 'string' || entry.fingerprint[key].trim() === '')) {
      throw new Error(`Fingerprint registry entry ${entry.version} has an empty axis.`)
    }
  }
  return registry as FingerprintRegistry
}

export async function loadRegistry(repositoryRoot: string): Promise<FingerprintRegistry> {
 const {ArtifactState}=await import('../../../../scripts/artifacts/artifact-state-store')
 const state=new ArtifactState(repositoryRoot,false,true)
 try{return state.registry('combat')}finally{state.close()}
}
export async function initializeRegistry(_path:string):Promise<void>{throw new Error('Registry initialization belongs to artifact-state allocate')}
export async function registerFingerprint(_path:string,_entry:RegistryEntry):Promise<void>{throw new Error('Use artifact-state finalize for atomic combat and world registration')}
