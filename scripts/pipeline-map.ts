/**
 * 생성 흐름의 단계별 재료 지도와 그 결정적 검사. 저장소 유지보수용이며 생성 중에는 실행하지 않는다.
 * 계약: docs/spec/pipeline-map.md
 *
 * 단계마다 읽는 파일과 쓰는 필드, 그 필드의 재료가 되는 앞 단계 필드를 선언한다.
 * 검사: 선언과 합성 fixture의 필드가 같은지, 재료가 그 단계가 읽는 입력에 있는지, 모든 필드에 재료나 지어냄 표시가 있는지,
 * 스킬의 '읽기' 절이 선언한 입력 파일을 말하는지. 보고서: 지어내는 필드, 알려진 재료 부족, 뒤에서 아무도 쓰지 않는 필드.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..')

/** 인용·근거를 담는 필드. 재료가 아니라 출처 표시라 지도에서 뺀다 */
export const META_FIELDS = ['근거', '재료', '출처']

export interface FieldSpec {
  /** `<섹션> > <필드>`. 필드 자리의 `*`는 섹션의 모든 필드 */
  key: string
  /** `<단계>:<섹션> > <필드>`, `<단계>:<섹션> > *`, 같은 단계 안의 필드, 또는 `external:<이름>` */
  from: string[]
  /** 재료 없이 지어내는 필드와 그 이유. 지어냄이 허용된 자리임을 드러낸다 */
  invented?: string
  /** 재료는 연결돼 있지만 의미가 맞지 않는 것으로 알려진 자리 */
  gap?: string
  /** 문서에 없을 수 있는 필드 */
  optional?: boolean
}

export interface StageSpec {
  id: string
  /** 이 단계를 쓰는 스킬 또는 스크립트 */
  by: string
  /** 같은 디렉터리에서 읽는 파일 */
  reads: string[]
  /** 읽는 파일이 어느 단계의 산출물인지 (차트 층은 `chart`) */
  readsStages: string[]
  /** 필드 검사에 쓰는 합성 fixture. 없으면 필드 대조를 하지 않는다 */
  fixture?: string
  fields: FieldSpec[]
}

/** 외부 재료: 저장소에 고정된 표나 장르 계약 */
export const EXTERNAL: Record<string, string> = {
  'combat-axes': '전투 원형 일곱 축의 값 목록(docs/ADR/2026-11-03-personalized-combat-archetype-selection.md)',
  genre: '장르 계약: 픽셀 그래픽, 빠른 실시간 액션, 로그라이트(docs/ADR/2026-11-23-claude-gdd-flow.md 결정 5)',
}

const all = (section: string, from: string[]): FieldSpec => ({ key: `${section} > *`, from })
const lifeSystem = (id: string, fixture: string, timeline: boolean): StageSpec => ({
  id, by: `/${id}`, fixture,
  reads: [`${id.split('-')[0]}-chart.md`, `${id.split('-')[0]}-facts.md`, `${id.split('-')[0]}-judgment.md`, ...(id === 'natal-life' ? [] : [`${id.split('-')[0]}-derived-facts.md`])],
  readsStages: ['chart'],
  fields: [
    all('배경', ['chart']),
    ...(timeline ? [all('생애 연표', ['chart'])] : []),
    all('인물 사전', ['chart']),
    all('재능과 생업', ['chart']),
    all('상처와 회복', ['chart']),
  ],
})
const SECTIONS_OF_LIFE = ['배경', '생애 연표', '인물 사전', '재능과 생업', '상처와 회복']

