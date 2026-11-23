/**
 * 1차 판단 결론을 입력으로 받아 결정론적으로 계산되는 사실(판단 파생 사실)을 만든다.
 * 판단 문서가 검증기를 통과해야 하고, 결과 파일이 이미 있으면 쓰지 않는다.
 * 계약: docs/spec/life-narrative-interpretation.md
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BRANCH_ELEMENT, ELEMENT_HANJA, STEM_INFO } from '@orrery/core/constants'

import { checkSajuJudgment } from './check-saju-judgment.ts'
import { checkZiweiJudgment } from './check-ziwei-judgment.ts'
import { readConclusions } from './judgment-document.ts'
import { LIFE_STAGES, overlaps } from './life-stages.ts'

/** ' 1運 ( 8세)  偏財  庚辰  食神  (2008年)' */
const DAEWOON_LINE = /^\s*(\d+)運 \(\s*(\d+)세\)\s+\S+\s+(\S\S)\s/
/** '  2- 11歲  命宮  乙酉  (空宮)' */
const DAXIAN_LINE = /^\s*(\d+)-\s*(\d+)歲\s+(\S+)\s+(\S\S)/

/** 천간·지지 역할로 정하는 大運 기조. 계약: docs/spec/life-shape-and-relationship-status.md 4.1 */
export function luckTone(stemRole: string, branchRole: string): string {
  const favorable = (role: string) => role === '용신' || role === '희신'
  const roles = [stemRole, branchRole]
  const good = roles.filter(favorable).length, bad = roles.filter((role) => role === '기신').length
  if (good > 0 && bad > 0) return '혼조'
  if (good > 0) return '순풍'
  if (bad > 0) return '역풍'
  return '평이'
}

/** 출생 연도 차 구간과 겹치는 생애 단계 이름 */
function stages(from: number, to: number): string {
  return LIFE_STAGES.filter((stage) => overlaps(stage, from, to)).map((stage) => stage.name).join('·')
}

export function sajuDerivedFacts(chart: string, judgment: string): string {
  const conclusions = readConclusions(judgment)
  const roles: [string, string][] = ['용신', '희신', '기신'].map((role) => [role, conclusions.get(role)!])
  const roleOf = (element: string) => roles.find(([, value]) => value === element)?.[0] ?? '해당 없음'

  const daewoon = chart.split('\n').flatMap((line) => {
    const match = line.match(DAEWOON_LINE)
    return match == null ? [] : [{ index: match[1], age: Number(match[2]), ganzi: match[3] }]
  })
  const lines = [
    `四柱 판단 파생 사실 (1차 판단 ${roles.map(([role, value]) => `${role} ${value}`).join(' · ')} 기준)`,
    '─────',
    '大運별 용신·희신·기신 (大運 천간과 지지 자체 오행, 나이는 출생 연도 차, 괄호는 겹치는 생애 단계):',
  ]
  const tones: { from: number; to: number; tone: string }[] = []
  daewoon.forEach(({ index, age, ganzi }, position) => {
    const to = (daewoon[position + 1]?.age ?? age + 10) - 1
    const [stem, branch] = [...ganzi]
    const stemElement = ELEMENT_HANJA[STEM_INFO[stem].element]
    const branchElement = ELEMENT_HANJA[BRANCH_ELEMENT[branch]]
    const tone = luckTone(roleOf(stemElement), roleOf(branchElement))
    tones.push({ from: age, to, tone })
    lines.push(`  ${index}運 ${ganzi} ${age}–${to} (${stages(age, to)}): ${
      `${stem} ${stemElement} ${roleOf(stemElement)} · ${branch} ${branchElement} ${roleOf(branchElement)} · ${tone}`}`)
  })
  lines.push('생애 단계별 운 기조 (단계 나이 구간 안에서 겹치는 大運의 기조, 첫 大運 이전 제외):')
  for (const stage of LIFE_STAGES) {
    const parts = tones.filter(({ from, to }) => overlaps(stage, from, to))
      .map(({ from, to, tone }) => `${tone} ${Math.max(from, stage.from)}–${Math.min(to, stage.to ?? Infinity)}`)
    lines.push(`  ${stage.name} ${stage.from}–${stage.to ?? ''}: ${parts.length > 0 ? parts.join(' → ') : '해당 大運 없음'}`)
  }
  return lines.join('\n')
}

export function ziweiDerivedFacts(chart: string, judgment: string): string {
  const conclusions = readConclusions(judgment)
  const daxian = chart.split('\n').flatMap((line) => {
    const match = line.match(DAXIAN_LINE)
    return match == null ? [] : [{ from: Number(match[1]), to: Number(match[2]), palace: match[3], ganZhi: match[4] }]
  })
  const lines = ['紫微斗數 판단 파생 사실 (1차 판단의 강점 궁·과제 궁이 걸린 大限, 생애 단계는 세는나이 − 1로 대조)', '─────']
  for (const section of ['강점 궁', '과제 궁']) {
    const palace = conclusions.get(section)!
    const { from, to, ganZhi } = daxian.find((item) => item.palace === palace)!
    lines.push(`${section} ${palace}: 大限 ${from}–${to}歲 ${ganZhi} (${stages(from - 1, to - 1)})`)
  }
  return lines.join('\n')
}

const SYSTEMS = {
  saju: { check: checkSajuJudgment, derive: sajuDerivedFacts },
  ziwei: { check: checkZiweiJudgment, derive: ziweiDerivedFacts },
}

if (import.meta.main) {
  const [system, dir] = process.argv.slice(2)
  if (!(system in SYSTEMS) || dir == null) {
    console.error('usage: bun scripts/derive-judgment-facts.ts <saju|ziwei> <차트 디렉터리>')
    process.exit(1)
  }
  const { check, derive } = SYSTEMS[system as keyof typeof SYSTEMS]
  const output = join(dir, `${system}-derived-facts.md`)
  if (existsSync(output)) {
    console.error(`이미 있음: ${output}`)
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
  const texts = { judgment: read(`${system}-judgment.md`), chart: read(`${system}-chart.md`), facts: read(`${system}-facts.md`) }
  const errors = check(texts)
  if (errors.length > 0) {
    console.error(`${system}-judgment.md가 검증을 통과하지 못해 파생 사실을 만들지 않았다:`)
    for (const error of errors) console.error(error)
    process.exit(1)
  }
  writeFileSync(output, `${derive(texts.chart, texts.judgment)}\n`)
}
