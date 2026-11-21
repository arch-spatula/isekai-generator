/**
 * 일생 서사의 생애 단계. 나이는 출생 연도 차(사주 大運 표시 나이와 같은 기준)다.
 * 계약: docs/spec/life-narrative-interpretation.md
 */
export interface LifeStage { name: string; from: number; to: number | null }

export const LIFE_STAGES: LifeStage[] = [
  { name: '유년', from: 0, to: 12 },
  { name: '소년', from: 13, to: 19 },
  { name: '청년', from: 20, to: 34 },
  { name: '장년', from: 35, to: 54 },
  { name: '노년', from: 55, to: null },
]

export function stageLabel(stage: LifeStage): string {
  return `${stage.name} ${stage.from}–${stage.to ?? ''}`
}

/** 구간 [from, to]가 단계와 겹치는지 */
export function overlaps(stage: LifeStage, from: number, to: number): boolean {
  return from <= (stage.to ?? Infinity) && to >= stage.from
}
