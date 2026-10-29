# Circuit Races Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the straight-line, gear-shifting race with a ~45 s circuit of 6–8 sectors where the player holds a brake and fires nitro, and where the car you pick changes the result.

**Architecture:** New pure modules in `supabase/functions/_shared/game/` (`tracks.ts`, `circuit.ts`, `opponents.ts`, `scoring.ts`) hold circuits, the fixed-step simulation, the seeded opponents and the scoring. They are added first, next to the old model. The client and the mock backend are switched over (Tasks 4–5), then the Edge Function, SQL and docs (Task 6), and the old model is deleted. The client submits `RaceInputs`; the server replays them.

**Tech Stack:** TypeScript (Vite + React 19, Vitest, PGlite), Supabase Edge Functions (Deno), plain CSS.

**Spec:** `docs/superpowers/specs/2026-10-29-race-circuits-design.md`

## Global Constraints

- Work directly on `main`. Commits stay local until Task 6 is green; push once at the end (a push to `main` deploys GitHub Pages).
- Files in `supabase/functions/_shared/game/` use explicit `.ts` import extensions and no browser or Deno APIs. They are also run by `node scripts/*.ts` (type stripping): no `enum`, no constructor parameter properties.
- Simulation step `DT = 1/120` s (exported by `race.ts`). Randomness comes only from a seeded `Rng`, never `Math.random`.
- Controls: brake = hold Space or ArrowDown; nitro = tap N or ArrowUp; 2 nitro charges, 2 s each, ×1.5 acceleration and ×1.04 vmax, no effect while braking.
- Corner quality from `r = v / vc` at corner entry: `Early` if `r < 0.93`, `Perfect` if `0.93 ≤ r ≤ 1.05`, `Late` if `r > 1.05`.
- Opponents: 3 distinct catalog cars of the player's tier, never the player's car, drawn from `raceId`; `skill` values `0.04, 0.08, 0.12` (shuffled by the seed).
- Event ids stay `drag`, `sprint`, `run`; add `touge` (fee 700, win 3800, points 160). `raceRewards` is unchanged.
- Server errors keep the `code|message` convention. Do not edit `src/styles/ds.css`. One CSS file per screen.
- Before each commit: `npm test` passes; from Task 4 on also `npm run lint` (10 existing warnings are the baseline) and `npm run build`.

## Review Focus

- Brake key released while the window loses focus or the finger leaves the button: the brake must not stay held (Task 2 `RaceInputRecorder.releaseAll`, Task 4 wiring).
- Brake held to the finish line (odd-length `brake` array) must be a valid submission (Task 2).
- A player who never lets go of the brake never finishes: the race ends at `MAX_RACE_SECONDS` in last place, with finite numbers everywhere (Tasks 2, 3).
- The slowest catalog car (e.g. a 45 km/h microcar) must finish every circuit before the cap, with and without input (Task 3).
- Touch devices: long-press menu, double-tap zoom and page scroll must not trigger on the control buttons (Task 4 CSS check).

---

### Task 1: Circuits

**Files:**
- Create: `supabase/functions/_shared/game/tracks.ts`, `supabase/functions/_shared/game/tracks.test.ts`
- Modify: `supabase/functions/_shared/game/index.ts` (add `export * from './tracks.ts'`)

**Interfaces:**
- Consumes: nothing.
- Produces (exported from `tracks.ts`):
  - `type TrackId = 'drag' | 'sprint' | 'touge' | 'run'`; `type SectorKind = 'straight' | 'sweeper' | 'chicane' | 'hairpin' | 'climb'`
  - `interface Sector { kind: SectorKind; len: number; turn: number; vRef?: number; grade?: number }` (`turn` in degrees, signed; `vRef` m/s only on corner sectors)
  - `type Focus = 'accel' | 'grip' | 'top'`; `interface Track { id: TrackId; focus: Focus[]; sectors: Sector[] }`
  - `const TRACKS: Record<TrackId, Track>`
  - `trackLength(t: Track): number`, `isCorner(s: Sector): boolean` (true when `vRef` is defined), `sectorStarts(t: Track): number[]` (start distance of each sector), `sectorIndexAt(t: Track, d: number): number` (clamped to the last sector)
  - `layoutTrack(t: Track, stepM?: number): { x: number; y: number }[]` (points every `stepM`, default 10 m, turtle walk from the origin heading along +x, ending with the finish point) and `pointAt(points: { x: number; y: number }[], stepM: number, d: number): { x: number; y: number }`

