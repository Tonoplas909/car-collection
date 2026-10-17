# MARQUE

Car collection game. `SPEC.md` is the product/design spec; `design/` holds the HTML design references (read-only). `README.md` (French) explains how to run the project; `API.md` is the HTTP contract.

## Stack
- `frontend/`: Angular 22, standalone components, Signals, `inject()`, native `@if`/`@for`, HttpClient. No UI library: `src/styles/ds.css` is the design system copied as-is from `design/ds/styles.css` (do not edit); app-level styles in `src/styles/app.css`, one global CSS file per screen (`src/styles/<screen>.css`), Angular glue in `src/styles/angular.css`. Components keep the React-era class names, so screens render `<main class="shell-main">` / `<aside class="shell-aside">` straight into the shell grid (host class `screen` = `display: contents`).
- `backend/`: Express 5 + Mongoose + JWT (bcryptjs), TypeScript run with `tsx`. Without `MONGODB_URI` it starts an embedded MongoDB (mongodb-memory-server, data in `backend/data/db`). Demo data is seeded into an empty database (`src/seed/`).
- `shared/game/`: game rules (packs, race physics, economy) and the catalog `cars.json` (edit it there; `reviewed: false` means specs/blurb are drafts; `photoMatch` / `photoQuery` steer photo search). Used by the backend (relative imports) and the frontend (`@game` path alias). Imports there use explicit `.ts` extensions and no browser/Node APIs. `shared/api.ts` (`@api` alias) types the HTTP contract.
- Every mutation returns the full `Snapshot`; the Angular `Store` (`frontend/src/app/core/store.ts`) replaces it and screens derive with `computed()`.

## Commands (repo root)
- `npm run install:all` — install root, backend and frontend
- `npm run dev` — backend (3000) + `ng serve` (4200, proxies `/api`)
- `npm test` — shared rules (Vitest) + backend API tests (node:test on a throwaway embedded MongoDB)
- `npm run test:web` — Angular unit tests; `npm run build` — production build
- `npm run seed:reset` — wipe the database and reload demo data
- `npm run cars:add` / `npm run cars:enrich` — catalog tools (see scripts)

Node must be ≥ 22.22.3 or ≥ 24.15 (Angular CLI 22). Node comes from nvm-windows (`C:\nvm4w\nodejs`) on the author's machine.

## Conventions
- Layout: desktop shell = rail nav (200px) | main | aside (`frontend/src/app/shell.ts`); phones (<768px) render the 390px designs with a bottom tab bar. Screens branch on `Viewport.mobile()`.
- Motion helpers are in `frontend/src/app/core/motion.ts`; global effects (page wipe on links, button sweep, magnetic buttons) in `global-fx.ts`. Everything respects `prefers-reduced-motion` and the Reduce motion setting. Programmatic navigation goes through `Nav.go()` to keep the wipe.
- Server errors are `{ error: { code, message, needed? } }` (`backend/src/errors.ts`) and map to `GameError` in `authInterceptor`.
- If an API route changes, update `API.md` and `shared/api.ts` in the same change.
