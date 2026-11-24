/**
 * 세 체계 일생 통합 문서(life.md)의 구조와 원본 일생 해석 인용을 검사한다. 계약: docs/spec/life-integration.md
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { LIFE_SYSTEMS, type LifeTextsBySystem, relationVotes } from './assemble-life-material.ts'
import { BACKGROUND, CAST, CAST_FIELDS, CAST_ITEM_FIELDS, TIMELINE } from './check-life-document.ts'
import { lifeTermErrors } from './chart-names.ts'
import { checkRelations, RELATION_ITEMS } from './life-relations.ts'
import { checkLifeDocument, readLifeItems } from './life-document.ts'
import { LIFE_STAGES } from './life-stages.ts'

type System = (typeof LIFE_SYSTEMS)[number]
const STAGE_NAMES = LIFE_STAGES.map((stage) => stage.name)
/** 출처 이름이 무엇이든 인용 꼴이면 잡아, 통합 문서에 쓰지 않는 출처도 알린다. */
const CITATION = /\[([a-z]+):([^\]]*)\]/g
/** 인용이 하나 이상 있어야 하는 필드 */
const CITED_FIELDS = ['근거', '본선', '다른 길']

const SECTIONS = [
  { name: '일생의 축', items: ['축'], fields: ['내용', '근거'] },
  BACKGROUND,
  { name: '생애 연표', items: STAGE_NAMES, fields: TIMELINE.fields.filter((field) => field !== '운') },
  { name: '인물 사전', items: CAST, fields: CAST_FIELDS, itemFields: CAST_ITEM_FIELDS, stageFields: ['관계의 변화'] },
  { name: '재능과 생업', items: ['주 재능', '보조 재능'], extraItems: true, fields: ['내용', '다루는 것', '꽃피는 시기', '막히는 조건', '근거'], stageFields: ['꽃피는 시기'], livelihood: { timeline: true } },
  { name: '상처와 회복', items: ['반복되는 실패', '상실', '회복'], fields: ['내용', '발현 조건', '근거'] },
  { name: '갈림길', items: [], extraItems: true, fields: ['본선', '다른 길', '갈리는 조건'] },
]
/** 같은 이름의 원본 항목을 문서 어딘가에서 인용해야 하는 항목과 그 체계 */
const SAME_NAME: [string[], System[]][] = [[BACKGROUND.items, [...LIFE_SYSTEMS]], [STAGE_NAMES, ['saju', 'ziwei']], [CAST, [...LIFE_SYSTEMS]]]
/** 섹션 안에서 세 체계를 각각 한 번 이상 인용해야 하는 섹션 */
const EVERY_SYSTEM = ['재능과 생업', '상처와 회복']

export interface IntegrationTexts { life: string; sources: LifeTextsBySystem }

interface Citation { system: string; target: string }
interface FieldLine { section: string; item: string; key: string; line: number; citations: Citation[] }

function fieldLines(text: string): FieldLine[] {
  const result: FieldLine[] = []
  let section = ''
  let item = ''
  text.split('\n').forEach((textLine, index) => {
    if (textLine.startsWith('## ')) [section, item] = [textLine.slice(3).trim(), '']
    else if (textLine.startsWith('### ')) item = textLine.slice(4).trim()
    else {
      const match = textLine.match(/^([^:]+):\s?(.*)$/)
      if (match == null || item === '') return
      const citations = [...match[2].matchAll(CITATION)].map(([, system, target]) => ({ system, target }))
      result.push({ section, item, key: match[1], line: index + 1, citations })
    }
  })
  return result
}

