/**
 * 체계별 일생 해석 문서(<체계>-life.md)를 검사한다. 계약: docs/spec/life-narrative-interpretation.md
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { chartPillars, POSITIONS } from './check-saju-judgment.ts'
import { chartTitles, factItems, readConclusions } from './judgment-document.ts'
import { checkLifeDocument as checkStructure, type LifeSection, stageLines } from './life-document.ts'
import { LIFE_STAGES } from './life-stages.ts'

export interface LifeTexts { life: string; chart: string; facts: string; judgment: string; derived?: string }

const TIMELINE: LifeSection = {
  name: '생애 연표',
  items: LIFE_STAGES.map((stage) => stage.name),
  fields: ['운', '주제', '전환점', '인연', '시련', '얻는 것', '잃는 것', '성격 변화', '근거'],
}
const CAST = ['부모', '형제·또래', '연인·배우자', '자녀·제자', '벗·동료', '스승·후원자', '경쟁자·적대자']

/** 생애 연표가 있는 체계는 관계의 변화·꽃피는 시기에 생애 단계를 쓴다. */
function commonSections(timeline: boolean): LifeSection[] {
  return [
    { name: '인물 사전', items: CAST, fields: ['성향', '주인공과의 관계', '관계의 변화', '근거'], stageFields: timeline ? ['관계의 변화'] : [] },
    { name: '재능과 생업', items: ['주 재능', '보조 재능'], extraItems: true, fields: ['내용', '꽃피는 시기', '막히는 조건', '근거'], stageFields: timeline ? ['꽃피는 시기'] : [] },
    { name: '상처와 회복', items: ['반복되는 실패', '상실', '회복'], fields: ['내용', '발현 조건', '근거'] },
  ]
}

const SYSTEMS = {
  saju: (texts: LifeTexts) => checkStructure(texts.life, {
    title: '# 四柱 일생 해석',
    identity: { key: '원국', expected: chartPillars(texts.chart) },
    sections: [TIMELINE, ...commonSections(true)],
    luck: { file: 'saju-facts.md', expected: stageLines(texts.facts, '생애 단계별 大運') },
    citations: {
      facts: { file: 'saju-facts.md', items: factItems(texts.facts) },
      chart: { file: 'saju-chart.md', names: new Set([...chartTitles(texts.chart), ...POSITIONS]) },
      judgment: { file: 'saju-judgment.md', sections: new Set(readConclusions(texts.judgment).keys()) },
      derived: { file: 'saju-derived-facts.md', items: factItems(texts.derived!) },
    },
  }),
}

export type LifeSystem = keyof typeof SYSTEMS

export function checkLifeDocument(system: LifeSystem, texts: LifeTexts): string[] {
  return SYSTEMS[system](texts)
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
    derived: read(`${system}-derived-facts.md`),
  })
  for (const error of errors) console.log(error)
  process.exit(errors.length > 0 ? 1 : 0)
}
