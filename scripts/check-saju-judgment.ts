/**
 * 사주 1차 판단 문서(saju-judgment.md)의 구조와 근거 인용을 검사한다.
 * 판단 내용의 옳고 그름은 보지 않는다. 계약: docs/spec/saju-first-pass-judgment.md
 */
import { chartTitles, checkJudgmentDocument, factItems, runJudgmentCli } from './judgment-document.ts'

const ELEMENTS = ['木', '火', '土', '金', '水']
const POSITIONS = ['時', '日', '月', '年'].flatMap((pillar) => ['干', '支', '柱'].map((part) => pillar + part))

export interface SajuJudgmentInput { judgment: string; chart: string; facts: string }

/** 차트 표의 천간·지지 행에서 時日月年 간지를 읽는다. */
function chartPillars(chart: string): string {
  const row = (label: string) => chart.split('\n').find((line) => line.startsWith(label))!.split(/\s+/).slice(1)
  const stems = row('천간')
  const branches = row('지지')
  return stems.map((stem, index) => stem + branches[index]).join(' ')
}

export function checkSajuJudgment({ judgment, chart, facts }: SajuJudgmentInput): string[] {
  return checkJudgmentDocument(judgment, {
    title: '# 四柱 1차 판단',
    identity: { key: '원국', expected: chartPillars(chart) },
    sections: [
      { name: '일간 강약', allowed: ['신강', '신약', '중화'] },
      { name: '격국', allowed: null },
      { name: '조후', allowed: ['한습', '난조', '불필요'] },
      { name: '용신', allowed: ELEMENTS, extra: { key: '기준', allowed: ['억부', '조후', '통관', '병약', '전왕'] } },
      { name: '희신', allowed: ELEMENTS },
      { name: '기신', allowed: ELEMENTS },
    ],
    facts: { file: 'saju-facts.md', items: factItems(facts) },
    chart: { file: 'saju-chart.md', names: new Set([...chartTitles(chart), ...POSITIONS]) },
    distinct: [['용신', '희신', '기신']],
  })
}

if (import.meta.main) {
  runJudgmentCli('check-saju-judgment.ts', { judgment: 'saju-judgment.md', chart: 'saju-chart.md', facts: 'saju-facts.md' }, checkSajuJudgment)
}
