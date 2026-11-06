import { execFileSync } from 'node:child_process'
import { lstatSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'

export type DocumentFinding = { file: string; line: number; severity: 'error' | 'review'; message: string }

/** Only actual link targets are errors; historical mentions require editorial review. */
export function checkDocument(file: string, markdown: string, root: string): DocumentFinding[] {
  const findings: DocumentFinding[] = []
  let fence: string | undefined
  const lines = markdown.split('\n')
  const visible = lines.map(line => {
    const marker = line.match(/^\s*(`{3,}|~{3,})/)
    if (marker) {
      if (!fence) fence = marker[1][0]
      else if (marker[1][0] === fence) fence = undefined
      return ' '.repeat(line.length)
    }
    return fence ? ' '.repeat(line.length) : line
  }).join('\n')
  const patterns = [
    /!?\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))/g,
    /^\s*\[[^\]]+\]:\s*(?:<([^>]+)>|(\S+))/gm,
    /\b(?:href|src)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi,
    /<(file:\/\/[^>]+)>/g,
  ]
  const seen = new Set<string>()
  for (const pattern of patterns) for (const match of visible.matchAll(pattern)) {
    const raw = (match[1] ?? match[2] ?? match[3]).trim()
    const line = visible.slice(0, match.index).split('\n').length
    const key = `${line}:${raw}`
    if (seen.has(key)) continue
    seen.add(key)
    let target: string
    try { target = decodeURIComponent(raw.replace(/&amp;/g, '&')).replaceAll('\\', '/').split(/[?#]/)[0] } catch { continue }
    if (/^(?:https?:|mailto:|data:|#)/i.test(target) || /<[^>]+>/.test(target)) continue
    target = target.replace(/^file:\/\//i, '')
    const absolute = isAbsolute(target) || /^[a-z]:\//i.test(target) || target.startsWith('~/')
    const resolved = absolute ? target : resolve(root, dirname(file), target)
    const localRoot = relative(resolve(root), resolved).replaceAll('\\', '/')
    if (localRoot === 'artifacts' || localRoot.startsWith('artifacts/') || (absolute && /(?:^|\/)artifacts(?:\/|$)/.test(target) && !/(?:^|\/)scripts\/artifacts(?:\/|$)/.test(target))) {
      findings.push({ file, line, severity: 'error', message: 'Persistent document links to untracked local artifacts; preserve minimal evidence or use a committed synthetic fixture.' })
    }
  }
  for (const [index, line] of visible.split('\n').entries()) {
    if (/\bv\d+\.\d+\.\d+\b|동일 출생 입력|동일 차트|과거 출력을 fixture|과거 결과 재분류/.test(line)) {
      findings.push({ file, line: index + 1, severity: 'review', message: 'Review historical identity, fictional example, or regression dependency; not an automatic violation.' })
    }
  }
  return findings
}

export function checkRepositoryDocuments(root: string): DocumentFinding[] {
  const files = execFileSync('git', ['-C', root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '*.md', ':(exclude)docs/legacy/**', ':(exclude)artifacts/**', ':(exclude)node_modules/**'], { encoding: 'utf8' }).split('\0').filter(Boolean)
  const findings: DocumentFinding[] = []
  for (const file of new Set(files)) {
    const path = resolve(root, file)
    let stat
    try { stat = lstatSync(path) } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue // A tracked document may be deleted in this worktree.
      throw error
    }
    if (stat.isSymbolicLink()) {
      findings.push({ file, line: 1, severity: 'error', message: 'Inspect document symlink explicitly; the checker does not follow it into local data.' })
      continue
    }
    findings.push(...checkDocument(file, readFileSync(path, 'utf8'), root))
  }
  return findings
}

if (import.meta.main) {
  try {
    const args = process.argv.slice(2)
    if (args.some(arg => arg !== '--review')) throw new Error('Usage: bun scripts/check-document-artifacts.ts [--review] (run at repository root)')
    const findings = checkRepositoryDocuments(process.cwd())
    for (const finding of findings.filter(item => item.severity === 'error' || args.includes('--review'))) console.log(`${finding.file}:${finding.line}: ${finding.severity}: ${finding.message}`)
    const errors = findings.filter(item => item.severity === 'error').length
    console.log(`Document artifact check: ${errors} errors; ${findings.filter(item => item.severity === 'review').length} editorial review candidates${args.includes('--review') ? '' : ' (--review to list)'}.`)
    if (errors) process.exitCode = 1
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
