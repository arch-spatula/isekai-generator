# ADR: 책임별 게시 폴더를 포함한 생성 기준선 0.5 채택

* **Status:** Accepted
* **Date:** 2026-11-15
* **Decision Owners:** Project Owner

## 결정

프로젝트 소유자의 구현 완료 후 버전 승격 요청에 따라 책임별 게시 폴더를 포함한
생성 기준선을 `0.4`에서 `0.5`로 승격한다. 구현·합성 회귀와 문서 검증을 완료하고
이 결정과 구현을 먼저 commit한다. 깨끗한 작업 트리에서 기존 승격 도구를 실행해
해당 commit을 기준 revision으로 기록하고 설정은 별도 commit한다.

승격만으로 실행이나 버전 디렉터리를 예약하지 않는다. 다음 사용자 생성 요청의 첫
예약은 새 series의 `.0`부터 시작하며 기존 run과 파일을 이동·재번호 부여하지 않는다.

## 채택 범위

신규 할당 run은 `runs.config`에 `artifactLayout: "responsibility-v1"`을 기록한다.
차트는 `charts/`, 전문·통합 해석은 `interpretation/`, 전투·세계 선정 브리프는
`design-rationale/`, GDD는 `game/`에 기존 파일명으로 게시한다. 재선정본은 해당
책임 폴더의 `revisions/<attempt-id>/`를 사용한다.

식별자가 없는 기존 run은 미게시 단계도 `docs/GDD/`를 유지한다. 게시와 복구는
저장된 `documents.final_path`를 따르며 본문·해시·DAG·입력 격리·채택 및 재시도 정책,
`garbage/` 위치를 유지한다. SQLite 위치는 이 결정 당시 공용 `artifacts/state.sqlite`였으나
이후 [파일 기반 진행 상태 ADR](2026-11-21-drop-sqlite-file-derived-progress.md)로 SQLite 상태 저장소 자체를 쓰지 않기로 했다. CLI 옵션과 DB 스키마는 추가하지 않는다.

이 기준선은 문서의 게시 위치를 구분한다. 최종 GDD의 개인화 근거 본문 분리나 새
에이전트·생성 단계의 도입까지 완료했다는 뜻은 아니다.

## 검증과 남은 한계

합성 단독 차트·전체 DAG, 기존 run의 미게시 단계와 runner, revision, 게시 중단
복구·충돌 거부를 검증했다. 통합 `bun run test`는 30개 파일의 251개 테스트에서
실패 0개, assertion 9,304개로 통과했다. 문서 검사 오류는 0개이며 수동 후보 10개는
가상 버전·역사적 결정·문제 설명으로 검토해 유지했다. 독립 검토에서 발견한 runner
테스트의 구형 경로와 식별자 없는 runner 사례 누락을 수정·보강하고 재승인받았다.

실제 모델 GDD 생성과 개인 자료를 이용한 품질 회귀는 수행하지 않았다. 승격 설정은
이 검증과 구현·결정의 commit 이후 별도 단계로 적용한다.

해석의 의미가 같은 책임 회피 서술 재발과 해양 세계관 수렴은 계속 미해결이다.
기존 두 incident를 `knownIssues`에 유지하며, 경로 변경의 합성 회귀를 이들 의미
품질 문제의 해결 근거로 사용하지 않는다.

## 관련 문서

- [책임별 게시 폴더 계약](../spec/artifact-directory-layout.md)
- [SQLite 상태 관리·작업 재개 명세](../spec/sqlite-artifact-state.md)
- [버전 관리 명세](../spec/artifact-generation-versioning.md)
- [해석 프롬프트 품질 이슈](../incidents/2026-11-03-interpretation-prompt-quality.md)
- [해양 세계관 수렴 이슈](../incidents/2026-11-04-maritime-world-setting-convergence.md)
