/**
 * 자미두수 1차 판단 문서(ziwei-judgment.md)의 구조와 근거 인용을 검사한다.
 * 판단 내용의 옳고 그름은 보지 않는다. 계약: docs/spec/ziwei-first-pass-judgment.md
 */
import { PALACE_NAMES } from '@orrery/core/constants'

import { chartTitles, checkJudgmentDocument, factItems, RELATION_SECTIONS, runJudgmentCli } from './judgment-document.ts'

export interface ZiweiJudgmentInput { judgment: string; chart: string; facts: string }

/** 차트 머리의 '命宮: 乙酉' 같은 줄 값 */
function headerValue(chart: string, key: string): string {
  return chart.split('\n').find((line) => line.startsWith(`${key}:`))!.slice(key.length + 1).trim()
}

/** 차트 머리의 命宮·身宮·五行局으로 만든 명반 신원 줄 값 */
export function ziweiIdentity(chart: string): string {
  return `命宮 ${headerValue(chart, '命宮')} · 身宮 ${headerValue(chart, '身宮')} · ${headerValue(chart, '五行局')}`
}

export function checkZiweiJudgment({ judgment, chart, facts }: ZiweiJudgmentInput): string[] {
  return checkJudgmentDocument(judgment, {
    title: '# 紫微斗數 1차 판단',
    identity: { key: '명반', expected: ziweiIdentity(chart) },
    sections: [
      { name: '명궁 역량', allowed: ['강', '중', '약'] },
      { name: '격국', allowed: null },
      { name: '강점 궁', allowed: PALACE_NAMES },
      { name: '과제 궁', allowed: PALACE_NAMES },
      ...RELATION_SECTIONS,
    ],
    facts: { file: 'ziwei-facts.md', items: factItems(facts) },
    // 流年·流月은 --flow-year에 따라 바뀌고 大限은 시기 해석이라 본명반 1차 판단의 근거로 쓰지 않는다.
    chart: { file: 'ziwei-chart.md', names: new Set([...chartTitles(chart), ...PALACE_NAMES]), forbidden: ['流年', '流月', '大限'] },
    distinct: [['강점 궁', '과제 궁']],
  })
}

if (import.meta.main) {
  runJudgmentCli('check-ziwei-judgment.ts', { judgment: 'ziwei-judgment.md', chart: 'ziwei-chart.md', facts: 'ziwei-facts.md' }, checkZiweiJudgment)
}
