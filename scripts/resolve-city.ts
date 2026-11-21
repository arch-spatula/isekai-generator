/**
 * 도시명을 chart-report.ts 입력값(위도·경도·IANA timezone)으로 결정론적으로 변환한다.
 * 도시 목록은 @orrery/core/cities를 그대로 쓰고, 해외 도시 timezone만 이 파일의 표로 보탠다.
 */
import { KOREAN_CITIES, WORLD_CITIES, filterCities, formatCityName } from '@orrery/core/cities'
import type { City } from '@orrery/core/cities'

const KOREA_TIMEZONE = 'Asia/Seoul'

/** WORLD_CITIES 이름 → IANA timezone. 여러 timezone을 가진 나라는 도시 단위로 정한다. */
export const WORLD_CITY_TIMEZONES: Readonly<Record<string, string>> = {
  도쿄: 'Asia/Tokyo', 오사카: 'Asia/Tokyo', 교토: 'Asia/Tokyo', 후쿠오카: 'Asia/Tokyo', 삿포로: 'Asia/Tokyo', 나고야: 'Asia/Tokyo',
  베이징: 'Asia/Shanghai', 상하이: 'Asia/Shanghai', 광저우: 'Asia/Shanghai', 선전: 'Asia/Shanghai', 청두: 'Asia/Shanghai', 충칭: 'Asia/Shanghai', 시안: 'Asia/Shanghai',
  홍콩: 'Asia/Hong_Kong', 타이베이: 'Asia/Taipei', 울란바토르: 'Asia/Ulaanbaatar', 평양: 'Asia/Pyongyang',
  방콕: 'Asia/Bangkok', 하노이: 'Asia/Bangkok', 호치민: 'Asia/Ho_Chi_Minh', 다낭: 'Asia/Ho_Chi_Minh',
  자카르타: 'Asia/Jakarta', 발리: 'Asia/Makassar', 싱가포르: 'Asia/Singapore', 쿠알라룸푸르: 'Asia/Kuala_Lumpur',
  마닐라: 'Asia/Manila', 세부: 'Asia/Manila', 양곤: 'Asia/Yangon', 프놈펜: 'Asia/Phnom_Penh', 비엔티안: 'Asia/Vientiane',
  뉴델리: 'Asia/Kolkata', 뭄바이: 'Asia/Kolkata', 벵갈루루: 'Asia/Kolkata', 다카: 'Asia/Dhaka',
  이슬라마바드: 'Asia/Karachi', 카라치: 'Asia/Karachi', 카트만두: 'Asia/Kathmandu', 콜롬보: 'Asia/Colombo',
  아스타나: 'Asia/Almaty', 알마티: 'Asia/Almaty', 타슈켄트: 'Asia/Tashkent', 비슈케크: 'Asia/Bishkek', 두샨베: 'Asia/Dushanbe', 아시가바트: 'Asia/Ashgabat',
  테헤란: 'Asia/Tehran', 바그다드: 'Asia/Baghdad', 리야드: 'Asia/Riyadh', 제다: 'Asia/Riyadh', 두바이: 'Asia/Dubai', 아부다비: 'Asia/Dubai',
  도하: 'Asia/Qatar', 쿠웨이트시티: 'Asia/Kuwait', 앙카라: 'Europe/Istanbul', 이스탄불: 'Europe/Istanbul',
  텔아비브: 'Asia/Jerusalem', 예루살렘: 'Asia/Jerusalem', 베이루트: 'Asia/Beirut', 암만: 'Asia/Amman', 다마스쿠스: 'Asia/Damascus',
  트빌리시: 'Asia/Tbilisi', 바쿠: 'Asia/Baku', 예레반: 'Asia/Yerevan',
  런던: 'Europe/London', 에든버러: 'Europe/London', 맨체스터: 'Europe/London',
  파리: 'Europe/Paris', 마르세유: 'Europe/Paris', 리옹: 'Europe/Paris',
  베를린: 'Europe/Berlin', 뮌헨: 'Europe/Berlin', 함부르크: 'Europe/Berlin', 프랑크푸르트: 'Europe/Berlin',
  암스테르담: 'Europe/Amsterdam', 브뤼셀: 'Europe/Brussels', 룩셈부르크: 'Europe/Luxembourg',
  마드리드: 'Europe/Madrid', 바르셀로나: 'Europe/Madrid', 로마: 'Europe/Rome', 밀라노: 'Europe/Rome', 나폴리: 'Europe/Rome',
  리스본: 'Europe/Lisbon', 아테네: 'Europe/Athens', 빈: 'Europe/Vienna', 베른: 'Europe/Zurich', 취리히: 'Europe/Zurich', 제네바: 'Europe/Zurich',
  프라하: 'Europe/Prague', 바르샤바: 'Europe/Warsaw', 크라쿠프: 'Europe/Warsaw', 부다페스트: 'Europe/Budapest',
  부쿠레슈티: 'Europe/Bucharest', 소피아: 'Europe/Sofia', 자그레브: 'Europe/Zagreb', 류블랴나: 'Europe/Ljubljana',
  베오그라드: 'Europe/Belgrade', 사라예보: 'Europe/Sarajevo', 티라나: 'Europe/Tirane',
  헬싱키: 'Europe/Helsinki', 스톡홀름: 'Europe/Stockholm', 오슬로: 'Europe/Oslo', 코펜하겐: 'Europe/Copenhagen',
  레이캬비크: 'Atlantic/Reykjavik', 더블린: 'Europe/Dublin', 탈린: 'Europe/Tallinn', 리가: 'Europe/Riga', 빌뉴스: 'Europe/Vilnius',
  모스크바: 'Europe/Moscow', 상트페테르부르크: 'Europe/Moscow', 블라디보스토크: 'Asia/Vladivostok',
  키이우: 'Europe/Kyiv', 민스크: 'Europe/Minsk', 키시너우: 'Europe/Chisinau',
  '워싱턴 D.C.':'America/New_York', 뉴욕: 'America/New_York', 보스턴: 'America/New_York', 마이애미: 'America/New_York', 애틀랜타: 'America/New_York',
  시카고: 'America/Chicago', 휴스턴: 'America/Chicago', 댈러스: 'America/Chicago', 덴버: 'America/Denver',
  로스앤젤레스: 'America/Los_Angeles', 샌프란시스코: 'America/Los_Angeles', 시애틀: 'America/Los_Angeles', 라스베이거스: 'America/Los_Angeles',
  호놀룰루: 'Pacific/Honolulu',
  오타와: 'America/Toronto', 토론토: 'America/Toronto', 몬트리올: 'America/Toronto', 밴쿠버: 'America/Vancouver',
  멕시코시티: 'America/Mexico_City', 칸쿤: 'America/Cancun', 아바나: 'America/Havana', 산토도밍고: 'America/Santo_Domingo',
  과테말라시티: 'America/Guatemala', 산호세: 'America/Costa_Rica', 파나마시티: 'America/Panama', 산후안: 'America/Puerto_Rico', 킹스턴: 'America/Jamaica',
  보고타: 'America/Bogota', 리마: 'America/Lima', 키토: 'America/Guayaquil', 산티아고: 'America/Santiago',
  부에노스아이레스: 'America/Argentina/Buenos_Aires', 몬테비데오: 'America/Montevideo', 아순시온: 'America/Asuncion', 라파스: 'America/La_Paz',
  브라질리아: 'America/Sao_Paulo', 상파울루: 'America/Sao_Paulo', 리우데자네이루: 'America/Sao_Paulo', 카라카스: 'America/Caracas',
  카이로: 'Africa/Cairo', 나이로비: 'Africa/Nairobi', 아디스아바바: 'Africa/Addis_Ababa', 아크라: 'Africa/Accra',
  라고스: 'Africa/Lagos', 아부자: 'Africa/Lagos', 다르에스살람: 'Africa/Dar_es_Salaam',
  케이프타운: 'Africa/Johannesburg', 요하네스버그: 'Africa/Johannesburg', 알제: 'Africa/Algiers', 튀니스: 'Africa/Tunis',
  라바트: 'Africa/Casablanca', 카사블랑카: 'Africa/Casablanca', 캄팔라: 'Africa/Kampala', 루사카: 'Africa/Lusaka',
  하라레: 'Africa/Harare', 마푸투: 'Africa/Maputo', 안타나나리보: 'Indian/Antananarivo',
  캔버라: 'Australia/Sydney', 시드니: 'Australia/Sydney', 멜버른: 'Australia/Melbourne', 브리즈번: 'Australia/Brisbane', 퍼스: 'Australia/Perth',
  웰링턴: 'Pacific/Auckland', 오클랜드: 'Pacific/Auckland',
}

