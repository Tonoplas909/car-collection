-- MARQUE game schema.
--
-- Clients read their own rows through RLS and never write tables directly. Every mutation goes
-- through a security-definer function so credit checks and transfers happen in one transaction.
-- Randomness (pack rolls) and race verification run in Edge Functions with the shared TypeScript
-- rules (supabase/functions/_shared/game) and are applied by service-role-only functions below.
--
-- Errors are raised as 'code|message[|needed]' so the client can map them to GameError.

create extension if not exists pgcrypto;

-- ── Reference data ───────────────────────────────────────────────────────────

create table public.cars (
  id text primary key,
  make text not null,
  model text not null,
  gen text not null default '',
  year int not null,
  country text not null,
  cc text not null,
  tier text not null check (tier in ('Common', 'Rare', 'Epic', 'Legendary')),
  hp int not null,
  nm int not null,
  acc numeric(4, 1) not null,
  top int not null,
  kg int not null,
  value bigint not null,
  blurb text not null default '',
  pools text[] not null default '{}',
  tastes text[] not null default '{}',
  photo_url text
);

create table public.race_events (
  id text primary key,
  kind text not null,
  len int not null,
  place text not null,
  fee int not null,
  win int not null,
  points int not null
);

create table public.seasons (
  id int primary key,
  ends_at timestamptz not null
);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  name text not null,
  rule text not null,
  prize text not null,
  event_id text not null references public.race_events (id),
  fee int not null,
  featured boolean not null default false
);

-- ── Players ──────────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (char_length(username) between 3 and 24),
  region text not null default 'France',
  city text not null default '',
  created_at timestamptz not null default now(),
  level int not null default 1,
  xp int not null default 0,
  credits bigint not null default 5000 check (credits >= 0),
  settings jsonb not null default '{"sound": true, "reduceMotion": false, "notifications": true, "showGarageValue": true}',
  races_run int not null default 0,
  races_won int not null default 0,
  season_points int not null default 0,
  packs_opened int not null default 0,
  legendary_pulls int not null default 0,
  pity int not null default 0,
  trades int not null default 0,
  trade_net bigint not null default 0,
  best_lap text not null default '—',
  streak int not null default 1,
  best_streak int not null default 1,
  free_pack_at timestamptz not null default now(),
  onboarded boolean not null default false
);

create table public.owned_cars (
  user_id uuid not null references public.profiles (id) on delete cascade,
  car_id text not null references public.cars (id),
  serial int not null,
  level int not null default 0 check (level between 0 and 5),
  acquired_at timestamptz not null default now(),
  showcase boolean not null default false,
  primary key (user_id, car_id)
);

create table public.activity (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  at timestamptz not null default now(),
  verb text not null,
  what text not null
);
create index activity_user_at on public.activity (user_id, at desc);

create table public.friends (
  user_id uuid not null references public.profiles (id) on delete cascade,
  friend_id uuid not null references public.profiles (id) on delete cascade,
  accepted boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

-- ── Market ───────────────────────────────────────────────────────────────────

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  -- null: a house seller that keeps the market stocked
  seller_id uuid references public.profiles (id) on delete cascade,
  seller_name text not null,
  car_id text not null references public.cars (id),
  level int not null default 0,
  -- serial held in escrow while a player's car is listed
  serial int,
  price bigint not null check (price >= 100),
  ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'sold', 'cancelled', 'expired')),
  created_at timestamptz not null default now()
);
create index listings_active on public.listings (status, ends_at);

create table public.sales (
  id bigint generated always as identity primary key,
  car_id text not null references public.cars (id),
  price bigint not null,
  sold_at timestamptz not null default now()
);
create index sales_car_at on public.sales (car_id, sold_at desc);

create table public.swap_offers (
  id uuid primary key default gen_random_uuid(),
  proposer_id uuid not null references public.profiles (id) on delete cascade,
  -- null when proposed to a house seller (never accepted)
  recipient_id uuid references public.profiles (id) on delete cascade,
  recipient_name text not null,
  proposer_car text not null references public.cars (id),
  recipient_car text not null references public.cars (id),
  credits bigint not null default 0 check (credits >= 0),
  expires_at timestamptz not null default now() + interval '24 hours',
  status text not null default 'open' check (status in ('open', 'accepted', 'declined'))
);

-- ── Races ────────────────────────────────────────────────────────────────────