- [ ] **Step 1: Write the failing tests** in `tracks.test.ts`: every track has 6–8 sectors; every corner sector has `vRef` between 12 and 60; `trackLength` equals the sum of lengths; `sectorStarts` starts at 0 and is strictly increasing; `sectorIndexAt(t, 0) === 0`, `sectorIndexAt(t, trackLength(t) + 50) === sectors.length - 1`, and a distance exactly on a boundary returns the later sector; `layoutTrack` returns `ceil(length / stepM) + 1` points and its first point is `{ x: 0, y: 0 }`; `focus` is `['accel']` for `drag`, `['grip']` for `touge`, `['top']` for `run` and has the three values for `sprint`.
- [ ] **Step 2: Run** `npx vitest run supabase/functions/_shared/game/tracks.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement `tracks.ts`.** Author the four circuits as data (names in the table of the spec). Starting values, to be tuned in Task 3: `drag` ≈ 1.6 km of straights ending in hard stops, `sprint` ≈ 2.0 km mixed with one chicane and one hairpin, `touge` ≈ 1.5 km with 4 hairpins/chicanes and one `climb` (`grade: 0.06`), `run` ≈ 3.0 km with long straights and fast sweepers (`vRef` ≥ 45). `layoutTrack` walks each sector, turning `turn / (len / stepM)` degrees per step.
- [ ] **Step 4: Run the test again.** Expected: PASS.
- [ ] **Step 5: Commit** `tracks.ts`, `tracks.test.ts`, `index.ts`: "Race circuits: sector data for drag, sprint, touge and run".

---

### Task 2: Circuit simulation

**Files:**
- Create: `supabase/functions/_shared/game/circuit.ts`, `supabase/functions/_shared/game/circuit.test.ts`
- Modify: `supabase/functions/_shared/game/race.ts` (add `year: number` to `RaceCarSpec`; pass `year` from every existing caller of the old code: `race.test.ts`, `Race.tsx`, `mock.ts`, `races/index.ts`), `index.ts` (export `circuit.ts`)

**Interfaces:**
- Consumes: `Track`, `Sector`, `isCorner`, `sectorIndexAt`, `sectorStarts`, `trackLength` (Task 1); `DT`, `RaceCarSpec` (`race.ts`, now `{ hp, kg, top, level, year }`); `Car` (`types.ts`).
- Produces (exported from `circuit.ts`):
  - `interface CarNotes { A: number; vmax: number; G: number; B: number }`; `carNotes(spec: RaceCarSpec): CarNotes` where `A = (3 + 18·hp/kg)·1.6·(1 + 0.02·level)`, `vmax = top/3.6`, `G = clamp(0.75 + 0.35·lightness + 0.1·recency + 0.01·level, 0.75, 1.25)` with `lightness = clamp((1900 − kg)/1500, 0, 1)` and `recency = clamp((year − 1950)/75, 0, 1)`, `B = 8 + 4·G`. All constants live in one exported `TUNING` object.
  - `raceSpec(car: Car, level: number): RaceCarSpec`
  - `type CornerQuality = 'Early' | 'Perfect' | 'Late'`; `cornerQuality(r: number): CornerQuality`
  - `interface RaceInputs { brake: number[]; nitro: number[] }` (`brake` = alternating on/off step numbers; `nitro` = activation steps)
  - `const MAX_RACE_SECONDS = 240`, `const MAX_STEPS = MAX_RACE_SECONDS / DT`, `const NITRO = { charges: 2, seconds: 2, accel: 1.5, vmax: 1.04 }`
  - `interface CircuitState { step: number; t: number; d: number; v: number; sector: number; braking: boolean; nitroLeft: number; nitroT: number; top: number; corners: CornerQuality[]; splits: number[]; finished: boolean; finishTime: number }` (`splits` = duration of each completed sector in seconds)
  - `class CircuitSim { readonly notes: CarNotes; s: CircuitState; constructor(spec: RaceCarSpec, track: Track); step(): void; setBrake(on: boolean): void; useNitro(): boolean }`
  - `replayCircuit(spec: RaceCarSpec, track: Track, inputs: RaceInputs): CircuitState` (applies every input whose step ≤ current step before stepping; stops at the finish or `MAX_STEPS`; if not finished, `t` is `MAX_RACE_SECONDS`)
  - `validRaceInputs(v: unknown): v is RaceInputs`
  - `class RaceInputRecorder { constructor(sim: CircuitSim); readonly inputs: RaceInputs; press(): void; release(): void; nitro(): void; releaseAll(): void }` (records `sim.s.step` and drives the sim; `press` while already braking and `release` while not braking are ignored)

Step rules to implement in `CircuitSim.step()` (spec "Pas de simulation"): current sector from `d`; drive `v += A·(1 − v/vmax)·DT − 9.81·grade·DT` unless braking; nitro multiplies `A` by 1.5 and `vmax` by 1.04 only while `nitroT > 0` and not braking, and `nitroT` counts down in time even while braking; braking `v −= B·DT`; in a corner with `vc = vRef·G`: `v −= 6·(v − vc)·DT` when `v > vc`, and drive never accelerates past `vc`; `v` never goes below 0. On entering a corner sector record `cornerQuality(v / vc)` in `corners`; on leaving any sector push its duration to `splits`. Finish time is interpolated like the old sim.

- [ ] **Step 1: Write the failing tests** in `circuit.test.ts` with a fixed spec `r34 = { hp: 280, kg: 1560, top: 250, level: 5, year: 1999 }`:
  - `cornerQuality`: 0.92 → Early, 0.93 → Perfect, 1.05 → Perfect, 1.06 → Late.
  - `carNotes`: a 545 kg 2013 car has higher `G` than a 2162 kg 2021 car; `G` stays within 0.75–1.25 for every car in `CATALOG` (`raceSpec(car, 0)` and level 5); `B > 8`.
  - Determinism: run a live `CircuitSim` with a `RaceInputRecorder` and the policy "hold the brake while `s.v > 35` and the next sector is a corner, press nitro at step 600"; `replayCircuit` of `recorder.inputs` returns the same `finishTime`, `corners`, `splits` and `top` (`toEqual`/`toBe`).
  - Braking: from `v = 50` with the brake held, after 120 steps `v < 50 − 0.9·B`.
  - Scrub: entering the first hairpin of `touge` at `2·vc` leaves `v ≤ 1.2·vc` one second later and records `Late`.
  - Nitro: with nitro the car covers more distance in 3 s than without; with the brake held the nitro adds nothing to speed; `useNitro()` called a third time returns false.
  - `validRaceInputs`: accepts `{ brake: [10, 20, 30], nitro: [5] }` (odd brake length) and empty arrays; rejects negative, fractional, decreasing steps, a brake array longer than 40, a nitro array longer than 2, a step above `MAX_STEPS`, and non-objects.
  - Recorder: `releaseAll()` after a `press()` produces an even-length `brake` array; two `press()` calls in a row record one step.
  - Cap: holding the brake from step 0 gives `finished === false`, `t` within `DT` of `MAX_RACE_SECONDS`, and all numbers finite.
- [ ] **Step 2: Run** `npx vitest run supabase/functions/_shared/game/circuit.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `circuit.ts`** as specified above, and update `RaceCarSpec` plus the old callers (`race.test.ts`, the old `scoreRace` callers in `src/screens/Race.tsx`, `src/api/mock.ts`, `supabase/functions/races/index.ts` pass `year: car.year`).
- [ ] **Step 4: Run** `npm test`. Expected: all pass (old race tests included).
- [ ] **Step 5: Commit** "Race circuits: fixed-step circuit simulation, replay and input validation".