export const STAGES: StageSpec[] = [
  lifeSystem('saju-life', 'scripts/fixtures/saju-life/saju-life.md', true),
  lifeSystem('ziwei-life', 'scripts/fixtures/ziwei-life/ziwei-life.md', true),
  lifeSystem('natal-life', 'scripts/fixtures/natal-life/natal-life.md', false),
  {
    id: 'material', by: 'scripts/assemble-life-material.ts', reads: ['saju-life.md', 'ziwei-life.md', 'natal-life.md'],
    readsStages: ['saju-life', 'ziwei-life', 'natal-life'],
    fields: SECTIONS_OF_LIFE.map((section) => all(section, ['saju-life', 'ziwei-life', ...(section === '생애 연표' ? [] : ['natal-life'])].map((stage) => `${stage}:${section} > *`))),
  },
  {
    id: 'life', by: '/life-integration', reads: ['life-material.md'], readsStages: ['material'], fixture: 'scripts/fixtures/life-integration/life.md',
    fields: [
      { key: '일생의 축 > 내용', from: ['material:생애 연표 > *', 'material:재능과 생업 > *', 'material:상처와 회복 > *'] },
      ...SECTIONS_OF_LIFE.map((section) => all(section, [`material:${section} > *`])),
      all('갈림길', ['material:인물 사전 > *', 'material:생애 연표 > *', 'material:재능과 생업 > *']),
    ],
  },
  {
    id: 'brief', by: '/translate-life', reads: ['life.md'], readsStages: ['life'], fixture: 'scripts/fixtures/translation-brief/translation-brief.md',
    fields: [
      { key: '주인공 > 내용', from: ['life:일생의 축 > 내용', 'life:상처와 회복 > 내용', 'life:상처와 회복 > 발현 조건', 'life:재능과 생업 > 기르는 기질'] },
      { key: '주인공 능력 > 다루는 것', from: ['life:재능과 생업 > 다루는 것'] },
      { key: '주인공 능력 > 하는 일', from: ['life:재능과 생업 > 내용'] },
      { key: '주인공 능력 > 약점', from: ['life:재능과 생업 > 막히는 조건'] },
      { key: '생업 > 시기', from: ['life:재능과 생업 > 시기'] },
      { key: '생업 > 내용', from: ['life:재능과 생업 > 내용'] },
      { key: '동료 > 후보', from: ['life:인물 사전 > 상태', 'life:인물 사전 > 영향', 'life:인물 사전 > 함께 한 일', 'life:인물 사전 > 곁에 있던 시기'] },
      { key: '동료 > 동행하는 장', from: ['life:인물 사전 > 곁에 있던 시기'] },
      { key: '동료 > 재주', from: ['life:인물 사전 > 다루는 것'] },
      { key: '동료 > 함께 하는 일', from: ['life:인물 사전 > 함께 한 일'] },
      { key: '동료 > 혼자', from: ['life:인물 사전 > 영향'], optional: true },
      { key: '배경 > 생활 기반', from: ['life:배경 > 생활 기반'] },
      { key: '배경 > 모습', from: ['life:배경 > 모습'] },
      { key: '배경 > 준 것', from: ['life:배경 > 준 것'] },
      { key: '배경 > 막은 것', from: ['life:배경 > 막은 것'] },
      { key: '배경 > 경로', from: ['life:배경 > *', 'life:인물 사전 > 성향', 'life:인물 사전 > 주인공과의 관계', 'life:생애 연표 > 성격 변화'] },
      { key: '장 > 사건', from: ['life:생애 연표 > 전환점'] },
      { key: '장 > 고민', from: ['life:생애 연표 > 주제'] },
      { key: '장 > 시련', from: ['life:생애 연표 > 시련'] },
      { key: '갈림길 > 본선', from: ['life:갈림길 > *'] },
      { key: '갈림길 > 다른 길', from: ['life:갈림길 > *'] },
      { key: '갈림길 > 갈리는 조건', from: ['life:갈림길 > *'] },
      { key: '동기와 퀘스트 > 내용', from: ['life:인물 사전 > 관계의 변화', 'life:갈림길 > *', 'life:상처와 회복 > 내용'] },
    ],
  },
  {
    id: 'identity', by: '/design-identity', reads: ['translation-brief.md'], readsStages: ['brief'], fixture: 'scripts/fixtures/identity/identity.md',
    fields: [
      { key: '클래스 후보 > 영역', from: ['brief:주인공 능력 > 다루는 것'] },
      { key: '클래스 후보 > 이세계의 힘', from: ['클래스 후보 > 영역', 'brief:주인공 능력 > 하는 일'],
        invented: '다루는 것의 현실 동작이 아니라 그 영역이 이세계에서 쓰는 힘을 지어낸다' },
      { key: '클래스 후보 > 판단', from: ['클래스 후보 > 이세계의 힘', 'brief:주인공 능력 > 다루는 것'] },
      { key: '클래스 > 하는 일', from: ['클래스 후보 > 이세계의 힘', 'brief:주인공 능력 > 다루는 것', 'brief:주인공 능력 > 하는 일'] },
      { key: '클래스 > 판단', from: ['클래스 후보 > 판단', 'brief:주인공 능력 > 다루는 것'] },
      { key: '부직업 > 하는 일', from: ['brief:생업 > 내용', 'brief:주인공 능력 > 하는 일'] },
      { key: '출신 도시 > 산업', from: ['brief:배경 > 생활 기반'] },
      { key: '출신 도시 > 권력', from: ['brief:배경 > 생활 기반', 'brief:배경 > 준 것', 'brief:배경 > 막은 것'] },
      { key: '출신 도시 > 역사', from: ['brief:배경 > 모습', 'brief:배경 > 막은 것'], invented: '도시의 내력은 배경의 조건에 어울리게 지어낸다' },
      { key: '출신 도시 > 주인공의 자리', from: ['brief:배경 > *'] },
      { key: '장별 세계 > 세계', from: ['출신 도시 > 산업', '출신 도시 > 권력', 'brief:장 > 사건'],
        invented: '브리프의 장에는 주인공 사건만 있어 시대 변화는 출신 도시의 산업·권력에서 지어낸다(#100)' },
    ],
  },
  {
    id: 'world', by: '/design-world', reads: ['translation-brief.md', 'identity.md'], readsStages: ['brief', 'identity'], fixture: 'scripts/fixtures/world/world.md',
    fields: [
      { key: '지역 > 장', from: ['brief:장 > 사건'] },
      { key: '지역 > 성격', from: ['identity:출신 도시 > *', 'identity:장별 세계 > 세계'] },
      { key: '지역 > 사정', from: ['identity:장별 세계 > 세계', 'brief:장 > 사건'] },
      { key: '지역 > 전장', from: ['지역 > 성격', '세력 > 목적'] },
      { key: '세력 > 목적', from: ['identity:출신 도시 > 권력', 'identity:장별 세계 > 세계', 'brief:배경 > *'] },
      { key: '세력 > 제약', from: ['identity:출신 도시 > 권력', 'brief:배경 > 막은 것'] },
      { key: '세력 > 주인공과의 관계', from: ['identity:출신 도시 > 주인공의 자리', 'brief:주인공 > 내용'] },
      { key: '서사 갈등 > 내용', from: ['brief:주인공 > 내용', '세력 > 목적', '세력 > 제약'] },
    ],
  },
  {
    id: 'combat', by: '/design-combat', reads: ['translation-brief.md', 'identity.md', 'world.md'], readsStages: ['brief', 'identity', 'world'], fixture: 'scripts/fixtures/combat/combat.md',
    fields: [
      { key: '후보 > 조작하는 것', from: ['brief:주인공 능력 > 다루는 것'] },
      { key: '후보 > 플레이', from: ['brief:주인공 능력 > 하는 일', 'identity:클래스 > 하는 일'] },
      { key: '후보 > 혼자일 때', from: ['후보 > 플레이'] },
      ...['전투 거리', '힘의 매개체', '주도 방식', '공간 활용', '전투 리듬', '숙련의 핵심', '위험 구조'].map((axis): FieldSpec => ({
        key: `후보 > ${axis}`, from: ['external:combat-axes', '후보 > 플레이'],
        ...(axis === '전투 거리' ? { gap: '후보를 닫힌 축 표에서 고르므로 run 사이에 같은 자리로 수렴할 수 있다(#75). 후보 수는 클래스의 능력 수에 맞춰 세 개로 줄였다' } : {}),
      })),
      { key: '후보 > 판단', from: ['후보 > 플레이', 'identity:클래스 > 하는 일'] },
      { key: '전투 방식 > 채택', from: ['후보 > 판단'] },
      { key: '전투 방식 > 핵심 행동', from: ['후보 > 플레이'] },
      { key: '전투 방식 > 약점', from: ['brief:주인공 능력 > 약점'] },
      { key: '전투 방식 > 적', from: ['world:세력 > 목적', 'world:지역 > 전장', '후보 > 플레이'] },
      { key: '전투 방식 > 런 한 번', from: ['external:genre'], invented: '장르 계약 안에서 지어낸다' },
      { key: '전투 방식 > 런 중 보상', from: ['external:genre', '후보 > 플레이'], invented: '장르 계약 안에서 지어낸다' },
      { key: '전투 방식 > 런 밖 성장', from: ['brief:주인공 능력 > 다루는 것'] },
      { key: '동료의 행동 > 행동', from: ['brief:동료 > 재주', 'brief:동료 > 함께 하는 일', '전투 방식 > 핵심 행동'] },
    ],
  },
  {
    id: 'gdd', by: '/write-gdd', reads: ['translation-brief.md', 'identity.md', 'combat.md', 'world.md'], readsStages: ['brief', 'identity', 'combat', 'world'], fixture: 'scripts/fixtures/gdd/gdd.md',
    fields: [
      { key: '게임 개요 > 본문', from: ['combat:전투 방식 > 핵심 행동', 'brief:주인공 > 내용', 'external:genre'] },
      { key: '주인공 > 본문', from: ['brief:배경 > *', 'identity:클래스 > 하는 일', 'identity:부직업 > 하는 일', 'brief:주인공 > 내용'] },
      { key: '동료 > 본문', from: ['brief:동료 > 동행하는 장', 'brief:동료 > 함께 하는 일', 'combat:동료의 행동 > 행동'] },
      { key: '세계와 장 > 본문', from: ['world:지역 > *', 'brief:장 > 사건'] },
      { key: '전투 > 본문', from: ['combat:전투 방식 > *'] },
      { key: '런과 성장 > 본문', from: ['combat:전투 방식 > 런 한 번', 'combat:전투 방식 > 런 중 보상', 'combat:전투 방식 > 런 밖 성장'] },
      { key: '서사의 변화 > 본문', from: ['brief:동기와 퀘스트 > 내용', 'world:서사 갈등 > 내용'] },
      { key: '대표 장면 > 본문', from: ['world:지역 > 전장', 'combat:전투 방식 > 핵심 행동'] },
    ],
  },
]

