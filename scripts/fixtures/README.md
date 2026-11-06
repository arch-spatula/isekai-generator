# 문서 품질의 합성 평가 사례

이 자료는 직접 작성한 가상 예시다. 실제 개인 입력·해석 전체나 로컬 실행과의 매핑은 없다.

| 자료 | 용도 | 실행·검토 방법 |
| --- | --- | --- |
| [interpretation-quality-cases.json](interpretation-quality-cases.json) | 방어적 문구와 정당한 범위·조건 설명의 비교 | `expected`와 이유를 기준으로 수동 검토. 의미 검증은 아직 미구현 |
| [gdd-translation-cases.json](gdd-translation-cases.json) | 표면 직역과 행동 패턴 변환의 비교 | [GDD 개선 계획](../../docs/GDD/personalized-gdd-remediation-plan.md)의 평가표로 수동 검토 |

결정적 검증은 기존 테스트 안의 합성 자료를 재사용한다.

- 구분선과 의미 근거: `bun test ./.agents/skills/generate-chart-report/scripts/run-chart-report.test.ts`
- 잘못된·누락된 evidence: `bun test ./.agents/skills/interpret-chart-system/scripts/validate-system-interpretation.test.ts`
- 전투 지문과 후보 거리: `bun test ./.agents/skills/select-gameplay-concept/scripts`
- 세계 지문의 구조 비교: `bun test ./.agents/skills/select-world-concept/scripts`
- GDD 계약: `bun test ./.agents/skills/generate-gdd-from-interpretation/scripts/validate-gdd.test.ts`

테스트 통과는 해당 구조 계약의 검증이며 실제 개인화 품질이나 과거 관찰 집계를 재현했다는
주장이 아니다. 새 모델 실험이 필요하면 합성 입력으로 별도 실행하고 결과는 로컬 run에 둔다.
