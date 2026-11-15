# 생성 진행 기록과 중단 후 인계

> 상태: 구현 완료
> 작성일: 2026-11-05
> 범위: 새 차트·개인화 GDD run의 루트 `TODO.md`

## SQLite 전환 적용

> 신규 생성은 아래 SQLite 전환 계약을 사용한다. 구형 아티팩트는 소급 변환하지 않는다.

신규 실행은 run TODO와 단계 JSON을 만들지 않는다. `read-artifact-state.ts`의
summary/next/input 조회가 진행 인계의 원본이다. 미완료 실행은 DB의 시도·제출·게시 상태와
필요한 worker 생존 확인을 거쳐 재개한다. 구형 파일을 조회해 DB를 소급 생성하지 않는다.
아래 TODO·checkpoint 파일 구조와 CLI는 전환 전 구현 기록이다.

상세 계약은 [SQLite 상태 관리·작업 재개 명세](sqlite-artifact-state.md)를 따른다.

## 목적

대화 컨텍스트나 실행이 중단되어도 다음 에이전트가 어디까지 검증됐고 무엇을 확인해야
하는지 알 수 있게 한다. 기존 버전 관리의 `allocated/running/succeeded/failed/cancelled`는
전체 실행의 상태이며, 단계별 진행 정보는 별도로 기록한다.

## 저장 계약

```text
artifacts/<version>/
├── artifact-run.json
├── TODO.md
├── garbage/progress/
│   ├── chart-report.json
│   ├── saju.json
│   └── ...
└── docs/GDD/...
```

- 예약기가 manifest 생성 직후 `TODO.md`와 진행 기록 디렉터리를 만든다.
- 단계 JSON은 상태·갱신 시각과 선택적인 에이전트 ID·전문 해석 시도 번호를 담는다.
- TODO는 manifest와 단계 기록에서 렌더링한다. 직접 편집하지 않는다.
- 체크 완료는 검증 완료 체크포인트를 의미한다. 산출물의 존재로 추측하지 않는다.
- 원시 출생정보, 차트·해석 본문, 명령 인자, 원시 stderr와 대화 요약을 넣지 않는다.
- TODO와 진행 기록은 오케스트레이터용이다. 하위 해석·설계 에이전트에 전달하지 않는다.
- 기존 버전에는 소급 생성하지 않는다.

## 갱신 주체

자동 갱신은 다음 기존 작업에 연결한다.

| 작업 | 기록 |
| --- | --- |
| 공용 버전 예약 | 빈 단계 목록과 다음 작업 생성 |
| 부모 run 상태 변경 | TODO의 전체 상태 갱신, 알려진 실패 단계 표시 |
| 차트 runner | 차트 시작, 보고서·근거 검증 완료 또는 실패 |
| 전문 해석 prepare | 체계별 진행 중 상태와 시도 번호 |
| 전문 해석 finish/error | 실패 또는 검증·정식 게시 완료 |

통합·전투·세계·GDD·최종 검증·두 지문 등록은 오케스트레이터가 작업 직전과 검증 완료 직후
진행 명령을 실행한다. 에이전트를 실행한 뒤 ID를 추가 기록할 수 있다. 전문 해석의 자체
재시도는 추가하지 않으며 전체 3회 한도도 유지한다.

```text
bun scripts/update-artifact-progress.ts start <run-directory> <stage> [agent-id]
bun scripts/update-artifact-progress.ts done <run-directory> <stage>
bun scripts/update-artifact-progress.ts fail <run-directory> <stage>
bun scripts/update-artifact-progress.ts sync <run-directory>
```

단계는 `chart-report`, `saju`, `ziwei`, `natal`, `integration`, `selection`,
`world-selection`, `gdd`, `final-validation`, `combat-registration`, `world-registration`이다.
차트 단독 실행에는 차트 단계만 있다. 시작·완료 기록에는 선행 단계 완료를 요구한다.
완료 단계를 다시 시작하거나 종료된 run의 단계를 수정하지 않는다. `done` 명령 자체가
validator를 대신하지는 않으며 호출자가 검증 성공을 먼저 확인한다.

## 병렬 작업과 쓰기 실패

진행 기록은 전용 락 안에서 단계 JSON을 원자적으로 저장한 뒤 전체 TODO를 원자적으로
렌더링한다. 병렬 전문 해석의 마지막 작성자가 다른 체계의 체크포인트를 잃지 않는다.
락 대기는 최대 5초이며 남은 락을 자동 삭제하지 않는다.

단계 JSON은 저장됐지만 TODO 쓰기가 실패할 수 있다. 도구는 실패를 반환하며 의존 작업을
중단한다. 원인을 해결한 뒤 `sync`로 체크포인트에서 다시 렌더링한다. manifest·단계 기록·
TODO 세 파일은 단일 트랜잭션이 아니므로 가장 최신의 확정된 기록과 실제 산출물을 대조한다.
전체 상태 기록 후 TODO 갱신만 실패해도 manifest가 이미 종료됐을 수 있음을 보고해야 한다.

## 중단 후 확인

사용자가 미완료 run의 이어하기를 요청하면 새 버전을 예약하기 전에 같은 run의 manifest,
TODO와 단계 기록을 읽는다. 진행 중 표시는 에이전트의 생존 증거도 종료 증거도 아니므로
프로세스를 먼저 확인한다. 완료 산출물은 재검증해 재사용하고 미완성 문서를 덮어쓰지 않는다.
원래 입력이 없는 차트 단계는 필요한 입력을 확인하며 추정하지 않는다.

전문 해석은 시도별 input/result/accepted 기록을 대조한다. 결과 미기록 시도나 남은 락을
자동 실패로 분류하지 않는다. 도구 작업 후 체크포인트 전에 중단됐다면 실제 결과를 확인해
기록을 맞춘다. 특히 지문은 두 레지스트리를 각각 확인하고 등록된 버전을 다시 등록하지 않는다.

이 기능은 중단 후 인계 힌트다. 종료 run 재개, 자동 프로세스 재실행, 무제한 재시도 또는
분산 실행 복구를 구현하지 않는다. 기존 종료 run의 상태는 유지한다.

컨텍스트 부족을 예상한 에이전트가 품질을 지키기 위해 자발적으로 중단하고, 질문별
미완료 작업을 새 컨텍스트로 전달하는 계약은 아직 없다. 이는
[별도 미해결 문제](../incidents/2026-11-05-context-exhaustion-quality-handoff.md)로 추적하며,
본 진행 기록 기능의 구현 완료와 구분한다.

## 검증

- 예약 즉시 TODO 생성과 기존 버전 비변경
- 진행 중 에이전트·시도 번호와 다음 의존 단계 표시
- 세 전문 해석의 병렬 기록 보존
- 검증 실패·복구 완료·부모 실패·취소·성공 반영
- 지문 부분 등록과 체크포인트 전 중단에 대한 확인 지침
- TODO 쓰기 실패 후 체크포인트 보존 및 sync 복구
- 차트 단독 실행과 CLI 입력·상태 경계

구현은 `scripts/artifacts/artifact-progress.ts`와 공용 예약기·차트 runner·전문 해석 관리자가
담당하고, 후속 단계 기록은 `generate-personalized-gdd` 스킬이 지시한다.

`bun test ./scripts ./.agents`에서 18개 파일의 144개 테스트가 통과했다. 두 생성 스킬의
`quick_validate.py`도 통과했다. 실제 새 GDD 생성은 실행하지 않았으며 임시 run으로
진행 기록·중단·복구·병렬 쓰기 동작을 검증했다.
