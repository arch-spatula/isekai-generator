---
name: generate-chart-report
description: Collect conversational birth details, normalize chart options and a city-level birthplace, calculate Saju, Zi Wei Dou Shu, and Western natal charts, and save the unchanged calculation output as chart-report.md. Use when Codex needs only the deterministic source chart report, either independently or as the first stage of the personalized GDD pipeline.
---

# Generate a chart report

Act as an input adapter and deterministic report runner. Do not interpret the chart.

## Collect inputs

Extract details already supplied in natural language and ask one focused question at a time only for missing required data. Required data are year, month, day, hour, minute, gender, latitude, longitude, and timezone.

- Treat a city or county as sufficient. Resolve its representative coordinates and IANA timezone without asking the user to confirm coordinates.
- Ask only when the place name itself is ambiguous. Do not request hospital-level detail.
- Normalize ordinary gender answers to `M` or `F`; do not infer a missing answer.
- Reject unknown birth time.

Use these defaults unless overridden:

- `flow-year`: current calendar year
- `jasi-method`: `unified`
- `house-system`: `P`

## Choose the output

When an orchestrator supplies an absolute `chart-report.md` path, use exactly that path and never allocate another version.

For standalone use, accept an optional semantic version and run:

`bun <skill-path>/scripts/resolve-chart-output.ts <repository-root> [version]`

Never overwrite an existing version directory or accept a free-form standalone output path.

## Generate

Resolve the repository root containing `scripts/chart-report.ts`. Run:

`bun <skill-path>/scripts/run-chart-report.ts <repository-root> <chart-report-output> -- <all chart flags>`

Supply every normalized option explicitly, including defaults. The runner preserves the calculator's stdout unchanged, checks all three chart sections, creates the output directory, and refuses to overwrite an existing report.

Treat calculator failure as a final input error. Do not repair, guess, interpret, summarize, or reformat its output. Do not inspect any other artifact version.

## Complete

Return only the report path, version when available, and a one-sentence calculation status. Do not reproduce the birth arguments or report.
