import { presentationFixture } from './game-presentation'
const domains = ['성격과 기질', '직업과 적성', '재물', '연애와 배우자', '가족과 대인관계', '건강과 생활 리듬', '시기운']
const items = domains.map((domain, index) => `### I-${String(index + 1).padStart(2, '0')}
영역: ${domain}
연결 영역: ${domains[(index + 1) % domains.length]}
관계: 일관
해석: 세 체계가 공통으로 가리키는 생활 경향을 결론부터 제시하고, 강점이 잘 드러나는 환경과 반복해서 부담이 생기는 조건을 일상 수준에서 구체적으로 설명한다.
작동 사슬: 자율성을 지키려는 욕구 → 먼저 기준을 세우는 행동 → 통제적인 환경과 마찰 → 혼자 책임을 떠안는 반복 결과
양면성: 강점: 스스로 방향을 정하고 끝까지 추진한다. | 취약점: 도움을 늦게 요청해 부담이 누적될 수 있다.
조건: 역할과 권한이 분명할 때 강점이 살아나며, 기준이 자주 바뀌거나 간섭이 심한 환경에서는 경직되기 쉽다.
근거: S-0${index + 1}, Z-0${index + 1}, N-0${index + 1}`).join('\n')

export const integratedInterpretation = `# 통합 차트 해석
## 해석 원칙
## 전문 해석 요약
### 사주팔자
### 자미두수
### 서양 점성술
## 교차 체계 비교
### 일관된 해석
### 구체성을 더하는 해석
### 상충하는 해석
## 통합 인물 구조
### 공통 핵심축
핵심 욕구: 자기 기준을 지키면서도 현실에서 성과를 확인하려 한다.
반복 갈등: 자율성을 지키려는 태도와 타인에게 협조를 구해야 하는 상황이 충돌한다.
의사결정 기준: 장기적으로 통제권과 전문성을 확보할 수 있는지를 먼저 판단한다.
근거: S-01, Z-01, N-01
### 체계별 고유 통찰
- 사주 고유: 에너지 배분과 장기 변화의 관점에서 지속 가능한 선택 조건을 좁힌다. (근거: S-01)
- 자미두수 고유: 삶의 무대와 시기 층위를 통해 같은 성향이 드러나는 영역을 특정한다. (근거: Z-01)
- 서양 점성술 고유: 내적 동기와 심리적 긴장을 통해 행동 이전의 갈등 구조를 설명한다. (근거: N-01)
### 영역 간 작동 구조
내적 동기: 자기 기준과 선택권을 보존하려 한다.
행동 방식: 충분히 검토한 뒤 혼자 책임질 수 있는 방향으로 움직인다.
환경 반응: 자율성이 보장되면 몰입하지만 통제가 강하면 방어적으로 거리를 둔다.
반복 결과: 성취의 질은 높아지지만 협업 요청이 늦어져 관계와 생활 리듬에 부담이 이어질 수 있다.
근거: S-01, Z-01, N-01
### 시간에 따른 변화
유지: 자기 기준과 전문성을 중시하는 기본 성향은 시간층이 달라져도 유지된다.
변화: 운의 층위에 따라 그 성향이 직업 선택, 관계 조정, 생활 리듬 재편 중 어디에 집중되는지가 달라진다.
근거: S-01, Z-01
## 핵심 해석 항목
${items}
`

const axes = [
  ['close', 'weapon', 'direct', 'pursuit', 'pressure', 'timing', 'health'],
  ['long', 'spell', 'reactive', 'swap', 'cycle', 'aim', 'focus_break'],
  ['mid', 'summon', 'command', 'fortify', 'prepare_execute', 'command', 'summon_loss'],
  ['close', 'body', 'transform', 'aerial', 'improvise', 'form_shift', 'overheat'],
]

function candidate(id: number, values: string[], fit: number): string {
  const keys = ['combatRange', 'powerMedium', 'initiative', 'spaceUse', 'combatRhythm', 'mastery', 'risk']
  const scoreKeys = ['interpretationFit', 'distinctiveness', 'actionability', 'progression', 'nonMonopoly', 'genreIndependence', 'candidateDistance']
  return `### Candidate C-${String(id).padStart(2, '0')}

- name: 후보 ${id}
- player-fantasy: 구조적으로 구별되는 전투 판타지 ${id}
- primary-verbs: anchor, redirect, detonate
- core-loop: 읽고 준비한 뒤 실행한다.
- growth-path: 같은 힘의 계통 안에서 범위가 확장된다.
- weakness: 잘못된 판단은 자원 손실을 일으킨다.
- evidence: I-01, I-02

#### Axes

${keys.map((key, index) => `- ${key}: ${values[index]}`).join('\n')}

#### Scores

${scoreKeys.map(key => `- ${key}: ${key === 'interpretationFit' ? fit : 4} | 평가 근거가 있다.`).join('\n')}`
}

