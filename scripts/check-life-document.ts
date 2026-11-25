/**
 * 체계별 일생 해석 문서(<체계>-life.md)를 검사한다. 계약: docs/spec/life-narrative-interpretation.md
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { PALACE_NAMES } from '@orrery/core/constants'

import { chartPillars, POSITIONS } from './check-saju-judgment.ts'
import { natalIdentity, PLANETS } from './check-natal-judgment.ts'
import { ziweiIdentity } from './check-ziwei-judgment.ts'
import { chartTitles, factItems, readConclusions } from './judgment-document.ts'
import { checkLifeDocument as checkStructure, type LifeSection, readLifeItems, stageLines } from './life-document.ts'
import { LIFE_STAGES } from './life-stages.ts'
import { checkRelations, RELATION_ITEMS, WEIGHT_FIELDS } from './life-relations.ts'

export interface LifeTexts { life: string; chart: string; facts: string; judgment: string; derived?: string }

export const TIMELINE: LifeSection = {
  name: '생애 연표',
  items: LIFE_STAGES.map((stage) => stage.name),
  fields: ['운', '주제', '전환점', '인연', '시련', '얻는 것', '잃는 것', '성격 변화', '근거'],
}
/**
 * 주인공이 자란 환경. 인물이 아니라 조건(생활 기반·지원·기대·제약)이다. 뿌리와 자란 집은 집안이 무엇을 다루며 먹고살았는지(생활 기반)를 쓴다.
 * 계약: docs/spec/life-narrative-interpretation.md 3절
 */
export const BACKGROUND: LifeSection = {
  name: '배경',
  items: ['뿌리', '자란 집', '떠남의 조건'],
  fields: ['모습', '준 것', '막은 것', '근거'],
  itemFields: { 뿌리: ['생활 기반'], '자란 집': ['생활 기반'] },
}
export const CAST = ['부모', '형제·또래', '연인·배우자', '자녀', '제자', '벗·동료', '스승·후원자', '경쟁자·적대자']
/** 인물 사전 필드. 상태는 RELATION_ITEMS 칸에만 있다 (docs/spec/life-shape-and-relationship-status.md 5.2·5.4) */
export const CAST_FIELDS = ['성향', '주인공과의 관계', '관계의 변화', ...WEIGHT_FIELDS, '근거']
export const CAST_ITEM_FIELDS = Object.fromEntries(Object.keys(RELATION_ITEMS).map((name) => [name, ['상태']]))

/** 생애 연표가 있는 체계는 관계의 변화·꽃피는 시기에 생애 단계를 쓴다. */
function commonSections(timeline: boolean): LifeSection[] {
  return [
    { name: '인물 사전', items: CAST, fields: CAST_FIELDS, itemFields: CAST_ITEM_FIELDS, stageFields: timeline ? ['관계의 변화'] : [] },
    { name: '재능과 생업', items: ['주 재능', '보조 재능'], extraItems: true, fields: ['내용', '다루는 것', '꽃피는 시기', '막히는 조건', '근거'], stageFields: timeline ? ['꽃피는 시기'] : [], livelihood: { timeline } },
    { name: '상처와 회복', items: ['반복되는 실패', '상실', '회복'], fields: ['내용', '발현 조건', '근거'] },
  ]
}

/**
 * 배경 항목마다 근거에 있어야 하는 자리(하나 이상)와 배경 절에서 쓰지 않는 본인 자리.
 * 본인 자리에서 읽은 성향·재능·생업을 환경으로 쓰는 실수를 막는다(#97). 계약: docs/spec/life-narrative-interpretation.md 3절
 */
interface BackgroundRule { items: Record<string, string[]>; forbidden: string[] }

