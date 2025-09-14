# Repository Guidelines

## Project Structure & Module Organization
- `src/` — TypeScript sources: `core/`, `runtime/`, `parser/`, `loader/`, `composer/`, `layout/`, `controller/`, `assets/`, `utils/`, `types/`.
- Tests are colocated: `__tests__/` with `*.test.ts` (e.g., `src/core/__tests__/Stage.test.ts`).
- `demo/` — local demo, proxy and plugin servers.
- `dist/` — build output (generated). `docs/` — documentation. `scripts/` — maintenance.
- `output/` — runtime logs (generated; git‑ignored). Scope: this guide applies repo‑wide.

## Build, Test, and Development Commands
- Use `pnpm`.
- `pnpm dev` — run Vite dev server (demo).
- `pnpm dev:build` — watch‑mode library build for development.
- `pnpm preview` — preview the built demo.
- `pnpm build` — typecheck then bundle to `dist/`.
- `pnpm typecheck` — TypeScript type checking only.
- `pnpm test` / `pnpm test:run` — Vitest (watch/CI).
- `pnpm test:coverage` — coverage report (v8 provider).
- `pnpm lint` / `pnpm lint:fix` — ESLint check/fix.
- `pnpm format` / `pnpm format:check` — Prettier write/check.
- Helpful: `pnpm verify` before pushing (runs lint, format:check, typecheck, tests).
- Full demo stack: `pnpm dev & pnpm plugin:server & pnpm proxy:server` (Node 18+).

## Coding Style & Naming Conventions
- Language: TypeScript (strict). Path alias `@/*` → `src/*` (e.g., `import { toMs } from '@/utils/time'`).
- Prettier: 2 spaces, single quotes, semicolons, width 80, trailing comma `es5`.
- ESLint: `no-console` warn; prefix unused args with `_`; prefer `const`.
- Filenames: modules/classes PascalCase (e.g., `AssetManager.ts`); utilities lowercase (e.g., `time.ts`).

## Testing Guidelines
- Framework: Vitest with `jsdom` env; aim for deterministic tests covering new logic and edge cases.
- Location: colocated `__tests__/` with `*.test.ts`.
- Run: `pnpm test` (watch) or `pnpm test:run` (CI). Coverage via `pnpm test:coverage`.

## Commit & Pull Request Guidelines
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, etc.); group logical changes.
- Ensure `pnpm verify` passes pre‑push.
- PRs: clear description, rationale, and testing notes; link issues; include screenshots/GIFs for demo/UI changes.
- Releases: follow Changesets (`pnpm changeset`, then `pnpm release`).

## Security & Configuration Tips
- Copy `.env.example` → `.env` when needed; do not commit secrets.
- GSAP is a peer dependency — install in host app: `pnpm add gsap`.
- Logs live under `output/`; large logs are git‑ignored.

