# 방어문구 편집 해시 계약과 에이전트 검증 누락

> 상태: 해결 — 해당 계약의 합성 회귀·독립 리뷰와 실제 모델 수용 확인
> 발견일: 2026-11-10
> 범위: 방어문구 편집 제출 계약과 해당 계약의 수용 검증

## 증상과 영향

새로 실행한 방어문구 편집자 3명 모두 최상위 `sourceSha256`에는 올바른 원문 해시를
제출했으나 `review.inputSha256`에는 `input.json` 파일의 해시를 넣었다. 관리 도구는
두 값 모두 원문 해시와 같기를 요구했으므로 `Review input mismatch`로 차단했다.
이는 당시 조사한 3개 제출물 중 3개에서 관찰한 결과다. 모든 모델·실행의 실패율을
뜻하지 않으며, 로컬 원본을 저장소에 보존하지 않아 그 집계 자체의 독립 재검증은 제한된다.

잘못된 제출물은 채택되지 않았다. 올바른 원문에 대한 편집안과 검토를 작성했더라도
중복 해시 필드의 대상을 다르게 이해하면 다음 단계로 진행할 수 없었다.

## 원인과 검증 공백

기존 제출 형식은 `{sourceSha256, edits, review}`이고 review 안에도 `inputSha256`을
요구했다. 코드에서는 두 필드를 같은 원문에 연결했지만 스킬은 두 필드를 열거했을 뿐
`input`이 원문인지 입력 JSON인지 구분하지 않았다. 같은 대상을 가리키는 중복 해시와
서로 다른 이름이 에이전트의 자연어 계약 이해에 혼선을 만들었다.

당시 테스트 작성과 테스트 리뷰는 실제로 서로 다른 에이전트가 맡았다. 그러나 검증은
작성자가 원문 해시를 두 필드에 넣은 합성 제출물을 중심으로 했다. 관리 도구가 그
제출물을 처리하는지는 확인했지만 새 편집자가 스킬만 읽고 해시 대상을 올바르게
이해하는지는 시험하지 않았다. 역할 분리와 합성 테스트 통과만으로 실제 에이전트의
계약 이해까지 검증했다고 볼 수 없다.

## 수정 계약과 최소 사례

[관리 모듈](../../scripts/artifacts/defensive-edit.ts)과
[편집 스킬](../../.agents/skills/edit-defensive-phrases/SKILL.md)은 최상위 `sourceSha256`
하나로 edits와 review 모두를 원문에 연결한다. 이 값은 `input.source.sha256`를 그대로
사용한다. `review.inputSha256`은 타입·검증·제출 지침에서 제거한다. 체계·시도·범위와
리뷰 내용 검증은 유지하며 새 호환 해시나 중복 비교를 추가하지 않는다.

개인정보 없는 최소 합성 예시는 다음과 같다. 값은 원문 해시가 입력에 이미 제공된
상황을 나타내는 가상 기호다.

```text
입력: source.sha256 = H_source
input.json 파일 자체의 SHA-256 = H_json (H_source와 다름)
이전 제출: sourceSha256 = H_source, review.inputSha256 = H_json
이전 결과: Review input mismatch
수정 제출: sourceSha256 = H_source, review = {system, attempt, scope, ...}
수정 결과: 중복 review 해시 없이 원문 연결을 검증하고 나머지 검사를 계속한다.
```

위 사례는 관찰된 혼선만 추출한 합성이며 실제 개인 입력이나 편집 본문을 재현하지 않는다.
최상위 제안 해시가 다르거나 원문이 준비 이후 바뀐 경우에는 계속 거부한다. 의미 보존,
원문 일치, 범위, 진단·추가 대상 연결, 리뷰 완결성과 채택 해시 검증도 유지한다.
상세 계약은 [방어문구 편집 명세](../spec/specialist-defensive-phrase-editing.md)를 따른다.

## 재현과 수용 검증