---

### Task 3: Opponents, autopilot, scoring and tuning

**Files:**
- Create: `supabase/functions/_shared/game/opponents.ts`, `supabase/functions/_shared/game/scoring.ts`, `supabase/functions/_shared/game/scoring.test.ts`, `scripts/tune-race.ts`
- Modify: `circuit.ts` (add `autoDrive`), `index.ts` (export `opponents.ts`, `scoring.ts`)

**Interfaces:**
- Consumes: Task 1 and 2 exports; `CATALOG`, `carLabel` (`catalog.ts`); `Rng`, `Car` (`types.ts`); `RaceRow`, `RaceRewards`, `raceRewards`, `RACE_EVENTS_BY_ID` (`race.ts`).
- Produces:
  - `circuit.ts`: `autoDrive(spec: RaceCarSpec, track: Track, rng: Rng, skill: number): RaceInputs`. Run a `CircuitSim` with a `RaceInputRecorder`; each step, for the next corner ahead at distance `dist` and target `vc`, brake when `dist ≤ (v² − vc²)/(2B) · (1 + e)` and `v > vc`, where `e = (rng()·2 − 1)·skill` is drawn once per corner; release at the corner start; press nitro on the first step of any non-corner sector of length ≥ 150 m while charges remain. `skill 0` is the ideal line.
  - `opponents.ts`: `OPPONENT_NAMES: string[]` (at least 12 handles, including `bayside.r`, `rallye.b`, `touge.t`), `interface Opponent { name: string; car: Car; skill: number }`, `seededRng(seed: string): Rng` (string hash then mulberry32), `opponentsFor(raceId: string, player: Car): Opponent[]`.
  - `scoring.ts`: `interface OpponentTrace { name: string; car: string; finishTime: number; distanceAt(t: number): number }`; `opponentTraces(raceId: string, player: Car, trackId: TrackId): OpponentTrace[]` (each opponent is `autoDrive`n with `seededRng(raceId + ':' + name)` at level 0, simulated once, distance sampled per step); `interface ScoredCircuitRace { rows: RaceRow[]; place: number; time: number; top: number; corners: CornerQuality[]; splits: number[]; nitroUsed: number; rewards: RaceRewards }`; `scoreCircuitRace(a: { raceId: string; car: Car; level: number; eventId: TrackId; inputs: RaceInputs; player: { name: string } }): ScoredCircuitRace` (rows sorted by time; a player who does not finish is ranked by `MAX_RACE_SECONDS`; ties go to the opponent).