const YEAR = ['[chart:年柱]', '[chart:年干]', '[chart:年支]']
const MONTH = ['[chart:月柱]', '[chart:月干]', '[chart:月支]']
const BACKGROUND_RULES: Record<'saju' | 'ziwei' | 'natal', BackgroundRule> = {
  saju: {
    items: {
      뿌리: YEAR,
      '자란 집': MONTH,
      '떠남의 조건': [...YEAR, ...MONTH, '[chart:八字關係]', '[facts:생애 단계별 大運]', '[derived:생애 단계별 운 기조]'],
    },
    // 日柱는 본인과 배우자, 時柱는 자녀와 늦은 시기의 자리다. 재능이 드러나는 자리라 배경의 근거로 쓰면 재능이 집안 내력으로 들어간다.
    forbidden: ['[chart:日干]', '[chart:日支]', '[chart:日柱]', '[chart:時干]', '[chart:時支]', '[chart:時柱]', '[judgment:일간 강약]'],
  },
  ziwei: {
    items: { 뿌리: ['[chart:父母]', '[chart:福德]'], '자란 집': ['[chart:田宅]', '[chart:父母]'], '떠남의 조건': ['[chart:遷移]'] },
    // 官祿·財帛은 본인의 일과 재물 자리다.
    forbidden: ['[chart:命宮]', '[chart:官祿]', '[chart:財帛]', '[facts:명궁 주성]', '[facts:명궁 삼방사정]', '[facts:삼방사정 보조성 수]', '[judgment:명궁 역량]', '[judgment:격국]'],
  },
  // 하우스는 하나씩 인용할 이름이 없어 하우스 표나 하우스별 사실 한 항목으로 인용된다. 어느 하우스를 읽었는지는 스킬 지침과 의미 검토가 맡는다.
  natal: {
    items: {
      뿌리: ['[facts:하우스별 룰러와 행성]', '[chart:Houses]'],
      '자란 집': ['[facts:하우스별 룰러와 행성]', '[chart:Houses]', '[chart:MC]'],
      '떠남의 조건': ['[facts:하우스별 룰러와 행성]', '[chart:Houses]'],
    },
    // 주요 행성·우세 원소는 본인의 재능·기질을 읽는 판단이다.
    forbidden: ['[chart:ASC]', '[facts:ASC]', '[facts:차트 룰러]', '[judgment:차트 룰러 상태]', '[judgment:주요 행성]', '[judgment:우세 원소]'],
  },
}

/** 배경 절의 인용이 자리 규칙을 따르는지 */
function backgroundCitations(life: string, rule: BackgroundRule): string[] {
  const errors: string[] = []
  for (const { section, name, fields } of readLifeItems(life)) {
    if (section !== BACKGROUND.name) continue
    const citations = fields.flatMap(([, value]) => value.match(/\[[a-z]+:[^\]]*\]/g) ?? [])
    for (const citation of new Set(citations.filter((c) => rule.forbidden.includes(c)))) {
      errors.push(`배경 > ${name}: ${citation}는 본인을 가리키는 자리라 배경의 근거로 쓰지 않는다`)
    }
    const required = rule.items[name]
    const basis = fields.find(([key]) => key === '근거')?.[1] ?? ''
    if (required != null && basis !== '' && !required.some((citation) => basis.includes(citation))) {
      errors.push(`배경 > ${name}: 근거에 ${required.join(' ')} 중 하나가 없다`)
    }
  }
  return errors
}