[합성 회귀 테스트](../../scripts/artifacts/defensive-edit.test.ts)는 과거 로컬 원본 없이
`bun test scripts/artifacts/defensive-edit.test.ts`로 실행한다. 정상 제출, 잘못된 제안·원문
해시 거부와 기존 리뷰·범위·채택 검사를 검증한다. 독립 테스트 리뷰는 25개 테스트·
252개 assertion 통과를 확인하고 승인했다. 최종 통합본의 `bun run test`는 22개 파일·
188개 테스트·815개 assertion 통과, 실패 0개와 문서 오류 0개를 확인했다.

별도로 개인정보 없는 합성 입력과 편집 스킬을 새 에이전트에게 전달하여 제출물을
생성하는 smoke 검증을 수행한다. 의도한 정답이나 과거 실패 원인을 편집자에게 주지 않고,
실제 제출물이 관리 도구 경계를 통과하는지 확인한다. 이는 해당 합성 조건에서의 관찰이며
자연어 이해·의미 보존·모든 모델의 성공을 자동 보장하지 않는다. 코드 회귀와 실제
에이전트 계약 수용을 구분해 보고한다.

첫 실제 모델 합성 smoke에서는 원문 해시 검사를 통과했으나 preservationConfirmed에
boolean 대신 보존 이유 문자열을 제출하여 `Incomplete review`로 차단됐다. 제출한
original에는 삭제할 문장 뒤의 개행도 포함되어 있었다. 이는 sentence 범위 검사를
위반하는 표현이지만 이 실행은 먼저 리뷰 검사에서 멈췄으므로 해당 범위 오류의 실제
반환까지 관찰한 것은 아니다. 스킬은 boolean·배열·시도 번호의 JSON 타입과 sentence의
개행 제외를 명시하지 않았다. 이를 최소한으로 명시하며 제품 검사는 완화하지 않는다.
첫 smoke 산출물은 고치지 않고 새 합성 run에서 수정 스킬을 재검증했다.

실제 모델 검증은 지침 보완 전후 각 1회, 총 2회 수행했다. 두 번째 검증은 새 합성
fixture와 `gpt-6.1-terra`의 low reasoning 조건에서 편집 스킬 경로와 input 경로만
제공했다. 정답 스키마나 해시 대상은 별도로 지시하지 않았다. 모델의 1회 출력은 올바른
sourceSha256, 별도 해시 없는 review, boolean preservationConfirmed, 개행 없는
original/replacement와 edit 1개를 포함했다. 관리 CLI finish는 `passed`,
`verifyDefensiveAcceptance`는 통과했고 후보·정식 문서 해시도 일치했다. 해당 fixture는
수동 수정이나 모델 재시도 없이 통과했다. 이는 첫 번째 smoke 실패와 구분되는 수용 관찰이다.

재실행 절차는 다음과 같다. 과거 로컬 실행이나 개인 입력은 필요하지 않다.

1. `bun scripts/artifacts/defensive-smoke-fixture.ts`로 새 합성 run을 생성한다.
   출력된 run/input 경로를 현재 검증에 사용한다.
2. 새 편집 에이전트에게 편집 스킬과 input 경로를 전달해 지정된 제출물만 작성하게 한다.
3. `bun scripts/manage-defensive-edit.ts finish <run-directory> saju 1`을 직접 실행한다.
4. [관리 모듈](../../scripts/artifacts/defensive-edit.ts)의
   `verifyDefensiveAcceptance(run, 'saju')`를 호출해 채택 기록과 해시를 확인한다.

이 절차는 합성 입력의 제출·적용·채택 경계를 검증한다. 실제 모델의 일반적인 의미 품질,
전체 GDD 생성과 비용 재측정은 수행하지 않았다.

이번 수정은 취합 실패, 코스트 최적화, 재시도 정책 변경이나 실패한 run의 재개를
포함하지 않는다. 이전 로컬 실행의 원본·상태·산출물을 수정하지 않는다.