- [ ] **Step 1: Write the failing tests** in `scoring.test.ts`:
  - `opponentsFor('a', car)` equals itself on a second call; returns 3 distinct cars, all of `car.tier`, none with `id === car.id`; two different race ids give different lineups at least once in 20 tries; works for every tier.
  - Skill monotonic: for `caterham-seven-620r` on `touge`, `replayCircuit(spec, track, autoDrive(spec, track, seededRng('s'), k)).finishTime` is non-decreasing for `k = 0, 0.1, 0.3` and `k = 0.5` is at least 5 % slower than `k = 0`.
  - Car matters: with `skill 0`, `bugatti-chiron` beats `caterham-seven-620r` on `drag` and on `run`, and `caterham-seven-620r` beats both `bugatti-chiron` and `tesla-model-s-plaid` on `touge`.
  - Time window: with `skill 0` and level 0, the median finish time over all catalog cars is between 35 and 55 s on each circuit, each tier's median is between 25 and 75 s, and every catalog car finishes every circuit before `MAX_RACE_SECONDS`, both with `autoDrive` and with empty inputs.
  - Win rate: for the middle car (by catalog order) of each tier, over 40 race ids, a `skill 0` player wins between 35 % and 90 % of `sprint` races; a `skill 0.5` player wins at most 25 %.
  - `scoreCircuitRace`: `rows` has 4 entries sorted by time and exactly one `me`; rewards equal `raceRewards(RACE_EVENTS_BY_ID[eventId], place)` (Task 4 adds `touge` to `RACE_EVENTS`; until then use `sprint`); two calls with the same arguments return deep-equal results; holding the brake forever returns `place === 4`, `time === MAX_RACE_SECONDS` and finite `top`.
