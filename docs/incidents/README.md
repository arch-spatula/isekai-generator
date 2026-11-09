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
- [통합 해석의 문장 길이를 품질로 대리한 검증 실패](2026-11-08-interpretation-length-quality-proxy.md) — 해결, 길이 제한 제거 및 합성 회귀 검증 완료
- [세계관 선정에서 해석의 표면 표현을 직접 옮긴 문제](2026-11-09-world-setting-literal-translation.md) — 미해결, 해양 배제가 아닌 재해석과 설정의 설득력 기준
- [능력 규칙의 구체성과 캐릭터 이미지 전달력의 불일치](2026-11-09-ability-concept-visual-abstraction.md) — 미해결, 작동 규칙과 시각적 첫인상의 구체성을 구분
