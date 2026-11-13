const domains = ['성격과 기질', '직업과 적성', '재물', '연애와 배우자', '가족과 대인관계', '건강과 생활 리듬', '시기운']
const headings = ['# 사주팔자 심층 해석', '## 계산 전제', '## 원국과 십신 구조', '## 팔자 관계', '## 신살', '## 좌법과 인종법', '## 대운', '## 전문 해석 항목']
export const syntheticSajuInterpretation = headings.join('\n') + '\n' + domains.map((domain, index) => `### S-0${index + 1}\n영역: ${domain}\n해상도: ${['원국 구조', '관계 작용', '운의 변화'][index % 3]}\n해석: ${'이 차트의 근거를 실제 생활의 선택과 반응 방식에 연결하여 강점과 마찰의 조건을 구체적으로 설명한다. '.repeat(2)}\n근거: S-E0000000000000001`).join('\n')
