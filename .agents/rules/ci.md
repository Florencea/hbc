---
trigger: glob
globs: ".github/workflows/**"
description: GitHub Actions CI workflow conventions, Major action versioning policies, and local actionlint validation.
---

# GitHub Actions CI & Workflow Standards

Guidelines for maintaining GitHub Actions CI/CD workflows and automated pipelines in the **`hbc`** repository.

## 1. Action Versioning SSOT (Major Versions Only)

- **Unpinned Major Tags**: All GitHub Actions must track the latest major version tag (e.g. `voidzero-dev/setup-vp@v1`, `actions/checkout@v7`, `actions/cache@v6`, `actions/upload-artifact@v7`, `actions/configure-pages@v6`, `actions/upload-pages-artifact@v5`, `actions/deploy-pages@v5`).
- **Strict Prohibition on Patch/Minor Pinning**: Never pin Actions to minor or patch versions (e.g. `@v1.21.2` or `@v7.0.1`). Major version tags ensure automated security patches and non-breaking bug fixes without manual intervention.

## 2. Shift-Left CI Verification (`actionlint`)

- **Mandatory Local Verification**: Whenever `.github/workflows/` files are created or modified, run `vpr agent:lint:ci` (`actionlint`) locally before staging (`git add`).
- **Zero Errors & Zero Warnings**: All workflow files must pass `actionlint` with 0 errors and 0 warnings.
- **Offline Guardrail Invariant**: NEVER embed `actionlint` jobs or steps into remote GitHub Actions YAML workflow files. Verification is strictly a local pre-commit / pre-push gate.

## 3. Vite+ Pipeline & Caching Standards

- **Runtime & Toolchain Setup**: Always use `voidzero-dev/setup-vp@v1` with `node-version-file: package.json`, `cache: true`, and `cache-toolchain: true` for deterministic sub-second environment initialization.
- **Vite Task Cache**: Cache `node_modules/.vite/task-cache` across runs to enable replay of unmodified build/lint/test steps in milliseconds.
- **Playwright Browser Cache**: Dynamically resolve Playwright version via `vp exec playwright --version` and cache `${{ runner.os }}-${{ runner.arch }}-playwright-<version>`.
- **Topological Step Execution**: Follow deterministic verification ordering:
  1. Dependencies: `vp install`
  2. Cache Restoration: Task cache and Playwright browser binaries
  3. Inner Loop: `vp run agent:verify:inner` (Oxlint, Oxfmt, Tailwind)
  4. Dead Code Analysis: `vp run check:deadcode` (Knip)
  5. Unit Tests: `vp run agent:test:unit`
  6. Bundle Build: `vp build`
  7. End-to-End Tests: `vp run agent:test:e2e`
