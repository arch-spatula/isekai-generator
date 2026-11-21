# 생성 아티팩트의 책임별 폴더 분리 계획

> 상태: 구현 완료 — 합성 회귀·독립 검토 완료, 기준선 0.5 승격은 별도 설정 단계
> 작성일: 2026-11-15
> 관련 이슈: [#12 게임 스튜디오 에이전트들 세분화](https://github.com/arch-spatula/isekai-generator/issues/12)
> 작업 브랜치: `docs/ccgs-workflow-evaluation` (PR #4)

## 1. 문제와 첫 단계

변경 전 SQLite 파이프라인은 계산 보고서, 전문·통합 해석, 전투·세계 선정 브리프와 최종
GDD를 모두 run 내부의 `docs/GDD/`에 게시했다. 문서의 책임을 구분하기 어려웠다.
에이전트를 세분화하기 전에 기존 문서를 책임별 폴더로 나누는 작은 변경부터 진행한다.

이번 계획의 구현 단위는 **게시 경로 변경**이다. 기존 파일명과 본문, 단계 ID, 생성 순서,
입력 격리, 검증·채택·재시도 정책을 유지한다. 폴더 분리만으로 게임 설계와 개인화 근거의
본문 분리가 완료됐다고 판단하지 않는다. 현재 최종 GDD에는 개인화 근거가 남아 있다.

## 2. 경로 계약

아래는 신규 실행의 저장 계약이며 실제 생성 결과 예시는 아니다.

```text
artifacts/
└── <version>/
    ├── state.sqlite
    ├── charts/
    │   └── chart-report.md
    ├── interpretation/
    │   ├── saju-interpretation.md
    │   ├── ziwei-interpretation.md
    │   ├── natal-interpretation.md
    │   └── chart-interpretation.md
    ├── design-rationale/
    │   ├── gameplay-concept-brief.md
    │   └── world-concept-brief.md
    ├── game/
    │   └── personalized-action-rpg-concept.md
    └── garbage/
        └── <attempt-id>/
            └── …
```

SQLite DB와 WAL·SHM 파일은 버전 폴더 루트에 둔다([버전 폴더별 SQLite ADR](../ADR/2026-11-21-per-version-sqlite-state.md)). 단독 차트 실행은 `charts/`에만
게시하며, 쓰지 않는 폴더나 빈 안내 문서를 미리 만들지 않는다.

| 단계 ID | 기존 `docs/GDD/` 내부 파일명 | 신규 게시 상대 경로 |
| --- | --- | --- |
| chart-report | chart-report.md | charts/chart-report.md |
| saju | saju-interpretation.md | interpretation/saju-interpretation.md |
| ziwei | ziwei-interpretation.md | interpretation/ziwei-interpretation.md |
| natal | natal-interpretation.md | interpretation/natal-interpretation.md |
| integration | chart-interpretation.md | interpretation/chart-interpretation.md |
| selection | gameplay-concept-brief.md | design-rationale/gameplay-concept-brief.md |
| world-selection | world-concept-brief.md | design-rationale/world-concept-brief.md |
| gdd | personalized-action-rpg-concept.md | game/personalized-action-rpg-concept.md |

재선정에 따른 기존 revision 게시 규칙은 각 책임 폴더 아래
`revisions/<attempt-id>/<기존 파일명>`으로 유지한다. 예를 들어 전투 선정의 새 채택본은
`design-rationale/revisions/<attempt-id>/gameplay-concept-brief.md`에 게시한다.
임시 후보는 기존 `garbage/`에 두고, 기존 경로에 중복 게시하거나 별칭 링크를 만들지 않는다.

## 3. 기존 실행과의 경계

- 신규 할당 run부터 새 경로를 사용한다. 기존 로컬 폴더와 DB의 경로를 이동·재작성하지 않는다.
- DB에 저장된 `documents.final_path`는 해당 게시의 원본 경로다. 읽기·게시 복구는
  이를 사용하고 현재 경로 규칙으로 재계산하지 않는다.
- 변경 전에 할당한 run은 아직 게시되지 않은 단계도 기존 레이아웃을 유지하도록 한다.
  신규 run의 `runs.config` snapshot에 `artifactLayout: "responsibility-v1"`을 기록한다.
  식별자가 없는 run은 기존 레이아웃으로 해석한다.
  이 필드는 경로 버전이며 실행 중 선택하는 CLI 옵션으로 노출하지 않는다.
- 검증기 revision 변경으로 기존 실행의 재개가 차단되는 현행 정책은 별개다.
  경로 호환을 검증기 revision 우회나 기존 승인의 자동 재사용으로 확장하지 않는다.
- 저장소의 `docs/GDD/` 원본 문서는 변경하지 않는다. DB 위치는 이 계획 당시 `artifacts/state.sqlite`였고
  이후 [버전 폴더별 SQLite ADR](../ADR/2026-11-21-per-version-sqlite-state.md)로 각 버전 폴더 루트로 바뀌었다.
  사용자 요청에 따른 [기준선 0.5 채택](../ADR/2026-11-15-adopt-artifact-series-0.5.md)은
  구현 검증·commit 후 별도 설정 commit으로 수행한다. 승격만으로 새 run을 만들지 않는다.
  DB 스키마 변경은 기존 config snapshot으로 해결할 수 없는 경우에만 별도 판단한다.

## 4. 구현 순서와 검증

1. **경로 생성 지점과 소비자 확인**
   - `scripts/artifacts/artifact-state-store.ts`의 파일명 매핑·최초 게시·revision 게시,
     단독 차트 runner, CLI 결과와 요약, 스킬·명세·테스트의 경로 가정을 조사한다.
   - 검증: 게시 경로를 만드는 곳과 DB 경로를 소비하는 곳을 구별한다. `docs/legacy/`와
     로컬 생성 결과를 검색하거나 읽지 않는다.
2. **신규 run의 책임별 게시 경로 적용**
   - run snapshot의 레이아웃으로 단계별 게시 경로를 정한다. 입력 전달과 후속 읽기는
     저장된 문서 경로를 사용한다. 후보 본문과 채택 상태는 변경하지 않는다.
   - 검증: 합성 단독 차트와 전체 DAG에서 위 여덟 경로, 본문 해시와 후속 전달을 확인한다.
3. **기존 실행·revision·게시 복구 회귀 확인**
   - 커밋된 합성 fixture로 식별자 없는 기존 run, 새 run, 재선정과 게시 중단을 만든다.
   - 검증: 기존 경로 보존, 책임 폴더의 revision, 재개 시 같은 경로로 게시, 충돌 시
     덮어쓰기 거부를 확인한다. 실제 개인 자료나 모델 호출은 필요하지 않다.
4. **경로 계약 문서와 스킬 안내 갱신**
   - SQLite 명세와 실제 경로를 설명하는 문서·스킬만 갱신한다. 미구현 본문 분리와
     에이전트 구성은 완료로 표시하지 않는다.
   - 검증: 관련 Bun 테스트, `bun run test`, `bun run check:docs`, `--review` 후보의
     의미 검토와 `git diff --check`를 수행한다.

테스트는 [테스트 작성 가이드](test-writing-guide.md)를 따른다. 기대 경로는 위 계약에서
직접 정하고 구현의 경로 매핑 상수를 가져와 기대값을 만들지 않는다. 원본 없이도 실행할 수
있는 합성 fixture만 사용한다. 경로·해시·상태 연결 검사는 의미 품질 평가와 구별한다.

## 5. 완료 기준과 후속 작업

- 신규 단독 차트·전체 GDD 실행의 게시본이 책임별 경로에 있고, 본문·해시는 유지된다.
- 게시·재선정·복구·후속 단계가 저장된 경로로 동작하며 과거 자료를 이동하지 않는다.
- 기존 run의 레이아웃과 검증기 revision 정책을 구분해 테스트한다.
- 문서와 테스트가 로컬 아티팩트 보존을 전제로 하지 않는다.

이 단계 이후 문서별 소유 설정과 의존 관계, 개인화 근거와 게임 본문의 분리,
캐릭터·서사·레벨 문서, 의미 검토 묶음과 승인 재사용을 차례로 설계한다.
에이전트 수·병렬화·새 생성 단계·검토 DB 모델은 여기서 확정하지 않는다.
#12 전체를 닫는 변경이 아니므로 PR은 `Refs #12`로 연결한다.

구현은 신규 할당 snapshot과 최초·revision 게시 경로, 단독 차트 runner에 적용했다.
게시 복구는 저장된 `final_path`를 그대로 사용한다.

- 통합 `bun run test` 통과: 30개 파일, 251개 테스트, 실패 0개, assertion 9,304개.
- 합성 단독 차트·전체 DAG의 책임별 경로, 본문 해시·후속 전달, 식별자 없는 기존 run의
  미게시 단계·runner, revision, 저장 경로를 따르는 게시 복구와 충돌 거부를 검증했다.
- 독립 검토에서 단독 차트 runner 테스트의 구형 경로와 식별자 없는 runner 사례 누락을
  발견해 수정·보강했으며 재검토에서 승인했다.
- 문서 검사 오류 0개. 수동 검토 후보 10개는 가상 버전·기존 기준선 결정·역사적 문제
  설명으로 검토해 유지했다.

실제 모델 GDD 생성은 수행하지 않았다. 기준선 0.5 승격은 이 구현·결정의 commit 후
기존 승격 도구와 별도 설정 commit으로 진행하며, 위 검증 완료가 설정 변경을 뜻하지는 않는다.
