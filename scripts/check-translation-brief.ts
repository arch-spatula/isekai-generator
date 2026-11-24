/**
 * 일생 번역 브리프(`translation-brief.md`)의 형식, 동료 후보, 인용, 차트 명칭을 검사한다.
 * 계약: docs/spec/life-to-game-translation.md 4·5절, docs/spec/claude-game-design-flow.md 4.1·5.1
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chartNameErrors } from './chart-names.ts'
import { CAST } from './check-life-document.ts'
import { companionCandidates } from './companion-candidates.ts'
import { isLivelihood, readLifeItems } from './life-document.ts'
import { LIFE_STAGES } from './life-stages.ts'

const TITLE = '# 일생 번역 브리프'
const SECTIONS = ['주인공', '주인공 능력', '동료', '배경', '장', '동기와 퀘스트', '옮기지 않은 인물']
/** 주인공 절의 항목과 각각 인용해야 하는 life.md 항목 */
const PROTAGONIST = ['축', '반복되는 실패']
const BACKGROUND = ['출신지', '성장 환경', '가족 구조', '떠남의 계기']
const STAGE_NAMES = LIFE_STAGES.map((stage) => stage.name)
const CITATION = /\[([^\]:]+):([^\]]*)\]/g

interface Field { key: string; value: string; line: number }
interface Item { name: string; line: number; fields: Field[] }
interface Section { name: string; line: number; fields: Field[]; items: Item[]; bullets: { name: string; reason: string; line: number }[] }

export interface BriefTexts { brief: string; life: string }

function parse(brief: string, report: (line: number, message: string) => void): Section[] {
  const sections: Section[] = []
  for (const [index, raw] of brief.split('\n').entries()) {
    const line = index + 1, text = raw.trimEnd()
    if (index === 0 || text === '') continue
    const section = sections.at(-1), item = section?.items.at(-1)
    if (text.startsWith('## ')) sections.push({ name: text.slice(3).trim(), line, fields: [], items: [], bullets: [] })
    else if (text.startsWith('### ') && section != null) section.items.push({ name: text.slice(4).trim(), line, fields: [] })
    else if (text.startsWith('- ') && section?.name === '옮기지 않은 인물') {
      const match = text.slice(2).match(/^([^:]+):\s*(.*)$/)
      if (match == null) report(line, `'- <인물>: <이유>' 형식이 아니다`)
      else section.bullets.push({ name: match[1].trim(), reason: match[2].trim(), line })
    } else {
      const match = text.match(/^([^:\s][^:]*):\s*(.*)$/)
      if (match == null || section == null) report(line, '`키: 값` 필드 줄이 아니다')
      else (item ?? section).fields.push({ key: match[1].trim(), value: match[2].trim(), line })
    }
  }
  return sections
}

const citations = (value: string) => [...value.matchAll(CITATION)].map(([, tag, target]) => ({ tag, target: target.trim() }))
const lifeTargets = (value: string) => citations(value).filter(({ tag }) => tag === 'life').map(({ target }) => target)

