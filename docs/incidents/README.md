# Incidents

실제로 발견된 버그, 검증 실패와 생성 품질 문제의 증상, 영향, 원인 분석, 해결 방향 및
재발 방지를 기록합니다. 설계 변경이 필요하면 관련 ADR을 양방향으로 연결합니다.

파일명은 `YYYY-MM-DD-주제.md` 형식을 사용합니다.

## 기록 목록

- [차트 근거 검증 경계선 장애 회고](2026-11-03-chart-evidence-validation.md)
- [차트 해석 프롬프트 품질 이슈](2026-11-03-interpretation-prompt-quality.md)
- [개인화 GDD 전투 원형 수렴 이슈](2026-11-03-combat-archetype-convergence.md)
- [개인화 GDD 해양 세계관 수렴 이슈](2026-11-04-maritime-world-setting-convergence.md)
- [컨텍스트 부족 시 품질 유지와 인계 계약 부재](2026-11-05-context-exhaustion-quality-handoff.md) — 계약 공백 확인, 품질 저하의 실제 재현은 미확인
- [영구 문서의 로컬 아티팩트 의존](2026-11-05-local-artifact-document-dependency.md) — 해결, 아티팩트 없는 사본 검증 완료
- [Codex 0.167 로컬 빌드로 인한 개발 셸 정지](2026-11-08-codex-0.167-local-build-freeze.md) — 0.166으로 완화, 2026-11-15 이후 패키지·캐시 재탐색 예정
- [방어문구 편집 해시 계약과 에이전트 검증 누락](2026-11-10-defensive-editor-hash-contract.md) — 해결: 합성 회귀·독립 리뷰·실제 편집자 계약 수용 확인
- [방어문구 편집 검증 예외와 이벤트 상태 병합 오류](2026-11-11-defensive-edit-validation-exception.md) — 코드 결함 수정·합성 회귀 완료, secondary 정책 검토 미완료
- [에이전트의 작업 범위 확대·사용량 소진과 기본값 처리 실패](2026-11-12-agent-scope-and-default-handling.md) — 비용 통제 미해결, 기본값 적용 지침 수정, 재개·컨텍스트 대응 미정
- [RPG 능력의 표현 방향과 흡수·방출 콘셉트 유실](2026-11-13-rpg-ability-direction-loss.md) — 미해결, 설계 방향 전달과 능력 정체성 유지 범위 검토
