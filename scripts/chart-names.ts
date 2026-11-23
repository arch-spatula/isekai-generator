/**
 * 게임 단계 산출물에 쓰면 안 되는 차트 명칭. 계산기 상수에서 만들고, 일상어와 겹치는 말은 잡지 않는다.
 * 이 검사는 입력 격리 뒤의 마지막 안전망이므로 오탐이 없는 좁은 목록만 쓴다.
 * 계약: docs/spec/claude-game-design-flow.md 4.1
 */
import {
  EARTH, HGANJI, LUCKY_STAR_NAMES, MAIN_STAR_NAMES, METEORS_12, PALACE_NAMES, PILLAR_NAMES, RELATIONS, SHA_STAR_NAMES, SKY,
  SPIRITS_12, WU_XING_JU_MAP,
} from '@orrery/core/constants'
import { KO_TEXT } from './chart-report.ts'
import { PLANETS } from './check-natal-judgment.ts'
import { SIGNS } from './natal-facts.ts'

const SI_HUA = ['化祿', '化權', '化科', '化忌']

/** 자미두수 별·궁·사화의 한글 독음. orrery 상수에는 독음이 없어 손으로 둔다. 상수에 이름이 더해지면 테스트가 알린다. */
export const ZIWEI_READINGS: Record<string, string> = {
  紫微: '자미', 天機: '천기', 太陽: '태양', 武曲: '무곡', 天同: '천동', 廉貞: '염정', 天府: '천부', 太陰: '태음',
  貪狼: '탐랑', 巨門: '거문', 天相: '천상', 天梁: '천량', 七殺: '칠살', 破軍: '파군',
  左輔: '좌보', 右弼: '우필', 文昌: '문창', 文曲: '문곡', 天魁: '천괴', 天鉞: '천월', 祿存: '녹존', 天馬: '천마',
  擎羊: '경양', 陀羅: '타라', 火星: '화성', 鈴星: '영성', 地空: '지공', 地劫: '지겁',
  命宮: '명궁', 兄弟: '형제', 夫妻: '부처', 子女: '자녀', 財帛: '재백', 疾厄: '질액', 遷移: '천이', 交友: '교우',
  官祿: '관록', 田宅: '전택', 福德: '복덕', 父母: '부모',
  化祿: '화록', 化權: '화권', 化科: '화과', 化忌: '화기',
}

const PLANETS_KO = ['태양', '달', '수성', '금성', '화성', '목성', '토성', '천왕성', '해왕성', '명왕성']
const SIGNS_KO = ['양자리', '황소자리', '쌍둥이자리', '게자리', '사자자리', '처녀자리', '천칭자리', '전갈자리', '사수자리', '염소자리', '물병자리', '물고기자리']

/**
 * 일상어와 겹쳐 잡지 않는 한글 이름. 한 글자 이름은 따로 두지 않아도 잡지 않는다.
 * 예: 천기(천기누설), 천부(천부적), 거문(거문고), 명궁(이름난 궁수), 상관(상관없다), 편재(두루 퍼져 있음), 화성·금성·토성(성 이름).
 */
export const EVERYDAY_WORDS = new Set([
  '천기', '태양', '천부', '거문', '천상', '문창', '천마', '타라', '화성', '영성',
  '명궁', '형제', '부처', '자녀', '천이', '교우', '관록', '복덕', '부모', '화과', '화기',
  '비견', '상관', '편재', '정재', '정인',
  '장생', '목욕', '관대', '제왕',
  '망신', '장성', '역마', '육해', '화개',
  '달', '수성', '금성', '목성', '토성',
])
/** 일상 영어와 겹쳐 잡지 않는 영어 이름 */
const EVERYDAY_ENGLISH = new Set(['Sun', 'Moon', 'Cancer', 'Leo'])

