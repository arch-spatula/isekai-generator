import { createHash } from 'node:crypto'

export type EvidenceSystem = 'saju' | 'ziwei' | 'natal'

export interface EvidenceItem {
  id: string
  text: string
}

export interface ChartEvidenceManifest {
  version: 1
  systems: Record<EvidenceSystem, EvidenceItem[]>
}

const SYSTEMS = [
  { name: 'saju', prefix: 'S', start: '四柱八字', end: '紫微斗數 命盤' },
  { name: 'ziwei', prefix: 'Z', start: '紫微斗數 命盤', end: 'Natal Chart' },
  { name: 'natal', prefix: 'N', start: 'Natal Chart', end: null },
] as const

function normalizedEvidenceLines(section: string, heading: string): string[] {
  return [...new Set(section.split('\n')
    .map(line => line.trim().replace(/\s+/g, ' '))
    .filter(line => line.length > 0 && line !== heading && !/^[─═]+$/.test(line)))]
}

/** Build stable, formatting-independent evidence IDs from deterministic chart output. */
export function buildEvidenceManifest(report: string): ChartEvidenceManifest {
  const systems = Object.fromEntries(SYSTEMS.map(system => {
    const start = report.indexOf(system.start)
    if (start === -1) throw new Error(`Missing chart section: ${system.start}`)
    const end = system.end == null ? report.length : report.indexOf(system.end, start)
    if (end === -1) throw new Error(`Missing chart section: ${system.end}`)
    const section = report.slice(start, end)
    const items = normalizedEvidenceLines(section, system.start).map(text => ({
      id: `${system.prefix}-E${createHash('sha256').update(`${system.name}\0${text}`).digest('hex').slice(0, 16)}`,
      text,
    }))
    return [system.name, items]
  })) as ChartEvidenceManifest['systems']
  return { version: 1, systems }
}
