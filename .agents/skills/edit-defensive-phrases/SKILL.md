---
name: edit-defensive-phrases
description: Review one specialist interpretation for defensive wording and return scoped replacement proposals and semantic review before integration, using an allocated same-run editing input.
---

# 전문 해석 방어문구 편집

input.json의 체계·시도·범위를 따른다. 해당 체계 원문, 전체 validator 진단, 전문 해석
지침, 모드, input의 chart.md/evidence.json만 읽는다. 다른 체계·이전 버전·대화 이력·
원시 출생 인수·TODO를 읽지 않는다. 재시도는 직전 candidate/review/result와 현재 진단·
기존 확인 대상만 받는다. 관리 도구나 다음 에이전트를 실행하지 않는다.

1차로 모든 자동 진단을 확인하고, 2차로 문서 전체의 추가 방어문구·보존 대상·판단 보류를
검토한다. 요소·관계·발현 조건 없이 요청하지 않은 예측·진단을 부정하거나 책임을 회피하는
절을 제거하거나 기존 근거 해석으로 연결한다. 동의어 치환으로 검사를 피하지 않는다.
실제 계산 범위·자료 부재와 조건부 발현은 보존한다. 새 해석이나 근거를 발명하지 않는다.

sentence는 지목한 절·문장, item은 해당 해석 항목(항목 밖은 해당 문단), system은
관련 항목·문단만 바꾼다. 전체 재작성은 금지한다. 무관한 문단, ID·evidence·순서·해상도·
필수 섹션·기존 유효 해석·관계·시드를 보존한다. 범위 밖 대상은 needs-expansion,
판단 보류는 deferred로 남긴다. 오탐 의심도 자동 통과하지 않는다.
sentence의 original/replacement에는 개행을 포함하지 않는다. 문장 텍스트만 선택하고
뒤따르는 줄바꿈은 원문에 유지한다.

정확히 input.edits와 input.review에 edits.json, review.md를 한번 작성한다.
JSON은 {sourceSha256,edits,review}다. sourceSha256에는 input.source.sha256 값을 그대로
사용한다. 이 최상위 해시 하나가 edits와 review 모두를 원문에 연결한다. input.json 파일
자체를 hash하지 않는다. review에는 별도 해시를 넣지 않는다. 각 edit는 고유 id,target,original,replacement와
진단 연결 diagnosticCode 또는 추가 대상 연결 reviewTargetId를 포함한다. target은 실제
항목 ID 또는 정확한 섹션 heading이다. heading은 다음 heading 전 직접 본문만 포함하며, 자식 항목은 각 실제 ID로 따로 지정한다. 3차도 관련 항목별 여러 제안을 사용한다. original은 그 범위 내 정확히 한번 일치해야 한다.
삭제 replacement는 빈 문자열이다. 후보 문서 전체는 출력하지 않는다.

review는 system,attempt,scope,primary,secondary,preservationConfirmed,
unresolved를 포함한다. attempt는 number, preservationConfirmed는 boolean true/false다.
보존 이유 설명문은 review.md에 쓴다. primary/secondary/unresolved와 각 editIds는 배열이며
대상이 없으면 []를 사용한다. primary의 각 진단은 diagnosticIndex,status,reason,editIds로
정확히 한번 기록한다. status는 fixed/unresolved/false-positive다. secondary는
id,target,status,reason,editIds이며 status는 fixed/preserved/needs-expansion/deferred다.
fixed는 실제 editIds를 연결한다. 미해결 시 nextScopeReason을 쓴다. 추가 대상이 없으면
빈 배열과 무수정 검토 완료를 남긴다. 제공된 토큰만 usage.inputTokens/outputTokens에
기록하며 미제공은 미측정이다. 측정용 모델 호출은 하지 않는다.

review.md에 각 판단·이유·변경별 기존 근거 보존 이유와 다음 범위 필요성을 설명한다.
기계 검증과 의미 보존 확인을 구별한다. 관리 도구가 후보와 전체 검증 결과를 기록한다.
편집자는 후보·원본·정식 문서·accepted 기록·부모 상태를 수정하지 않는다.
