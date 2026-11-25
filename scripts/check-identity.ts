/**
 * 이세계 정체성(`identity.md`)의 클래스 후보·클래스·부직업·출신 도시·장별 세계, 인용, 차트 명칭을 검사한다.
 * 계약: docs/spec/claude-game-design-flow.md 5.5절, docs/ADR/2026-11-24-isekai-identity-design.md 2번, docs/ADR/2026-11-25-class-candidates.md
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  checkCitationsAndNames, checkSectionOrder, fieldsOf, itemNames, parseGameDocument, sectionItemNames, targetsOf, type Report, type Section,
} from './game-document.ts'

const TITLE = '# 이세계 정체성'
const SECTIONS = ['클래스 후보', '클래스', '부직업', '출신 도시', '장별 세계']
/** 다루는 것을 기능 영역으로 올려 이세계의 힘으로 옮긴 후보를 견준다 */
const CANDIDATE_COUNT = 3

export interface IdentityTexts { identity: string; brief: string }

/** 클래스 항목 이름과 그 재료로 인용한 브리프의 주인공 능력. 전투 단계가 후보의 출처를 이 안에서 고른다. */
export function classAbilities(identity: string, brief: string): { name: string; abilities: string[] } | null {
  const abilities = sectionItemNames(brief, '주인공 능력')
  let section = '', name: string | null = null
  for (const line of identity.split('\n')) {
    if (line.startsWith('## ')) section = line.slice(3).trim()
    else if (section === '클래스' && line.startsWith('### ')) name = line.slice(4).trim()
    else if (section === '클래스' && name != null && line.startsWith('재료:')) {
      return { name, abilities: targetsOf(line, 'brief').filter((target) => abilities.includes(target)) }
    }
  }
  return null
}

