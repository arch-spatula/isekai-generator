# ADR: 실행 상태 SQLite를 각 버전 폴더 루트에 둔다

* **Status:** Accepted — 문서 갱신 완료, 코드 구현 전
* **Date:** 2026-11-21
* **Decision Owners:** Project Owner
* **Supersedes:** [SQLite와 목적별 CLI ADR](2026-11-12-sqlite-agent-state-evaluation.md)의 "저장소당 하나의 DB" 위치 결정,
  [기준선 0.5 ADR](2026-11-15-adopt-artifact-series-0.5.md)의 "공용 SQLite 위치 유지"

## 결정

생성 실행의 상태 SQLite는 **그 실행이 할당받은 버전 폴더의 루트**에 둔다. 아티팩트 루트
`artifacts/`에는 DB를 두지 않는다.

```text
artifacts/
└── v0.5.1/
    ├── state.sqlite
    ├── state.sqlite-wal      # SQLite가 필요할 때 관리
    ├── state.sqlite-shm      # SQLite가 필요할 때 관리
    ├── charts/
    ├── interpretation/
    ├── design-rationale/
    ├── game/
    └── garbage/
```

- 하나의 버전 폴더에는 하나의 run과 하나의 DB가 있다. DB는 그 run의 상태·시도·이벤트·근거·채택 기록과
  그 run의 전투·세계 지문을 담는다.
- DB의 목적은 **같은 버전의 작업을 이어서 할 때 참조하는 것**이다. 새 컨텍스트는 이어 갈 버전 폴더의 DB만 열어
  진행 상황과 다음 행동을 얻는다.
- 버전 폴더가 서로 격리되어 있으므로 서로 다른 run 사이에는 쓰기 경합이 없다. run 간 동시성을 위한 잠금,
  공용 카운터, revision 재확인을 설계하지 않는다.

## 배경

2026-11-12 SQLite 전환은 저장소당 하나의 DB를 `artifacts/state.sqlite`에 두고 모든 run과 지문을 함께 저장했다.
이 위치는 원래 의도와 맞지 않는다. DB는 한 버전의 작업 재개를 위한 기록인데, 아티팩트 루트의 공용 DB는
모든 run을 한 파일에 묶었다. 그 결과 다음 비용이 생겼다.

- run 간 쓰기 경합을 전제로 한 설계(공용 series 카운터, 동시 첫 초기화, `registry-stale` 재확인)가 필요해졌다.
- 한 버전 폴더만으로는 그 run을 이해하거나 이어 갈 수 없다. 폴더와 상태 기록이 떨어져 있다.
- 공용 DB 전제가 여러 명세와 스킬 지침에 퍼져, 이후 작업자가 루트 DB를 정상 구조로 받아들이게 됐다.

## 결과

### 버전 할당

- DB 카운터 없이 버전 폴더의 **배타적 생성**으로 번호를 확정한다. 활성 series의 기존 폴더 이름을 확인해
  다음 patch를 고르고, 폴더 생성이 실패하면(이미 존재) 다음 번호로 넘어간다. 번호는 재사용하지 않는다.
- 폴더 생성에 성공한 프로세스만 그 폴더의 DB를 초기화한다. 첫 초기화 경합은 생기지 않는다.
- 차트 단독 실행과 전체 GDD 실행은 같은 할당 규칙을 쓴다.

### 재개와 조회

- 재개·조회 명령은 대상 버전을 받아 그 폴더의 DB만 연다. DB가 없으면 실패하고 빈 DB를 만들지 않는다.
- DB에는 자신이 속한 버전을 기록한다. 폴더 이름과 기록이 다르면(복사·이동으로 연결이 끊긴 경우) 중단한다.
- 미완료 실행 목록은 버전 폴더들의 DB를 읽기 전용으로 열어 모은다.

### run 사이에 걸친 조회: 전투·세계 지문

- 지문은 각 run의 DB에 저장한다. 선택 단계는 **다른 버전 폴더의 DB를 읽기 전용으로 열어** 성공 확정된 run의
  지문만 모으고, 선택 시작 시점의 이 모음을 비교 snapshot으로 쓴다.
- 다른 run의 DB에는 쓰지 않는다. finalize는 자기 run의 DB 안에서 두 지문과 완료 상태를 한 트랜잭션으로 확정한다.
- 동시에 진행 중인 run끼리는 서로의 지문을 보지 못할 수 있다. 격리를 우선해 이 한계를 받아들이며,
  다른 run의 등록을 이유로 finalize를 막는 `registry-stale` 검사는 두지 않는다.

### run 안의 병렬 작업

세 체계 전문 해석처럼 한 run 안에서 병렬로 진행하는 작업은 같은 DB를 쓴다. 이 경우의 짧은 트랜잭션,
`busy_timeout`, 활성 시도 UNIQUE 같은 기존 규칙은 유지한다. 바뀌는 것은 run 사이의 공유뿐이다.

### 기존 공용 DB

- 이미 `artifacts/state.sqlite`에 기록된 run은 새 구조로 이관하지 않는다. 2026-11-12 전환 때와 같이 과거 상태를
  import하거나 추정하지 않는다.
- 새 구조 구현 이후 루트 DB는 읽거나 쓰지 않는다. 루트 DB 파일의 정리는 별도 사용자 지시로 한다.

## 구현 상태

이 결정과 관련 명세는 2026-11-21에 갱신했다. **코드는 아직 바뀌지 않았다.** 현재 구현
(`scripts/artifacts/artifact-state-store.ts` 등)은 여전히 `artifacts/state.sqlite`를 연다. 갱신된 명세가 목표 계약이며,
구현과 합성 회귀는 후속 작업이다.

## 관련 문서

- [SQLite 상태 관리·작업 재개 명세](../spec/sqlite-artifact-state.md)
- [책임별 폴더 계약](../spec/artifact-directory-layout.md)
- [생성 아티팩트 버전 및 기준선 관리](../spec/artifact-generation-versioning.md)
