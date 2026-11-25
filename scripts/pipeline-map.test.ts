import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { checkPipelineMap, documentKeys, pipelineReport, STAGES, type StageSpec } from './pipeline-map.ts'

// 저장소의 지도는 합성 fixture·스킬과 맞아야 한다. 변형 사례의 기대 위반은 docs/spec/pipeline-map.md 2절에서 정했다.
const ROOT = join(import.meta.dir, '..')
const readRepo = (path: string) => readFileSync(join(ROOT, path), 'utf8')

test('the repository map matches the fixtures, the inputs and the skills', () => {
  expect(checkPipelineMap(STAGES, readRepo)).toEqual([])
})

/** 합성 두 단계: a가 쓰고 b가 a를 읽는다 */
const files: Record<string, string> = {
  'a.md': '## 몸\n### 하나\n값: 1\n근거: [x:y]\n',
  'b.md': '## 결과\n### 하나\n뜻: 2\n',
  '.claude/skills/b/SKILL.md': '## 2. 읽기\n\n같은 디렉터리의 `a.md`만 읽는다.\n\n## 3. 작성\n',
}
const read = (path: string) => files[path] ?? ''
const base = (): StageSpec[] => [
  { id: 'a', by: 'script', reads: [], readsStages: ['chart'], fixture: 'a.md', fields: [{ key: '몸 > 값', from: ['chart'] }] },
  { id: 'b', by: '/b', reads: ['a.md'], readsStages: ['a'], fixture: 'b.md', fields: [{ key: '결과 > 뜻', from: ['a:몸 > 값'] }] },
]

test('a synthetic map with matching documents passes', () => {
  expect(checkPipelineMap(base(), read)).toEqual([])
})

test('a field without material or an invented mark is rejected', () => {
  const stages = base()
  stages[1].fields[0].from = []
  expect(checkPipelineMap(stages, read)).toEqual(['b 결과 > 뜻: 재료도 지어냄 표시도 없다'])
  stages[1].fields[0].invented = '장르 안에서 짓는다'
  expect(checkPipelineMap(stages, read)).toEqual([])
})

// 재료 없는 요구: 그 단계가 읽지 않는 단계의 필드를 재료로 선언하면 입력 격리와 어긋난다.
test('material from a stage the step does not read is rejected', () => {
  const stages = base()
  stages[1].fields[0].from = ['c:몸 > 값']
  expect(checkPipelineMap(stages, read)).toEqual(['b 결과 > 뜻: c 단계를 읽지 않는데 재료로 쓴다 (c:몸 > 값)'])
  stages[1].fields[0].from = ['a:몸 > 없음']
  expect(checkPipelineMap(stages, read)).toEqual(['b 결과 > 뜻: a에 없는 필드 몸 > 없음'])
})

test('the map and the fixture must declare the same fields', () => {
  const stages = base()
  stages[1].fields.push({ key: '결과 > 덧', from: ['a:몸 > 값'] })
  expect(checkPipelineMap(stages, read)).toEqual(['b: 지도의 결과 > 덧가 문서에 없다 (b.md)'])
  const extra = { ...files, 'b.md': `${files['b.md']}새것: 3\n` }
  expect(checkPipelineMap(base(), (path) => extra[path] ?? '')).toEqual(['b: 문서의 결과 > 새것가 지도에 없다 (b.md)'])
})

test('the skill reading section must name every input file', () => {
  const stages = base()
  stages[1].reads.push('z.md')
  expect(checkPipelineMap(stages, read)).toEqual(['b: 스킬 /b의 읽기 절이 z.md을 말하지 않는다'])
})

test('document keys skip citations, lists and the preamble, and name prose 본문', () => {
  expect([...documentKeys('원국: 甲\n## 가\n### 나\n값: 1\n근거: [a:b]\n- 목록: 2\n## 다\n문장에 [x:y] 인용이 있다\n')]).toEqual(['가 > 값', '다 > 본문'])
})

test('the report lists invented fields, known gaps and fields nobody downstream uses', () => {
  const report = pipelineReport(STAGES)
  expect(report).toContain('## 지어내는 필드')
  expect(report).toContain('- combat 전투 방식 > 적:')
  // 같은 단계 안에서 쓰이는 필드는 쓰이지 않는 필드로 잡지 않는다.
  expect(report).not.toContain('- combat 후보 > 플레이')
  expect(report).toContain('- life 재능과 생업 > 꽃피는 시기')
})