create table public.races (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id text not null references public.race_events (id),
  car_id text not null references public.cars (id),
  level int not null,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  result jsonb
);

-- ── Row level security: read-only access to what a player may see ────────────

alter table public.cars enable row level security;
alter table public.race_events enable row level security;
alter table public.seasons enable row level security;
alter table public.calendar_events enable row level security;
alter table public.profiles enable row level security;
alter table public.owned_cars enable row level security;
alter table public.activity enable row level security;
alter table public.friends enable row level security;
alter table public.listings enable row level security;
alter table public.sales enable row level security;
alter table public.swap_offers enable row level security;
alter table public.races enable row level security;

create policy "catalog is public" on public.cars for select using (true);
create policy "events are public" on public.race_events for select using (true);
create policy "seasons are public" on public.seasons for select using (true);
create policy "calendar is public" on public.calendar_events for select using (true);
create policy "own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "own garage" on public.owned_cars for select to authenticated using (user_id = (select auth.uid()));
create policy "own activity" on public.activity for select to authenticated using (user_id = (select auth.uid()));
create policy "own friends" on public.friends for select to authenticated using (user_id = (select auth.uid()));
create policy "active listings" on public.listings for select to authenticated using (status = 'active' or seller_id = (select auth.uid()));
create policy "sales history" on public.sales for select to authenticated using (true);
create policy "own offers" on public.swap_offers for select to authenticated
  using (proposer_id = (select auth.uid()) or recipient_id = (select auth.uid()));
create policy "own races" on public.races for select to authenticated using (user_id = (select auth.uid()));

-- ── Internal helpers (not exposed through the API) ───────────────────────────

create schema if not exists private;

create function private.ms(t timestamptz) returns bigint
language sql immutable as $$ select (extract(epoch from t) * 1000)::bigint $$;

create function private.label(c public.cars) returns text
language sql immutable as $$ select case when c.gen <> '' then c.model || ' ' || c.gen else c.model end $$;

create function private.fmt(n bigint) returns text
language sql immutable as $$ select to_char(n, 'FM999,999,999,990') $$;

create function private.uid() returns uuid
language plpgsql stable as $$
begin
  if auth.uid() is null then
    raise exception 'unauthenticated|Sign in to continue.';
  end if;
  return auth.uid();
end $$;

create function private.spend(p_user uuid, p_amount bigint) returns void
language plpgsql as $$
begin
  update public.profiles set credits = credits - p_amount where id = p_user and credits >= p_amount;
  if not found then
    raise exception 'insufficient_credits|You need % CR.|%', private.fmt(p_amount), p_amount;
  end if;
end $$;

create function private.log(p_user uuid, p_verb text, p_what text) returns void
language sql as $$ insert into public.activity (user_id, verb, what) values (p_user, p_verb, p_what) $$;

create function private.add_car(p_user uuid, p_car text, p_level int default 0, p_serial int default null) returns void
language plpgsql as $$
begin
  insert into public.owned_cars (user_id, car_id, level, serial)
  values (
    p_user, p_car, p_level,
    coalesce(p_serial, (select coalesce(max(serial), 0) + 1 from public.owned_cars where user_id = p_user))
  );
end $$;

create function private.add_xp(p_user uuid, p_xp int) returns void
language plpgsql as $$
declare
  p public.profiles;
begin
  -- 10,000 XP per level (keep in sync with XP_PER_LEVEL)
  update public.profiles set xp = xp + p_xp where id = p_user returning * into p;
  while p.xp >= 10000 loop
    update public.profiles set xp = xp - 10000, level = level + 1 where id = p_user returning * into p;
    perform private.log(p_user, 'Reached', 'level ' || p.level);
  end loop;
end $$;

-- ── New users ────────────────────────────────────────────────────────────────

create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  wanted text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'username'), ''), split_part(new.email, '@', 1));
  name text := left(wanted, 24);
begin
  if char_length(name) < 3 then name := name || '_' || substr(md5(random()::text), 1, 4); end if;
  if exists (select 1 from public.profiles where username = name) then
    name := left(wanted, 19) || '_' || substr(md5(random()::text), 1, 4);
  end if;
  insert into public.profiles (id, username) values (new.id, name);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ── Snapshot: everything the signed-in player sees ───────────────────────────

