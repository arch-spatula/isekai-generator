/**
 * 통합 일생 해석 `life.md`의 인물 사전에서 동료 모험가 후보를 계산한다. 번역 브리프 스킬과 검증기가 함께 쓴다.
 * 계약: docs/spec/life-to-game-translation.md 3.2
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readLifeItems } from './life-document.ts'

export interface Companion {
  name: string
  /** 곁에 있던 생애 단계 */
  stages: string[]
}

/** 관계 상태가 없음이 아니고, 영향이 크고, 함께 한 일과 곁에 있던 시기가 있는 인물. 인물 사전 순서를 따른다. */
export function companionCandidates(life: string): Companion[] {
  return readLifeItems(life).filter(({ section }) => section === '인물 사전').flatMap(({ name, fields }) => {
    const field = (key: string) => fields.find(([fieldKey]) => fieldKey === key)?.[1]
    const period = field('곁에 있던 시기')
    if (field('상태') === '없음' || field('영향') !== '큼' || field('함께 한 일') === '없음' || period == null || period === '없음') return []
    return [{ name, stages: period.split(',').map((stage) => stage.trim()) }]
  })
}

if (import.meta.main) {
  const [dir] = process.argv.slice(2)
  if (dir == null) {
    console.error('usage: bun scripts/companion-candidates.ts <차트 디렉터리>')
    process.exit(1)
  }
  let life: string
  try {
    life = readFileSync(join(dir, 'life.md'), 'utf8')
  } catch {
    console.error(`읽을 수 없음: ${join(dir, 'life.md')}`)
    process.exit(1)
  }
  const candidates = companionCandidates(life)
  console.log(candidates.length === 0 ? '없음' : candidates.map(({ name, stages }) => `${name}: ${stages.join(', ')}`).join('\n'))
}
