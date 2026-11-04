import { readFile } from 'node:fs/promises'

import { initializeRegistry, registerFingerprint } from './fingerprint-registry'
import { parseFinalFingerprint, parseSelectedCandidateId } from './validate-concept-brief'

if (import.meta.main) {
  const [command, registryPath, version, briefPath] = process.argv.slice(2)
  if (command === 'init' && registryPath != null && version == null) {
    try {
      await initializeRegistry(registryPath)
      console.log(`Initialized fingerprint registry: ${registryPath}`)
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    }
  } else if (command === 'register' && registryPath != null && version != null && briefPath != null) {
    try {
      const brief = await readFile(briefPath, 'utf8')
      const fingerprint = parseFinalFingerprint(brief)
      const candidateId = parseSelectedCandidateId(brief)
      if (fingerprint == null || candidateId == null) throw new Error('Brief has no valid selected fingerprint.')
      await registerFingerprint(registryPath, { version, candidateId, fingerprint })
      console.log(`Registered fingerprint for ${version}.`)
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    }
  } else {
    console.error('Usage: bun manage-fingerprint-registry.ts init <registry.json> | register <registry.json> <vX.Y.Z> <gameplay-concept-brief.md>')
    process.exitCode = 2
  }
}
