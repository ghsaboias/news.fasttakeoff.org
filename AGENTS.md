# Repository Guidelines

## Project Structure & Modules
- `src/app`: Next.js App Router pages and API routes.
- `src/components`: Reusable UI (shadcn/Radix-based) in PascalCase files.
- `src/lib`: Core logic — `data/` services (Discord, feeds, EOs), `utils/`, `transformers/`, `types/`.
- `public/`: Static assets.
- `tests/`: Vitest tests (`tests/**/*.test.ts`) with `tests/setup.ts`.
- `scripts/`: Local utilities and model/scoring tools.
- Root config: `wrangler.toml` (Cloudflare Worker + KV/R2), `eslint.config.mjs`, `vitest.config.ts`, `tailwind.config.js`.

## Build, Test, and Development
- `npm run dev`: Next dev server at `localhost:3000`.
- `npm run build`: Next production build.
- `npm run preview:patch`: Build OpenNext worker, patch scheduled handler, run `wrangler dev`.
- `npm run deploy`: Build, patch worker, deploy to Cloudflare.
- `npm run lint`: ESLint (Next + TypeScript rules).
- `npm run test` / `npm run test:unit`: Run all/unit tests; `npm run test:watch` to watch.
- `npm run cf-typegen`: Generate Cloudflare env typings after binding/env changes.

## Coding Style & Naming
- **Language**: TypeScript, React 19, Next.js App Router.
- **Indentation**: 2 spaces; prefer early returns and small pure functions.
- **Components**: PascalCase `.tsx` (e.g., `NewsGlobe.tsx`).
- **Hooks**: `useX` camelCase in `src/lib/hooks/`.
- **Utils/Services**: kebab-case files (e.g., `report-cache.ts`).
- **Imports**: Use `@/` alias for `src`.
- **Linting**: Fix issues or disable rules narrowly with justification. Use `cn` from `src/lib/utils.ts` for Tailwind class composition.

## Testing Guidelines
- **Framework**: Vitest (node env). Tests live in `tests/**/*.test.ts`.
- **Setup**: `tests/setup.ts` is auto-loaded (see `vitest.config.ts`).
- **Conventions**: Name files `*.test.ts`. Prefer unit tests for services/utils; mock network and env.
- **Examples**: Run a file `vitest run tests/unit/cache-utils.test.ts`.

## Commit & PR Guidelines
- **Commits**: Conventional prefixes used in history: `feat:`, `fix:`, `refactor:`, etc. Example: `feat: add node panel minimization`.
- **PRs**: Include scope/intent, linked issues, screenshots for UI, and a test plan. Ensure `npm run test` and `npm run lint` pass. Note any env/KV changes (`wrangler.toml`).

## Security & Configuration
- Store secrets in `.env.local`/`.dev.vars`; never commit secrets. Cloudflare bindings are in `wrangler.toml` (KV, R2, D1, crons).
- After changing env/bindings, run `npm run cf-typegen` and re-verify `npm run preview:patch` locally.
