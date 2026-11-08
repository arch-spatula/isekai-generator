import { expect, test } from 'bun:test'
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
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

test('both six argument CLIs reject an invalid outline while valid inputs succeed', () => {
  const root = mkdtempSync(join(tmpdir(), 'gdd-template-'))
  try {
    const sources = [fullGdd, '합성 차트 원본', fixtureInterpretation, combat, serializeWorldBrief()]
    const paths = sources.map((source, index) => { const path = join(root, `${index}.md`); writeFileSync(path, source); return path })
    const presentation = resolve(import.meta.dir, '../docs/prompts/game-presentation-contract.md')
    for (const skill of ['generate-gdd-from-interpretation', 'generate-personalized-gdd']) {
      const cli = resolve(import.meta.dir, '../.agents/skills', skill, 'scripts/validate-gdd.ts')
      writeFileSync(paths[0], fullGdd)
      expect(Bun.spawnSync(['bun', cli, ...paths, presentation]).exitCode).toBe(0)
      writeFileSync(paths[0], fullGdd.replace(gddTitle, '# 임의 제목'))
      const result = Bun.spawnSync(['bun', cli, ...paths, presentation])
      expect(result.exitCode).toBe(1)
      expect(result.stderr.toString()).toContain('Invalid GDD')
      expect(Bun.spawnSync(['bun', cli, ...paths, presentation, 'extra']).exitCode).toBe(2)
    }
  } finally { rmSync(root, { recursive: true, force: true }) }
})
