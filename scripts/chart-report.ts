/*
 * Adapted from rath/orrery src/utils/text-export.ts.
 * Copyright (C) 2026 Jang-Ho Hwang
 * SPDX-License-Identifier: AGPL-3.0-only
 * Source: https://github.com/rath/orrery
 */
import { parseArgs } from 'node:util'

import type { BirthInput, SajuResult, ZiweiChart, LiuNianInfo, NatalChart } from '@orrery/core/types'
import { ELEMENT_HANJA, PILLAR_NAMES, PALACE_NAMES, MAIN_STAR_NAMES } from '@orrery/core/constants'
import { calculateSaju } from '@orrery/core/saju'
import { createChart, calculateLiunian, getDaxianList } from '@orrery/core/ziwei'
import { DEFAULT_TIMEZONE, getBirthTimezone } from '@orrery/core/timezone'
import { calculateNatal, ZODIAC_SYMBOLS, PLANET_SYMBOLS, ASPECT_SYMBOLS, ROMAN, formatDegree, HOUSE_SYSTEMS } from '@orrery/core/natal'

type Locale = 'ko' | 'en'

interface TextExportOptions {
  ziweiYear?: number | null
  houseSystem?: string
  locale?: Locale
}

interface ZiweiTextOptions {
  timezone?: string
  locale?: Locale
}

/** 화면과 같은 선택 조건으로 세 계산 결과를 모은다. */
export async function allChartsToText(input: BirthInput, options: TextExportOptions = {}): Promise<string> {
  const locale = options.locale ?? 'ko'
  const parts = [sajuToText(calculateSaju(input), locale)]
  if (!input.unknownTime) {
    const chart = createChart(
      input.year, input.month, input.day, input.hour, input.minute,
      input.gender === 'M', input.timezone, input.longitude,
    )
    const year = options.ziweiYear ?? new Date().getFullYear()
    parts.push(ziweiToText(chart, calculateLiunian(chart, year), { timezone: getBirthTimezone(input), locale }))
  }
  parts.push(natalToText(await calculateNatal(input, options.houseSystem)))
  return parts.join('\n\n')
}

const KO_TEXT: Record<string, string> = {
  'export.timeKst': '시각 기준: KST(UTC+09:00) 벽시계로 정규화; 역사적 표준시·서머타임 보정',
  'export.timeSolar': '시각 기준: IANA 현지 시각 → UTC → 경도·균시차 기반 진태양시',
  'export.timeUnspecified': '시각 기준: 원본 타임존 정보 미제공',
  'export.sajuCalendar': '계산 기준: 年柱는 立春, 月柱는 천문 절입 시각 기준',
  'export.sajuUnified': '子時法: 통자시 — 子時는 {start}부터, 日柱를 다음날로 전환',
  'export.sajuSplit': '子時法: 야자시 — 子時는 {start}부터, 00:00 전 日柱는 당일·時干은 익일 기준',
  'export.sajuAge': '大運 표시 나이: 시작 연도 − 보정된 출생 연도 (생일 기준 만 나이 아님)',
  'export.ziweiCalendar': '계산 기준: 음력 달력(lunar-javascript); 年柱·流年은 설날 기준',
  'export.ziweiTime': '子時: 23:00–01:00; 보정된 시각의 23시에는 음력 날짜를 당일로 유지',
  'export.ziweiLeap': '閏月: 본월로 처리 (반월 분할 없음)',
  'export.ziweiAge': '大限·流年 나이: 세는나이 = 조회 음력년 − 출생 음력년 + 1',
  'export.ziweiFlowYear': '기간: 해당 음력년의 설날부터 다음 설날 전날까지',
  'export.ziweiMonths': '流月 (음력 1–12월 · 斗君 기준 명궁 위치 요약)',
  'saju.sipsin': '십신',
  'saju.cheongan': '천간',
  'saju.jiji': '지지',
  'saju.unseong': '운성',
  'saju.janggan': '장간',
  'saju.gongmang': '공망',
  'saju.unknownTimeWarning': '출생 시간 없이 정오(12:00) 기준으로 계산하여 대운 시작 시기에 수개월 오차가 있을 수 있습니다.',
  'saju.ageSuffix': '세',
  'saju.sal.cheonul': '천을귀인',
  'saju.sal.cheonduk': '천덕귀인',
  'saju.sal.wolduk': '월덕귀인',
  'saju.sal.munchang': '문창귀인',
  'saju.sal.geumyeo': '금여록',
  'saju.sal.yangin': '양인살',
  'saju.sal.dohwa': '도화살',
  'saju.sal.baekho': '백호살',
  'saju.sal.goegang': '괴강살',
  'saju.sal.hongyeom': '홍염살',
  'saju.injong.desc': '— 누락 십성의 양간 인종',
}

