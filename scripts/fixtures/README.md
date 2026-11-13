# 문서 품질의 합성 평가 사례

이 자료는 직접 작성한 가상 예시다. 실제 개인 입력·해석 전체나 로컬 실행과의 매핑은 없다.

| 자료 | 용도 | 실행·검토 방법 |
| --- | --- | --- |
| [interpretation-quality-cases.json](interpretation-quality-cases.json) | 방어적 문구와 정당한 범위·조건 설명의 비교 | `expected`와 이유를 기준으로 수동 검토. 의미 검증은 아직 미구현 |
| [gdd-translation-cases.json](gdd-translation-cases.json) | 표면 직역과 행동 패턴 변환의 비교 | [GDD 개선 계획](../../docs/GDD/personalized-gdd-remediation-plan.md)의 평가표로 수동 검토 |
| [ability-design-cases.json](ability-design-cases.json) | 능력 최초 설계와 기존 능력의 표현 개선 관찰 | 입력·요청과 관찰 질문으로 자유 기록. 성공·실패 필드와 고정 정답이 없으며 생성 스킬에는 자동 연결되지 않음 |
| [game-presentation-cases.json](game-presentation-cases.json) | 화면 선언과 본문 모순, 가독성·조작·빌드의 비교 | [공통 화면·아트 계약](../../docs/spec/game-presentation-contract.md)의 수용 기준으로 수동 검토 |
| [three-agent-workflow-cases.json](three-agent-workflow-cases.json) | 무근거 기대값·구현 결함·검증 범위·승인 버전의 합성 수용 사례 | [3개 에이전트 작업 흐름](../../docs/spec/three-agent-implementation-workflow.md)의 요구와 비교해 수동 검토 |

3개 에이전트 자료는 리뷰 판단의 입력과 기대 처리만 정의한다. 에이전트가 실제로 역할을
분리했는지, 지적을 반영했는지, 같은 버전을 실행했는지는 각 실행에서 별도 확인한다.
임시 과제의 `normalizeLabel` 자동 테스트는 앞뒤 공백 제거·내부 공백 보존·빈 결과 오류를
확인하며, 이 JSON의 리뷰 판단이나 의미 품질을 자동 검증하지 않는다.

`game-presentation.ts`는 parser와 독립적으로 작성한 합성 선언이다. 공통 프롬프트와의
일치, 선언 오류, 필수 입력, 단계 간 전파와 등록 거부는 `bun test scripts/game-presentation.test.ts`로
검증한다. 자연어 사례 JSON의 의미 판정이 자동화됐다는 뜻은 아니다.

결정적 검증은 기존 테스트 안의 합성 자료를 재사용한다.

- 구분선과 의미 근거: `bun test ./.agents/skills/generate-chart-report/scripts/run-chart-report.test.ts`
- 잘못된·누락된 evidence: `bun test ./.agents/skills/interpret-chart-system/scripts/validate-system-interpretation.test.ts`
- 전투 지문과 후보 거리: `bun test ./.agents/skills/select-gameplay-concept/scripts`
- 세계 지문의 구조 비교: `bun test ./.agents/skills/select-world-concept/scripts`
- GDD 계약: `bun test ./.agents/skills/generate-gdd-from-interpretation/scripts/validate-gdd.test.ts`

테스트 통과는 해당 구조 계약의 검증이며 실제 개인화 품질이나 과거 관찰 집계를 재현했다는
주장이 아니다. 새 모델 실험이 필요하면 합성 입력으로 별도 실행하고 결과는 로컬 run에 둔다.
