# 차트 근거 검증 경계선 장애 회고

## 요약

당시 로컬에서 생성된 네이탈 전문 해석은 내용·섹션·영역·해상도를 충족했지만, 차트 보고서의 장식 구분선 `═════`를 `- 검토:` 행으로 복제하지 않았다는 이유로 실패했다. 기존 validator는 `─────`만 구분선으로 제외하고 `═════`는 의미 있는 원문 행으로 취급했다.

이 장애는 LLM 해석 실패가 아니라 책임 배치 실패였다. 계산 스크립트가 결정론적으로 아는 원문 구조와 장식을 LLM이 다시 복사하게 만들고, validator가 그 복사 결과를 문자열 단위로 비교했다.

## 기존 구조의 문제

```text
결정론적 차트 출력
→ LLM이 모든 원문 행을 Markdown 검토표로 복제
→ validator가 원문 문자열과 검토표를 비교
```

이 구조에서는 다음이 의미 계약에 섞였다.

- 구분선 문자 종류
- 공백 정규화 방식
- 표시 순서와 섹션 제목
- LLM이 해석과 무관한 원문을 정확히 복사했는지 여부

그 결과 정상 해석이 포맷 실패로 보고됐고, 오류 메시지도 해석 실패와 복사 실패를 구분하지 못했다.

## 결정

고정 가능한 근거 추출과 커버리지 계산은 계산 단계가 담당한다.

`generate-chart-report`는 다음 두 파일을 함께 만든다.

- `chart-report.md`: 사람이 읽는 원본 계산 보고서
- `chart-evidence.json`: 기계가 검증하는 근거 manifest

manifest는 각 체계의 비어 있지 않은 의미 행을 정규화하고, 체계명과 내용의 SHA-256 해시에서 안정적인 ID를 만든다. 장식 구분선과 섹션 제목은 제외한다.

```text
S-E0123456789abcdef
Z-E0123456789abcdef
N-E0123456789abcdef
```

전문 해석은 원문 검토표를 생성하지 않는다. 각 `근거:`에서 manifest ID를 참조하고, validator는 다음만 검사한다.

- 참조 ID가 해당 체계 manifest에 존재하는가
- manifest의 모든 ID가 문서 전체에서 한 번 이상 사용됐는가
- 전문 ID·영역·해상도·해석 필드 계약이 유효한가

## 재현 근거와 테스트 원칙

원래 생성 문서는 저장소에 포함되지 않는 당시의 관찰 자료다. 재현은 개인 입력이나
원본 해석 대신 아래 합성 구분선 사례를 사용하는
[차트 보고서 테스트](../../.agents/skills/generate-chart-report/scripts/run-chart-report.test.ts)와
[전문 해석 테스트](../../.agents/skills/interpret-chart-system/scripts/validate-system-interpretation.test.ts)로 수행한다.

`bun test ./.agents/skills/generate-chart-report/scripts/run-chart-report.test.ts ./.agents/skills/interpret-chart-system/scripts/validate-system-interpretation.test.ts`

테스트는 더 이상 구분선 복사를 요구하지 않는다.

- `─────`와 `═════`를 바꿔도 evidence manifest는 동일해야 한다.
- 존재하지 않는 evidence ID를 인용하면 실패해야 한다.
- manifest의 의미 항목을 인용하지 않으면 실패해야 한다.
- Markdown 장식, 구분선, 공백은 해석 커버리지 테스트 대상이 아니다.

## 결과

LLM은 삶의 해석과 근거 연결에만 집중한다. 원문 직렬화, 장식 제거, 안정 ID 생성, 커버리지 집합 비교는 결정론적 코드가 담당한다. 이후 유사한 문제가 생기면 허용할 문자 목록을 늘리기보다 해당 책임이 LLM과 코드 중 어디에 있어야 하는지 먼저 검토한다.