export function combatBrief(): string {
  const traits = [
    ['combatRange', 'close'],
    ['powerMedium', 'weapon'],
    ['initiative', 'direct'],
    ['spaceUse', 'pursuit'],
    ['combatRhythm', 'pressure'],
    ['mastery', 'timing'],
    ['risk', 'health'],
  ].map(([axis, value], index) => `### Trait T-${String(index + 1).padStart(2, '0')}

- axis: ${axis}
- value: ${value}
- evidence: I-${String(index + 1).padStart(2, '0')}
- counter-evidence: 반대 방향의 가능성도 있다.
- confidence: 0.8`).join('\n\n')
  const candidates = axes.map((values, index) => candidate(index + 1, values, 5 - index)).join('\n\n')
  return `# Gameplay Concept Brief

- schema-version: 1

## Interpretation Traits

${traits}

## Candidates

${candidates}

## Selection

- initial-selected: C-01
- selected: C-01
- reason: 가장 높은 평가를 받았다.

### Rejected C-02

- reason: 선택 후보보다 적합도가 낮다.

### Rejected C-03

- reason: 선택 후보보다 적합도가 낮다.

### Rejected C-04

- reason: 선택 후보보다 적합도가 낮다.

## Registry Review

- threshold: 5
- compared-entries: 0
- challenger-required: false
- challenger-candidate: none
- similarity-justification: none

## Final Fingerprint

- combatRange: close
- powerMedium: weapon
- initiative: direct
- spaceUse: pursuit
- combatRhythm: pressure
- mastery: timing
- risk: health
` + presentationFixture
}


import { gddTemplateFixture } from './gdd-template'
import { serializeWorldBrief, worldBriefFixture, worldStructureFixture } from '../../.agents/skills/select-world-concept/scripts/world-fixtures'
export const combatFingerprint = { combatRange: 'close', powerMedium: 'weapon', initiative: 'direct', spaceUse: 'pursuit', combatRhythm: 'pressure', mastery: 'timing', risk: 'health' }
export function worldBrief(): string {
  const brief = worldBriefFixture()
  for (const candidate of brief.candidates) candidate.verbMapping.push({ verb: 'detonate', operation: '표면에 남긴 표식을 폭발시켜 봉쇄된 통로를 개방한다.' })
  return serializeWorldBrief(brief)
}
export function pipelineGdd(): string {
  return gddTemplateFixture('설계 모티프: 우회로의 개방\n해석 근거: I-01\n\n```combat-fingerprint\n' + JSON.stringify(combatFingerprint) + '\n```' + worldStructureFixture() + presentationFixture)
}

import { worldCandidate } from '../../.agents/skills/select-world-concept/scripts/world-fixtures'
export function revisedCombatBrief(previousVersion: string): string {
  const review = `## Registry Review

- threshold: 5
- compared-entries: 1
- challenger-required: true
- challenger-candidate: C-05
- similarity-justification: 같은 축을 유지하지만 현재 해석의 기준 수립과 반복 책임을 표식의 해제 순서에 연결한다.

### Initial Closest Match ${previousVersion} C-01

- equal-axes: 7
- similar: true

### Final Closest Match ${previousVersion} C-01

- equal-axes: 7
- similar: true`
  return combatBrief()
    .replace('\n## Selection', `\n\n${candidate(5, axes[1], 1)}\n\n## Selection`)
    .replace('\n## Registry Review', '\n\n### Rejected C-05\n\n- reason: 현재 해석의 책임 반복을 구현하는 인과가 기존 선택안보다 약하다.\n\n## Registry Review')
    .replace(/## Registry Review[\s\S]*?(?=\n## Final Fingerprint)/, review)
}
export function revisedWorldBrief(previousVersion: string): string {
  const brief = worldBriefFixture()
  brief.candidates.push(worldCandidate(4, 3))
  brief.rejected.push({ id: 'W-05', reason: '이동 거점의 반복 순환보다 고정 도시 사이의 관문을 여는 선택이 해석과 직접 연결된다.' })
  for (const candidate of brief.candidates) candidate.verbMapping.push({ verb: 'detonate', operation: '표면의 표식을 폭발시켜 봉쇄된 통로를 개방한다.' })
  const matches = [{ version: previousVersion, candidateId: 'W-01', equalAxes: 6 }]
  brief.registryReview = { comparedEntries: 1, initialClosest: matches, finalClosest: matches, similarityDifferences: [{ version: previousVersion, candidateId: 'W-01', interpretationFit: '기준 수립과 탐색의 긴장을 현재 해석에서 직접 연결한다.', spatialDifference: '현재의 관문 해제는 책임을 분산하는 우회 순서와 연결되어 조작의 선택 조건이 다르다.' }] }
  return serializeWorldBrief(brief)
}
