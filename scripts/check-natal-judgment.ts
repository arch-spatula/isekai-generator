/**
 * 네이탈 1차 판단 문서(natal-judgment.md)의 구조와 근거 인용을 검사한다.
 * 판단 내용의 옳고 그름은 보지 않는다. 계약: docs/spec/natal-first-pass-judgment.md
 */
import { chartTitles, checkJudgmentDocument, factItems, runJudgmentCli } from './judgment-document.ts'

export const PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']
/** '<기호> <이름> <사인 기호> <사인> …' 줄(Angles·Planets)에서 이름 다음의 사인 */
const POSITION_LINE = /^(?:\S+ )?(ASC|MC|[A-Z][a-z]+(?: [A-Z][a-z]+)?)\s+\S+ ([A-Z][a-z]+)\b/
/** '☉ Sun        □ ☽ Moon       orb 0.1°' */
const ASPECT_LINE = /^\S+ ([A-Za-z]+(?: [A-Za-z]+)?)\s+([□☍△⚹☌])\s+\S+ ([A-Za-z]+(?: [A-Za-z]+)?)\s+orb /

export interface NatalJudgmentInput { judgment: string; chart: string; facts: string }

function signOf(chart: string, name: string): string {
  return chart.split('\n').map((line) => line.match(POSITION_LINE)).find((match) => match?.[1] === name)![2]
}

/** Major Aspects의 □·☍를 차트에 적힌 순서대로 '<행성> <기호> <행성>'으로 */
function hardAspects(chart: string): string[] {
  return chart.split('\n').flatMap((line) => {
    const match = line.match(ASPECT_LINE)
    return match != null && (match[2] === '□' || match[2] === '☍') ? [`${match[1]} ${match[2]} ${match[3]}`] : []
  })
}

/** 'ASC <사인> · Sun <사인> · Moon <사인> · <하우스 시스템>' */
export function natalIdentity(chart: string): string {
  const houseSystem = chart.match(/^Houses \((.+)\)$/m)![1]
  return `ASC ${signOf(chart, 'ASC')} · Sun ${signOf(chart, 'Sun')} · Moon ${signOf(chart, 'Moon')} · ${houseSystem}`
}

export function checkNatalJudgment({ judgment, chart, facts }: NatalJudgmentInput): string[] {
  return checkJudgmentDocument(judgment, {
    title: '# Natal 1차 판단',
    identity: { key: '차트', expected: natalIdentity(chart) },
    sections: [
      { name: '차트 룰러 상태', allowed: ['강', '중', '약'] },
      { name: '주요 행성', allowed: PLANETS },
      { name: '우세 원소', allowed: ['Fire', 'Earth', 'Air', 'Water'] },
      { name: '핵심 긴장', allowed: hardAspects(chart) },
    ],
    facts: { file: 'natal-facts.md', items: factItems(facts) },
    chart: { file: 'natal-chart.md', names: new Set([...chartTitles(chart), ...PLANETS, 'ASC', 'MC']) },
  })
}

if (import.meta.main) {
  runJudgmentCli('check-natal-judgment.ts', { judgment: 'natal-judgment.md', chart: 'natal-chart.md', facts: 'natal-facts.md' }, checkNatalJudgment)
}
