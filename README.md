# Handoff: MARQUE, a car collection game (web)

## Overview
MARQUE is a web collection game about real cars. Players open packs, race short real-time races, trade on a market and show their garage. "MARQUE" is a placeholder name. Target audience: car enthusiasts who want specs, generation codes (E30, R34, 992, F-series) and history.

Core loop: **open packs → race to win cars → buy/sell/swap on the market → upgrade and show off.**

## About the Design Files
The files in `design/` are **design references created in HTML**: prototypes showing intended look and behavior, not production code to copy. Recreate them in the target codebase using its established patterns and libraries. If no codebase exists yet, a good choice is **Vite + React + TypeScript** (or Next.js if you want SSR for the landing page) with a small API (Node/Fastify or similar) and Postgres. The `.dc.html` files are plain HTML with a small template layer; read them as markup, the `class Component` block at the bottom of each file holds the logic and sample data.

## Fidelity
**High-fidelity.** Colors, type, spacing, borders and motion are final. Recreate pixel-accurately with design tokens. Exceptions: all car photos, pack art, avatars and the hero shot are **striped placeholders** (`repeating-linear-gradient(135deg, surface 0 8px, neutral-300 8px 16px)`) awaiting real images; all names, prices, odds and stats are sample data.

## Design system: Modernist
Flat, architectural. Archivo only. Zero corner radius. Strong 2px dividers (`var(--color-divider)`). Labels flush left, never centered inside buttons. Accent red used sparingly, as the one field color for heroes/headers. Photos print black and white (`.grayscale`). `design/ds/styles.css` is the source of truth for tokens and the `.btn`, `.input`, `.seg`, `.card`, `.table`, `.dialog` classes; copy it as-is.