const SYSTEMS = {
  saju: (texts: LifeTexts) => checkStructure(texts.life, {
    title: '# 四柱 일생 해석',
    identity: { key: '원국', expected: chartPillars(texts.chart), file: 'saju-chart.md' },
    sections: [BACKGROUND, TIMELINE, ...commonSections(true)],
    luck: { file: 'saju-facts.md', expected: stageLines(texts.facts, '생애 단계별 大運') },
    citations: {
      facts: { file: 'saju-facts.md', items: factItems(texts.facts) },
      chart: { file: 'saju-chart.md', names: new Set([...chartTitles(texts.chart), ...POSITIONS]) },
      judgment: { file: 'saju-judgment.md', sections: new Set(readConclusions(texts.judgment).keys()) },
      derived: { file: 'saju-derived-facts.md', items: factItems(texts.derived!) },
    },
  }),
  ziwei: (texts: LifeTexts) => checkStructure(texts.life, {
    title: '# 紫微斗數 일생 해석',
    identity: { key: '명반', expected: ziweiIdentity(texts.chart), file: 'ziwei-chart.md' },
    sections: [BACKGROUND, TIMELINE, ...commonSections(true)],
    luck: { file: 'ziwei-facts.md', expected: stageLines(texts.facts, '생애 단계별 大限') },
    citations: {
      facts: { file: 'ziwei-facts.md', items: factItems(texts.facts) },
      // 大限은 일생 해석의 시기 근거라 쓸 수 있고, 조회 연도에 따라 바뀌는 流年·流月만 막는다.
      chart: { file: 'ziwei-chart.md', names: new Set([...chartTitles(texts.chart), ...PALACE_NAMES]), forbidden: ['流年', '流月'] },
      judgment: { file: 'ziwei-judgment.md', sections: new Set(readConclusions(texts.judgment).keys()) },
      derived: { file: 'ziwei-derived-facts.md', items: factItems(texts.derived!) },
    },
  }),
  // 시기 계산이 없어 생애 연표·판단 파생 사실이 없고, 관계의 변화·꽃피는 시기는 단계 대신 조건으로 쓴다.
  natal: (texts: LifeTexts) => checkStructure(texts.life, {
    title: '# Natal 일생 해석',
    identity: { key: '차트', expected: natalIdentity(texts.chart), file: 'natal-chart.md' },
    sections: [BACKGROUND, ...commonSections(false)],
    citations: {
      facts: { file: 'natal-facts.md', items: factItems(texts.facts) },
      chart: { file: 'natal-chart.md', names: new Set([...chartTitles(texts.chart), ...PLANETS, 'ASC', 'MC']) },
      judgment: { file: 'natal-judgment.md', sections: new Set(readConclusions(texts.judgment).keys()) },
    },
  }),
}

export type LifeSystem = keyof typeof SYSTEMS

/** 1차 판단의 짝·자식·제자 결론을 인물 칸 → 상태로 */
function expectedStatus(judgment: string): Map<string, string> {
  const conclusions = readConclusions(judgment)
  return new Map(Object.entries(RELATION_ITEMS).flatMap(([item, section]) => conclusions.has(section) ? [[item, conclusions.get(section)!]] : []))
}

/** 사주 생애 연표의 근거는 그 단계의 운 기조를 인용한다 (명세 4.3) */
function luckToneCitations(life: string): string[] {
  const errors: string[] = []
  let section = '', stage = ''
  for (const line of life.split('\n')) {
    if (line.startsWith('## ')) section = line.slice(3).trim()
    else if (line.startsWith('### ')) stage = line.slice(4).trim()
    else if (section === '생애 연표' && line.startsWith('근거:') && !line.includes('[derived:생애 단계별 운 기조]')) {
      errors.push(`생애 연표 > ${stage}: 근거에 [derived:생애 단계별 운 기조]가 없다`)
    }
  }
  return errors
}

export function checkLifeDocument(system: LifeSystem, texts: LifeTexts): string[] {
  return [
    ...SYSTEMS[system](texts),
    ...checkRelations(texts.life, { expectedStatus: expectedStatus(texts.judgment), timeline: system !== 'natal' }),
    ...(system === 'saju' ? luckToneCitations(texts.life) : []),
    ...backgroundCitations(texts.life, BACKGROUND_RULES[system]),
  ]
}

if (import.meta.main) {
  const [system, dir] = process.argv.slice(2)
  if (!(system in SYSTEMS) || dir == null) {
    console.error(`usage: bun scripts/check-life-document.ts <${Object.keys(SYSTEMS).join('|')}> <차트 디렉터리>`)
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
  const errors = checkLifeDocument(system as LifeSystem, {
    life: read(`${system}-life.md`),
    chart: read(`${system}-chart.md`),
    facts: read(`${system}-facts.md`),
    judgment: read(`${system}-judgment.md`),
    derived: system === 'natal' ? undefined : read(`${system}-derived-facts.md`),
  })
  for (const error of errors) console.log(error)
  process.exit(errors.length > 0 ? 1 : 0)
}