export function checkTranslationBrief({ brief, life }: BriefTexts): string[] {
  const errors: string[] = []
  const report = (line: number | null, message: string) => errors.push(line == null ? message : `${line}: ${message}`)
  if (brief.split('\n')[0] !== TITLE) report(1, `첫 줄은 '${TITLE}'이어야 한다`)

  const lifeItems = readLifeItems(life)
  const itemNames = new Set(lifeItems.map(({ name }) => name))
  // 생업 항목은 능력의 출처가 아니다. 생업을 전투 능력으로 직역하지 않는다(#85).
  const talents = new Set(lifeItems.filter(({ section, name }) => section === '재능과 생업' && !isLivelihood(name)).map(({ name }) => name))
  const candidates = companionCandidates(life)

  const sections = parse(brief, report)
  const order = sections.map(({ name }) => name)
  if (order.join() !== SECTIONS.join()) report(null, `섹션은 ${SECTIONS.join(', ')} 순서여야 한다 (실제: ${order.join(', ')})`)
  const section = (name: string) => sections.find((candidate) => candidate.name === name)

  /** 항목의 필드가 required를 모두 갖고 allowed 밖의 필드가 없는지 */
  const fieldsOf = (where: string, item: Item, required: string[], allowed = required) => {
    const map = new Map(item.fields.map((field) => [field.key, field]))
    for (const field of item.fields) {
      if (!allowed.includes(field.key)) report(field.line, `${where}: 허용하지 않는 필드 '${field.key}'`)
      else if (field.value === '') report(field.line, `${where}: ${field.key}가 비었다`)
    }
    for (const key of required) if (!map.has(key)) report(item.line, `${where}: ${key} 필드가 없다`)
    return map
  }
  const requireLife = (where: string, field: Field | undefined) => {
    if (field != null && field.value !== '' && lifeTargets(field.value).length === 0) report(field.line, `${where}: ${field.key}에 [life:<항목>] 인용이 없다`)
  }

  // 주인공: 축과 반복되는 실패. 근거는 life.md의 같은 이름 항목이다.
  const protagonist = section('주인공')
  if (protagonist != null) {
    const names = protagonist.items.map(({ name }) => name)
    if (names.join() !== PROTAGONIST.join()) report(protagonist.line, `주인공: 항목은 ${PROTAGONIST.join(', ')} 순서여야 한다 (실제: ${names.join(', ')})`)
    for (const item of protagonist.items) {
      const basis = fieldsOf(`주인공 > ${item.name}`, item, ['내용', '근거']).get('근거')
      if (basis != null && basis.value !== '' && !lifeTargets(basis.value).includes(item.name)) report(basis.line, `주인공 > ${item.name}: 근거에 [life:${item.name}]이 없다`)
    }
  }

  // 장: 모험이 걸친 생애 단계를 연표 순서로. 근거는 그 단계다.
  const chapters = section('장')
  const chapterNames = chapters?.items.map(({ name }) => name) ?? []
  if (chapters != null) {
    if (chapters.items.length === 0) report(chapters.line, '장: 장 항목이 없다')
    const known = chapterNames.filter((name) => STAGE_NAMES.includes(name))
    if (known.join() !== [...known].sort((a, b) => STAGE_NAMES.indexOf(a) - STAGE_NAMES.indexOf(b)).join() || new Set(known).size !== known.length) {
      report(chapters.line, `장: 생애 단계는 연표 순서로 한 번씩 쓴다 (실제: ${chapterNames.join(', ')})`)
    }
    for (const item of chapters.items) {
      const where = `장 > ${item.name}`
      if (!STAGE_NAMES.includes(item.name)) report(item.line, `${where}: 생애 단계 이름이 아니다`)
      const basis = fieldsOf(where, item, ['사건', '근거']).get('근거')
      if (basis != null && basis.value !== '' && !lifeTargets(basis.value).includes(item.name)) report(basis.line, `${where}: 근거에 [life:${item.name}]이 없다`)
    }
  }

  // 동료: 후보 줄은 계산 결과와 같고, 동료는 후보 안에서만, 동행하는 장은 곁에 있던 시기와 브리프의 장 안에서만 고른다.
  const chosen = new Set<string>()
  const companions = section('동료')
  if (companions != null) {
    const expected = candidates.length === 0 ? '없음' : candidates.map(({ name }) => name).join(', ')
    const listed = companions.fields.find((field) => field.key === '후보')
    if (listed == null) report(companions.line, '동료: 후보 줄이 없다')
    else if (listed.value !== expected) report(listed.line, `동료: 후보 '${listed.value}' — 계산 결과 '${expected}'`)
    const alone = companions.fields.find((field) => field.key === '혼자')
    for (const field of companions.fields) if (field.key !== '후보' && field.key !== '혼자') report(field.line, `동료: 허용하지 않는 필드 '${field.key}'`)
    if (alone != null && alone.value === '') report(alone.line, '동료: 혼자의 이유가 비었다')
    if (alone != null && companions.items.length > 0) report(alone.line, '동료: 동료 항목과 혼자를 함께 쓸 수 없다')
    if (alone == null && companions.items.length === 0) report(companions.line, '동료: 동료 항목이나 `혼자: <이유>`가 필요하다')
    for (const item of companions.items) {
      const where = `동료 > ${item.name}`
      const candidate = candidates.find(({ name }) => name === item.name)
      if (candidate == null) report(item.line, `${where}: 동료 후보가 아니다 (후보: ${expected})`)
      else chosen.add(item.name)
      const fields = fieldsOf(where, item, ['동행하는 장', '함께 하는 일', '근거'])
      const stages = fields.get('동행하는 장')
      for (const stage of stages?.value.split(',').map((part) => part.trim()).filter(Boolean) ?? []) {
        if (!STAGE_NAMES.includes(stage)) report(stages!.line, `${where}: '${stage}'는 생애 단계 이름이 아니다`)
        else if (candidate != null && !candidate.stages.includes(stage)) report(stages!.line, `${where}: ${stage}는 곁에 있던 시기(${candidate.stages.join(', ')}) 밖이다`)
        else if (chapters != null && !chapterNames.includes(stage)) report(stages!.line, `${where}: ${stage}는 브리프의 장이 아니다`)
      }
      const basis = fields.get('근거')
      if (basis != null && !lifeTargets(basis.value).includes(item.name)) report(basis.line, `${where}: 근거에 [life:${item.name}]이 없다`)
    }
  }

  // 주인공 능력: 출처는 재능 항목이다. 관계는 능력의 출처가 아니다(#71).
  const abilities = section('주인공 능력')
  if (abilities != null && abilities.items.length === 0) report(abilities.line, '주인공 능력: 능력 항목이 없다')
  for (const item of abilities?.items ?? []) {
    const where = `주인공 능력 > ${item.name}`
    const source = fieldsOf(where, item, ['출처', '다루는 것', '약점']).get('출처')
    requireLife(where, source)
    for (const target of lifeTargets(source?.value ?? '')) {
      if (isLivelihood(target)) report(source!.line, `${where}: 출처 [life:${target}]는 생업 항목이다 (생업은 능력의 출처가 아니다)`)
      else if (!talents.has(target)) report(source!.line, `${where}: 출처 [life:${target}]는 재능 항목이 아니다 (관계는 능력의 출처가 아니다)`)
    }
  }

  // 배경: 네 항목, 세 단계 해석 경로, life 인용
  const background = section('배경')
  if (background != null) {
    const names = background.items.map(({ name }) => name)
    if (names.join() !== BACKGROUND.join()) report(background.line, `배경: 항목은 ${BACKGROUND.join(', ')} 순서여야 한다 (실제: ${names.join(', ')})`)
    for (const item of background.items) {
      const where = `배경 > ${item.name}`
      const fields = fieldsOf(where, item, item.name === '출신지' ? ['경로', '장소의 사정', '근거'] : ['경로', '근거'], ['경로', '장소의 사정', '근거'])
      const path = fields.get('경로')
      if (path != null && path.value !== '') {
        const steps = path.value.split('→').map((step) => step.trim())
        if (steps.length !== 3 || steps.some((step) => step === '')) report(path.line, `${where}: 경로는 '→'로 이은 세 단계여야 한다`)
      }
      requireLife(where, fields.get('근거'))
    }
  }

  // 동기와 퀘스트
  const quests = section('동기와 퀘스트')
  if (quests != null && quests.items.length === 0) report(quests.line, '동기와 퀘스트: 퀘스트 항목이 없다')
  const questPeople = new Set<string>()
  for (const item of quests?.items ?? []) {
    const where = `동기와 퀘스트 > ${item.name}`
    const material = fieldsOf(where, item, ['내용', '재료']).get('재료')
    requireLife(where, material)
    for (const target of lifeTargets(material?.value ?? '')) questPeople.add(target)
  }

  // 옮기지 않은 인물과 인물 사전 8칸의 행방
  const leftOut = new Set<string>()
  for (const bullet of section('옮기지 않은 인물')?.bullets ?? []) {
    if (!CAST.includes(bullet.name)) report(bullet.line, `옮기지 않은 인물: '${bullet.name}'는 인물 사전 칸이 아니다`)
    if (bullet.reason === '') report(bullet.line, `옮기지 않은 인물 > ${bullet.name}: 이유가 비었다`)
    leftOut.add(bullet.name)
  }
  for (const person of CAST) {
    if (!chosen.has(person) && !questPeople.has(person) && !leftOut.has(person)) report(null, `인물 사전 > ${person}: 동료·퀘스트 재료·옮기지 않은 인물 어디에도 없다`)
  }

  // 인용과 차트 명칭
  for (const [index, line] of brief.split('\n').entries()) {
    for (const { tag, target } of citations(line)) {
      if (tag !== 'life') report(index + 1, `[${tag}:${target}] — 번역 브리프는 [life:<항목>]만 인용한다`)
      else if (!itemNames.has(target)) report(index + 1, `[life:${target}] — life.md에 없는 항목`)
    }
  }
  errors.push(...chartNameErrors(brief))
  return errors
}

if (import.meta.main) {
  const [dir] = process.argv.slice(2)
  if (dir == null) {
    console.error('usage: bun scripts/check-translation-brief.ts <차트 디렉터리>')
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
  const errors = checkTranslationBrief({ brief: read('translation-brief.md'), life: read('life.md') })
  for (const error of errors) console.log(error)
  process.exit(errors.length > 0 ? 1 : 0)
}
