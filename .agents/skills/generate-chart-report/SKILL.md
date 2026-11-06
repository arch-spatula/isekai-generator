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

For standalone use, accept `purpose` (default `experiment`) and `mode` (default `light`) and run:

`bun <skill-path>/scripts/resolve-chart-output.ts <repository-root> --purpose <purpose> --mode <mode>`

Allowed purposes are `experiment`, `regression`, `new-profile`, `incident-reproduction`, and `release-candidate`. Allowed modes are `light` and `deep`. The shared allocator reserves one patch in `.agents/artifact-series.json`'s active series and creates `artifact-run.json` with kind `chart-report` and status `allocated`. A dirty `release-candidate` is rejected before reservation. Reject explicit artifact versions / `--version`. Ordinary generation increments only the active patch. An explicit user declaration adopting a new minor authorizes the separate documented promotion workflow before allocation; do not repeatedly ask for the same authorization or guess a minor from code changes.

Never overwrite an existing version directory or accept a free-form standalone output path.

## Progress and interruption

Allocation creates a root `TODO.md`; the runner records chart start and validated completion, and parent status changes refresh it. The file points to same-run checkpoints and next checks without storing birth arguments or generated content. Do not pass it to downstream interpretation agents.

If explicitly asked to continue an unfinished standalone run, first read its manifest, TODO and chart checkpoint. Confirm whether an earlier process is still active before launching another. A file's presence is not validation. If both report and evidence are complete, revalidate their consistency before reconciling the completion checkpoint; do not overwrite them or rerun the calculator. Terminal runs remain closed. Missing input must be obtained rather than guessed. Do not backfill old versions or remove locks automatically.

## Generate

Resolve the repository root containing `scripts/chart-report.ts`. Run:

`bun <skill-path>/scripts/run-chart-report.ts <repository-root> <chart-report-output> -- <all chart flags>`

Supply every normalized option explicitly, including defaults. The runner preserves the calculator's stdout unchanged, checks all three chart sections, creates the output directory, and refuses to overwrite an existing report. It also writes a sibling `chart-evidence.json` whose stable content-derived IDs map to the report's semantic rows; decorative separators and section title lines are excluded deterministically.

The runner requires a reserved output path. For a standalone `chart-report` run it records `running` before calculation, then `succeeded` only after report and evidence validation and writes finish successfully. Caught errors record `failed` with a short safe summary; original calculator errors are reported separately. If recording failure also fails, report both errors. In a `personalized-gdd` run, the runner requires the parent to be `running` and leaves its status to the orchestrator.

For a standalone user cancellation before completion, run `bun <repository-root>/scripts/update-artifact-run.ts <version-directory> cancelled`. If input normalization fails after reservation but before the runner starts, record `failed` with stage `chart-input` and a short non-sensitive summary using the same command. Do not store birth details, command arguments, generated content, or raw stderr in manifest errors. Never remove a reserved directory or reuse its version. An abnormal interruption may leave `allocated` or `running`; do not guess its result.

Treat calculator failure as a final input error. Do not repair, guess, interpret, summarize, or reformat its output. Do not inspect any other artifact version.

## Complete

Return only the report path, evidence manifest path, artifact version, purpose and final status when standalone (or the parent's current status when orchestrated), and a one-sentence calculation status. On failure or cancellation, report the reserved version, purpose and final status without claiming validated outputs. Do not reproduce the birth arguments or report.

Returned artifact paths identify local runtime files; they are valid in the user response but are not permanent repository evidence. If persistent documentation is requested, preserve only necessary non-identifying observations or committed synthetic cases and follow `docs/spec/local-artifact-document-boundary.md`. Do not link persistent docs to a specific local run or require its files or original birth input for regression.
