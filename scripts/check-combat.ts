/**
 * 전투 설계(`combat.md`)의 후보 비교, 출처, 동료의 행동, 인용, 차트 명칭과 제외 메커니즘을 검사한다.
 * 계약: docs/spec/claude-game-design-flow.md 4·5.2·6절, 축과 차이 기준: docs/ADR/2026-11-03-personalized-combat-archetype-selection.md 2.1·2.2
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  checkCitationsAndNames, checkSectionOrder, fieldsOf, itemNames, parseGameDocument, sectionItemNames, targetsOf, type Report,
} from './game-document.ts'

const TITLE = '# 전투 설계'
const SECTIONS = ['후보', '전투 방식', '동료의 행동']
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
const CANDIDATE_COUNT = 4
/** 후보 쌍마다 달라야 하는 축의 최소 수 */
const MIN_DIFFERENT_AXES = 3
const STYLE_FIELDS = ['채택', '핵심 행동', '약점', '적', '런 한 번', '런 중 보상', '런 밖 성장']

export interface CombatTexts { combat: string; brief: string }

export function checkCombat({ combat, brief }: CombatTexts): string[] {
  const errors: string[] = []
  const report: Report = (line, message) => errors.push(line == null ? message : `${line}: ${message}`)
  const sections = parseGameDocument(combat, TITLE, report)
  checkSectionOrder(sections, SECTIONS, report)
  const section = (name: string) => sections.find((candidate) => candidate.name === name)
  const abilities = new Set(sectionItemNames(brief, '주인공 능력'))
  const companions = sectionItemNames(brief, '동료')

  // 후보: 네 개, 출처는 브리프의 주인공 능력, 축 값은 허용값, 후보 쌍마다 세 축 이상 다름, 채택은 하나
  const candidates = section('후보')?.items ?? []
  if (section('후보') != null && candidates.length !== CANDIDATE_COUNT) report(section('후보')!.line, `후보: 후보는 ${CANDIDATE_COUNT}개여야 한다 (실제: ${candidates.length})`)
  const axes = new Map<string, Record<string, string>>()
  const adopted: string[] = []
  for (const item of candidates) {
    const where = `후보 > ${item.name}`
    const fields = fieldsOf(where, item, ['출처', '플레이', ...Object.keys(AXES), '판단'], report)
    const source = fields.get('출처')
    if (source != null && source.value !== '') {
      const targets = targetsOf(source.value, 'brief')
      if (targets.length === 0) report(source.line, `${where}: 출처에 [brief:<주인공 능력>] 인용이 없다`)
      for (const target of targets) if (!abilities.has(target)) report(source.line, `${where}: 출처 [brief:${target}]는 브리프의 주인공 능력이 아니다`)
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
    for (const key of ['약점', '런 밖 성장']) {
      const field = fields.get(key)
      if (field != null && field.value !== '' && !targetsOf(field.value, 'brief').some((target) => abilities.has(target))) report(field.line, `전투 방식: ${key}에 [brief:<주인공 능력>] 인용이 없다`)
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

  checkCitationsAndNames(combat, { brief: itemNames(brief) }, report, true)
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
  const errors = checkCombat({ combat: read('combat.md'), brief: read('translation-brief.md') })
  for (const error of errors) console.log(error)
  process.exit(errors.length > 0 ? 1 : 0)
}
