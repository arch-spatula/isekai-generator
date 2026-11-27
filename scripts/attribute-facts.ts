/**
 * 세 체계의 사실 파일에서 속성의 재료가 되는 기운 사실을 계산한다. 판정하지 않고, 차트 명칭 없이 일상어로 낸다.
 * 정체성 스킬이 이 출력을 읽고 브리프의 재능·생업과 함께 해석해 속성을 정한다.
 * 계약: docs/ADR/2026-11-27-attribute.md, docs/ADR/2026-11-26-game-slots.md 결정 1
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface FactTexts { saju: string; ziwei: string; natal: string }

const ELEMENTS: Record<string, string> = { 木: '나무', 火: '불', 土: '흙', 金: '쇠', 水: '물' }
const WESTERN: Record<string, string> = { Fire: '불', Earth: '흙', Air: '공기', Water: '물' }
const MODES: Record<string, string> = { Cardinal: '시작', Fixed: '고정', Mutable: '변화' }
const GAINED = ['도미사일', '엑잘테이션']
const LOST = ['데트리먼트', '폴']

/** `라벨...: 값` 줄의 값. 없으면 파일과 라벨을 알린다 */
function lineValue(text: string, file: string, label: string): string {
  const line = text.split('\n').find((candidate) => candidate.startsWith(label))
  if (line == null) throw new Error(`${file}: ${label} 줄이 없다`)
  return line.slice(line.indexOf(': ') + 2).trim()
}

/** `A 1 · B 2` 분포를 이름표를 바꿔 다시 쓴다 */
function distribution(value: string, names: Record<string, string>): string {
  return value.split(' · ').map((part) => {
    const [name, count] = part.trim().split(' ')
    return `${names[name] ?? name} ${count}`
  }).join(' · ')
}

/** 섹트 소속 줄에서 길성·흉성으로 적힌 별을 골라 본질적 품위로 힘을 얻은 수와 잃은 수를 센다 */
function dignityCounts(natal: string, kind: '길성' | '흉성'): string {
  const planets = [...lineValue(natal, 'natal-facts.md', '섹트 소속').matchAll(new RegExp(`${kind} (\\w+)`, 'g'))].map(([, name]) => name)
  let gained = 0, lost = 0
  for (const planet of planets) {
    const value = lineValue(natal, 'natal-facts.md', `  ${planet} in `)
    if (GAINED.some((name) => value.includes(name))) gained++
    if (LOST.some((name) => value.includes(name))) lost++
  }
  return `힘을 얻음 ${gained} · 힘을 잃음 ${lost}`
}

export function attributeFacts({ saju, ziwei, natal }: FactTexts): string {
  const center = lineValue(saju, 'saju-facts.md', '일간').match(/\((.)/)?.[1] ?? ''
  const season = lineValue(saju, 'saju-facts.md', '월령').match(/계절 (\S+)/)?.[1] ?? ''
  const base = lineValue(ziwei, 'ziwei-facts.md', '오행국').charAt(0)
  const [lucky, harsh] = [...lineValue(ziwei, 'ziwei-facts.md', '삼방사정 보조성 수').matchAll(/\d+/g)].map(([count]) => count)
  return [
    '세 체계의 기운 (규칙 계산값, 판정 아님)',
    `동양 다섯 기운 (여덟 자리): ${distribution(lineValue(saju, 'saju-facts.md', '오행 분포'), ELEMENTS)}`,
    `중심 기운: ${ELEMENTS[center] ?? center} · 태어난 계절: ${season}`,
    `두 번째 체계의 바탕 기운: ${ELEMENTS[base] ?? base}`,
    `서양 네 원소: ${distribution(lineValue(natal, 'natal-facts.md', '원소 분포'), WESTERN)}`,
    `서양 움직임: ${distribution(lineValue(natal, 'natal-facts.md', '양태 분포'), MODES)}`,
    `삶의 중심 둘레의 결: 길한 기운 ${lucky} · 거친 기운 ${harsh}`,
    `길한 별: ${dignityCounts(natal, '길성')}`,
    `거친 별: ${dignityCounts(natal, '흉성')}`,
  ].join('\n')
}

if (import.meta.main) {
  const [dir] = process.argv.slice(2)
  if (dir == null) {
    console.error('usage: bun scripts/attribute-facts.ts <차트 디렉터리>')
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
  try {
    console.log(attributeFacts({ saju: read('saju-facts.md'), ziwei: read('ziwei-facts.md'), natal: read('natal-facts.md') }))
  } catch (error) {
    console.error((error as Error).message)
    process.exit(1)
  }
}