create function public.get_snapshot() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := private.uid();
  p public.profiles;
  s public.seasons;
  l public.listings;
begin
  -- House listings roll over so the market never empties.
  update listings set ends_at = ends_at + interval '3 days' * ceil(extract(epoch from now() - ends_at) / 259200.0 + 0.0001)
  where seller_id is null and status = 'active' and ends_at < now();
  -- The player's own expired listings return the car to the garage.
  for l in select * from listings where seller_id = uid and status = 'active' and ends_at < now() for update loop
    perform private.add_car(uid, l.car_id, l.level, l.serial);
    update listings set status = 'expired' where id = l.id;
  end loop;
  update swap_offers set status = 'declined' where status = 'open' and expires_at < now() and (proposer_id = uid or recipient_id = uid);

  select * into p from profiles where id = uid;
  if not found then raise exception 'not_found|Profile missing.'; end if;
  select * into s from seasons order by id desc limit 1;

  return jsonb_build_object(
    'user', jsonb_build_object(
      'id', p.id, 'username', p.username, 'email', (select email from auth.users where id = uid),
      'region', p.region, 'city', p.city, 'since', private.ms(p.created_at),
      'level', p.level, 'xp', p.xp, 'credits', p.credits, 'settings', p.settings),
    'stats', jsonb_build_object(
      'racesRun', p.races_run, 'racesWon', p.races_won, 'seasonPoints', p.season_points,
      'packsOpened', p.packs_opened, 'legendaryPulls', p.legendary_pulls, 'pity', p.pity,
      'trades', p.trades, 'tradeNet', p.trade_net, 'bestLap', p.best_lap,
      'streak', p.streak, 'bestStreak', p.best_streak),
    'garage', coalesce((
      select jsonb_agg(jsonb_build_object('carId', car_id, 'serial', serial, 'level', level,
        'acquiredAt', private.ms(acquired_at), 'showcase', showcase) order by serial)
      from owned_cars where user_id = uid), '[]'::jsonb),
    'listings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id, 'carId', x.car_id, 'level', x.level, 'price', x.price, 'seller', x.seller_name,
        'endsAt', private.ms(x.ends_at), 'mine', x.seller_id is not distinct from uid,
        'avg', coalesce((select round(avg(price))::bigint from sales where car_id = x.car_id and sold_at > now() - interval '30 days'), c.value)
      ) order by x.created_at)
      from listings x join cars c on c.id = x.car_id
      where x.status = 'active'), '[]'::jsonb),
    'offers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id,
        'from', (select username from profiles where id = o.proposer_id),
        'to', o.recipient_name,
        'give', case when o.recipient_id = uid then o.recipient_car else o.proposer_car end,
        'get', case when o.recipient_id = uid then o.proposer_car else o.recipient_car end,
        'credits', o.credits, 'expiresAt', private.ms(o.expires_at), 'incoming', o.recipient_id = uid
      ) order by o.expires_at)
      from swap_offers o where o.status = 'open' and (o.proposer_id = uid or o.recipient_id = uid)), '[]'::jsonb),
    'activity', coalesce((
      select jsonb_agg(jsonb_build_object('at', private.ms(a.at), 'verb', a.verb, 'what', a.what) order by a.at desc)
      from (select * from activity where user_id = uid order by at desc limit 50) a), '[]'::jsonb),
    'friends', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', fp.username,
        'status', case when f.accepted then 'Friend' else 'Request sent' end,
        'online', false,
        'cars', (select count(*) from owned_cars where user_id = fp.id),
        'points', fp.season_points,
        'showcase', coalesce((
          select c.make || ' ' || private.label(c) from owned_cars oc join cars c on c.id = oc.car_id
          where oc.user_id = fp.id order by oc.showcase desc, c.value desc limit 1), '—')
      ) order by fp.username)
      from friends f join profiles fp on fp.id = f.friend_id where f.user_id = uid), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'date', private.ms(e.starts_at), 'name', e.name, 'rule', e.rule,
        'prize', e.prize, 'eventId', e.event_id, 'fee', e.fee, 'featured', e.featured) order by e.starts_at)
      from calendar_events e where e.starts_at > now() - interval '1 day'), '[]'::jsonb),
    'freePackAt', private.ms(p.free_pack_at),
    'seasonEndsAt', private.ms(coalesce(s.ends_at, now())),
    'season', coalesce(s.id, 1)
  );