## Design Tokens
- **Colors**: bg `#f3f2f2`; surface `#eae9e9`; text `#201e1d`; accent `#ec3013` (hover/pressed `accent-600`, text-size accent `accent-700`); divider `rgba(32,30,29,.4)`; neutrals 200 `#eae7e7`, 300 `#d7d3d3`, 400 `#bab6b6`, 500 `#9b9797`, 600 `#7d7979`, 700 `#605d5d`, 800 `#444141`, 900 `#2d2b2b`.
- **Tier colors**: Common neutral-400 bar; Rare text (#201e1d) bar; Epic accent-400 bar; Legendary accent (#ec3013), with white text on a red card.
- **Type**: Archivo. Headings weight 800, tight tracking (-0.03em to -0.06em on big numerals). Page titles 64–96px / line-height 0.85–0.9. Section labels 11px, uppercase, letter-spacing .08em, neutral-700. Body 14–15.5px, line-height 22–28px. Numbers use `font-variant-numeric: tabular-nums`.
- **Spacing**: 4, 8, 12, 16, 24, 32 (scale), layouts use multiples of 4. **Radius**: 0 everywhere.
- **Shadows**: sm `0 1px 2px #2d2b2b24`, md `0 3px 10px #2d2b2b29`, lg `0 12px 32px #2d2b2b38`.
- **Motion**: ease-in-out `cubic-bezier(.76,0,.24,1)` for wipes/sweeps; ease-out `cubic-bezier(.2,.8,.2,1)` for rises/fades.
- **Icons**: Lucide.

## App shell (desktop, 1280 wide)
3-column grid: left nav 200px (border-right 2px divider) | main | right side panel 320–440px (border-left 2px divider). Nav: brand "MARQUE" 22px/800, links Garage, Packs, Race, Market, Leaderboard (15px, padding 10px 20px; active = text bg, white label), credits + player block pinned at the bottom (links to Profile). Mobile (390 × 844): content scrolls, **bottom tab bar** of 5 equal tabs (Garage, Packs, Race, Market, Ranks; Profile reached from Ranks area/tab variant), active tab = black fill, 2px top border.

## Screens / Views
All files are in `design/`.

1. **Garage** (`Garage.dc.html`, desktop **1b**, mobile **2a** list + **2b** detail). Collection grid of owned cars only (missing cars are hidden). Free sort + tier filters with counts. Card: tier bar (6px, tier color), photo (4:3 placeholder), tier label, model + generation code in lighter text ("M3 E30", "Skyline GT-R V-Spec R34"), make · year · hp. Clicking a card opens the **side panel**: red header (tier, serial, year, country, make+generation, model 36–64px), photo, 4 stat blocks with bars (power, 0–100, top speed, weight; upgrade level and market value shown too), history blurb. 1a was discarded.
2. **Packs** (`Packs.dc.html`): **3a** pack shop (Street 2,000 CR everyday cars; Heritage 8,000 CR classics; Apex 25,000 CR supercars; each with published odds). **3b** reveal: five face-down black cards; clicking one rolls the black box up like a garage door (see Motion) revealing the car with tier strips. Duplicates convert to credits.
3. **Market** (`Market.dc.html` **3c**): listing table (tier filter, sortable columns), right detail panel with price history and buy/sell/swap actions. Selecting a row triggers the panel animation.
4. **Leaderboard** (`Leaderboard.dc.html` **4a**): tabs (race points / garage value / cars owned), scope switch (Global / Friends / France), top 3 podium (1st on red), list, pinned "you" row (black), side panel with your rank, gap to next, season timer, rewards.
5. **Profile** (`Profile.dc.html` **4b**): avatar, name, level/XP bar, 8 headline stats, collection by tier and by country, showcase (3 cars), recent activity.
6. **Race** (`Race.dc.html`): **5a** setup (event: Drag 402 m, Sprint 800 m, Highway run 1,600 m; car list with hp, weight, hp/tonne; right panel opponents, entry/win/points). Choosing a car or event sweeps a black slab across it and animates the right panel. **5b** live race: 4 lanes, rev bar with shift window (82–97% grey, 97–100% accent), gear, speed; shift with button or space bar. Perfect shift (82–97%) = 0.7 s boost ×1.3 acceleration; early/late shifts give none. **5c** results (place in 200px type, red when P1; rows with gaps; rewards; shift-quality strip).
7. **Landing** (`Landing.dc.html`): responsive page, hero, stats, ticker, how it works, tier cards, red closing banner.
8. **Mobile** (`Mobile.dc.html`): 6a Packs, 6b Market (Buy/Sell/Swap tabs), 6c Leaderboard, 6d Profile, 6e Race setup, 6f Race live (playable), 6g Landing, 6h Pack reveal, 6i Results.
9. **Onboarding** (`Onboarding.dc.html`): 7a Sign up, 7b "What do you love?" (6 tastes, multi-select, biases first pack), 7c first pack opening.
10. **Extras** (`Extras.dc.html`): 8a Settings, 8b Credits top-up (4 bundles + order summary), 8c Car upgrade (levels 1–5, cost curve, stat deltas), 8d Events calendar, 8e Friends.
11. **States** (`States.dc.html`): 9a empty garage, 9b no listings, 9c race search timeout, 9d low credits, 9e confirm dialogs (buy / sell / swap).

## Interactions & Behavior
- **Navigation**: nav links between screens; mobile tab bar.
- **Garage/Market panel animation** (on selecting an item; 520–900 ms): red header wipes in with `clip-path` left→right; photo wipes in right→left (+120 ms); model name slides up 48px (+240 ms); stat blocks rise 16px staggered 70 ms; stat bars fill with `scaleX` 0→1 (700 ms); meta row fades in last.
- **Race setup selection**: a black slab (`translateX(-101% → 0 → 101%)`, 720 ms, ease-in-out) crosses the chosen row, and also the red header of the right panel; then title rises, opponent rows slide in 24px, reward cells rise 16px.
- **Pack reveal**: black cover `translateY(0 → -101%)` 600–900 ms ease-in-out; car content underneath slides up and fades.
- **Race model**: acceleration A = (3 + 18·hp/kg) · 1.6 · (1 + 0.02·level); speed limit = top speed; rpm rises `1.1 / gear^0.85` per second; accel × (0.35 + 0.65·rpm) × gear factor `1/gear^0.15` × (1 − v/vmax); rpm ≥ 1 applies a limiter ×0.3. Opponents follow `v·(t − τ(1 − e^(−t/τ)))` and are time-scaled so a near-perfect run wins narrowly. For production, **run races server-side or verify them**, since the client-side physics here is only a prototype.
- **Global effects** (`fx.js`): black+red-edge wipe on page change (420 ms out, 560 ms in); screen frames fade/rise on scroll; list rows slide in staggered 35 ms; buttons scale .97 on press with a currentColor sweep; primary buttons magnetic (max 8 px); nav links indent to 28 px with a 4 px red inset bar on hover; clickable rows brighten/darken (filter) and dip on press; inputs get a 4 px accent focus ring (22%). All disabled under `prefers-reduced-motion`.
- **Landing**: headline lines rise from masks; hero image wipe plus red sweep; stats count up; rules draw left→right; ticker scrolls at 60 s per loop, slows on hover; sticky blurred nav.
- **Empty/error/confirm**: see `States.dc.html`. Confirm dialogs have a red header (kind + title), row summary, note, primary and Cancel buttons. A buy with insufficient credits turns the primary into "Top up credits".

## State Management
- **User**: id, username, region, level, xp, credits, settings (sound, reduce motion, notifications, show garage value).
- **Car (catalog)**: id, make, model, generation code, year, country, tier, hp, torque, kg, 0–100, top speed, history text, photo URL.
- **Owned car**: carId, serial, level (1–5), acquiredAt, showcase flag.
- **Packs**: type, price, odds table, pity rule (a Legendary guaranteed at least every 20 packs is a proposal), opening result with new/duplicate flags.
- **Market**: listings (seller, car, price, kind buy/swap), price history (12 weeks), fee 5% on sale, swap offers with expiry 24 h.
- **Race**: event, selected car, opponents (matched by garage level), result (times, place, shift qualities), rewards.
- **Leaderboards**: per metric and scope, season id, rewards by percentile.
- **Social**: friends with online status; challenges.
- **Client UI state**: filters, sort, selected car/listing, reveal progress, race phase (idle / count / race / done).

## Data / API (suggested)
Auth (sign-up, login), `GET /cars` catalog, `GET /me/garage`, `POST /packs/:type/open`, `GET/POST /market/listings`, `POST /market/listings/:id/buy`, `POST /races` (server simulates and returns the result), `GET /leaderboards?metric=&scope=`, `GET /me/profile`, `POST /cars/:id/upgrade`, `GET /events`, friends endpoints, credit purchase through a payment provider (the prototype shows a card field only as a mockup).

## Assets
No external images. Car photos, pack art, avatar and hero are placeholders to replace; photos should be black and white (grayscale filter) or processed to match. Licensed car imagery and names require licensing. Font: Archivo (Google Fonts). Icons: Lucide.

## Files
`design/`: Garage, Packs, Market, Leaderboard, Profile, Race, Landing, Mobile, Onboarding, Extras, States (`.dc.html`), `fx.js` (global motion), `ds/styles.css` (tokens + components). Open any `.dc.html` from the original project to see it live; the bundled copies expect the project's `_ds/` runtime to render, so use them for reading markup, colors and logic.

## Getting started with Claude Code
1. Unzip this folder into a new repo (e.g. `docs/design/`).
2. Run `claude` in the repo and give it this prompt: "Read docs/design/README.md and the HTML files it lists. Scaffold a Vite + React + TypeScript app, port `ds/styles.css` as the global stylesheet, build the shared shell (nav, tab bar), then implement screens in this order: Garage, Packs, Market, Race, Leaderboard, Profile, Landing, Onboarding, the rest. Ask me before choosing a backend."
3. Keep this README as the spec, and add a `CLAUDE.md` with the stack and commands once the scaffold exists.
