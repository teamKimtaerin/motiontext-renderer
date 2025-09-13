# Repository Guidelines

## Project Structure & Module Organization
- `src/` — TypeScript sources.
  - `core/`, `runtime/`, `parser/`, `loader/`, `composer/`, `layout/`, `controller/`, `assets/`, `utils/`, `types/`
  - Tests live near code in `__tests__/` (e.g., `src/core/__tests__/Stage.test.ts`).
- `demo/` — local demo, proxy and plugin servers.
- `dist/` — build output (generated).
- `docs/` — project documentation.
- `scripts/` — one-off maintenance scripts.
- `output/` — runtime logs (generated; see logging notes).

## Build, Test, and Development Commands
- `pnpm dev` — run Vite dev server.
- `pnpm dev:build` — watch-mode library build.
- `pnpm preview` — preview built demo.
- `pnpm build` — typecheck then bundle to `dist/`.
- `pnpm test` / `pnpm test:run` — Vitest (UI/CI modes).
- `pnpm test:coverage` — coverage report (v8 provider).
- `pnpm lint` / `pnpm lint:fix` — ESLint check/fix.
- `pnpm format` / `pnpm format:check` — Prettier write/check.
- `pnpm typecheck` — TS type checking only.
- Helpful: `pnpm verify` before pushing (lint + format:check + typecheck + tests).
- Demo stack (requires Node 18+): `pnpm dev & pnpm plugin:server & pnpm proxy:server`.

## Coding Style & Naming Conventions
- Language: TypeScript, strict mode on; path alias `@/*` → `src/*` (e.g., `import { toMs } from '@/utils/time'`).
- Prettier: 2 spaces, single quotes, semicolons, width 80, trailing comma `es5`.
- ESLint: `no-console` warn; prefix unused args with `_`; prefer `const`.
- Filenames: class/feature modules PascalCase (e.g., `AssetManager.ts`); utilities lowercase (e.g., `time.ts`).

## Testing Guidelines
- Framework: Vitest with `jsdom` env.
- Location: colocated `__tests__` with `*.test.ts` (example: `src/parser/__tests__/ScenarioParser.test.ts`).
- Run locally: `pnpm test` (watch) or `pnpm test:run` (CI); generate coverage via `pnpm test:coverage`.
- Aim to cover new logic and edge cases; prefer deterministic tests.

## Commit & Pull Request Guidelines
- Commits: prefer Conventional Commits (e.g., `feat:`, `fix:`, `chore:`); group logical changes.
- Pre-push hook runs format/lint/typecheck — ensure `pnpm verify` passes locally.
- PRs: clear description, rationale, and testing notes; link issues; include screenshots/GIFs for demo/UI changes.
- For releases, follow Changesets flow (`pnpm changeset`, then `pnpm release`).

## Security & Configuration Tips
- Copy `.env.example` → `.env` when required; do not commit secrets.
- GSAP is a peer dependency — install in host app (`pnpm add gsap`).
- Logs are written under `output/`; large logs are git-ignored.
