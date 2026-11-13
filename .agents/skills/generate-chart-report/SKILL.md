---
name: generate-chart-report
description: Collect conversational birth details, normalize chart options and a city-level birthplace, calculate Saju, Zi Wei Dou Shu, and Western natal charts, and save the unchanged calculation output as chart-report.md. Use when Codex needs only the deterministic source chart report, either independently or as the first stage of the personalized GDD pipeline.
---

# Generate deterministic chart report

Collect user-stated birth date, time, gender and city-level birthplace. Resolve ambiguous location before calculation. Default flow-year to current year, jasi-method unified and house-system P; do not invent missing birth inputs. Preserve existing calculator normalization and command flags from `scripts/chart-report.ts --help`.

Before asking any input question, check explicit user values, existing agreements and applicable settings, then apply every defined default. Omission of an option with a default is not missing or ambiguous input; do not request confirmation of defaults or values already resolved from supplied information. Explicit user values override defaults. Ask only for required information still missing or conflicts still unresolved after this step.

An omitted calendar means Gregorian (양력). Resolve timezone from an unambiguous birthplace (South Korean cities use `Asia/Seoul`). Never pass an explicitly lunar date to the Gregorian calculator unchanged.

For standalone generation reserve with `artifact-state.ts allocate --kind chart-report --mode <light|deep> --purpose <purpose> --request <id>`, then start. For an existing parent run use its reservation; do not allocate another. Call `<chart-skill-path>/scripts/run-chart-report.ts <root> <reserved-final-chart-path> -- <chart-flags>`; it retains stdout unchanged, validates, publishes Markdown and stores evidence in SQLite. The common DB is `artifacts/state.sqlite`; do not generate evidence files. Do not expose raw birth flags in operational logs. If generation is interrupted, use read-artifact-state summary/next and reconcile, never silently recompute an accepted chart. Return only reserved path, run and status.
