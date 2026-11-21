/**
 * 다음 릴리스 단위 버전 폴더(artifacts/v<series>.<patch>)를 원자적으로 차지하고 명식 파일 디렉터리를 돌려준다.
 * series는 .agents/artifact-series.json의 activeSeries, patch는 기존 폴더 중 최댓값 + 1이다.
 */
import { mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export interface AllocatedArtifactPath {
  version: string
  directory: string
  /** chart-report.ts --out-dir에 넘길 디렉터리 */
  chartDir: string
}

function nextPatch(artifactsDir: string, series: string): number {
  const pattern = new RegExp(`^v${series.replace('.', '\\.')}\\.(0|[1-9]\\d*)$`)
  let max = -1
  for (const name of readdirSync(artifactsDir)) {
    const match = pattern.exec(name)
    if (match != null) max = Math.max(max, Number(match[1]))
  }
  return max + 1
}

/** root 기준 상대 경로를 돌려준다. 같은 버전을 다른 실행이 먼저 차지하면 다음 번호로 다시 시도한다. */
export function allocateArtifactPath(root: string): AllocatedArtifactPath {
  const { activeSeries } = JSON.parse(readFileSync(join(root, '.agents', 'artifact-series.json'), 'utf8')) as { activeSeries: unknown }
  if (typeof activeSeries !== 'string' || !/^0\.(0|[1-9]\d*)$/.test(activeSeries)) {
    throw new Error(`Invalid activeSeries in .agents/artifact-series.json: ${String(activeSeries)}`)
  }
  const artifactsDir = join(root, 'artifacts')
  mkdirSync(artifactsDir, { recursive: true })

  for (;;) {
    const version = `v${activeSeries}.${nextPatch(artifactsDir, activeSeries)}`
    const directory = join('artifacts', version)
    try {
      mkdirSync(join(root, directory)) // 이미 있으면 EEXIST: 다른 실행이 먼저 차지한 번호
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') continue
      throw error
    }
    const chartDir = join(directory, 'docs', 'GDD')
    mkdirSync(join(root, chartDir), { recursive: true })
    return { version, directory, chartDir }
  }
}

if (import.meta.main) {
  try {
    console.log(JSON.stringify(allocateArtifactPath(process.cwd()), null, 2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
