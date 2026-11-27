/**
 * 전투 설계(`combat.md`)의 후보 비교, 출처, 콘텐츠 모드, 동료의 행동, 인용, 차트 명칭과 제외 메커니즘을 검사한다.
 * 계약: docs/spec/claude-game-design-flow.md 4·5.2·6절, 축과 차이 기준: docs/ADR/2026-11-03-personalized-combat-archetype-selection.md 2.1·2.2
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { classAbilities } from './check-identity.ts'
import {
  checkCitationsAndNames, checkSectionOrder, fieldsOf, itemNames, parseGameDocument, sectionItemNames, targetsOf, type Report,
} from './game-document.ts'

const TITLE = '# 전투 설계'
const SECTIONS = ['후보', '전투 방식', '콘텐츠 모드', '끌림', '장별 끌림', '동료의 행동']
/** 끌림 시스템의 필드. 반복되는 실패를 위험과 보상의 구조로 옮기고, 게임이 남기는 기록으로 스토리와 잇는다(#112) */
const DRAW_FIELDS = ['재료', '플레이어용 이름', '쌓는 행동', '보상', '대가', '기록', '극복']
/** 게임플레이 성향 축과 허용값 */
export const AXES: Record<string, string[]> = {
  '전투 거리': ['밀착', '중거리', '원거리'],
  '힘의 매개체': ['신체', '무기', '주문', '소환체', '설치물', '환경', '장치', '기호', '소리', '물질'],
  '주도 방식': ['직접 타격', '반응·반격', '지휘', '준비·함정', '변신', '제작', '변환', '보호·회복'],
  '공간 활용': ['추격', '진지 구축', '위치 교환', '영역 확장', '공중 이동', '지형 변형', '은신'],
  '전투 리듬': ['지속 압박', '축적 후 폭발', '순환', '준비 후 실행', '즉흥 변주'],
  '숙련의 핵심': ['타이밍', '조준', '자원 조합', '배치', '명령', '형태 전환', '해석', '정밀 조작'],
  '위험 구조': ['체력', '과열', '집중 붕괴', '소환체 손실', '지형 붕괴', '재료 소모', '오작동'],
}
/** 클래스가 능력 두세 개만 쓰므로(#99) 후보는 세 개다 */
const CANDIDATE_COUNT = 3
/** 후보 쌍마다 달라야 하는 축의 최소 수 */
const MIN_DIFFERENT_AXES = 3
const STYLE_FIELDS = ['채택', '핵심 행동', '속성', '약점', '적', '런 한 번', '런 중 보상', '런 밖 성장']

export interface CombatTexts { combat: string; brief: string; identity: string; world: string }

