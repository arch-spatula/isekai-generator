---
name: generate-chart-report
description: Collect conversational birth details, normalize chart options and a city-level birthplace, calculate Saju, Zi Wei Dou Shu, and Western natal charts, and save the unchanged calculation output as chart-report.md. Use when Codex needs only the deterministic source chart report, either independently or as the first stage of the personalized GDD pipeline.
---

# Generate deterministic chart report

Collect user-stated birth date, time, gender and city-level birthplace. Resolve ambiguous location before calculation. Default flow-year to current year, jasi-method unified and house-system P; do not invent missing birth inputs. Preserve existing calculator normalization and command flags from `scripts/chart-report.ts --help`.

Before asking any input question, check explicit user values, existing agreements and applicable settings, then apply every defined default. Omission of an option with a default is not missing or ambiguous input; do not request confirmation of defaults or values already resolved from supplied information. Explicit user values override defaults. Ask only for required information still missing or conflicts still unresolved after this step.

An omitted calendar means Gregorian (양력). Resolve timezone from an unambiguous birthplace (South Korean cities use `Asia/Seoul`). Never pass an explicitly lunar date to the Gregorian calculator unchanged.

For standalone generation allocate with `bun <root>/scripts/artifact-allocate.ts chart-report <light|deep> <purpose> <root>`. For an existing parent run use its version directory; do not allocate another. Call `bun <chart-skill-path>/scripts/run-chart-report.ts <root> <version-dir> -- <chart-flags>`; it creates the next chart attempt, keeps calculator stdout unchanged, validates and publishes `<version-dir>/charts/chart-report.md`. Evidence IDs are recomputed from the published report; do not generate evidence files. Do not create unused role folders and never create a state database. A failed calculation leaves only a short safe `result.md`; do not expose raw birth flags in files or logs. If interrupted, run `bun <root>/scripts/artifact-status.ts <version-dir>`; never silently recompute an accepted chart. Return only the published path, version and status.