export interface ResolvedCity {
  /** 사용자에게 보여줄 도시 표시명 (예: "광주 (경기도)", "뉴욕, 미국") */
  label: string
  latitude: number
  longitude: number
  timezone: string
}

export type ResolveCityResult =
  | { status: 'resolved', city: ResolvedCity }
  | { status: 'ambiguous', candidates: string[] }
  | { status: 'not-found', candidates: string[] }

function timezoneOf(city: City): string {
  if (city.country == null) return KOREA_TIMEZONE
  const timezone = WORLD_CITY_TIMEZONES[city.name]
  if (timezone == null) throw new Error(`No timezone mapped for ${formatCityName(city)}`)
  return timezone
}

/** 도시명 또는 표시명과 정확히 일치할 때만 확정한다. 부분 일치는 후보로만 돌려준다. */
export function resolveCity(query: string): ResolveCityResult {
  const q = query.trim()
  const exact = [...KOREAN_CITIES, ...WORLD_CITIES].filter(
    (city) => city.name === q || formatCityName(city) === q,
  )
  if (exact.length === 1) {
    const city = exact[0]
    return {
      status: 'resolved',
      city: { label: formatCityName(city), latitude: city.lat, longitude: city.lon, timezone: timezoneOf(city) },
    }
  }
  if (exact.length > 1) return { status: 'ambiguous', candidates: exact.map(formatCityName) }
  return { status: 'not-found', candidates: filterCities(q).map(formatCityName) }
}

if (import.meta.main) {
  const query = process.argv.slice(2).join(' ')
  if (query.trim() === '') {
    console.error('Usage: bun scripts/resolve-city.ts <도시명>')
    process.exitCode = 1
  } else {
    console.log(JSON.stringify(resolveCity(query), null, 2))
  }
}