const EN_TEXT: Record<string, string> = {
  'export.natalBasis': 'Calculation basis: tropical zodiac · geocentric positions · mean lunar node',
  'export.natalTime': 'Time basis: IANA local time → UTC (historical offsets and DST applied)',
  'export.natalHouses': 'Houses: {system}; cusp start inclusive, next cusp exclusive',
  'natal.unknownTime': 'Calculated based on noon (12:00) without birth time.',
  'natal.unknownTimeDetail': 'The Moon may have up to ±6° error, and ASC / house placements are not displayed.',
  'planet.NorthNode': 'North Node',
  'planet.SouthNode': 'South Node',
}

/** 보고서에서 사용하는 고정 한국어/영어 문구를 반환한다. */
function makeT(locale: Locale = 'ko') {
  return (key: string): string => {
    if (locale === 'ko') return KO_TEXT[key] ?? key
    if (key.startsWith('planet.')) return EN_TEXT[key] ?? key.slice('planet.'.length)
    if (key.startsWith('zodiac.')) return key.slice('zodiac.'.length)
    return EN_TEXT[key] ?? key
  }
}

/** 2글자 한자 포맷 (1글자면 앞뒤에 공백) */
function fmt2(value: string): string {
  return value.length === 1 ? ` ${value} ` : value
}

function timeBasisKey(timezone?: string): string {
  if (timezone == null) return 'export.timeUnspecified'
  return timezone === DEFAULT_TIMEZONE ? 'export.timeKst' : 'export.timeSolar'
}

