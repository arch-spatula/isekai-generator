/**
 * GDD(`gdd.md`)의 절 구성, 장·동료와 앞 단계의 대응, 인용, 차트 명칭과 제외 메커니즘을 검사한다. 본문은 문단으로 쓴다.
 * 계약: docs/spec/claude-game-design-flow.md 4·5.4·6절
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkCitationsAndNames, citationsIn, headingNames, itemNames, parseGameDocument, sectionItemNames, type Report } from './game-document.ts'

const SECTIONS = ['게임 개요', '주인공', '동료', '세계와 장', '전투', '런과 성장', '서사의 변화', '대표 장면', '크레딧']
const BACKGROUND = ['출신지', '성장 환경', '가족 구조', '떠남의 계기']

interface Block { name: string; line: number; text: string; items: { name: string; line: number; text: string }[] }

export interface GddTexts { gdd: string; brief: string; combat: string; world: string; identity: string }

function parse(gdd: string): Block[] {
  const blocks: Block[] = []
  for (const [index, line] of gdd.split('\n').entries()) {
    if (index === 0) continue
    const block = blocks.at(-1)
    if (line.startsWith('## ')) blocks.push({ name: line.slice(3).trim(), line: index + 1, text: '', items: [] })
    else if (line.startsWith('### ') && block != null) block.items.push({ name: line.slice(4).trim(), line: index + 1, text: '' })
    else if (block != null) {
      const item = block.items.at(-1)
      if (item != null) item.text += `${line}\n`
      block.text += `${line}\n`
    }
  }
  return blocks
}

/** 세계 설계의 지역 이름 → 장 */
function regionChapters(world: string): Map<string, string> {
  const result = new Map<string, string>()
  let section = '', region = ''
  for (const line of world.split('\n')) {
    if (line.startsWith('## ')) section = line.slice(3).trim()
    else if (line.startsWith('### ')) region = line.slice(4).trim()
    else if (section === '지역' && line.startsWith('장:')) result.set(region, line.slice(2).trim())
  }
  return result
}

/** 문서 한 절의 첫 항목 이름과 그 플레이어용 이름 */
function namedItem(text: string, section: string): { name: string; player: string } | null {
  const item = parseGameDocument(text, '', () => {}).find((candidate) => candidate.name === section)?.items[0]
  const player = item?.fields.find((field) => field.key === '플레이어용 이름')?.value
  return item == null || player == null || player === '' ? null : { name: item.name, player }
}

/** 정체성에서 의뢰 필드가 있는 부직업 이름 */
function subJobsWithRequests(identity: string): string[] {
  const items = parseGameDocument(identity, '', () => {}).find((candidate) => candidate.name === '부직업')?.items ?? []
  return items.filter((item) => item.fields.some((field) => field.key === '의뢰' && field.value !== '')).map(({ name }) => name)
}