/** 문서의 `<섹션> > <필드>` 키. 필드 줄이 아닌 본문은 `본문`, 메타 필드와 목록은 뺀다 */
export function documentKeys(text: string): Set<string> {
  const keys = new Set<string>()
  let section = ''
  for (const line of text.split('\n')) {
    if (line.startsWith('## ')) { section = line.slice(3).trim(); continue }
    if (section === '' || line.startsWith('### ') || line.startsWith('- ') || line.trim() === '') continue
    const match = line.match(/^([^\s:[\]][^:[\]]{0,15}):\s/)
    const field = match?.[1] ?? '본문'
    if (!META_FIELDS.includes(field)) keys.add(`${section} > ${field}`)
  }
  return keys
}

const sectionOf = (key: string) => key.split(' > ')[0]
const covers = (spec: FieldSpec, key: string) => spec.key === key || (spec.key.endsWith(' > *') && sectionOf(spec.key) === sectionOf(key))

/** 지도의 결정적 검사. read는 저장소 루트 기준 파일을 읽는다 */
export function checkPipelineMap(stages: StageSpec[], read: (path: string) => string): string[] {
  const errors: string[] = []
  const byId = new Map(stages.map((stage) => [stage.id, stage]))
  const declared = (stage: StageSpec, key: string) => stage.fields.some((spec) => covers(spec, key) || (key.endsWith(' > *') && sectionOf(spec.key) === sectionOf(key)))

  for (const stage of stages) {
    for (const spec of stage.fields) {
      if (spec.from.length === 0 && spec.invented == null) errors.push(`${stage.id} ${spec.key}: 재료도 지어냄 표시도 없다`)
      for (const source of spec.from) {
        if (source === 'chart') {
          if (!stage.readsStages.includes('chart')) errors.push(`${stage.id} ${spec.key}: 차트를 읽지 않는 단계가 차트를 재료로 쓴다`)
          continue
        }
        if (source.startsWith('external:')) {
          if (!(source.slice(9) in EXTERNAL)) errors.push(`${stage.id} ${spec.key}: 알 수 없는 외부 재료 ${source}`)
          continue
        }
        const colon = source.indexOf(':')
        const [from, key] = colon === -1 ? [stage.id, source] : [source.slice(0, colon), source.slice(colon + 1)]
        if (from !== stage.id && !stage.readsStages.includes(from)) {
          errors.push(`${stage.id} ${spec.key}: ${from} 단계를 읽지 않는데 재료로 쓴다 (${source})`)
          continue
        }
        const upstream = byId.get(from)
        if (upstream == null) errors.push(`${stage.id} ${spec.key}: 없는 단계 ${from}`)
        else if (!declared(upstream, key)) errors.push(`${stage.id} ${spec.key}: ${from}에 없는 필드 ${key}`)
      }
    }

    if (stage.fixture != null) {
      const keys = documentKeys(read(stage.fixture))
      for (const key of keys) if (!stage.fields.some((spec) => covers(spec, key))) errors.push(`${stage.id}: 문서의 ${key}가 지도에 없다 (${stage.fixture})`)
      for (const spec of stage.fields) {
        if (spec.optional || spec.key.endsWith(' > *')) continue
        if (!keys.has(spec.key)) errors.push(`${stage.id}: 지도의 ${spec.key}가 문서에 없다 (${stage.fixture})`)
      }
    }

    if (stage.by.startsWith('/')) {
      const skill = read(`.claude/skills/${stage.by.slice(1)}/SKILL.md`)
      const reading = skill.slice(skill.indexOf('## 2. 읽기'), skill.indexOf('## 3.'))
      for (const file of stage.reads) if (!reading.includes(`\`${file}\``)) errors.push(`${stage.id}: 스킬 ${stage.by}의 읽기 절이 ${file}을 말하지 않는다`)
    }
  }
  return errors
}

