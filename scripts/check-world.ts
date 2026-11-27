/**
 * 세계 설계(`world.md`)의 지역·세력·장·서사 갈등, 인용, 차트 명칭을 검사한다.
 * 계약: docs/spec/claude-game-design-flow.md 4·5.3·6절, docs/ADR/2026-11-26-open-origin.md, docs/ADR/2026-11-27-world-before-chapters.md
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  checkCitationsAndNames, checkSectionOrder, fieldsOf, itemNames, parseGameDocument, sectionItemNames, targetsOf, type Field, type Report,
} from './game-document.ts'

const TITLE = '# 세계 설계'
const SECTIONS = ['지역', '세력', '장', '서사 갈등']

export interface WorldTexts { world: string; brief: string; identity: string }

export function checkWorld({ world, brief, identity }: WorldTexts): string[] {
  const errors: string[] = []
  const report: Report = (line, message) => errors.push(line == null ? message : `${line}: ${message}`)
  const sections = parseGameDocument(world, TITLE, report)
  checkSectionOrder(sections, SECTIONS, report)
  const section = (name: string) => sections.find((candidate) => candidate.name === name)
  const chapters = sectionItemNames(brief, '장')
  // 첫 지역은 정체성 단계가 만든 출신지에서 시작한다(#86).
  const origins = sectionItemNames(identity, '출신지')

  /** 근거는 일생의 사실에서 왔다고 주장하는 요소에만 쓰고, 쓰면 브리프나 정체성을 인용한다. 지어낸 요소에는 근거를 쓰지 않는다(#87). */
  const requireBasis = (where: string, field: Field | undefined) => {
    if (field != null && field.value !== '' && targetsOf(field.value, 'brief').length === 0 && targetsOf(field.value, 'identity').length === 0) {
      report(field.line, `${where}: 근거에 [brief:<항목>]이나 [identity:<항목>] 인용이 없다 (지어낸 설정이면 근거 줄을 쓰지 않는다)`)
    }
  }
  const requireItems = (name: string) => {
    const found = section(name)
    if (found != null && found.items.length === 0) report(found.line, `${name}: 항목이 없다`)
    for (const field of found?.fields ?? []) report(field.line, `${name}: 허용하지 않는 필드 '${field.key}'`)
    return found?.items ?? []
  }

  // 지역: 생애의 장과 따로 세운다. 첫 지역은 정체성의 출신지에서 시작한다(#123).
  // 전장은 위협이 있는 지역에만 두고 세계 전체에 하나 이상 둔다. 적은 세력이 아니라 장르의 적이어도 된다(#121).
  const regions = requireItems('지역')
  for (const [index, item] of regions.entries()) {
    const where = `지역 > ${item.name}`
    // 근거는 첫 지역(출신지)에만 필수다.
    const fields = fieldsOf(where, item, index === 0 ? ['성격', '사정', '근거'] : ['성격', '사정'], report, ['성격', '사정', '전장', '근거'])
    const basis = fields.get('근거')
    requireBasis(where, basis)
    if (index === 0 && basis != null && !targetsOf(basis.value, 'identity').some((target) => origins.includes(target))) {
      report(basis.line, `${where}: 첫 지역의 근거에 출신지 [identity:${origins[0] ?? '<출신지>'}]가 없다`)
    }
  }
  const regionLine = section('지역')?.line
  if (regionLine != null && regions.length > 0 && !regions.some((item) => item.fields.some((field) => field.key === '전장'))) {
    report(regionLine, '지역: 전장이 있는 지역이 없다')
  }

  // 세력: 자체 목적과 제약, 주인공과의 관계
  for (const item of requireItems('세력')) {
    const where = `세력 > ${item.name}`
    requireBasis(where, fieldsOf(where, item, ['목적', '제약', '주인공과의 관계'], report, ['목적', '제약', '주인공과의 관계', '근거']).get('근거'))
  }

  // 장: 브리프의 장마다 순서대로 하나. 그 장의 사건이 일어나는 지역을 고른다. 첫 장은 출신지에서 만든 첫 지역이다(#123).
  const eras = section('장')
  if (eras != null) {
    const names = eras.items.map(({ name }) => name)
    if (names.join() !== chapters.join()) report(eras.line, `장: 항목은 브리프의 장 ${chapters.join(', ')} 순서여야 한다 (실제: ${names.join(', ')})`)
    for (const field of eras.fields) report(field.line, `장: 허용하지 않는 필드 '${field.key}'`)
    const regionNames = regions.map(({ name }) => name)
    for (const [index, item] of eras.items.entries()) {
      const where = `장 > ${item.name}`
      const region = fieldsOf(where, item, ['지역'], report).get('지역')
      if (region == null || region.value === '') continue
      if (!regionNames.includes(region.value)) report(region.line, `${where}: 지역 '${region.value}'는 이 문서의 지역이 아니다`)
      else if (index === 0 && region.value !== regionNames[0]) report(region.line, `${where}: 첫 장의 지역은 출신지에서 만든 첫 지역 '${regionNames[0]}'이다`)
    }
  }

  // 서사 갈등: 주인공의 축과 반복되는 실패가 세계와 부딪치는 곳. 둘 다 어딘가에서 인용한다.
  const cited = new Set<string>()
  for (const item of requireItems('서사 갈등')) {
    const where = `서사 갈등 > ${item.name}`
    const basis = fieldsOf(where, item, ['내용', '근거'], report).get('근거')
    requireBasis(where, basis)
    for (const target of targetsOf(basis?.value ?? '', 'brief')) cited.add(target)
  }
  if (section('서사 갈등') != null) {
    for (const name of ['축', '반복되는 실패']) if (!cited.has(name)) report(section('서사 갈등')!.line, `서사 갈등: 근거 어디에도 [brief:${name}]이 없다`)
  }

  checkCitationsAndNames(world, { brief: itemNames(brief), identity: itemNames(identity) }, report)
  return errors
}

if (import.meta.main) {
  const [dir] = process.argv.slice(2)
  if (dir == null) {
    console.error('usage: bun scripts/check-world.ts <차트 디렉터리>')
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
  const errors = checkWorld({ world: read('world.md'), brief: read('translation-brief.md'), identity: read('identity.md') })
  for (const error of errors) console.log(error)
  process.exit(errors.length > 0 ? 1 : 0)
}