export function checkLifeIntegration({ life, sources }: IntegrationTexts): string[] {
  const errors = checkLifeDocument(life, { title: '# 일생 통합 해석', sections: SECTIONS })
  const report = (line: number | null, message: string) => errors.push(line == null ? message : `${line}: ${message}`)
  const names = Object.fromEntries(LIFE_SYSTEMS.map((system) =>
    [system, new Set(readLifeItems(sources[system]).map(({ name }) => name))])) as Record<System, Set<string>>
  const isSystem = (system: string): system is System => (LIFE_SYSTEMS as readonly string[]).includes(system)

  const lines = fieldLines(life)
  const cited = new Set<string>()
  for (const { section, item, key, line, citations } of lines) {
    const where = `${section} > ${item}`
    if (CITED_FIELDS.includes(key) && citations.length === 0) report(line, `${where}: ${key}에 인용이 없다`)
    for (const { system, target } of citations) {
      if (!isSystem(system)) report(line, `${where}: 통합 해석에 쓰지 않는 인용 [${system}:${target}]`)
      else if (!names[system].has(target)) report(line, `${where}: ${system}-life.md에 없는 항목 [${system}:${target}]`)
      else cited.add(`[${system}:${target}]`)
    }
  }

  const missing = SAME_NAME.flatMap(([items, systems]) => items.flatMap((item) =>
    systems.map((system) => `[${system}:${item}]`))).filter((citation) => !cited.has(citation))
  if (missing.length > 0) report(null, `같은 이름의 원본 항목을 인용하지 않았다: ${missing.join(' ')}`)

  for (const section of EVERY_SYSTEM) {
    const systems = new Set(lines.filter((line) => line.section === section).flatMap(({ citations }) => citations.map(({ system }) => system)))
    const absent = LIFE_SYSTEMS.filter((system) => !systems.has(system))
    if (absent.length > 0) report(null, `${section}: 인용하지 않은 체계가 있다: ${absent.join(', ')}`)
  }

  const forks = lines.filter((line) => line.section === '갈림길')
  for (const item of new Set(forks.map((line) => line.item))) {
    const systemsOf = (key: string) => new Set(forks.find((line) => line.item === item && line.key === key)?.citations.map(({ system }) => system))
    const main = systemsOf('본선')
    const other = systemsOf('다른 길')
    if (main.size > 0 && other.size > 0 && [...other].every((system) => main.has(system))) {
      report(forks.find((line) => line.item === item && line.key === '다른 길')!.line,
        `갈림길 > ${item}: 다른 길이 본선에 없는 체계를 인용하지 않는다`)
    }
  }

  // 문장에 차트 명칭과 판단·운세 용어를 쓰지 않는다(#66). 인용 안은 보지 않는다.
  for (const error of lifeTermErrors(life)) {
    const [line, ...rest] = error.split(': ')
    report(Number(line), `${rest.join(': ')} — 통합 해석의 문장은 생애 사건 언어로 쓴다`)
  }

  // 상태를 판정하지 않는 인물의 부재(`함께 한 일`·`곁에 있던 시기`가 없음)는 두 체계 이상이 같은 필드를 없음으로 썼을 때만 쓴다(#65).
  const fieldOf = (text: string, person: string, key: string) =>
    readLifeItems(text).find(({ section, name }) => section === '인물 사전' && name === person)?.fields.find(([field]) => field === key)?.[1]
  for (const person of CAST.filter((name) => !(name in RELATION_ITEMS))) {
    for (const key of ['함께 한 일', '곁에 있던 시기']) {
      if (fieldOf(life, person, key) !== '없음') continue
      const absent = LIFE_SYSTEMS.filter((system) => fieldOf(sources[system], person, key) === '없음')
      if (absent.length < 2) {
        const line = lines.find((field) => field.section === '인물 사전' && field.item === person && field.key === key)?.line ?? null
        report(line, `인물 사전 > ${person}: ${key}${key === '함께 한 일' ? '을' : '를'} 없음으로 쓰려면 두 체계 이상이 없음이어야 한다 (없음: ${absent.join(', ') || '없음'})`)
      }
    }
  }

  // 상태·영향은 세 체계의 중앙값을 따르고, 본선과 다른 값을 낸 체계는 갈림길의 다른 길에서 인용한다(영향은 큼과 작음이 섞일 때만).
  const status = relationVotes(sources, '상태'), impact = relationVotes(sources, '영향')
  errors.push(...checkRelations(life, {
    expectedStatus: new Map([...status].map(([person, vote]) => [person, vote.main])),
    expectedImpact: new Map([...impact].map(([person, vote]) => [person, vote.main])),
    timeline: true,
  }))
  const otherPaths = new Set(forks.filter((line) => line.key === '다른 길').flatMap(({ citations }) => citations.map(({ system, target }) => `[${system}:${target}]`)))
  const requireFork = (person: string, key: string, values: Record<System, string>, main: string) => {
    const dissent = LIFE_SYSTEMS.filter((system) => values[system] !== main && !otherPaths.has(`[${system}:${person}]`))
    if (dissent.length > 0) report(null, `인물 사전 > ${person}: ${key === '상태' ? '상태가' : '영향이'} 본선(${main})과 다른 체계를 갈림길의 다른 길에서 인용하지 않았다: ${dissent.join(', ')}`)
  }
  for (const [person, { values, main }] of status) requireFork(person, '상태', values, main)
  for (const [person, { values, main }] of impact) {
    const set = new Set(Object.values(values))
    if (set.has('큼') && set.has('작음')) requireFork(person, '영향', values, main)
  }
  return errors
}

if (import.meta.main) {
  const [dir] = process.argv.slice(2)
  if (dir == null) {
    console.error('usage: bun scripts/check-life-integration.ts <차트 디렉터리>')
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
  const sources = Object.fromEntries(LIFE_SYSTEMS.map((system) => [system, read(`${system}-life.md`)])) as LifeTextsBySystem
  const errors = checkLifeIntegration({ life: read('life.md'), sources })
  for (const error of errors) console.log(error)
  process.exit(errors.length > 0 ? 1 : 0)
}