export function checkIdentity({ identity, brief }: IdentityTexts): string[] {
  const errors: string[] = []
  const report: Report = (line, message) => errors.push(line == null ? message : `${line}: ${message}`)
  const sections = parseGameDocument(identity, TITLE, report)
  checkSectionOrder(sections, SECTIONS, report)
  const section = (name: string) => sections.find((candidate) => candidate.name === name)
  const abilities = sectionItemNames(brief, '주인공 능력')
  const livelihoods = sectionItemNames(brief, '생업')
  const chapters = sectionItemNames(brief, '장')

  /** 섹션에 항목이 정확히 하나 있다 */
  const single = (found: Section | undefined) => {
    if (found == null) return undefined
    for (const field of found.fields) report(field.line, `${found.name}: 허용하지 않는 필드 '${field.key}'`)
    if (found.items.length !== 1) report(found.line, `${found.name}: 항목은 하나다 (실제: ${found.items.length}개)`)
    return found.items[0]
  }

  // 클래스 후보: 세 개, 재료는 브리프의 주인공 능력, 채택은 하나. 다루는 것의 현실 명사를 그대로 클래스로 내리지 않도록
  // 영역(기능)으로 올린 뒤 이세계의 힘으로 옮긴 후보를 견준다. 옮김이 이세계다운지는 검토가 본다.
  const candidates = section('클래스 후보')
  const adopted: string[] = []
  if (candidates != null) {
    for (const field of candidates.fields) report(field.line, `클래스 후보: 허용하지 않는 필드 '${field.key}'`)
    if (candidates.items.length !== CANDIDATE_COUNT) report(candidates.line, `클래스 후보: 후보는 ${CANDIDATE_COUNT}개여야 한다 (실제: ${candidates.items.length})`)
    for (const item of candidates.items) {
      const where = `클래스 후보 > ${item.name}`
      const fields = fieldsOf(where, item, ['재료', '영역', '이세계의 힘', '판단'], report)
      const material = fields.get('재료')
      if (material != null && !targetsOf(material.value, 'brief').some((target) => abilities.includes(target))) {
        report(material.line, `${where}: 재료에 [brief:<주인공 능력>]이 없다`)
      }
      const verdict = fields.get('판단')
      if (verdict != null && verdict.value !== '') {
        if (verdict.value === '채택') adopted.push(item.name)
        else if (!/^제외 — \S/.test(verdict.value)) report(verdict.line, `${where}: 판단은 '채택' 또는 '제외 — <이유>'이다`)
      }
    }
    if (adopted.length !== 1) report(candidates.line, `클래스 후보: 채택한 후보는 하나여야 한다 (실제: ${adopted.length})`)
  }

  // 클래스: 재능 전체를 놓고 정한다. 재료에 주인공 능력이 하나 이상 있고, 생업 이름을 그대로 클래스로 옮기지 않는다.
  const klass = single(section('클래스'))
  if (klass != null) {
    const where = `클래스 > ${klass.name}`
    const material = fieldsOf(where, klass, ['재료', '하는 일', '판단'], report).get('재료')
    if (material != null && !targetsOf(material.value, 'brief').some((target) => abilities.includes(target))) {
      report(material.line, `${where}: 재료에 [brief:<주인공 능력>]이 없다`)
    }
    if (livelihoods.includes(klass.name)) report(klass.line, `${where}: 생업 이름을 그대로 클래스로 쓰지 않는다`)
    if (adopted.length === 1 && klass.name !== adopted[0]) report(klass.line, `${where}: 클래스는 후보에서 채택한 '${adopted[0]}'이다`)
  }

  // 부직업: 싸움 밖에서 하는 일. 브리프의 생업이나 능력을 재료로 한다.
  const subJob = single(section('부직업'))
  if (subJob != null) {
    const where = `부직업 > ${subJob.name}`
    const material = fieldsOf(where, subJob, ['재료', '하는 일'], report).get('재료')
    if (material != null && !targetsOf(material.value, 'brief').some((target) => abilities.includes(target) || livelihoods.includes(target))) {
      report(material.line, `${where}: 재료에 [brief:<생업>]이나 [brief:<주인공 능력>]이 없다`)
    }
  }

  // 출신 도시: 자체 산업·권력·역사를 가진 곳. 브리프 배경의 출신지(life.md 배경의 뿌리·자란 집을 옮긴 환경)에 기댄다(#97).
  const city = single(section('출신 도시'))
  if (city != null) {
    const where = `출신 도시 > ${city.name}`
    const basis = fieldsOf(where, city, ['산업', '권력', '역사', '주인공의 자리', '근거'], report).get('근거')
    if (basis != null && !targetsOf(basis.value, 'brief').includes('출신지')) {
      report(basis.line, `${where}: 근거에 [brief:출신지]가 없다`)
    }
  }

  // 장별 세계: 브리프의 장마다 순서대로 하나. 그 시기 주인공이 놓인 공동체·시대의 모습이다.
  const eras = section('장별 세계')
  if (eras != null) {
    const names = eras.items.map(({ name }) => name)
    if (names.join() !== chapters.join()) report(eras.line, `장별 세계: 항목은 브리프의 장 ${chapters.join(', ')} 순서여야 한다 (실제: ${names.join(', ')})`)
    for (const field of eras.fields) report(field.line, `장별 세계: 허용하지 않는 필드 '${field.key}'`)
    for (const item of eras.items) {
      const where = `장별 세계 > ${item.name}`
      const basis = fieldsOf(where, item, ['세계', '근거'], report).get('근거')
      if (basis != null && chapters.includes(item.name) && !targetsOf(basis.value, 'brief').includes(item.name)) report(basis.line, `${where}: 근거에 [brief:${item.name}]이 없다`)
    }
  }

  checkCitationsAndNames(identity, { brief: itemNames(brief) }, report)
  return errors
}

if (import.meta.main) {
  const [dir] = process.argv.slice(2)
  if (dir == null) {
    console.error('usage: bun scripts/check-identity.ts <차트 디렉터리>')
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
  const errors = checkIdentity({ identity: read('identity.md'), brief: read('translation-brief.md') })
  for (const error of errors) console.log(error)
  process.exit(errors.length > 0 ? 1 : 0)
}
