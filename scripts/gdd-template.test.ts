import { Database } from 'bun:sqlite'
import { beforeGdd } from './fixtures/sqlite-pipeline-runtime'
import { pipelineGdd as fullPipelineGdd } from './fixtures/sqlite-pipeline'
import { prepare, submit, finish, call, request } from './artifacts/sqlite-test-fixtures'
import { expect, test } from 'bun:test'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import * as validator from '../.agents/skills/generate-gdd-from-interpretation/scripts/validate-gdd'
import { gddSections, gddTemplateFixture, gddTitle } from './fixtures/gdd-template'
import { presentationFixture } from './fixtures/game-presentation'
import { fixtureCombat, fixtureInterpretation, serializeWorldBrief, worldStructureFixture } from '../.agents/skills/select-world-concept/scripts/world-fixtures'

const valid = gddTemplateFixture()
const fingerprint = { combatRange: 'long', powerMedium: 'spell', initiative: 'reactive', spaceUse: 'swap', combatRhythm: 'cycle', mastery: 'aim', risk: 'focus_break' }
const combat = fixtureCombat + '\n\n## Final Fingerprint\n\n' + Object.entries(fingerprint).map(([key, value]) => `- ${key}: ${value}`).join('\n')
const declarations = '\n설계 모티프: 우회와 반격\n해석 근거: I-01\n\n```combat-fingerprint\n' + JSON.stringify(fingerprint) + '\n```\n' + worldStructureFixture() + presentationFixture
const fullGdd = gddTemplateFixture(declarations)
const invalidOutlines = [
  valid.replace(gddTitle, ''),
  valid.replace(gddTitle, '# 유리 숲'),
  valid.replace('## 1. 게임 개요', '## 1. 소개'),
  valid.replace('## 1. 게임 개요', '## 2. 플레이어 경험과 핵심 재미').replace('## 2. 플레이어 경험과 핵심 재미\n\n합성', '## 1. 게임 개요\n\n합성'),
  ...gddSections.map(heading => valid.replace(new RegExp(`## ${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n[\\s\\S]*?(?=\\n## |$)`), '')),
  valid + '\n# 부록\n내용',
  valid + '\n## 부록\n내용',
  valid + '\n' + gddTitle + '\n내용',
  valid + '\n## 1. 게임 개요\n내용',
  ...gddSections.map(heading => valid.replace(new RegExp(`(## ${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n)[\\s\\S]*?(?=\\n## |$)`), '$1\n \t\n')),
]

test('template prompt has one bounded outline matching the independently specified headings', () => {
  const prompt = readFileSync(resolve(import.meta.dir, '../docs/prompts/personalized-action-rpg-concept.md'), 'utf8')
  expect(prompt.match(/<!-- gdd-template:start -->/g)?.length).toBe(1)
  expect(prompt.match(/<!-- gdd-template:end -->/g)?.length).toBe(1)
  const bounded = prompt.split('<!-- gdd-template:start -->')[1]?.split('<!-- gdd-template:end -->')[0] ?? ''
  expect(bounded.match(/^#{1,2} .+$/gm)).toEqual([gddTitle, ...gddSections.map(heading => '## ' + heading)])
})

test('public structure check accepts free names, subsection headings, CRLF and fenced heading examples', () => {
  expect(typeof validator.hasGddTemplateStructure).toBe('function')
  for (const markdown of [valid, valid.replaceAll('\n', '\r\n'), valid.replace('유리 숲의 문지기', '다른 게임명'), valid + '\n### 자유 소제목\n설명\n#### 세부 항목\n설명', valid + '\n```markdown\n# 가짜 제목\n## 가짜 장\n```', valid + '\n~~~markdown\n# 가짜 제목\n## 가짜 장\n~~~']) {
    expect(validator.hasGddTemplateStructure(markdown)).toBe(true)
  }
})

test('structure check rejects missing, renamed, reordered, extra, duplicate and empty sections', () => {
  for (const markdown of invalidOutlines) expect(validator.hasGddTemplateStructure(markdown)).toBe(false)
  expect(validator.hasGddTemplateStructure('```markdown\n' + valid + '\n```')).toBe(false)
})

test('isValidGdd enforces structure on otherwise valid declarations and evidence', () => {
  const args = ['합성 차트 원본', fixtureInterpretation, combat, serializeWorldBrief()] as const
  expect(validator.isValidGdd(fullGdd, ...args)).toBe(true)
  for (const markdown of invalidOutlines) expect(validator.isValidGdd(declarations + markdown, ...args)).toBe(false)
})

test('public finish rejects an invalid GDD outline and preserves registration state', () => {
  const { root, run } = beforeGdd()
  const attempt = prepare(root, run, 'gdd').data
  writeFileSync(attempt.output, fullPipelineGdd().replace(gddTitle, '# 임의 제목'))
  submit(root, attempt)
  expect(finish(root, attempt).outcome).toBe('validation-failed')
  const result = call(root, ['finalize', '--run', run, '--request', request()])
  expect(result.code).toBe(1)
  const db = new Database(join(root, 'artifacts/state.sqlite'), { readonly: true })
  try { expect(db.query('SELECT count(*) AS count FROM fingerprints').get()).toEqual({ count: 0 }) } finally { db.close() }
})
