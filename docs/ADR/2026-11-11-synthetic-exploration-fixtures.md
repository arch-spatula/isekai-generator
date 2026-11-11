# ADR: 합성 fixture로 생성 탐색 계약 회귀 검증

* **Status:** Accepted — 구현 미반영
* **Date:** 2026-11-11
* **Decision Owners:** Project Owner
* **Scope:** 개인화 GDD 파이프라인의 후보 생성·비교·선택 회귀 검증

---

# 1. Context

사후 품질 분석에서는 선택된 결과보다 생성 단계에서 검토되지 않은 강한 대안이 뒤늦게
발견되기도 한다. 이 관찰을 바로 골든셋으로 만들면 한 번의 취향 판단을 정답으로 고정하고,
특정 능력이나 설정을 반복하게 할 위험이 있다. 반대로 대화나 로컬 아티팩트에만 남기면 같은
후보 누락과 조기 축 고정이 재발해도 자동으로 발견할 수 없다.

현재 저장소는 개인정보를 제거한 합성 fixture로 구조적 회귀를 재현하고, 실제 모델 생성
품질과 결정적 검증을 구분한다. 후보 탐색에도 같은 경계가 필요하다.

# 2. Decision

사후 분석에서 확인한 일반화 가능한 실패 특성을 **합성 탐색 fixture**로 승격한다. fixture는
특정 최종 결과나 후보 순위를 답으로 저장하지 않고, 후보군이 지켜야 할 탐색 계약과
불변식을 검증한다.

fixture는 최소한 다음 항목을 가진다.

```yaml
schemaVersion: 1
id: rapid-action-shared-burden
input:
  tensions:
    - rapid-intervention
    - shared-burden
    - recovery-need
assertions:
  minimumCandidateCount: 4
  requiredInteractionFamilies:
    - oneOf: [interception, pursuit]
    - oneOf: [absorption, redirection]
  forbiddenConvergence:
    allCandidatesSharePrimaryFamily: true
limits:
  - does-not-rank-final-candidates
  - does-not-prove-model-quality
```

예시는 형식 설명용이다. 실제 assertion 이름과 표현력은 구현 spec과 validator가 정한다.

fixture는 다음 원칙을 따른다.

- 실제 개인의 출생정보, 전문 해석 전문이나 로컬 GDD를 복사하지 않는다.
- 관찰된 실패에서 검증에 필요한 최소 구조만 새로 작성한다.
- “특정 능력을 선택하라”가 아니라 “타당한 기계적 계열을 후보군에서 누락하지 말라”를
  우선 검증한다.
- 구조 검사와 의미 평가를 구분한다. ID·개수·축 거리·상호작용 계열은 도구가 확인하고,
  해석 적합성과 재미는 독립 의미 검토 또는 별도 모델 평가가 판단한다.
- 동일 사례에 사람의 안정적인 쌍대 선호가 누적되기 전에는 골든셋이라고 부르지 않는다.

fixture의 승격 조건은 사후 분석 하나의 존재가 아니다. 재발 가능성이 있고, 개인정보 없이
일반화할 수 있으며, 결정적 assertion 또는 명시적인 수동 평가표가 있을 때만 추가한다.

# 3. Validation

fixture validator와 테스트는 다음을 확인한다.

- fixture 스키마와 참조하는 온톨로지 ID가 유효하다.
- assertion이 특정 후보 이름이나 고유 세계 설정에 의존하지 않는다.
- 후보 수, 구조적 거리, 필수 상호작용 계열과 금지된 수렴을 재현 가능하게 판정한다.
- 실패 fixture가 실제로 문제 출력을 거부하고, 최소 수정된 출력은 수용한다.
- 테스트는 로컬 `artifacts/`, 실제 출생 입력과 네트워크 접근 없이 실행된다.

실제 모델이 항상 좋은 후보를 생성한다는 주장은 이 테스트의 범위가 아니다. 모델 평가는
fixture 입력을 이용할 수 있지만 결정적 회귀 결과와 별도로 보고한다.

# 4. Golden Set과의 경계

fixture는 탐색 절차의 계약이고 골든셋은 결과 품질의 비교 기준이다. 다음 조건이 쌓이면
fixture 일부를 별도 골든셋 평가 사례로 승격할 수 있다.

- 여러 독립 평가에서 후보 간 선호 순위가 안정적이다.
- 선호 이유가 특정 외형이나 문체가 아니라 조작·위험·성장 인과로 설명된다.
- 모델 또는 프롬프트가 바뀌어도 평가 기준을 적용할 수 있다.
- 동률, 허용 가능한 대안과 평가자 불일치를 보존한다.

승격 후에도 원래 fixture는 구조 회귀용으로 유지할 수 있다. 골든셋의 선호 순위를 fixture의
결정적 assertion으로 역수입하지 않는다.

# 5. Rejected Alternatives

## 5.1 사후 분석을 모두 ADR로 기록

반복 가능한 계약이 아닌 개별 취향과 관찰까지 결정으로 고정하게 된다. ADR은 정책을,
fixture는 최소 재현과 회귀를 담당하도록 분리한다.

## 5.2 로컬 생성 결과를 그대로 fixture로 커밋

개인정보·고유 설정·대량 산출물을 영구 근거로 만들고 독립 재현의 경계를 흐리므로 채택하지
않는다.

## 5.3 처음부터 최종 후보 순위를 고정

평가 증거가 부족한 상태에서 하나의 창작 답을 과적합하게 된다. 구조적 누락 검출부터
시작하고 반복 평가가 쌓인 뒤 골든셋을 별도로 도입한다.

# 6. Consequences

## Positive

- 사후 분석이 대화에만 남지 않고 재현 가능한 회귀 조건이 된다.
- 특정 능력을 강제하지 않으면서 후보 누락과 형식적 다양성을 검출할 수 있다.
- 실제 개인 자료 없이 CI에서 반복 실행할 수 있다.
- 골든셋 도입 전에 평가 기준을 작게 검증할 수 있다.

## Negative

- fixture assertion이 지나치게 구체적이면 새로운 유효 후보를 거부할 수 있다.
- 구조적 통과가 창작 품질 보증으로 오인될 수 있다.
- 온톨로지 변경과 fixture ID 마이그레이션을 함께 관리해야 한다.
- 사례 수를 늘리는 것 자체가 목표가 되면 유지 비용만 증가한다.

# 7. Follow-up

1. fixture 스키마와 기존 `scripts/fixtures/` 배치 관례를 확정한다.
2. 조기 축 고정, 외형만 다른 후보, 위험이 플레이되지 않는 후보를 각각 최소 사례로 만든다.
3. 실패·통과 쌍을 검사하는 결정적 validator 테스트를 작성한다.
4. 실제 모델 평가 결과와 CI 구조 검증 결과의 보고 형식을 분리한다.
5. 반복적인 사람 평가가 쌓이면 별도의 골든셋 채택 여부를 결정한다.

# 8. Related Documents

- [해석과 게임 메커니즘의 복수 번역 온톨로지 도입](2026-11-11-interpretation-mechanics-ontology.md)
- [비식별 설계 사례 카드의 대안 중심 검색 도입](2026-11-11-design-pattern-card-retrieval.md)
- [개인화 전투 원형을 후보 비교로 선택](2026-11-03-personalized-combat-archetype-selection.md)
- [로컬 아티팩트와 영구 문서의 근거 분리](../spec/local-artifact-document-boundary.md)
- [합성 평가 자료 안내](../../scripts/fixtures/README.md)
