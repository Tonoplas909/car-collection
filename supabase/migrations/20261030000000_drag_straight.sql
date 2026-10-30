-- Drag is a straight quarter mile again, with a manual gearbox (supabase/functions/_shared/game/drag.ts).
-- Keep in sync with RACE_EVENTS in supabase/functions/_shared/game/race.ts
-- (npm run db:seed writes the same rows to catalog.sql, which is safe to run on the live database).
insert into public.race_events (id, kind, len, place, fee, win, points) values
  ('sprint', 'Circuit', 1500, 'Suzuka East', 500, 2500, 120),
  ('drag', 'Drag', 402, 'Santa Pod, quarter mile', 300, 1500, 80),
  ('touge', 'Touge', 910, 'Mount Haruna pass', 700, 3800, 160),
  ('run', 'Highway run', 2520, 'Autobahn A9, closed section', 1000, 6000, 220)
on conflict (id) do update set kind = excluded.kind, len = excluded.len, place = excluded.place, fee = excluded.fee, win = excluded.win, points = excluded.points;