export function checkCombat({ combat, brief, identity, world }: CombatTexts): string[] {
  const errors: string[] = []
  const report: Report = (line, message) => errors.push(line == null ? message : `${line}: ${message}`)
  const sections = parseGameDocument(combat, TITLE, report)
  checkSectionOrder(sections, SECTIONS, report)
  const section = (name: string) => sections.find((candidate) => candidate.name === name)
  const abilities = new Set(sectionItemNames(brief, '주인공 능력'))
  const companions = sectionItemNames(brief, '동료')
  // 후보는 정체성 단계가 고른 클래스 안에서 만든다. 출처는 클래스의 재료인 능력이다(#86).
  const klass = classAbilities(identity, brief)

  // 후보: 세 개, 출처는 브리프의 주인공 능력, 축 값은 허용값, 후보 쌍마다 세 축 이상 다름, 채택은 하나
  const candidates = section('후보')?.items ?? []
  if (section('후보') != null && candidates.length !== CANDIDATE_COUNT) report(section('후보')!.line, `후보: 후보는 ${CANDIDATE_COUNT}개여야 한다 (실제: ${candidates.length})`)
  const axes = new Map<string, Record<string, string>>()
  const adopted: string[] = []
  for (const item of candidates) {
    const where = `후보 > ${item.name}`
    const fields = fieldsOf(where, item, ['출처', '조작하는 것', '플레이', '혼자일 때', ...Object.keys(AXES), '판단'], report)
    const source = fields.get('출처')
    if (source != null && source.value !== '') {
      const targets = targetsOf(source.value, 'brief')
      if (targets.length === 0) report(source.line, `${where}: 출처에 [brief:<주인공 능력>] 인용이 없다`)
      for (const target of targets) {
        if (!abilities.has(target)) report(source.line, `${where}: 출처 [brief:${target}]는 브리프의 주인공 능력이 아니다`)
        else if (klass != null && !klass.abilities.includes(target)) report(source.line, `${where}: 출처 [brief:${target}]는 클래스 '${klass.name}'의 재료가 아니다`)
      }
    }
    const values: Record<string, string> = {}
    for (const [axis, allowed] of Object.entries(AXES)) {
      const field = fields.get(axis)
      if (field == null || field.value === '') continue
      if (!allowed.includes(field.value)) report(field.line, `${where}: ${axis} '${field.value}' — 허용값 ${allowed.join(' · ')}`)
      values[axis] = field.value
    }
    axes.set(item.name, values)
    const verdict = fields.get('판단')
    if (verdict != null && verdict.value !== '') {
      if (verdict.value === '채택') adopted.push(item.name)
      else if (!/^제외 — \S/.test(verdict.value)) report(verdict.line, `${where}: 판단은 '채택' 또는 '제외 — <이유>'이다`)
    }
  }
  // 능력마다 후보를 하나씩 만들지 않는다. 같은 능력의 다루는 것을 다르게 해석한 후보가 둘 이상 있어야 한다(#82).
  const perAbility = new Map<string, number>()
  for (const item of candidates) {
    const source = item.fields.find((field) => field.key === '출처')
    for (const target of new Set(targetsOf(source?.value ?? '', 'brief'))) perAbility.set(target, (perAbility.get(target) ?? 0) + 1)
  }
  if (candidates.length === CANDIDATE_COUNT && ![...perAbility.values()].some((count) => count >= 2)) {
    report(section('후보')!.line, '후보: 같은 능력에서 나온 후보가 둘 이상 있어야 한다 (능력마다 하나씩 만들지 않는다)')
  }
  const names = [...axes.keys()]
  for (const [index, first] of names.entries()) {
    for (const second of names.slice(index + 1)) {
      const a = axes.get(first)!, b = axes.get(second)!
      const different = Object.keys(AXES).filter((axis) => a[axis] != null && b[axis] != null && a[axis] !== b[axis]).length
      if (different < MIN_DIFFERENT_AXES) report(null, `후보 > ${first} · ${second}: 다른 축이 ${different}개다 (최소 ${MIN_DIFFERENT_AXES}개)`)
    }
  }
  if (section('후보') != null && adopted.length !== 1) report(section('후보')!.line, `후보: 채택한 후보는 하나여야 한다 (실제: ${adopted.length})`)

  // 전투 방식: 채택한 후보를 구체화한다. 약점과 런 밖 성장은 브리프의 능력에서 나온다.
  const style = section('전투 방식')
  if (style != null) {
    const fields = fieldsOf('전투 방식', style, STYLE_FIELDS, report)
    const chosen = fields.get('채택')
    if (chosen != null && chosen.value !== '' && adopted.length === 1 && chosen.value !== adopted[0]) report(chosen.line, `전투 방식: 채택 '${chosen.value}' — 후보에서 채택한 것은 '${adopted[0]}'`)
    // 속성은 정체성 단계가 정한다. 전투는 그 속성이 핵심 행동에서 어떻게 드러나는지 쓰고 인용한다(#115).
    const attribute = fields.get('속성')
    const attributes = sectionItemNames(identity, '속성')
    if (attribute != null && attribute.value !== '' && !targetsOf(attribute.value, 'identity').some((target) => attributes.includes(target))) {
      report(attribute.line, `전투 방식: 속성에 정체성의 속성 [identity:${attributes[0] ?? '<속성>'}] 인용이 없다`)
    }
    // 적은 세계 단계가 정한 세력이나 지역에서 나온다. 세계가 전투보다 먼저 만들어진다. 장르의 적이면 그 지역을 인용한다(#121).
    const enemy = fields.get('적')
    const sources = [...sectionItemNames(world, '세력'), ...sectionItemNames(world, '지역')]
    if (enemy != null && enemy.value !== '' && !targetsOf(enemy.value, 'world').some((target) => sources.includes(target))) report(enemy.line, `전투 방식: 적에 [world:<세력>]이나 [world:<지역>] 인용이 없다`)
    for (const key of ['약점', '런 밖 성장']) {
      const field = fields.get(key)
      if (field != null && field.value !== '' && !targetsOf(field.value, 'brief').some((target) => abilities.has(target))) report(field.line, `전투 방식: ${key}에 [brief:<주인공 능력>] 인용이 없다`)
    }
  }

  // 콘텐츠 모드: 그 세계에서 주인공이 반복해서 하는 활동과 그 활동의 런. 일생 해석에는 재료가 없어 세계의 지역·세력에서 지어내고
  // 출처를 인용한다. 장르 어휘 목록에서 고르지 않는다(#116, 칸 ADR 배정 규칙 3).
  const modes = section('콘텐츠 모드')
  if (modes != null) {
    for (const field of modes.fields) report(field.line, `콘텐츠 모드: 허용하지 않는 필드 '${field.key}'`)
    if (modes.items.length === 0) report(modes.line, '콘텐츠 모드: 항목이 하나 이상 있어야 한다 (실제: 0개)')
    const places = [...sectionItemNames(world, '지역'), ...sectionItemNames(world, '세력')]
    for (const item of modes.items) {
      const where = `콘텐츠 모드 > ${item.name}`
      const source = fieldsOf(where, item, ['활동', '런', '출처'], report).get('출처')
      if (source != null && source.value !== '' && !targetsOf(source.value, 'world').some((target) => places.includes(target))) {
        report(source.line, `${where}: 출처에 [world:<지역>]이나 [world:<세력>] 인용이 없다`)
      }
    }
  }

  // 끌림: 브리프의 반복되는 실패를 플레이 시스템으로 옮긴 항목 하나. 서술에만 두면 플레이어가 그 사고방식을 겪지 못한다(#112).
  const draw = section('끌림')
  if (draw != null) {
    for (const field of draw.fields) report(field.line, `끌림: 허용하지 않는 필드 '${field.key}'`)
    if (draw.items.length !== 1) report(draw.line, `끌림: 항목은 하나다 (실제: ${draw.items.length}개)`)
    for (const item of draw.items) {
      const material = fieldsOf(`끌림 > ${item.name}`, item, DRAW_FIELDS, report).get('재료')
      if (material != null && material.value !== '' && !targetsOf(material.value, 'brief').includes('반복되는 실패')) report(material.line, `끌림 > ${item.name}: 재료에 [brief:반복되는 실패]이 없다`)
    }
  }

  // 장별 끌림: 사람은 시기마다 고민이 다르다. 브리프의 장마다 그 시기에 이 끌림이 무엇을 시험하는지 쓴다(#109·#112).
  const chapters = sectionItemNames(brief, '장')
  const byChapter = section('장별 끌림')
  if (byChapter != null) {
    for (const field of byChapter.fields) report(field.line, `장별 끌림: 허용하지 않는 필드 '${field.key}'`)
    const written = byChapter.items.map(({ name }) => name)
    if (written.join() !== chapters.join()) report(byChapter.line, `장별 끌림: 항목은 브리프의 장 ${chapters.join(', ')} 순서여야 한다 (실제: ${written.join(', ')})`)
    for (const item of byChapter.items) {
      const basis = fieldsOf(`장별 끌림 > ${item.name}`, item, ['의미', '근거'], report).get('근거')
      if (basis != null && basis.value !== '' && chapters.includes(item.name) && !targetsOf(basis.value, 'brief').includes(item.name)) report(basis.line, `장별 끌림 > ${item.name}: 근거에 [brief:${item.name}]이 없다`)
    }
  }

  // 동료의 행동: 브리프의 동료마다 하나, 근거는 그 동료. 동료는 스스로 움직이며 플레이어의 기술이 아니다(#71).
  const skills = section('동료의 행동')
  if (skills != null) {
    const written = skills.items.map(({ name }) => name)
    for (const name of companions) if (!written.includes(name)) report(skills.line, `동료의 행동: 브리프의 동료 '${name}'의 행동이 없다`)
    for (const item of skills.items) {
      const where = `동료의 행동 > ${item.name}`
      if (!companions.includes(item.name)) report(item.line, `${where}: 브리프의 동료가 아니다`)
      const basis = fieldsOf(where, item, ['행동', '근거'], report).get('근거')
      if (basis != null && basis.value !== '' && !targetsOf(basis.value, 'brief').includes(item.name)) report(basis.line, `${where}: 근거에 [brief:${item.name}]이 없다`)
    }
    for (const field of skills.fields) report(field.line, `동료의 행동: 허용하지 않는 필드 '${field.key}'`)
  }

  checkCitationsAndNames(combat, { brief: itemNames(brief), identity: itemNames(identity), world: itemNames(world) }, report, true)
  return errors
}

if (import.meta.main) {
  const [dir] = process.argv.slice(2)
  if (dir == null) {
    console.error('usage: bun scripts/check-combat.ts <차트 디렉터리>')
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
  const errors = checkCombat({ combat: read('combat.md'), brief: read('translation-brief.md'), identity: read('identity.md'), world: read('world.md') })
  for (const error of errors) console.log(error)
  process.exit(errors.length > 0 ? 1 : 0)
}