/** 보고서: 지어내는 필드, 알려진 재료 부족, 뒤 단계가 쓰지 않는 필드 */
export function pipelineReport(stages: StageSpec[]): string {
  const used = new Set<string>()
  for (const stage of stages) for (const spec of stage.fields) for (const source of spec.from) {
    if (source === 'chart' || source.startsWith('external:')) continue
    // 같은 단계 안의 필드는 단계 이름 없이 적는다
    used.add(source.includes(':') ? source : `${stage.id}:${source}`)
  }
  const isUsed = (stageId: string, key: string) => [...used].some((source) => {
    const [from, rest] = [source.slice(0, source.indexOf(':')), source.slice(source.indexOf(':') + 1)]
    return from === stageId && (rest === key || (rest.endsWith(' > *') && sectionOf(rest) === sectionOf(key)) || (key.endsWith(' > *') && sectionOf(rest) === sectionOf(key)))
  })
  const lines = ['# 재료 지도 보고서', '', '## 지어내는 필드']
  for (const stage of stages) for (const spec of stage.fields) if (spec.invented != null) lines.push(`- ${stage.id} ${spec.key}: ${spec.invented}`)
  lines.push('', '## 알려진 재료 부족')
  for (const stage of stages) for (const spec of stage.fields) if (spec.gap != null) lines.push(`- ${stage.id} ${spec.key}: ${spec.gap}`)
  lines.push('', '## 뒤 단계가 쓰지 않는 필드')
  const last = stages.at(-1)!.id
  for (const stage of stages) {
    if (stage.id === last) continue
    const keys = stage.fixture != null ? [...documentKeys(readFileSync(join(ROOT, stage.fixture), 'utf8'))] : stage.fields.map(({ key }) => key)
    for (const key of keys) if (!isUsed(stage.id, key)) lines.push(`- ${stage.id} ${key}`)
  }
  return lines.join('\n')
}

if (import.meta.main) {
  const errors = checkPipelineMap(STAGES, (path) => readFileSync(join(ROOT, path), 'utf8'))
  for (const error of errors) console.log(error)
  if (process.argv.includes('--report')) console.log(pipelineReport(STAGES))
  process.exit(errors.length > 0 ? 1 : 0)
}
