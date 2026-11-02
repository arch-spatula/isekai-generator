import { readFile } from 'node:fs/promises'

/** Return whether the generated document contains non-whitespace content. */
export function isValidGdd(markdown: string): boolean {
  return markdown.trim().length > 0
}

if (import.meta.main) {
  const path = process.argv[2]
  if (path == null) {
    console.error('Usage: bun validate-gdd.ts <gdd.md>')
    process.exitCode = 2
  } else {
    try {
      if (!isValidGdd(await readFile(path, 'utf8'))) {
        console.error('Generated document is empty.')
        process.exitCode = 1
      } else {
        console.log('Validated non-empty GDD.')
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    }
  }
}