/** 사주 결과를 CLI 형식 텍스트로 변환 */
export function sajuToText(result: SajuResult, locale?: Locale): string {
  const t = makeT(locale)
  const { input, pillars, daewoon, relations, specialSals, gongmang } = result
  const lines: string[] = []
  const genderChar = input.gender === 'M' ? '男' : '女'

  lines.push(`四柱八字 (${genderChar})`)
  lines.push('─────')
  const timezone = getBirthTimezone(input)
  lines.push(t('export.sajuCalendar'))
  lines.push(t(timeBasisKey(timezone)))
  const ziStart = timezone === DEFAULT_TIMEZONE ? '23:30' : '23:00'
  lines.push(t(input.jasiMethod === 'split' ? 'export.sajuSplit' : 'export.sajuUnified').replace('{start}', ziStart))
  lines.push(t('export.sajuAge'))
  lines.push('')

  const labels = ['時柱', '日柱', '月柱', '年柱']
  const q = input.unknownTime

  lines.push(`       ${labels.join('    ')}`)
  lines.push('─────')
  lines.push(`${t('saju.sipsin')}   ${pillars.map((p, i) => fmt2(i === 0 && q ? '? ' : p.stemSipsin)).join('    ')}`)
  lines.push(`${t('saju.cheongan')}     ${pillars.map((p, i) => i === 0 && q ? '?' : p.pillar.stem).join('      ')}`)
  lines.push(`${t('saju.jiji')}     ${pillars.map((p, i) => i === 0 && q ? '?' : p.pillar.branch).join('      ')}`)
  lines.push(`${t('saju.sipsin')}   ${pillars.map((p, i) => fmt2(i === 0 && q ? '? ' : p.branchSipsin)).join('    ')}`)
  lines.push('─────')
  lines.push(`${t('saju.unseong')}   ${pillars.map((p, i) => fmt2(i === 0 && q ? '? ' : p.unseong)).join('    ')}`)
  const gmSet = new Set(gongmang.branches)
  lines.push(`${t('saju.gongmang')}   ${pillars.map((p, i) => fmt2(i === 0 && q ? '? ' : (i !== 1 && gmSet.has(p.pillar.branch) ? '空 ' : '  '))).join('    ')}`)
  lines.push(`${t('saju.janggan')}  ${pillars.map((p, i) => i === 0 && q ? '  ?  ' : p.jigang).join('  ')}`)
  lines.push(`${t('saju.gongmang')}: ${gongmang.branches[0]}${gongmang.branches[1]}`)
  lines.push('')

  // 팔자 관계
  const relLines: string[] = []
  const pairNames: Record<string, string> = {
    '0,1': '時-日', '0,2': '時-月', '0,3': '時-年',
    '1,2': '日-月', '1,3': '日-年', '2,3': '月-年',
  }

  const ganzis = pillars.map(p => p.pillar.ganzi)

  relations.pairs.forEach((rel, key) => {
    const [iStr, jStr] = key.split(',')
    const i = Number(iStr)
    const j = Number(jStr)
    const parts: string[] = []

    for (const r of rel.stem) {
      const detail = r.detail && ELEMENT_HANJA[r.detail] ? ELEMENT_HANJA[r.detail] : ''
      parts.push(`${ganzis[i][0]}${ganzis[j][0]}${r.type}${detail}`)
    }
    for (const r of rel.branch) {
      const detail = r.detail && ELEMENT_HANJA[r.detail]
        ? ELEMENT_HANJA[r.detail]
        : r.detail ? `(${r.detail})` : ''
      parts.push(`${ganzis[i][1]}${ganzis[j][1]}${r.type}${detail}`)
    }
    if (parts.length > 0) {
      relLines.push(`${pairNames[key] || key}: ${parts.join(', ')}`)
    }
  })

  for (const rel of relations.triple) {
    const el = rel.detail && ELEMENT_HANJA[rel.detail] ? ELEMENT_HANJA[rel.detail] : ''
    relLines.push(`${rel.type}${el}局`)
  }
  for (const rel of relations.directional) {
    const el = rel.detail && ELEMENT_HANJA[rel.detail] ? ELEMENT_HANJA[rel.detail] : ''
    relLines.push(`${rel.type}${el}`)
  }

  if (relLines.length > 0) {
    lines.push('八字關係')
    lines.push('─────')
    relLines.forEach(l => lines.push(l))
    lines.push('')
  }

  // 신살
  const salItems: string[] = []
  // 길신
  if (specialSals.cheonul.length > 0)
    salItems.push(`${t('saju.sal.cheonul')}(${specialSals.cheonul.map(i => PILLAR_NAMES[i]).join(',')})`)
  if (specialSals.cheonduk.length > 0)
    salItems.push(`${t('saju.sal.cheonduk')}(${specialSals.cheonduk.map(i => PILLAR_NAMES[i]).join(',')})`)
  if (specialSals.wolduk.length > 0)
    salItems.push(`${t('saju.sal.wolduk')}(${specialSals.wolduk.map(i => PILLAR_NAMES[i]).join(',')})`)
  if (specialSals.munchang.length > 0)
    salItems.push(`${t('saju.sal.munchang')}(${specialSals.munchang.map(i => PILLAR_NAMES[i]).join(',')})`)
  if (specialSals.geumyeo.length > 0)
    salItems.push(`${t('saju.sal.geumyeo')}(${specialSals.geumyeo.map(i => PILLAR_NAMES[i]).join(',')})`)
  // 흉신
  if (specialSals.yangin.length > 0)
    salItems.push(`${t('saju.sal.yangin')}(${specialSals.yangin.map(i => PILLAR_NAMES[i]).join(',')})`)
  if (specialSals.dohwa.length > 0)
    salItems.push(`${t('saju.sal.dohwa')}(${specialSals.dohwa.map(i => PILLAR_NAMES[i]).join(',')})`)
  if (specialSals.baekho) salItems.push(t('saju.sal.baekho'))
  if (specialSals.goegang) salItems.push(t('saju.sal.goegang'))
  if (specialSals.hongyeom) salItems.push(t('saju.sal.hongyeom'))
  if (salItems.length > 0) {
    lines.push('神殺')
    lines.push('─────')
    lines.push(salItems.join(' · '))
    lines.push('')
  }

  // 좌법
  if (result.jwabeop) {
    lines.push(`坐法 (${t('saju.janggan')} → ${t('saju.unseong')})`)
    lines.push('─────')
    const pillarLabels = ['時柱', '日柱', '月柱', '年柱']
    result.jwabeop.forEach((entries, i) => {
      if (i === 0 && input.unknownTime) return
      const parts = entries.map(e => `${e.stem}(${e.sipsin}·${e.unseong}坐)`).join(' ')
      lines.push(`${pillarLabels[i]}: ${parts}`)
    })
    lines.push('')
  }

  // 인종법
  if (result.injongbeop && result.injongbeop.length > 0) {
    lines.push(`引從法 (${t('saju.injong.desc').replace(/^— /, '')})`)
    lines.push('─────')
    const parts = result.injongbeop.map(e => `${e.yangStem} ${e.category} → ${e.unseong}從`)
    lines.push(parts.join(' · '))
    lines.push('')
  }

  // 대운
  if (daewoon.length > 0) {
    lines.push(input.unknownTime ? `大運 (${t('saju.unknownTimeWarning')})` : '大運')
    lines.push('─────')
    for (const dw of daewoon) {
      const gmMark = dw.isGongmang ? ' 空' : ''
      lines.push(`${String(dw.index).padStart(2)}運 (${String(dw.age).padStart(2)}${t('saju.ageSuffix')})  ${fmt2(dw.stemSipsin)}  ${dw.ganzi}  ${fmt2(dw.branchSipsin)}  (${dw.startDate.getUTCFullYear()}年)${gmMark}`)
    }
  }

  return lines.join('\n')
}