export function checkGdd({ gdd, brief, combat, world, identity }: GddTexts): string[] {
  const errors: string[] = []
  const report: Report = (line, message) => errors.push(line == null ? message : `${line}: ${message}`)
  if (!/^# \S/.test(gdd.split('\n')[0])) report(1, "첫 줄은 '# <게임 제목>'이어야 한다")

  const blocks = parse(gdd)
  const order = blocks.map(({ name }) => name)
  if (order.join() !== SECTIONS.join()) report(null, `섹션은 ${SECTIONS.join(', ')} 순서여야 한다 (실제: ${order.join(', ')})`)
  const block = (name: string) => blocks.find((candidate) => candidate.name === name)
  const cites = (text: string, tag: string) => citationsIn(text).filter((citation) => citation.tag === tag).map(({ target }) => target)

  for (const { name, line, text } of blocks) {
    if (text.trim() === '') report(line, `${name}: 본문이 없다`)
    else if (citationsIn(text).length === 0) report(line, `${name}: [brief:]·[identity:]·[combat:]·[world:] 인용이 없다`)
  }

  // 주인공: 배경 네 항목과 정체성의 클래스·부직업을 모두 인용한다(#86).
  const protagonist = block('주인공')
  if (protagonist != null) {
    const cited = cites(protagonist.text, 'brief')
    for (const name of BACKGROUND) if (!cited.includes(name)) report(protagonist.line, `주인공: [brief:${name}]을 인용하지 않았다`)
    const role = cites(protagonist.text, 'identity')
    const classes = sectionItemNames(identity, '클래스')
    if (!classes.some((name) => role.includes(name))) report(protagonist.line, `주인공: 클래스 [identity:${classes[0] ?? '<클래스>'}]를 인용하지 않았다`)
    // 부직업은 여러 개일 수 있고, 그 조합이 이 사람다움이므로 모두 잇는다(#120).
    for (const name of sectionItemNames(identity, '부직업')) if (!role.includes(name)) report(protagonist.line, `주인공: 부직업 [identity:${name}]를 인용하지 않았다`)
  }

  // 의뢰가 있는 부직업은 퀘스트를 주는 자리다. 세계와 장이나 런과 성장에서 그 부직업을 인용한다(#120).
  const questBlocks = ['세계와 장', '런과 성장'].map(block).filter((found) => found != null)
  const questCited = questBlocks.flatMap((found) => cites(found.text, 'identity'))
  for (const name of subJobsWithRequests(identity)) {
    if (!questCited.includes(name)) report(block('세계와 장')?.line ?? null, `세계와 장: 의뢰가 있는 부직업 [identity:${name}]을 세계와 장이나 런과 성장에서 인용하지 않았다`)
  }

  // 동료: 브리프의 동료마다 항목 하나. 동료가 없으면 항목 없이 혼자인 이유를 쓴다.
  const companions = sectionItemNames(brief, '동료')
  const companionBlock = block('동료')
  if (companionBlock != null) {
    const written = companionBlock.items.map(({ name }) => name)
    for (const name of companions) if (!written.includes(name)) report(companionBlock.line, `동료: 브리프의 동료 '${name}' 항목이 없다`)
    for (const item of companionBlock.items) {
      if (!companions.includes(item.name)) report(item.line, `동료 > ${item.name}: 브리프의 동료가 아니다`)
      else if (!cites(item.text, 'brief').includes(item.name)) report(item.line, `동료 > ${item.name}: [brief:${item.name}]을 인용하지 않았다`)
    }
  }

  // 세계와 장: 브리프의 장마다 항목 하나를 순서대로, 그 장의 지역을 인용한다.
  const chapters = sectionItemNames(brief, '장')
  const regions = regionChapters(world)
  const worldBlock = block('세계와 장')
  if (worldBlock != null) {
    const written = worldBlock.items.map(({ name }) => name)
    if (written.join() !== chapters.join()) report(worldBlock.line, `세계와 장: 항목은 브리프의 장 ${chapters.join(', ')} 순서여야 한다 (실제: ${written.join(', ')})`)
    for (const item of worldBlock.items) {
      if (!chapters.includes(item.name)) continue
      if (!cites(item.text, 'world').some((region) => regions.get(region) === item.name)) report(item.line, `세계와 장 > ${item.name}: 이 장의 지역을 [world:<지역>]으로 인용하지 않았다`)
    }
  }

  // 전투는 전투 설계를, 런과 성장은 전투 설계와 브리프의 능력을, 서사의 변화는 퀘스트나 서사 갈등을 인용한다.
  const abilities = sectionItemNames(brief, '주인공 능력'), quests = sectionItemNames(brief, '동기와 퀘스트'), conflicts = sectionItemNames(world, '서사 갈등')
  const combatBlock = block('전투')
  if (combatBlock != null && cites(combatBlock.text, 'combat').length === 0) report(combatBlock.line, '전투: [combat:<제목>] 인용이 없다')
  const run = block('런과 성장')
  if (run != null) {
    if (cites(run.text, 'combat').length === 0) report(run.line, '런과 성장: [combat:<제목>] 인용이 없다')
    if (!cites(run.text, 'brief').some((target) => abilities.includes(target))) report(run.line, '런과 성장: 성장의 출처인 [brief:<주인공 능력>] 인용이 없다')
  }
  const story = block('서사의 변화')
  if (story != null && !cites(story.text, 'brief').some((target) => quests.includes(target)) && !cites(story.text, 'world').some((target) => conflicts.includes(target))) {
    report(story.line, '서사의 변화: [brief:<퀘스트>]나 [world:<서사 갈등>] 인용이 없다')
  }

  // 끌림 시스템은 런과 성장에 나온다(#112). 크레딧은 플레이어용 이름마다 설계 항목을 인용해 출처를 밝힌다(#114).
  const klass = namedItem(identity, '클래스'), draw = namedItem(combat, '끌림')
  if (run != null && draw != null && !cites(run.text, 'combat').includes(draw.name)) report(run.line, `런과 성장: 끌림 [combat:${draw.name}] 인용이 없다`)
  const credits = block('크레딧')
  if (credits != null) {
    for (const [label, named, tag] of [['클래스', klass, 'identity'], ['끌림', draw, 'combat']] as const) {
      if (named == null) continue
      const item = credits.items.find(({ name }) => name === named.player)
      if (item == null) report(credits.line, `크레딧: ${label}의 플레이어용 이름 '${named.player}' 항목이 없다`)
      else if (!cites(item.text, tag).includes(named.name)) report(item.line, `크레딧 > ${named.player}: [${tag}:${named.name}]을 인용하지 않았다`)
    }
  }

  checkCitationsAndNames(gdd, { brief: itemNames(brief), identity: itemNames(identity), combat: headingNames(combat), world: headingNames(world) }, report, true)
  return errors
}

if (import.meta.main) {
  const [dir] = process.argv.slice(2)
  if (dir == null) {
    console.error('usage: bun scripts/check-gdd.ts <차트 디렉터리>')
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
  const errors = checkGdd({ gdd: read('gdd.md'), brief: read('translation-brief.md'), identity: read('identity.md'), combat: read('combat.md'), world: read('world.md') })
  for (const error of errors) console.log(error)
  process.exit(errors.length > 0 ? 1 : 0)
}
