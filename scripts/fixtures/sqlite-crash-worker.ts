// Test-only child: terminate the actual storage operation at a filesystem boundary.
import { spyOn } from 'bun:test'
import * as fs from 'node:fs'
const [phase, root, attempt, claim, request] = process.argv.slice(2)
const originalLink = fs.linkSync, originalMkdir = fs.mkdirSync
if (phase === 'before-publish' || phase === 'after-publish') {
  spyOn(fs, 'linkSync').mockImplementation((source, destination) => {
    if (phase === 'before-publish') process.kill(process.pid, 'SIGKILL')
    originalLink(source, destination)
    process.kill(process.pid, 'SIGKILL')
  })
}
if (phase === 'after-reservation') {
  spyOn(fs, 'mkdirSync').mockImplementation(((path: fs.PathLike, options: any) => {
    if (/\/artifacts\/v\d+\.\d+\.\d+$/.test(String(path))) process.kill(process.pid, 'SIGKILL')
    return originalMkdir(path, options)
  }) as typeof fs.mkdirSync)
}
const { ArtifactState } = await import('../artifacts/artifact-state-store')
const state = new ArtifactState(root, phase === 'after-reservation')
try {
  const result = phase === 'after-reservation' ? state.allocate('chart-report', 'deep', 'new-profile', request) : state.finish(attempt, claim, request)
  process.stdout.write(JSON.stringify(result))
} finally { state.close() }