/** 자미두수 명반을 텍스트로 변환 */
export function ziweiToText(chart: ZiweiChart, liunian?: LiuNianInfo, options: ZiweiTextOptions = {}): string {
  const t = makeT(options.locale)
  const lines: string[] = []
  const genderChar = chart.isMale ? '男' : '女'

  lines.push(`紫微斗數 命盤 (${genderChar})`)
  lines.push('═════')
  lines.push(t('export.ziweiCalendar'))
  lines.push(t(timeBasisKey(options.timezone)))
  lines.push(t('export.ziweiTime'))
  lines.push(t('export.ziweiLeap'))
  lines.push(t('export.ziweiAge'))
  lines.push('')
  lines.push(`年柱: ${chart.yearGan}${chart.yearZhi}`)

  const mingPalace = chart.palaces['命宮']
  lines.push(`命宮: ${mingPalace?.gan ?? ''}${mingPalace?.zhi ?? ''}`)

  // 신궁 찾기
  let shenPalaceName = ''
  for (const p of Object.values(chart.palaces)) {
    if (p.isShenGong) { shenPalaceName = p.name; break }
  }
  lines.push(`身宮: ${shenPalaceName} (${chart.shenGongZhi})`)
  lines.push(`五行局: ${chart.wuXingJu.name}`)
  lines.push(`大限起始: ${chart.daXianStartAge}歲`)
  lines.push('')

  // 12궁
  lines.push('十二宮')
  lines.push('─────')
  for (const palaceName of PALACE_NAMES) {
    const palace = chart.palaces[palaceName]
    if (!palace) continue

    const shenMark = palace.isShenGong ? '·身' : '  '
    const mainStars = palace.stars.filter(s => MAIN_STAR_NAMES.has(s.name))
    const auxStars = palace.stars.filter(s => !MAIN_STAR_NAMES.has(s.name))

    const mainStr = mainStars.length > 0
      ? mainStars.map(s => {
          let name = s.name
          if (s.brightness) name += ` ${s.brightness}`
          if (s.siHua) name += ` ${s.siHua}`
          return name
        }).join(', ')
      : '(空宮)'

    lines.push(`${palace.name}${shenMark} ${palace.ganZhi}  ${mainStr}`)

    if (auxStars.length > 0) {
      const luckyNames = new Set(['左輔', '右弼', '文昌', '文曲', '天魁', '天鉞', '祿存', '天馬'])
      const lucky = auxStars.filter(s => luckyNames.has(s.name)).map(s => s.name)
      const sha = auxStars.filter(s => !luckyNames.has(s.name)).map(s => s.name)
      const parts: string[] = []
      if (lucky.length > 0) parts.push(`吉: ${lucky.join(' ')}`)
      if (sha.length > 0) parts.push(`煞: ${sha.join(' ')}`)
      if (parts.length > 0) lines.push(`          ${parts.join(' | ')}`)
    }
  }

  // 사화 요약
  lines.push('')
  lines.push('四化')
  lines.push('─────')
  const huaOrder = ['化祿', '化權', '化科', '化忌']
  for (const huaType of huaOrder) {
    for (const palace of Object.values(chart.palaces)) {
      for (const star of palace.stars) {
        if (star.siHua === huaType) {
          lines.push(`${huaType}: ${star.name} 在 ${palace.name}`)
        }
      }
    }
  }

  // 대운
  lines.push('')
  lines.push('大限')
  lines.push('─────')
  const daxianList = getDaxianList(chart)
  for (const dx of daxianList) {
    const stars = dx.mainStars.length > 0 ? dx.mainStars.join(' ') : '(空宮)'
    lines.push(`${String(dx.ageStart).padStart(3)}-${String(dx.ageEnd).padStart(3)}歲  ${dx.palaceName}  ${dx.ganZhi}  ${stars}`)
  }

  // 유년
  if (liunian) {
    lines.push('')
    lines.push(`流年 (${liunian.year}年 ${liunian.gan}${liunian.zhi}年)`)
    lines.push('═════')
    lines.push(t('export.ziweiFlowYear'))
    lines.push(`大限: ${liunian.daxianAgeStart}-${liunian.daxianAgeEnd}歲 ${liunian.daxianPalaceName}`)
    lines.push(`流年命宮: ${liunian.mingGongZhi}宮 → 本命 ${liunian.natalPalaceAtMing}`)

    for (const huaType of ['化祿', '化權', '化科', '化忌']) {
      let starName = ''
      for (const [s, h] of Object.entries(liunian.siHua)) {
        if (h === huaType) { starName = s; break }
      }
      const palaceName = liunian.siHuaPalaces[huaType] || '?'
      if (starName) lines.push(`${huaType}: ${starName} → ${palaceName}`)
    }

    lines.push('')
    lines.push(t('export.ziweiMonths'))
    lines.push('─────')
    const lunarMonthNames = ['正月', '二月', '三月', '四月', '五月', '六月',
                              '七月', '八月', '九月', '十月', '冬月', '臘月']
    for (const ly of liunian.liuyue) {
      lines.push(`${lunarMonthNames[ly.month - 1]} (${ly.mingGongZhi}): ${ly.natalPalaceName}`)
    }
  }

  return lines.join('\n')
}

