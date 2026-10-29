-- Circuit races. The opponents are no longer listed by the database: the client and the Edge
-- Function derive the same three cars from the race id (supabase/functions/_shared/game/opponents.ts).

create or replace function public.enter_race(p_event text, p_car text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := private.uid();
  e race_events;
  o owned_cars;
  rid uuid;
begin
  select * into e from race_events where id = p_event;
  if not found then raise exception 'not_found|Unknown event.'; end if;
  select * into o from owned_cars where user_id = uid and car_id = p_car;
  if not found then raise exception 'not_found|Choose a car from your garage.'; end if;
  perform private.spend(uid, e.fee);
  insert into races (user_id, event_id, car_id, level) values (uid, p_event, p_car, o.level) returning id into rid;
  return jsonb_build_object(
    'snapshot', public.get_snapshot(),
    'entry', jsonb_build_object('raceId', rid, 'eventId', p_event, 'carId', p_car));
end $$;

-- Keep in sync with RACE_EVENTS in supabase/functions/_shared/game/race.ts
-- (npm run db:seed writes the same rows to catalog.sql, which is safe to run on the live database).
insert into public.race_events (id, kind, len, place, fee, win, points) values
  ('sprint', 'Circuit', 1500, 'Suzuka East', 500, 2500, 120),
  ('drag', 'Drag', 1540, 'Santa Pod, launch loop', 300, 1500, 80),
  ('touge', 'Touge', 910, 'Mount Haruna pass', 700, 3800, 160),
  ('run', 'Highway run', 2520, 'Autobahn A9, closed section', 1000, 6000, 220)
on conflict (id) do update set kind = excluded.kind, len = excluded.len, place = excluded.place, fee = excluded.fee, win = excluded.win, points = excluded.points;