- [ ] **Step 2: Run** `npx vitest run supabase/functions/_shared/game/scoring.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `autoDrive`, `opponents.ts` and `scoring.ts` to the signatures above.
- [ ] **Step 4: Write `scripts/tune-race.ts`**: prints, per circuit and tier, the min/median/max perfect-play time, the Chiron/Caterham/Plaid times, and the `sprint` win rates from the test. Run `node scripts/tune-race.ts`.
- [ ] **Step 5: Tune** `TUNING` (in `circuit.ts`) and the circuit lengths/`vRef` (in `tracks.ts`) until the Step 1 tests pass. Change data and constants only; do not weaken an assertion. If a bound cannot be met, report which one and the measured numbers instead of editing the test.
- [ ] **Step 6: Run** `npm test`. Expected: all pass.
- [ ] **Step 7: Commit** "Race circuits: seeded opponents, autopilot, scoring and first tuning pass".

---

### Task 4: Client cut-over with a playable live screen

**Files:**
- Modify: `supabase/functions/_shared/game/race.ts` (add `'touge'` to `RaceEventId` via `TrackId`, add the `touge` event, set each event's `len` to `trackLength(TRACKS[id])`, update `kind`/`place` per the spec table: `drag` "Drag · Santa Pod", `sprint` "Circuit · Suzuka East", `touge` "Touge · Mount Haruna pass", `run` "Highway run · Autobahn A9"), `src/api/types.ts`, `src/api/mock.ts`, `src/api/supabase.ts`, `src/api/seed.ts` (drop the metre counts from calendar `rule` strings), `src/state/store.ts`, `src/screens/Race.tsx`, `src/screens/Race.css`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces:
  - `RaceEntry = { raceId; eventId; carId }` (no `opponents`); `RaceResult` replaces `shifts` with `corners: CornerQuality[]`, `splits: number[]`, `nitroUsed: number`.
  - `GameApi.finishRace(raceId: string, inputs: RaceInputs): Promise<{ snapshot; result }>`; `actions.finishRace(inputs: RaceInputs)`.
  - Supabase client sends `invoke('races', { raceId, inputs })`; `enterRace` still calls the `enter_race` RPC.

- [ ] **Step 1: Switch types, store and APIs.** The mock's `enterRace` stores `{ eventId, carId, level }` and returns `{ raceId, eventId, carId }`; its `finishRace` calls `scoreCircuitRace` with `player.name = You · <username>` and applies the same rewards/stats/activity as today. Remove the old `OPPONENTS` use.
- [ ] **Step 2: Rewrite `RaceLivePage`/`LiveRace`.** Keep the 4 lane rows and chips (progress = distance / track length). Drive a `CircuitSim` with a `RaceInputRecorder` in the existing `requestAnimationFrame` loop; opponents from `opponentTraces(entry.raceId, car, eventId)` sampled at the player's `s.t`; position = rank by distance. Keys on `window`: Space/ArrowDown press on `keydown` (ignore repeats) and release on `keyup`, N/ArrowUp tap nitro; `window` `blur` calls `releaseAll()`. End the race when `s.finished` or `s.t ≥ MAX_RACE_SECONDS`, then `actions.finishRace(recorder.inputs)`. HUD adds `Sector n/N` and nitro charges; under the lanes a one-line readout "Next: <kind> in <m> m · target <km/h> · you <km/h>". Replace the rev bar with a speed/gear display (gear = `min(6, 1 + floor(6·v/vmax))`, display only). Desktop: a large Brake button (pointer down = press, up/leave/cancel = release) and a Nitro button; mobile: the same two buttons full width with `touch-action: none; user-select: none; -webkit-touch-callout: none`. The "Ready" overlay text: "Hold Brake (space) before corners, tap Nitro (N) on exits."
- [ ] **Step 3: Update setup and results.** Setup lists the four events (the mobile selector scrolls horizontally if needed) and its aside shows the three `Focus` notes of the selected circuit instead of the fixed opponent list; "4 players · matched by garage level" stays. Results replace "Shifts"/"Perfect shifts"/"Gear reached" with corner qualities (`Early`/`Perfect`/`Late` strip, "Perfect corners n / N"), sector splits and nitro used.
- [ ] **Step 4: Verify.** `npm run lint`, `npm run build`, `npm test` pass. With `npx vite preview --port 4173` (mock backend) and Playwright (global module, `NODE_PATH=$(npm root -g)`): enter a race, hold Space through the first corner, finish, and screenshot setup, live and results on desktop (1280×800) and mobile (390×844). Check the control buttons' computed `touch-action` is `none` and that a `blur` event during a hold produces an even-length `brake` array (read from the submitted request or expose it through a `data-` attribute while testing).
- [ ] **Step 5: Commit** "Races: circuit gameplay on the client (brake, nitro, seeded opponents)".

---

### Task 5: Circuit map and approach strip

**Files:**
- Create: `src/components/RaceMap.tsx`
- Modify: `src/screens/Race.tsx`, `src/screens/Race.css`

**Interfaces:**
- Consumes: `layoutTrack`, `pointAt`, `sectorStarts`, `TRACKS` (Task 1); the live state from Task 4.
- Produces: `RaceMap({ track, dots, size }: { track: Track; dots: { id: string; d: number; me: boolean }[]; size?: 'sm' | 'lg' })` rendering the circuit as an SVG polyline fitted to its viewBox, corner sectors drawn thicker, and a dot per entry (the player in `var(--color-accent)`); `ApproachStrip` (same file or `Race.tsx`) showing the next corner with boards at 100, 50 and 25 m, target speed and current speed.

- [ ] **Step 1: Build `RaceMap`** with a tracing preview (`size="sm"`) in the setup aside above the focus notes and the live map (`size="lg"`) in place of the four lanes on desktop. On mobile the map replaces the lanes too, at full width.
- [ ] **Step 2: Build `ApproachStrip`**: a horizontal bar covering the next 200 m, corner marker at its end, boards turning solid as the player passes 100 / 50 / 25 m, text "target X km/h · you Y km/h", turning `var(--color-accent)` when `v > 1.05·vc` at the marker. Replace the one-line readout from Task 4.
- [ ] **Step 3: Respect motion settings.** Dots move by position only (no easing) so `prefers-reduced-motion` needs no special case; the setup-screen sweep animations stay as they are.
- [ ] **Step 4: Verify** with lint, build, tests and Playwright screenshots (desktop and mobile) of setup (each of the four circuits) and live (mid-race, in a braking zone).
- [ ] **Step 5: Commit** "Races: circuit map and braking-board approach strip".

---

### Task 6: Server cut-over, cleanup, docs, push

**Files:**
- Create: `supabase/migrations/20261029000001_race_circuits.sql`
- Modify: `supabase/functions/races/index.ts`, `supabase/functions/_shared/game/race.ts` (delete the old sim: `RaceSim`, `replay`, `perfectTime`, `calibrateOpponents`, `scoreRace`, `OPPONENTS`, `GEARS`, `SHIFT_WINDOW`, boost constants, `shiftQuality`, `ShiftQuality`, `validShiftSteps`), `supabase/functions/_shared/game/race.test.ts` (keep only the reward tests), `scripts/gen-seed.ts` (no change expected: it reads `RACE_EVENTS`; regenerate), `scripts/test-db.mjs`, `README.md` (Race model paragraph), `DEPLOY.md`, `TODO.md`
- Generated: `supabase/catalog.sql`, `supabase/seed.sql`

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: Edge Function body `{ raceId: string, inputs: RaceInputs }`; SQL `enter_race(p_event text, p_car text)` returning `entry = { raceId, eventId, carId }`.

- [ ] **Step 1: Edge Function.** Validate with `validRaceInputs`; load the race row; call `scoreCircuitRace` with `raceId`, `car`, `level`, `eventId`, `inputs` and the player name; keep the `SLACK_MS` check (`elapsed + SLACK_MS < scored.time·1000` fails); result is `{ raceId, eventId, carId, ...scored }`.
- [ ] **Step 2: Migration** `20261029000001_race_circuits.sql`: `create or replace function public.enter_race` without the hard-coded opponent list; `insert into public.race_events … on conflict (id) do update` for the four events with the same values as `RACE_EVENTS` (mark "keep in sync" like the other duplicated constants).
- [ ] **Step 3: Failing DB test first.** Update `scripts/test-db.mjs`: after `enter_race('sprint', …)` expect `entered.entry.opponents === undefined` and `entered.entry.eventId === 'sprint'`; add a check that `enter_race('touge', …)` charges 700 and that `select count(*) from race_events` is 4. Run `npm run test:db`; expected FAIL before the migration is added, PASS after.
- [ ] **Step 4: Delete the old model** from `race.ts` and `race.test.ts`; run `npm run db:seed` to regenerate the SQL files.
- [ ] **Step 5: Docs.** `README.md`: replace the "Race model" bullet and the Race screen description with the circuit model (notes A/vmax/G/B, brake/nitro, seeded opponents). `DEPLOY.md`: after pulling this change run `npx supabase db push` (the migration upserts the four events, so `catalog.sql` need not be re-run) and redeploy the `races` Edge Function with `npx supabase functions deploy races`; `packs` is unchanged. `TODO.md`: add a line "Réglage fin des courses sur circuit (constantes dans `TUNING` et `tracks.ts`) après essai".
- [ ] **Step 6: Full verification.** `npm test`, `npm run test:db`, `npm run lint`, `npm run build` all pass; one more Playwright run of a full race in mock mode.
- [ ] **Step 7: Commit** "Races: server replays circuit inputs; remove the gear-shift model; docs" and `git push origin main`. Tell the user to run `npx supabase db push` and redeploy `races`.