/** Natal Chart를 텍스트로 변환 */
export function natalToText(chart: NatalChart, houseSystemName = 'Placidus'): string {
  houseSystemName = HOUSE_SYSTEMS.find(([code]) => code === chart.houseSystem)?.[1] ?? houseSystemName
  const t = makeT('en')
  const lines: string[] = []
  const hasHouses = chart.angles != null

  lines.push('Natal Chart')
  if (!hasHouses) lines.push(`(${t('natal.unknownTime')})`)
  lines.push('═════')
  lines.push(t('export.natalBasis'))
  lines.push(t('export.natalTime'))
  if (hasHouses) {
    lines.push(t('export.natalHouses').replace('{system}', houseSystemName))
  } else {
    lines.push(t('natal.unknownTimeDetail'))
  }
  lines.push('')

  // Angles
  if (chart.angles) {
    lines.push('Angles')
    lines.push('─────')
    for (const [label, a] of [['ASC', chart.angles.asc], ['MC', chart.angles.mc]] as const) {
      lines.push(`${label}  ${ZODIAC_SYMBOLS[a.sign]} ${t(`zodiac.${a.sign}`)} ${formatDegree(a.longitude)}`)
    }
    lines.push('')
  }

  // Planets
  lines.push('Planets')
  lines.push('─────')
  for (const p of chart.planets) {
    const retro = p.isRetrograde ? ' R' : '  '
    const sym = PLANET_SYMBOLS[p.id]
    const signSym = ZODIAC_SYMBOLS[p.sign]
    const planetName = t(`planet.${p.id}`)
    const signName = t(`zodiac.${p.sign}`)
    const housePart = p.house != null ? ` ${ROMAN[p.house - 1].padStart(5)}` : ''
    lines.push(`${sym} ${planetName.padEnd(10)} ${signSym} ${signName.padEnd(12)} ${formatDegree(p.longitude)}${retro}${housePart}`)
  }
  lines.push('')

  // Houses
  if (hasHouses && chart.houses.length > 0) {
    lines.push(`Houses (${houseSystemName})`)
    lines.push('─────')
    for (const h of chart.houses) {
      lines.push(`${ROMAN[h.number - 1].padStart(4)}  ${ZODIAC_SYMBOLS[h.sign]} ${t(`zodiac.${h.sign}`).padEnd(12)} ${formatDegree(h.cuspLongitude)}`)
    }
    lines.push('')
  }

  // Aspects
  lines.push('Major Aspects')
  lines.push('─────')
  for (const a of chart.aspects) {
    const sym1 = PLANET_SYMBOLS[a.planet1]
    const sym2 = PLANET_SYMBOLS[a.planet2]
    const aspSym = ASPECT_SYMBOLS[a.type]
    lines.push(`${sym1} ${t(`planet.${a.planet1}`).padEnd(10)} ${aspSym} ${sym2} ${t(`planet.${a.planet2}`).padEnd(10)} orb ${a.orb.toFixed(1)}°`)
  }

  return lines.join('\n')
}

