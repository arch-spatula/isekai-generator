/**
 * 세계 설계(`world.md`)의 지역·세력·서사 갈등, 인용, 차트 명칭을 검사한다.
 * 계약: docs/spec/claude-game-design-flow.md 4·5.3·6절
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  checkCitationsAndNames, checkSectionOrder, fieldsOf, headingNames, itemNames, parseGameDocument, sectionItemNames, targetsOf, type Field, type Report,
} from './game-document.ts'

const TITLE = '# 세계 설계'
const SECTIONS = ['지역', '세력', '서사 갈등']

export interface WorldTexts { world: string; brief: string; combat: string; identity: string }

export function checkWorld({ world, brief, combat, identity }: WorldTexts): string[] {
  const errors: string[] = []
  const report: Report = (line, message) => errors.push(line == null ? message : `${line}: ${message}`)
  const sections = parseGameDocument(world, TITLE, report)
  checkSectionOrder(sections, SECTIONS, report)
  const section = (name: string) => sections.find((candidate) => candidate.name === name)
  const chapters = sectionItemNames(brief, '장')
  // 첫 지역은 정체성 단계가 만든 출신 도시에서 시작한다(#86).
  const cities = sectionItemNames(identity, '출신 도시')

  /** 근거는 브리프나 정체성을 인용하거나 `창작:`으로 시작한다 */
  const requireBasis = (where: string, field: Field | undefined) => {
    if (field != null && field.value !== '' && !field.value.startsWith('창작:') && targetsOf(field.value, 'brief').length === 0 && targetsOf(field.value, 'identity').length === 0) {
      report(field.line, `${where}: 근거에 [brief:<항목>]이나 [identity:<항목>] 인용이 없다 (근거 없는 설정은 '창작:'으로 시작한다)`)
    }
  }
  const requireItems = (name: string) => {
    const found = section(name)
    if (found != null && found.items.length === 0) report(found.line, `${name}: 항목이 없다`)
    for (const field of found?.fields ?? []) report(field.line, `${name}: 허용하지 않는 필드 '${field.key}'`)
    return found?.items ?? []
  }

  // 지역: 브리프의 장마다 하나 이상. 첫 지역은 정체성의 출신 도시에서 시작한다. 전장은 전투 설계를 인용한다.
  const regions = requireItems('지역')
  const covered = new Set<string>()
  for (const [index, item] of regions.entries()) {
    const where = `지역 > ${item.name}`
    const fields = fieldsOf(where, item, ['장', '성격', '사정', '전장', '근거'], report)
    const chapter = fields.get('장')
    if (chapter != null && chapter.value !== '') {
      if (!chapters.includes(chapter.value)) report(chapter.line, `${where}: 장 '${chapter.value}'는 브리프의 장(${chapters.join(', ')})이 아니다`)
      covered.add(chapter.value)
      if (index === 0 && chapter.value !== chapters[0]) report(chapter.line, `${where}: 첫 지역의 장은 브리프의 첫 장 '${chapters[0]}'이다`)
    }
    const field = fields.get('전장')
    if (field != null && field.value !== '' && targetsOf(field.value, 'combat').length === 0) report(field.line, `${where}: 전장에 [combat:<항목>] 인용이 없다`)
    const basis = fields.get('근거')
    requireBasis(where, basis)
    if (index === 0 && basis != null && !targetsOf(basis.value, 'identity').some((target) => cities.includes(target))) {
      report(basis.line, `${where}: 첫 지역의 근거에 출신 도시 [identity:${cities[0] ?? '<출신 도시>'}]가 없다`)
    }
  }
  if (section('지역') != null) for (const chapter of chapters) if (!covered.has(chapter)) report(section('지역')!.line, `지역: 브리프의 장 '${chapter}'의 지역이 없다`)

  // 세력: 자체 목적과 제약, 주인공과의 관계
  for (const item of requireItems('세력')) {
    const where = `세력 > ${item.name}`
    requireBasis(where, fieldsOf(where, item, ['목적', '제약', '주인공과의 관계', '근거'], report).get('근거'))
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

  checkCitationsAndNames(world, { brief: itemNames(brief), combat: headingNames(combat), identity: itemNames(identity) }, report)
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
  const errors = checkWorld({ world: read('world.md'), brief: read('translation-brief.md'), combat: read('combat.md'), identity: read('identity.md') })
  for (const error of errors) console.log(error)
  process.exit(errors.length > 0 ? 1 : 0)
}