const HANZI = [
  ...MAIN_STAR_NAMES, ...LUCKY_STAR_NAMES, ...SHA_STAR_NAMES, ...PALACE_NAMES, ...SI_HUA,
  ...RELATIONS.map((item) => item.hanja), ...METEORS_12.map((item) => item.hanja), ...SPIRITS_12.map((item) => item.hanja),
  ...SKY, ...EARTH, ...HGANJI, ...PILLAR_NAMES, ...Object.values(WU_XING_JU_MAP).map((ju) => ju.name),
  '大運', '大限', '小限', '流年', '流月',
]
const PALACE_READINGS = PALACE_NAMES.map((name) => ZIWEI_READINGS[name])
const HANGUL = [
  ...Object.values(ZIWEI_READINGS), ...PALACE_READINGS.map((reading) => reading.endsWith('궁') ? reading : `${reading}궁`),
  ...RELATIONS.map((item) => item.hangul), ...METEORS_12.map((item) => item.hangul), ...SPIRITS_12.map((item) => item.hangul),
  ...Object.entries(KO_TEXT).filter(([key]) => key.startsWith('saju.sal.')).map(([, name]) => name),
  ...PLANETS_KO, ...SIGNS_KO,
].filter((name) => name.length >= 2 && !EVERYDAY_WORDS.has(name))
const ENGLISH = [...PLANETS, 'Chiron', ...SIGNS].filter((name) => !EVERYDAY_ENGLISH.has(name))

/** 잡는 이름 전체 (중복 제거) */
export const CHART_NAMES = [...new Set([...HANZI, ...HANGUL])]
const ENGLISH_PATTERN = new RegExp(`\\b(${[...new Set(ENGLISH)].join('|')})\\b`, 'g')
const HOUSE_PATTERN = /제?\d+\s*하우스|하우스\s*\d+/g

/** 줄마다 차트 명칭을 찾아 `<줄>: 차트 명칭 '<이름>'`으로 돌려준다. */
export function chartNameErrors(text: string): string[] {
  const errors: string[] = []
  for (const [index, line] of text.split('\n').entries()) {
    const found = new Set<string>()
    for (const name of CHART_NAMES) if (line.includes(name)) found.add(name)
    for (const match of line.matchAll(ENGLISH_PATTERN)) found.add(match[1])
    for (const match of line.matchAll(HOUSE_PATTERN)) found.add(match[0])
    for (const name of found) errors.push(`${index + 1}: 차트 명칭 '${name}'`)
  }
  return errors
}

/**
 * 일생 해석 문서(`life.md`)의 문장에 쓰지 않는 판단·운세·차트 해설 용어. 일상어와 겹치는 말(평이·인성·비겁·식상·육친·대한·신궁·사화 등)은 뺀다.
 * 게임 단계에는 적용하지 않는다. 계약: docs/spec/life-integration.md
 */
export const INTERPRETATION_TERMS = [
  '순풍', '역풍', '혼조',
  '용신', '희신', '기신', '일간', '신강', '신약', '격국', '조후', '관성', '재성', '십신', '공망', '대운',
  '명궁', '공궁', '주성', '보조성', '살성', '삼방사정',
  '룰러', '애스펙트', '스텔리움', '섹트', '데트리먼트', '엑잘테이션', '커스프',
]

/** 줄마다 차트 명칭과 해석 용어를 찾아 `<줄>: <종류> '<말>'`로 돌려준다. `[체계:항목]` 인용 안은 보지 않는다. */
export function lifeTermErrors(text: string): string[] {
  const prose = text.replace(/\[[a-z]+:[^\]]*\]/g, '')
  const errors = chartNameErrors(prose)
  for (const [index, line] of prose.split('\n').entries()) {
    for (const term of INTERPRETATION_TERMS) if (line.includes(term)) errors.push(`${index + 1}: 해석 용어 '${term}'`)
  }
  return errors.sort((a, b) => Number(a.split(':')[0]) - Number(b.split(':')[0]))
}