const USAGE = `Usage:
  bun scripts/chart-report.ts \\
    --year <year> --month <month> --day <day> \\
    --hour <hour> --minute <minute> --gender <M|F> \\
    --latitude <latitude> --longitude <longitude> \\
    --timezone <IANA timezone> [--flow-year <year>] \\
    [--jasi-method <unified|split>] [--house-system <code>]`

interface CliReportRequest {
  input: BirthInput
  ziweiYear: number
  houseSystem: string
}

function requiredNumber(value: string | undefined, name: string): number {
  if (value == null || value === '') throw new Error(`Missing required option: --${name}`)
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error(`--${name} must be a number`)
  return parsed
}

export function parseCliArguments(args: string[]): CliReportRequest {
  const { values } = parseArgs({
    args,
    options: {
      year: { type: 'string' },
      month: { type: 'string' },
      day: { type: 'string' },
      hour: { type: 'string' },
      minute: { type: 'string' },
      gender: { type: 'string' },
      latitude: { type: 'string' },
      longitude: { type: 'string' },
      timezone: { type: 'string' },
      'flow-year': { type: 'string' },
      'jasi-method': { type: 'string', default: 'unified' },
      'house-system': { type: 'string', default: 'P' },
    },
    strict: true,
  })

  if (values.gender == null || values.gender === '') {
    throw new Error('Missing required option: --gender')
  }
  if (values.gender !== 'M' && values.gender !== 'F') {
    throw new Error('--gender must be M or F')
  }
  if (values.timezone == null || values.timezone === '') {
    throw new Error('Missing required option: --timezone')
  }
  if (values['jasi-method'] !== 'unified' && values['jasi-method'] !== 'split') {
    throw new Error('--jasi-method must be unified or split')
  }

  const currentYear = new Date().getFullYear()
  return {
    input: {
      year: requiredNumber(values.year, 'year'),
      month: requiredNumber(values.month, 'month'),
      day: requiredNumber(values.day, 'day'),
      hour: requiredNumber(values.hour, 'hour'),
      minute: requiredNumber(values.minute, 'minute'),
      gender: values.gender,
      latitude: requiredNumber(values.latitude, 'latitude'),
      longitude: requiredNumber(values.longitude, 'longitude'),
      timezone: values.timezone,
      jasiMethod: values['jasi-method'],
    },
    ziweiYear: values['flow-year'] == null
      ? currentYear
      : requiredNumber(values['flow-year'], 'flow-year'),
    houseSystem: values['house-system'],
  }
}

if (import.meta.main) {
  try {
    const request = parseCliArguments(process.argv.slice(2))
    console.log(await allChartsToText(request.input, {
      ziweiYear: request.ziweiYear,
      houseSystem: request.houseSystem,
    }))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    console.error(`\n${USAGE}`)
    process.exitCode = 1
  }
}
