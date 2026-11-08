/** Synthetic output outline taken from the requested contract, independently of product parsing. */
export const gddTitle = '# 개인화 액션 RPG 기획서'
export const gddSections = [
  '1. 게임 개요',
  '2. 플레이어 경험과 핵심 재미',
  '3. 주인공과 주요 인물',
  '4. 세계와 주요 지역',
  '5. 전투 시스템',
  '6. 능력의 기원과 성장',
  '7. 탐험과 게임 진행',
  '8. 서사와 인물 관계의 변화',
  '9. 대표 플레이 시나리오',
  '10. 개인화 설계 근거',
  '11. 구조화된 설계 선언',
] as const

export function gddTemplateFixture(declarations = ''): string {
  return gddTitle + '\n\n' + gddSections.map((heading, index) =>
    `## ${heading}\n\n${index === 0 ? '게임명: 유리 숲의 문지기' : '합성 설계 설명.'}${index === 10 ? '\n\n' + declarations : ''}`,
  ).join('\n\n') + '\n'
}