end $$;

-- ── Market ───────────────────────────────────────────────────────────────────

create function public.buy_listing(p_listing uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := private.uid();
  l listings;
  c cars;
begin
  select * into l from listings where id = p_listing and status = 'active' for update;
  if not found then raise exception 'not_found|This listing has ended.'; end if;
  if l.seller_id = uid then raise exception 'invalid|You cannot buy your own listing.'; end if;
  if exists (select 1 from owned_cars where user_id = uid and car_id = l.car_id) then
    raise exception 'invalid|This car is already in your garage.';
  end if;
  select * into c from cars where id = l.car_id;
  perform private.spend(uid, l.price);
  if l.seller_id is not null then
    -- 5% market fee taken from the seller (keep in sync with MARKET_FEE)
    update profiles set credits = credits + l.price - round(l.price * 0.05), trades = trades + 1,
      trade_net = trade_net + l.price - round(l.price * 0.05)
    where id = l.seller_id;
    perform private.log(l.seller_id, 'Sold', format('%s %s for %s CR', c.make, private.label(c), private.fmt(l.price)));
  end if;
  perform private.add_car(uid, l.car_id, l.level);
  update listings set status = 'sold' where id = l.id;
  insert into sales (car_id, price) values (l.car_id, l.price);
  update profiles set trades = trades + 1, trade_net = trade_net - l.price where id = uid;
  perform private.log(uid, 'Bought', format('%s %s from %s', c.make, private.label(c), l.seller_name));
  return public.get_snapshot();
end $$;

create function public.list_car(p_car text, p_price bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := private.uid();
  o owned_cars;
  c cars;
begin
  if p_price is null or p_price < 100 then raise exception 'invalid|Set a price of at least 100 CR.'; end if;
  delete from owned_cars where user_id = uid and car_id = p_car returning * into o;
  if not found then raise exception 'not_found|This car is not in your garage.'; end if;
  select * into c from cars where id = p_car;
  insert into listings (seller_id, seller_name, car_id, level, serial, price, ends_at)
  values (uid, (select username from profiles where id = uid), p_car, o.level, o.serial, p_price, now() + interval '3 days');
  perform private.log(uid, 'Listed', format('%s %s for %s CR', c.make, private.label(c), private.fmt(p_price)));
  return public.get_snapshot();
end $$;

create function public.cancel_listing(p_listing uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := private.uid();
  l listings;
begin
  update listings set status = 'cancelled' where id = p_listing and seller_id = uid and status = 'active' returning * into l;
  if not found then raise exception 'not_found|Listing not found.'; end if;
  perform private.add_car(uid, l.car_id, l.level, l.serial);
  return public.get_snapshot();
end $$;

create function public.make_offer(p_listing uuid, p_price bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := private.uid();
  l listings;
  c cars;
begin
  select * into l from listings where id = p_listing and status = 'active';
  if not found then raise exception 'not_found|This listing has ended.'; end if;
  if (select credits from profiles where id = uid) < p_price then
    raise exception 'insufficient_credits|Your balance is too low for this offer.|%', p_price;
  end if;
  select * into c from cars where id = l.car_id;
  -- Price offers are recorded for now; sellers accepting them is a later feature.
  perform private.log(uid, 'Offered', format('%s CR to %s for the %s', private.fmt(p_price), l.seller_name, private.label(c)));
  return public.get_snapshot();
end $$;

create function public.propose_swap(p_to text, p_give text, p_get text, p_credits bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := private.uid();
  c cars;
begin
  if not exists (select 1 from owned_cars where user_id = uid and car_id = p_give) then
    raise exception 'not_found|This car is not in your garage.';
  end if;
  if coalesce(p_credits, 0) < 0 then raise exception 'invalid|Credits cannot be negative.'; end if;
  insert into swap_offers (proposer_id, recipient_id, recipient_name, proposer_car, recipient_car, credits)
  values (uid, (select id from profiles where username = p_to), p_to, p_give, p_get, coalesce(p_credits, 0));
  select * into c from cars where id = p_give;
  perform private.log(uid, 'Proposed', format('a swap of the %s to %s', private.label(c), p_to));
  return public.get_snapshot();
end $$;

create function public.accept_swap(p_offer uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := private.uid();
  o swap_offers;
  a cars;
  b cars;
  mine owned_cars;
  theirs owned_cars;
begin
  select * into o from swap_offers where id = p_offer and recipient_id = uid and status = 'open' and expires_at > now() for update;
  if not found then raise exception 'not_found|This offer has expired.'; end if;
  delete from owned_cars where user_id = uid and car_id = o.recipient_car returning * into mine;
  if not found then raise exception 'invalid|The car asked for is no longer in your garage.'; end if;
  delete from owned_cars where user_id = o.proposer_id and car_id = o.proposer_car returning * into theirs;
  if not found then raise exception 'invalid|The other player no longer has this car.'; end if;
  perform private.spend(o.proposer_id, o.credits);
  update profiles set credits = credits + o.credits, trades = trades + 1, trade_net = trade_net + o.credits where id = uid;
  update profiles set trades = trades + 1, trade_net = trade_net - o.credits where id = o.proposer_id;
  -- Duplicates convert to credits like pack duplicates (keep in sync with DUPLICATE_CREDITS).
  select * into a from cars where id = o.recipient_car;
  select * into b from cars where id = o.proposer_car;
  if exists (select 1 from owned_cars where user_id = uid and car_id = b.id) then
    update profiles set credits = credits + case b.tier when 'Common' then 300 when 'Rare' then 1200 when 'Epic' then 4000 else 15000 end where id = uid;
  else
    perform private.add_car(uid, b.id, theirs.level);
  end if;
  if exists (select 1 from owned_cars where user_id = o.proposer_id and car_id = a.id) then
    update profiles set credits = credits + case a.tier when 'Common' then 300 when 'Rare' then 1200 when 'Epic' then 4000 else 15000 end where id = o.proposer_id;
  else
    perform private.add_car(o.proposer_id, a.id, mine.level);
  end if;
  update swap_offers set status = 'accepted' where id = o.id;
  perform private.log(uid, 'Swapped', format('%s for %s', private.label(a), private.label(b)));
  perform private.log(o.proposer_id, 'Swapped', format('%s for %s', private.label(b), private.label(a)));
  return public.get_snapshot();
end $$;

create function public.decline_swap(p_offer uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := private.uid();
begin
  update swap_offers set status = 'declined' where id = p_offer and status = 'open' and (recipient_id = uid or proposer_id = uid);
  return public.get_snapshot();
end $$;

-- ── Garage ───────────────────────────────────────────────────────────────────

create function public.upgrade_car(p_car text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := private.uid();
  o owned_cars;
  c cars;
  -- Credits to go from level n to n + 1 (keep in sync with UPGRADE_COST)
  costs int[] := array[1000, 2000, 5000, 9000, 15000];
begin
  select * into o from owned_cars where user_id = uid and car_id = p_car for update;
  if not found then raise exception 'not_found|This car is not in your garage.'; end if;
  if o.level >= 5 then raise exception 'invalid|Already at level 5.'; end if;
  perform private.spend(uid, costs[o.level + 1]);
  update owned_cars set level = level + 1 where user_id = uid and car_id = p_car;
  select * into c from cars where id = p_car;
  perform private.log(uid, 'Upgraded', format('%s %s to Lv %s', c.make, private.label(c), o.level + 1));
  return public.get_snapshot();
end $$;

create function public.set_showcase(p_cars text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := private.uid();
begin
  update owned_cars set showcase = (car_id = any (p_cars[1:3])) where user_id = uid;
  return public.get_snapshot();
end $$;

-- ── Profile & friends ────────────────────────────────────────────────────────

create function public.save_profile(p_username text, p_region text, p_settings jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := private.uid();
  name text := trim(p_username);
begin
  if char_length(name) < 3 or char_length(name) > 24 then raise exception 'invalid|Usernames are 3 to 24 characters.'; end if;
  if exists (select 1 from profiles where username = name and id <> uid) then raise exception 'invalid|This username is taken.'; end if;
  update profiles set username = name, region = left(trim(p_region), 40),
    settings = jsonb_build_object(
      'sound', coalesce((p_settings ->> 'sound')::boolean, true),
      'reduceMotion', coalesce((p_settings ->> 'reduceMotion')::boolean, false),
      'notifications', coalesce((p_settings ->> 'notifications')::boolean, true),
      'showGarageValue', coalesce((p_settings ->> 'showGarageValue')::boolean, true))
  where id = uid;
  update listings set seller_name = name where seller_id = uid and status = 'active';
  return public.get_snapshot();
end $$;

create function public.add_friend(p_username text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := private.uid();
  fid uuid;
begin
  select id into fid from profiles where username = trim(p_username);
  if fid is null then raise exception 'not_found|No player called %.', trim(p_username); end if;
  if fid = uid then raise exception 'invalid|That is you.'; end if;
  if exists (select 1 from friends where user_id = uid and friend_id = fid) then
    raise exception 'invalid|% is already on your list.', trim(p_username);
  end if;
  insert into friends (user_id, friend_id) values (uid, fid);
  -- A request in both directions makes it mutual.
  if exists (select 1 from friends where user_id = fid and friend_id = uid) then
    update friends set accepted = true where (user_id = uid and friend_id = fid) or (user_id = fid and friend_id = uid);
  end if;
  return public.get_snapshot();
end $$;

-- ── Races ────────────────────────────────────────────────────────────────────

create function public.enter_race(p_event text, p_car text) returns jsonb
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
    'entry', jsonb_build_object('raceId', rid, 'eventId', p_event, 'carId', p_car,
      'opponents', jsonb_build_array(
        jsonb_build_object('name', 'bayside.r', 'car', 'Toyota Supra A80'),
        jsonb_build_object('name', 'rallye.b', 'car', 'Lancia Delta Integrale'),
        jsonb_build_object('name', 'touge.t', 'car', 'Honda NSX NA1'))));
end $$;

-- Called by the `races` Edge Function after it replays the race.
create function public.apply_race_result(p_user uuid, p_race uuid, p_result jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  r races;
  e race_events;
  c cars;
  place int := (p_result ->> 'place')::int;
begin
  update races set finished_at = now(), result = p_result
  where id = p_race and user_id = p_user and finished_at is null returning * into r;
  if not found then raise exception 'not_found|This race has already been scored.'; end if;
  select * into e from race_events where id = r.event_id;
  select * into c from cars where id = r.car_id;
  update profiles set
    credits = credits + (p_result -> 'rewards' ->> 'credits')::int,
    season_points = season_points + (p_result -> 'rewards' ->> 'points')::int,
    races_run = races_run + 1,
    races_won = races_won + case when place = 1 then 1 else 0 end
  where id = p_user;
  perform private.add_xp(p_user, (p_result -> 'rewards' ->> 'xp')::int);
  if place = 1 then
    perform private.log(p_user, 'Won', format('a %s at %s in the %s', lower(e.kind), e.place, private.label(c)));
  else
    perform private.log(p_user, 'Finished P' || place, format('in a %s at %s', lower(e.kind), e.place));
  end if;
end $$;

-- ── Packs ────────────────────────────────────────────────────────────────────

-- Called by the `packs` Edge Function with a roll made from the shared rules.
-- Duplicate flags are re-checked here, inside the transaction, against the live garage.
create function public.apply_pack_opening(
  p_user uuid, p_label text, p_price int, p_free boolean, p_pulls jsonb, p_dup_credits jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p profiles;
  pull jsonb;
  out_pulls jsonb := '[]'::jsonb;
  dup boolean;
  v_credits int;
  back int := 0;
  has_leg boolean := false;
  best cars;
begin
  select * into p from profiles where id = p_user for update;
  if p_free then
    if p.free_pack_at > now() then raise exception 'invalid|Your free pack is not ready yet.'; end if;
    update profiles set free_pack_at = now() + interval '24 hours' where id = p_user;
  else
    perform private.spend(p_user, p_price);
  end if;
  for pull in select * from jsonb_array_elements(p_pulls) loop
    dup := exists (select 1 from owned_cars where user_id = p_user and car_id = pull ->> 'carId');
    v_credits := case when dup then (p_dup_credits ->> (pull ->> 'tier'))::int else 0 end;
    if not dup then perform private.add_car(p_user, pull ->> 'carId'); end if;
    back := back + v_credits;
    has_leg := has_leg or (pull ->> 'tier') = 'Legendary';
    out_pulls := out_pulls || jsonb_build_object('carId', pull ->> 'carId', 'tier', pull ->> 'tier', 'duplicate', dup, 'credits', v_credits);
  end loop;
  update profiles set
    credits = credits + back,
    packs_opened = packs_opened + 1,
    legendary_pulls = legendary_pulls + case when has_leg then 1 else 0 end,
    pity = case when has_leg then 0 else pity + 1 end
  where id = p_user;
  select * into best from cars where id = (p_pulls -> -1 ->> 'carId');
  perform private.log(p_user, 'Pulled', format('%s %s from a %s pack', best.make, private.label(best), p_label));
  return jsonb_build_object('pulls', out_pulls, 'creditsBack', back);
end $$;

create function public.apply_starter_pack(p_user uuid, p_cars text[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  cid text;
  hero cars;
begin
  if (select onboarded from profiles where id = p_user for update) or exists (select 1 from owned_cars where user_id = p_user) then
    raise exception 'invalid|The starter pack has already been opened.';
  end if;
  foreach cid in array p_cars loop perform private.add_car(p_user, cid); end loop;
  update profiles set onboarded = true where id = p_user;
  select * into hero from cars where id = p_cars[1];
  perform private.log(p_user, 'Pulled', format('%s %s from the starter pack', hero.make, private.label(hero)));
end $$;

-- ── Leaderboards ─────────────────────────────────────────────────────────────

create function public.get_leaderboard(p_metric text, p_scope text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := private.uid();
  me profiles;
  my_score bigint;
  my_rank bigint;
  next_score bigint;
  total bigint;
  v_rows jsonb;
begin
  select * into me from profiles where id = uid;
  create temp table if not exists lb (id uuid, name text, region text, score bigint, car text) on commit drop;
  delete from lb;
  insert into lb
  select pr.id, pr.username, pr.region,
    case p_metric
      when 'value' then coalesce((select sum(c.value) from owned_cars o join cars c on c.id = o.car_id where o.user_id = pr.id), 0)
      when 'size' then (select count(*) from owned_cars o where o.user_id = pr.id)
      else pr.season_points
    end,
    coalesce((select c.make || ' ' || private.label(c) from owned_cars o join cars c on c.id = o.car_id
      where o.user_id = pr.id order by c.value desc limit 1), '—')
  from profiles pr
  where case p_scope
    when 'friends' then pr.id = uid or pr.id in (select friend_id from friends where user_id = uid)
    when 'region' then pr.region = me.region
    else true
  end;

  select score into my_score from lb where id = uid;
  select count(*) + 1 into my_rank from lb where score > my_score;
  select min(score) into next_score from lb where score > my_score;
  select count(*) into total from lb;
  select coalesce(jsonb_agg(jsonb_build_object('rank', rk, 'name', name, 'cc', upper(left(region, 2)), 'car', car, 'score', score) order by rk), '[]'::jsonb)
  into v_rows
  from (select *, rank() over (order by score desc, name) as rk from lb) t where rk <= 18;

  return jsonb_build_object('rows', v_rows, 'me', jsonb_build_object(
    'rank', my_rank, 'score', my_score,
    'car', coalesce((select car from lb where id = uid), '—'),
    'gapToNext', coalesce(next_score - my_score, 0),
    'progress', case when coalesce(next_score, 0) > 0 then round(my_score::numeric / next_score, 2) else 1 end,
    'percentile', case p_scope
      when 'friends' then format('%s of %s friends', my_rank, total)
      when 'region' then format('Top %s%% in %s', greatest(1, ceil(100.0 * my_rank / greatest(total, 1))), me.region)
      else format('Top %s%% of %s active players', greatest(1, ceil(100.0 * my_rank / greatest(total, 1))), to_char(total, 'FM999,999,990'))
    end));
end $$;

-- ── Privileges ───────────────────────────────────────────────────────────────

revoke all on schema private from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.get_snapshot(), public.buy_listing(uuid), public.list_car(text, bigint), public.cancel_listing(uuid),
  public.make_offer(uuid, bigint), public.propose_swap(text, text, text, bigint), public.accept_swap(uuid),
  public.decline_swap(uuid), public.upgrade_car(text), public.set_showcase(text[]),
  public.save_profile(text, text, jsonb), public.add_friend(text), public.enter_race(text, text),
  public.get_leaderboard(text, text)
to authenticated;

grant execute on function
  public.apply_race_result(uuid, uuid, jsonb), public.apply_pack_opening(uuid, text, int, boolean, jsonb, jsonb),
  public.apply_starter_pack(uuid, text[])
to service_role;
