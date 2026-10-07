# MARQUE

Car collection game. `README.md` is the product/design spec; `design/` holds the HTML design references (read-only).

## Stack
- Vite + React 19 + TypeScript, React Router 7, Lucide icons. Plain CSS: `src/styles/ds.css` is the design system copied as-is from `design/ds/styles.css` (do not edit); app-level styles in `src/styles/app.css`, one CSS file per screen.
- Game rules (catalog, packs, race physics, economy) live in `supabase/functions/_shared/game/` and are shared by the web app (`@game` alias) and the Edge Functions. Imports there use explicit `.ts` extensions and no browser/Deno APIs.
- Backend: Supabase. Schema, RLS and all mutations are Postgres functions in `supabase/migrations/`; pack rolls and race scoring are Edge Functions (`supabase/functions/packs`, `races`). `supabase/seed.sql` is generated from the TS data.
- `src/api/` defines `GameApi`. `supabase.ts` is used when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set (`.env.local`), otherwise `mock.ts` runs the same rules on localStorage.

## Commands
- `npm run dev` — dev server (mock backend unless `.env.local` is set)
- `npm run build` — type-check + production build
- `npm test` — unit tests for the shared game rules (Vitest)
- `npm run test:db` — runs the migration + seed on PGlite and exercises every SQL function (no Docker needed)
- `npm run lint` — oxlint
- `npm run db:seed` — regenerate `supabase/seed.sql` after changing the catalog, race events or house listings
- `npm run db:start` / `npm run db:reset` / `npm run functions:serve` — local Supabase stack (needs Docker)

Node comes from nvm-windows (`C:\nvm4w\nodejs`).

## Conventions
- Layout: desktop shell = rail nav (200px) | main | aside (`Main` / `Aside` in `src/components/Shell.tsx`); phones (<768px) render the 390px designs with a bottom tab bar. Screens branch on `useIsMobile()`.
- Motion helpers are in `src/lib/motion.ts`; everything respects `prefers-reduced-motion` and the Reduce motion setting.
- Server errors use `code|message[|needed]` and map to `GameError` on the client.
- Constants duplicated in SQL (market fee 5%, upgrade costs, duplicate credits, XP per level) are marked "keep in sync" in the migration.
