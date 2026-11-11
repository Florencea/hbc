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

- **Centralized Pipeline**: Web and Fullstack applications consume the centralized Reusable Workflow from `Florencea/vp-actions/.github/workflows/vp-web-ci.yml@v1`.
- **Inputs Configuration**:
  - `enable-platform-compat`: Set to `true` to execute cross-platform matrix checks (Windows, macOS).
  - `pre-test-command`: Pass repository-specific preparation hooks when applicable.
- **Specialized Composite Actions**: Workflows with custom deployment or execution requirements consume modular composite actions:
  - `Florencea/vp-actions/actions/setup-vp-env@v1`: Node.js engine, Vite+, dependency installation, and Vite Task Cache.
  - `Florencea/vp-actions/actions/setup-playwright@v1`: Playwright browser cache, Chromium binary installation, and Linux system dependencies.

## 3. Action Versioning SSOT (Major Versions Only)

- **Unpinned Major Floating Tags**: All GitHub Actions and reusable workflows must track the latest major version tag (e.g. `Florencea/vp-actions/.github/workflows/vp-web-ci.yml@v1`, `voidzero-dev/setup-vp@v1`, `actions/checkout@v7`, `actions/cache@v6`, `actions/upload-artifact@v7`, `actions/configure-pages@v6`, `actions/upload-pages-artifact@v5`, `actions/deploy-pages@v5`).
- **Strict Prohibition on Patch/Minor Pinning**: Never pin Actions to minor or patch versions (e.g. `@v1.21.2` or `@v7.0.1`). Major version tags ensure automated security patches and non-breaking bug fixes without manual intervention.

## 4. Runner Best Practices & Concurrency

- **Concurrency Policy**: Workflows triggered by `push` and `pull_request` must declare top-level `concurrency` with `cancel-in-progress: ${{ github.ref != 'refs/heads/main' && github.ref != 'refs/heads/master' }}` to prevent redundant CI runs and runner starvation.
- **Job Timeout Protection**: Runner jobs must declare an explicit `timeout-minutes: 15`.
- **Artifact Retention**: Diagnostic artifact uploads on failure must specify `retention-days: 7` and `if-no-files-found: ignore`.
