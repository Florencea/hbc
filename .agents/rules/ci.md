---
trigger: glob
globs: ".github/workflows/**"
description: GitHub Actions CI workflow conventions, Major action versioning policies, actionlint verification, and Florencea/vp-actions standards.
---

# GitHub Actions CI & Workflow Standards

Guidelines for maintaining GitHub Actions CI/CD workflows and automated pipelines in the **`hbc`** repository.

## 1. Shift-Left CI Verification (`actionlint`)

- **Mandatory Local Verification**: Whenever `.github/workflows/` files are created or modified, run `vpr agent:lint:ci` (`actionlint`) locally before staging (`git add`).
- **Zero Errors & Zero Warnings**: All workflow files must pass `actionlint` with 0 errors and 0 warnings.
- **Offline Guardrail Invariant**: NEVER embed `actionlint` jobs or steps into remote GitHub Actions YAML workflow files. Verification is strictly a local pre-commit / pre-push gate.

## 2. Centralized Workflows (`Florencea/vp-actions`)

- **Centralized Pipeline**: Web and Fullstack applications consume the centralized Reusable Workflow from `Florencea/vp-actions/.github/workflows/vp-web-ci.yml@v3.0.0` (`ubuntu-24.04`).
- **Inputs Configuration**:
  - `pre-test-command`: Pass repository-specific preparation hooks when applicable.
- **Electron & Specialized Composite Actions**: Electron desktop projects consume `Florencea/vp-actions/.github/workflows/vp-electron-ci.yml@v3.0.0`; workflows with custom deployment or execution requirements consume modular composite actions:
  - `Florencea/vp-actions/actions/setup-vp-env@v3.0.0`: Node.js engine, Vite+, dependency installation, and Vite Task Cache.
  - `Florencea/vp-actions/actions/setup-playwright@v3.0.0`: Chromium binary installation and Linux system dependencies.

## 3. Action Versioning SSOT (Exact SemVer Pinning)

- **Exact SemVer Pinning**: Pin GitHub Actions and reusable workflows to exact stable SemVer tags (`vX.Y.Z`) and upgrade via `up` (e.g. `Florencea/vp-actions/.github/workflows/vp-web-ci.yml@v3.0.0`, `voidzero-dev/setup-vp@v1.22.0`, `actions/checkout@v7.0.1`, `actions/cache@v6.1.0`, `actions/upload-artifact@v7.0.2`).
- **Strict Prohibition on Floating Tags**: Avoid unpinned floating major or minor tags (e.g. `@v1` or `@v7.0`).

## 4. Runner Best Practices & Concurrency

- **Concurrency Policy**: Workflows triggered by `push` and `pull_request` must declare top-level `concurrency` with `cancel-in-progress: ${{ github.ref != 'refs/heads/main' && github.ref != 'refs/heads/master' }}` to prevent redundant CI runs and runner starvation.
- **Job Timeout Protection**: Runner jobs must declare an explicit `timeout-minutes: 15`.
- **Artifact Retention**: Diagnostic artifact uploads on failure must specify `retention-days: 7` and `if-no-files-found: ignore`.
