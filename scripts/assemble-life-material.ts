/**
 * 세 체계의 일생 해석을 항목 이름 기준으로 나란히 모은 통합 재료표(life-material.md)를 만든다.
 * 세 문서가 모두 일생 해석 검증기를 통과해야 하고, 결과 파일이 이미 있으면 쓰지 않는다.
 * 계약: docs/spec/life-integration.md
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { checkLifeDocument, type LifeSystem } from './check-life-document.ts'
import { type LifeItem, readLifeItems } from './life-document.ts'
import { IMPACT, median, RELATION_ITEMS, RELATION_STATUS } from './life-relations.ts'

export const LIFE_SYSTEMS = ['saju', 'ziwei', 'natal'] as const
export type LifeTextsBySystem = Record<(typeof LIFE_SYSTEMS)[number], string>

/** 같은 이름 항목을 필드별로 나란히 놓는 섹션과 그 섹션이 있는 체계. 나머지 섹션은 체계별로 나열한다. */
const SIDE_BY_SIDE: Record<string, readonly LifeSystem[]> = {
  '생애 연표': ['saju', 'ziwei'],
  '인물 사전': LIFE_SYSTEMS,
}
const BY_SYSTEM = ['재능과 생업', '상처와 회복']
/** 근거는 다른 파일을 가리키는 인용이라 옮기지 않는다. */
const fieldsOf = (item: LifeItem) => item.fields.filter(([key]) => key !== '근거')

/** 인물 칸마다 세 체계의 값과 그 중앙값 (상태는 RELATION_ITEMS 칸만). 계약: docs/spec/life-shape-and-relationship-status.md 5.3·5.4 */
export function relationVotes(lives: LifeTextsBySystem, key: '상태' | '영향'): Map<string, { values: Record<LifeSystem, string>; main: string }> {
  const order = key === '상태' ? RELATION_STATUS : IMPACT
  const result = new Map<string, { values: Record<LifeSystem, string>; main: string }>()
  const persons = readLifeItems(lives.saju).filter(({ section }) => section === '인물 사전').map(({ name }) => name)
  for (const person of persons) {
    if (key === '상태' && !(person in RELATION_ITEMS)) continue
    const values = Object.fromEntries(LIFE_SYSTEMS.map((system) => [system,
      readLifeItems(lives[system]).find((item) => item.section === '인물 사전' && item.name === person)?.fields.find(([field]) => field === key)?.[1] ?? ''])) as Record<LifeSystem, string>
    if (Object.values(values).some((value) => !order.includes(value))) continue
    result.set(person, { values, main: median(Object.values(values), order) })
  }
  return result
}

/** 섹션을 넘어 두 번 이상 나오는 항목 이름 */
export function duplicateItemNames(life: string): string[] {
  const names = readLifeItems(life).map(({ name }) => name)
  return [...new Set(names.filter((name, index) => names.indexOf(name) !== index))]
}

export function lifeMaterial(lives: LifeTextsBySystem): string {
  const items = Object.fromEntries(LIFE_SYSTEMS.map((system) => [system, readLifeItems(lives[system])])) as Record<LifeSystem, LifeItem[]>
  const inSection = (system: LifeSystem, section: string) => items[system].filter((item) => item.section === section)
  const lines = ['일생 통합 재료 (세 체계 일생 해석을 항목 이름으로 모은 것 · 해석 아님)', '─────']

  const votes = { 상태: relationVotes(lives, '상태'), 영향: relationVotes(lives, '영향') }
  for (const [section, systems] of Object.entries(SIDE_BY_SIDE)) {
    lines.push(`## ${section}`)
    for (const first of inSection(systems[0], section)) {
      lines.push(`### ${first.name}`)
      for (const [key] of fieldsOf(first)) {
        for (const system of systems) {
          const value = inSection(system, section).find(({ name }) => name === first.name)!.fields.find(([field]) => field === key)![1]
          lines.push(`${key} [${system}]: ${value}`)
        }
      }
      if (section !== '인물 사전') continue
      for (const key of ['상태', '영향'] as const) {
        const vote = votes[key].get(first.name)
        if (vote != null) lines.push(`${key} 본선: ${vote.main}`)
      }
    }
  }
  for (const section of BY_SYSTEM) {
    lines.push(`## ${section}`)
    for (const system of LIFE_SYSTEMS) {
      for (const item of inSection(system, section)) {
        lines.push(`### ${system} ${item.name}`, ...fieldsOf(item).map(([key, value]) => `${key}: ${value}`))
      }
    }
  }
  return lines.join('\n')
}

if (import.meta.main) {
  const [dir] = process.argv.slice(2)
  if (dir == null) {
    console.error('usage: bun scripts/assemble-life-material.ts <차트 디렉터리>')
    process.exit(1)
  }
  const output = join(dir, 'life-material.md')
  if (existsSync(output)) {
    console.error(`이미 있음: ${output}`)
    process.exit(1)
  }
  const read = (file: string) => {
    try {
      return readFileSync(join(dir, file), 'utf8')
    } catch {
      console.error(`읽을 수 없음: ${join(dir, file)}`)
      process.exit(1)
    }
  }
  const lives = {} as LifeTextsBySystem
  for (const system of LIFE_SYSTEMS) {
    const life = read(`${system}-life.md`)
    const errors = checkLifeDocument(system, {
      life,
      chart: read(`${system}-chart.md`),
      facts: read(`${system}-facts.md`),
      judgment: read(`${system}-judgment.md`),
      derived: system === 'natal' ? undefined : read(`${system}-derived-facts.md`),
    })
    const duplicates = duplicateItemNames(life)
    if (duplicates.length > 0) errors.push(`항목 이름이 섹션을 넘어 겹친다: ${duplicates.join(', ')}`)
    if (errors.length > 0) {
      console.error(`${system}-life.md가 검증을 통과하지 못해 재료표를 만들지 않았다:`)
      for (const error of errors) console.error(error)
      process.exit(1)
    }
    lives[system] = life
  }
  writeFileSync(output, `${lifeMaterial(lives)}\n`)
}
