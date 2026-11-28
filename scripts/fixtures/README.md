# 문서 품질의 합성 평가 사례

이 자료는 직접 작성한 가상 예시다. 실제 개인 입력·해석 전체나 로컬 실행과의 매핑은 없다.

| 자료 | 용도 | 실행·검토 방법 |
| --- | --- | --- |
| [three-agent-workflow-cases.json](three-agent-workflow-cases.json) | 무근거 기대값·구현 결함·검증 범위·승인 버전의 합성 수용 사례 | [3개 에이전트 작업 흐름](../../docs/spec/three-agent-implementation-workflow.md)의 요구와 비교해 수동 검토 |

3개 에이전트 자료는 리뷰 판단의 입력과 기대 처리만 정의한다. 에이전트가 실제로 역할을
분리했는지, 지적을 반영했는지, 같은 버전을 실행했는지는 각 실행에서 별도 확인한다.
임시 과제의 `normalizeLabel` 자동 테스트는 앞뒤 공백 제거·내부 공백 보존·빈 결과 오류를
확인하며, 이 JSON의 리뷰 판단이나 의미 품질을 자동 검증하지 않는다.

결정적 검증은 기존 테스트 안의 합성 자료를 재사용한다.

- 사주 1차 판단 문서 구조·근거 인용: `bun test scripts/check-saju-judgment.test.ts` (`saju-judgment/`의 차트·사실은 합성 출생 입력의 chart-report 출력이고, 판단 문서는 직접 쓴 가상 예시)
- 자미두수 1차 판단 문서 설정: `bun test scripts/check-ziwei-judgment.test.ts` (`ziwei-judgment/`도 같은 방식의 합성 자료)
- 네이탈 1차 판단 문서 설정: `bun test scripts/check-natal-judgment.test.ts` (`natal-judgment/`도 같은 방식의 합성 자료)
- 사주 일생 해석 문서 구조·인용: `bun test scripts/check-life-document.test.ts` (`saju-life/`는 같은 합성 입력의 현재 사실 파일, 합성 1차 판단과 그 판단 파생 사실, 직접 쓴 가상 일생 해석)
- 자미두수 일생 해석 설정: 같은 테스트 (`ziwei-life/`도 같은 방식의 합성 자료)
- 네이탈 일생 해석 설정: 같은 테스트 (`natal-life/`도 같은 방식의 합성 자료이고 판단 파생 사실은 없음)
- 세 체계 일생 통합 재료표: `bun test scripts/assemble-life-material.test.ts` (위 세 일생 해석 fixture를 그대로 입력으로 쓰며, 서로 다른 합성 출생 입력이다)
- 세 체계 일생 통합 문서 구조·인용: `bun test scripts/check-life-integration.test.ts` (`life-integration/life.md`는 위 세 일생 해석 fixture를 재료로 직접 쓴 가상 통합 문서)
- GDD 차트 명칭 검사: `bun test scripts/check-gdd.test.ts` (검사 문장은 테스트 안의 합성 예시)
- 차트 명칭 검사: `bun test scripts/chart-names.test.ts` (거부·허용 문장은 테스트 안의 합성 예시)

테스트 통과는 해당 구조 계약의 검증이며 실제 개인화 품질이나 과거 관찰 집계를 재현했다는
주장이 아니다. 새 모델 실험이 필요하면 합성 입력으로 별도 실행하고 결과는 로컬 run에 둔다.
