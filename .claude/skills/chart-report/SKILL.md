---
name: chart-report
description: 생년월일·태어난 시각·태어난 도시·성별로 사주팔자, 자미두수, 네이탈 차트를 계산해 결과를 그대로 보여준다. 출생정보로 명식/차트를 뽑아 달라는 요청에 사용한다.
allowed-tools: Bash(bun scripts/resolve-city.ts:*), Bash(bun scripts/chart-report.ts:*)
---

# 명식 계산

에이전트는 입력을 스크립트 인자로 옮기는 어댑터 역할만 한다. 계산·해석·요약을 직접 하지 않는다.

## 1. 입력 정리

필요한 값: 생년월일, 태어난 시각(시:분), 성별, 태어난 도시.

- 사용자가 준 값과 아래 기본값을 먼저 적용하고, 그래도 빠진 필수값만 묻는다. 기본값은 확인받지 않는다.
  - 달력 언급이 없으면 양력이다.
  - `--flow-year`는 올해, `--jasi-method`는 `unified`, `--house-system`은 `P`이며 기본값이면 인자를 생략한다.
  - 사용자가 명시한 값은 기본값보다 우선한다.
- 성별: 남 → `M`, 여 → `F`.
- 시각은 24시간제로 바꾼다 (오후 2시 30분 → `--hour 14 --minute 30`).
- 음력 생일이라고 명시하면 그대로 넘기지 않는다. 지금은 음력 변환을 지원하지 않으므로 양력 날짜를 물어본다.
- 태어난 시각을 모르면 지금 스크립트는 계산할 수 없다고 알리고 멈춘다.

## 2. 도시 변환

도시명을 orrery 목록의 한국어 이름으로 옮겨(예: New York → 뉴욕, 서울특별시 → 서울) 실행한다.

```bash
bun scripts/resolve-city.ts <도시명>
```

출력 JSON의 `status`에 따라:

- `resolved`: `city.latitude`, `city.longitude`, `city.timezone`을 다음 단계에 쓴다.
- `ambiguous` 또는 후보가 있는 `not-found`: 후보를 보여주고 사용자가 고르게 한다. 고른 표시명 그대로 다시 실행한다. 임의로 고르지 않는다.
- 후보가 없는 `not-found`: 목록에 없는 도시라고 알리고 가까운 큰 도시를 묻는다. 좌표나 timezone을 추측해 채우지 않는다.

## 3. 계산

```bash
bun scripts/chart-report.ts --year=<Y> --month=<M> --day=<D> --hour=<h> --minute=<m> \
  --gender=<M|F> --latitude=<lat> --longitude=<lon> --timezone=<IANA>
```

- 모든 인자는 `--name=value` 형태로 넘긴다. 서반구·남반구 도시의 음수 좌표(`--longitude=-74.006`)가 공백 구분 형태에서는 거부된다.

- 성공하면 stdout 전체를 수정·요약 없이 코드 블록으로 보여준다. 앞에 확정한 입력(날짜, 시각, 성별, 도시 표시명)을 한 줄로 밝힌다.
- 실패하면 stderr 메시지를 그대로 전하고, 입력 문제라면 해당 값만 다시 묻는다.
- 파일로 저장하지 않는다.
