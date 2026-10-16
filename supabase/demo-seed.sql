-- MARQUE demo data: fake accounts + activity for a school project showcase.
-- Not part of the generated catalog pipeline (supabase/seed.sql / catalog.sql) — run this by hand,
-- once, against a project whose car catalog is already loaded (npm run db:seed / catalog.sql applied).
--
-- Run it in the Supabase dashboard's SQL Editor (hosted project), or:
--   psql "$DATABASE_URL" -f supabase/demo-seed.sql
--
-- Creates 14 fake players (garages, stats, activity, market listings, friendships,
-- swap offers). They show up immediately on the Leaderboard and Market screens for ANY logged-in
-- account — including your own — since those are global. Their Activity/Friends feeds only show up
-- if you log into one of these fake accounts directly.
--
-- All fake accounts share the password: Demo1234!
-- Emails follow the pattern <username>@marque.demo so they're easy to find and wipe later:
--   delete from auth.users where email like '%@marque.demo';  -- cascades to every table below
--
-- Fake usernames: apex.julien, retro.claire, drift.sato, touge.mina, rallye.marco, autobahn.lena, cityhatch.noa, paddock.yanis, vitesse.chloe, boxe.hugo, freshstart.lea, grid.oliver, westcoast.jake, curb.ines

create extension if not exists pgcrypto;

-- ── Accounts (auth.users + auth.identities; the on_auth_user_created trigger creates the matching
--    public.profiles row automatically) ──────────────────────────────────────────────────────────


-- apex.julien (whale, Lyon)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000', '0000dead-0000-4000-a000-000000000001', 'authenticated', 'authenticated', 'apex_julien@marque.demo',
  crypt('Demo1234!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('username', 'apex.julien'),
  now() - interval '83 days', now()
);
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '0000dead-0000-4000-a000-000000000001', '0000dead-0000-4000-a000-000000000001', jsonb_build_object('sub', '0000dead-0000-4000-a000-000000000001', 'email', 'apex_julien@marque.demo'), 'email', now(), now(), now());

-- retro.claire (collector, Reims)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000', '0000dead-0000-4000-a000-000000000002', 'authenticated', 'authenticated', 'retro_claire@marque.demo',
  crypt('Demo1234!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('username', 'retro.claire'),
  now() - interval '389 days', now()
);
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '0000dead-0000-4000-a000-000000000002', '0000dead-0000-4000-a000-000000000002', jsonb_build_object('sub', '0000dead-0000-4000-a000-000000000002', 'email', 'retro_claire@marque.demo'), 'email', now(), now(), now());

-- drift.sato (whale, Tokyo)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000', '0000dead-0000-4000-a000-000000000003', 'authenticated', 'authenticated', 'drift_sato@marque.demo',
  crypt('Demo1234!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('username', 'drift.sato'),
  now() - interval '63 days', now()
);
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '0000dead-0000-4000-a000-000000000003', '0000dead-0000-4000-a000-000000000003', jsonb_build_object('sub', '0000dead-0000-4000-a000-000000000003', 'email', 'drift_sato@marque.demo'), 'email', now(), now(), now());

-- touge.mina (collector, Osaka)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000', '0000dead-0000-4000-a000-000000000004', 'authenticated', 'authenticated', 'touge_mina@marque.demo',
  crypt('Demo1234!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('username', 'touge.mina'),
  now() - interval '363 days', now()
);
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '0000dead-0000-4000-a000-000000000004', '0000dead-0000-4000-a000-000000000004', jsonb_build_object('sub', '0000dead-0000-4000-a000-000000000004', 'email', 'touge_mina@marque.demo'), 'email', now(), now(), now());

-- rallye.marco (collector, Torino)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000', '0000dead-0000-4000-a000-000000000005', 'authenticated', 'authenticated', 'rallye_marco@marque.demo',
  crypt('Demo1234!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('username', 'rallye.marco'),
  now() - interval '391 days', now()
);
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '0000dead-0000-4000-a000-000000000005', '0000dead-0000-4000-a000-000000000005', jsonb_build_object('sub', '0000dead-0000-4000-a000-000000000005', 'email', 'rallye_marco@marque.demo'), 'email', now(), now(), now());

-- autobahn.lena (whale, Munich)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000', '0000dead-0000-4000-a000-000000000006', 'authenticated', 'authenticated', 'autobahn_lena@marque.demo',
  crypt('Demo1234!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('username', 'autobahn.lena'),
  now() - interval '176 days', now()
);
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '0000dead-0000-4000-a000-000000000006', '0000dead-0000-4000-a000-000000000006', jsonb_build_object('sub', '0000dead-0000-4000-a000-000000000006', 'email', 'autobahn_lena@marque.demo'), 'email', now(), now(), now());

-- cityhatch.noa (regular, Nantes)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000', '0000dead-0000-4000-a000-000000000007', 'authenticated', 'authenticated', 'cityhatch_noa@marque.demo',
  crypt('Demo1234!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('username', 'cityhatch.noa'),
  now() - interval '336 days', now()
);
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '0000dead-0000-4000-a000-000000000007', '0000dead-0000-4000-a000-000000000007', jsonb_build_object('sub', '0000dead-0000-4000-a000-000000000007', 'email', 'cityhatch_noa@marque.demo'), 'email', now(), now(), now());

-- paddock.yanis (regular, Marseille)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000', '0000dead-0000-4000-a000-000000000008', 'authenticated', 'authenticated', 'paddock_yanis@marque.demo',
  crypt('Demo1234!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('username', 'paddock.yanis'),
  now() - interval '315 days', now()
);
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '0000dead-0000-4000-a000-000000000008', '0000dead-0000-4000-a000-000000000008', jsonb_build_object('sub', '0000dead-0000-4000-a000-000000000008', 'email', 'paddock_yanis@marque.demo'), 'email', now(), now(), now());

-- vitesse.chloe (regular, Toulouse)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000', '0000dead-0000-4000-a000-000000000009', 'authenticated', 'authenticated', 'vitesse_chloe@marque.demo',
  crypt('Demo1234!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('username', 'vitesse.chloe'),
  now() - interval '360 days', now()
);
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '0000dead-0000-4000-a000-000000000009', '0000dead-0000-4000-a000-000000000009', jsonb_build_object('sub', '0000dead-0000-4000-a000-000000000009', 'email', 'vitesse_chloe@marque.demo'), 'email', now(), now(), now());

-- boxe.hugo (newbie, Bordeaux)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000', '0000dead-0000-4000-a000-00000000000a', 'authenticated', 'authenticated', 'boxe_hugo@marque.demo',
  crypt('Demo1234!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('username', 'boxe.hugo'),
  now() - interval '63 days', now()
);
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '0000dead-0000-4000-a000-00000000000a', '0000dead-0000-4000-a000-00000000000a', jsonb_build_object('sub', '0000dead-0000-4000-a000-00000000000a', 'email', 'boxe_hugo@marque.demo'), 'email', now(), now(), now());

-- freshstart.lea (newbie, Lille)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000', '0000dead-0000-4000-a000-00000000000b', 'authenticated', 'authenticated', 'freshstart_lea@marque.demo',
  crypt('Demo1234!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('username', 'freshstart.lea'),
  now() - interval '336 days', now()
);
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '0000dead-0000-4000-a000-00000000000b', '0000dead-0000-4000-a000-00000000000b', jsonb_build_object('sub', '0000dead-0000-4000-a000-00000000000b', 'email', 'freshstart_lea@marque.demo'), 'email', now(), now(), now());

-- grid.oliver (collector, London)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000', '0000dead-0000-4000-a000-00000000000c', 'authenticated', 'authenticated', 'grid_oliver@marque.demo',
  crypt('Demo1234!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('username', 'grid.oliver'),
  now() - interval '120 days', now()
);
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '0000dead-0000-4000-a000-00000000000c', '0000dead-0000-4000-a000-00000000000c', jsonb_build_object('sub', '0000dead-0000-4000-a000-00000000000c', 'email', 'grid_oliver@marque.demo'), 'email', now(), now(), now());

-- westcoast.jake (whale, Los Angeles)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000', '0000dead-0000-4000-a000-00000000000d', 'authenticated', 'authenticated', 'westcoast_jake@marque.demo',
  crypt('Demo1234!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('username', 'westcoast.jake'),
  now() - interval '164 days', now()
);
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '0000dead-0000-4000-a000-00000000000d', '0000dead-0000-4000-a000-00000000000d', jsonb_build_object('sub', '0000dead-0000-4000-a000-00000000000d', 'email', 'westcoast_jake@marque.demo'), 'email', now(), now(), now());

-- curb.ines (newbie, Strasbourg)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000', '0000dead-0000-4000-a000-00000000000e', 'authenticated', 'authenticated', 'curb_ines@marque.demo',
  crypt('Demo1234!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('username', 'curb.ines'),
  now() - interval '393 days', now()
);
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '0000dead-0000-4000-a000-00000000000e', '0000dead-0000-4000-a000-00000000000e', jsonb_build_object('sub', '0000dead-0000-4000-a000-00000000000e', 'email', 'curb_ines@marque.demo'), 'email', now(), now(), now());

-- ── Profile stats (level, credits, season stats, etc.) ───────────────────────────────────────

update public.profiles set region = 'France', city = 'Lyon', level = 20, xp = 4852,
  credits = 47267, races_run = 154, races_won = 40, season_points = 5268,
  packs_opened = 66, legendary_pulls = 7, pity = 2, trades = 29, trade_net = 30927,
  best_lap = '2:31.205', streak = 1, best_streak = 5, onboarded = true,
  free_pack_at = now() + interval '0 hours'
where id = '0000dead-0000-4000-a000-000000000001';
update public.profiles set region = 'France', city = 'Reims', level = 14, xp = 551,
  credits = 36351, races_run = 73, races_won = 39, season_points = 2179,
  packs_opened = 39, legendary_pulls = 1, pity = 9, trades = 14, trade_net = 20978,
  best_lap = '1:27.378', streak = 2, best_streak = 6, onboarded = true,
  free_pack_at = now() + interval '8 hours'
where id = '0000dead-0000-4000-a000-000000000002';
update public.profiles set region = 'Japan', city = 'Tokyo', level = 22, xp = 2129,
  credits = 107058, races_run = 180, races_won = 48, season_points = 7692,
  packs_opened = 62, legendary_pulls = 8, pity = 15, trades = 38, trade_net = 16206,
  best_lap = '2:24.931', streak = 2, best_streak = 6, onboarded = true,
  free_pack_at = now() + interval '4 hours'
where id = '0000dead-0000-4000-a000-000000000003';
update public.profiles set region = 'Japan', city = 'Osaka', level = 11, xp = 1733,
  credits = 38772, races_run = 62, races_won = 31, season_points = 2575,
  packs_opened = 25, legendary_pulls = 3, pity = 1, trades = 6, trade_net = 3388,
  best_lap = '1:24.041', streak = 6, best_streak = 7, onboarded = true,
  free_pack_at = now() + interval '5 hours'
where id = '0000dead-0000-4000-a000-000000000004';
update public.profiles set region = 'Italy', city = 'Torino', level = 11, xp = 8955,
  credits = 18025, races_run = 67, races_won = 31, season_points = 3044,
  packs_opened = 27, legendary_pulls = 2, pity = 10, trades = 17, trade_net = 13318,
  best_lap = '1:38.105', streak = 6, best_streak = 12, onboarded = true,
  free_pack_at = now() + interval '1 hours'
where id = '0000dead-0000-4000-a000-000000000005';
update public.profiles set region = 'Germany', city = 'Munich', level = 18, xp = 4948,
  credits = 72364, races_run = 131, races_won = 69, season_points = 7500,
  packs_opened = 60, legendary_pulls = 5, pity = 7, trades = 11, trade_net = 31047,
  best_lap = '2:19.003', streak = 6, best_streak = 12, onboarded = true,
  free_pack_at = now() + interval '1 hours'
where id = '0000dead-0000-4000-a000-000000000006';
update public.profiles set region = 'France', city = 'Nantes', level = 9, xp = 4499,
  credits = 17072, races_run = 11, races_won = 4, season_points = 899,
  packs_opened = 8, legendary_pulls = 0, pity = 2, trades = 4, trade_net = 25544,
  best_lap = '2:21.310', streak = 5, best_streak = 10, onboarded = true,
  free_pack_at = now() + interval '-2 hours'
where id = '0000dead-0000-4000-a000-000000000007';
update public.profiles set region = 'France', city = 'Marseille', level = 5, xp = 1675,
  credits = 19558, races_run = 20, races_won = 11, season_points = 359,
  packs_opened = 5, legendary_pulls = 0, pity = 2, trades = 6, trade_net = 20096,
  best_lap = '2:16.221', streak = 4, best_streak = 9, onboarded = true,
  free_pack_at = now() + interval '5 hours'
where id = '0000dead-0000-4000-a000-000000000008';
update public.profiles set region = 'France', city = 'Toulouse', level = 5, xp = 8419,
  credits = 18795, races_run = 15, races_won = 6, season_points = 888,
  packs_opened = 7, legendary_pulls = 1, pity = 8, trades = 3, trade_net = 1847,
  best_lap = '1:53.413', streak = 4, best_streak = 6, onboarded = true,
  free_pack_at = now() + interval '10 hours'
where id = '0000dead-0000-4000-a000-000000000009';
update public.profiles set region = 'France', city = 'Bordeaux', level = 2, xp = 2064,
  credits = 1017, races_run = 3, races_won = 2, season_points = 12,
  packs_opened = 2, legendary_pulls = 0, pity = 2, trades = 0, trade_net = -4439,
  best_lap = '1:51.753', streak = 6, best_streak = 6, onboarded = true,
  free_pack_at = now() + interval '8 hours'
where id = '0000dead-0000-4000-a000-00000000000a';
update public.profiles set region = 'France', city = 'Lille', level = 1, xp = 1194,
  credits = 5449, races_run = 5, races_won = 2, season_points = 60,
  packs_opened = 0, legendary_pulls = 0, pity = 4, trades = 1, trade_net = -4015,
  best_lap = '2:30.267', streak = 6, best_streak = 11, onboarded = true,
  free_pack_at = now() + interval '1 hours'
where id = '0000dead-0000-4000-a000-00000000000b';
update public.profiles set region = 'United Kingdom', city = 'London', level = 11, xp = 8602,
  credits = 53926, races_run = 82, races_won = 43, season_points = 1414,
  packs_opened = 25, legendary_pulls = 3, pity = 8, trades = 8, trade_net = 20721,
  best_lap = '2:36.686', streak = 4, best_streak = 6, onboarded = true,
  free_pack_at = now() + interval '-1 hours'
where id = '0000dead-0000-4000-a000-00000000000c';
update public.profiles set region = 'United States', city = 'Los Angeles', level = 28, xp = 5347,
  credits = 54719, races_run = 194, races_won = 77, season_points = 3358,
  packs_opened = 72, legendary_pulls = 4, pity = 1, trades = 18, trade_net = 13648,
  best_lap = '2:57.468', streak = 4, best_streak = 6, onboarded = true,
  free_pack_at = now() + interval '8 hours'
where id = '0000dead-0000-4000-a000-00000000000d';
update public.profiles set region = 'France', city = 'Strasbourg', level = 1, xp = 666,
  credits = 5587, races_run = 3, races_won = 1, season_points = 144,
  packs_opened = 1, legendary_pulls = 0, pity = 0, trades = 0, trade_net = 9508,
  best_lap = '1:10.259', streak = 2, best_streak = 7, onboarded = true,
  free_pack_at = now() + interval '1 hours'
where id = '0000dead-0000-4000-a000-00000000000e';

-- ── Garages ────────────────────────────────────────────────────────────────────────────────────

insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000001', 'alfa-romeo-33-stradale', 1, 4, now() - interval '172 days', true);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000001', 'ford-gt40-mk1', 2, 3, now() - interval '98 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000001', 'porsche-959', 3, 3, now() - interval '325 days', true);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000001', 'audi-rs2-avant', 4, 4, now() - interval '199 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000001', 'aston-martin-db5', 5, 3, now() - interval '341 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000001', 'bmw-m1', 6, 2, now() - interval '155 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000001', 'mercedes-c111', 7, 0, now() - interval '79 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000001', 'porsche-356-speedster', 8, 0, now() - interval '79 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000001', 'nissan-300zx-z32', 9, 5, now() - interval '131 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000001', 'toyota-celica-st205', 10, 1, now() - interval '113 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000001', 'fiat-uno-turbo', 11, 2, now() - interval '155 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000001', 'opel-kadett-gsi', 12, 5, now() - interval '330 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000002', 'ferrari-250-gto', 1, 3, now() - interval '342 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000002', 'bmw-m3-e46-csl', 2, 2, now() - interval '291 days', true);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000002', 'ferrari-365-daytona', 3, 2, now() - interval '309 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000002', 'honda-nsx-r-na1', 4, 4, now() - interval '151 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000002', 'saab-900-turbo', 5, 0, now() - interval '251 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000002', 'lancia-stratos-zero', 6, 3, now() - interval '149 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000002', 'porsche-944-turbo', 7, 3, now() - interval '324 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000002', 'fiat-uno-turbo', 8, 1, now() - interval '222 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000002', 'vw-golf-gti-mk2', 9, 4, now() - interval '172 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000003', 'alfa-romeo-33-stradale', 1, 2, now() - interval '303 days', true);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000003', 'mercedes-slr-mclaren', 2, 5, now() - interval '1 days', true);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000003', 'koenigsegg-ccx', 3, 5, now() - interval '113 days', true);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000003', 'toyota-supra-a80', 4, 0, now() - interval '307 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000003', 'bmw-m3-e46-csl', 5, 4, now() - interval '329 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000003', 'honda-nsx-na1', 6, 4, now() - interval '12 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000003', 'mclaren-mp4-12c', 7, 0, now() - interval '41 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000003', 'vw-golf-r32', 8, 3, now() - interval '287 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000003', 'toyota-gt86', 9, 1, now() - interval '64 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000003', 'ford-sierra-cosworth', 10, 5, now() - interval '259 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000003', 'daihatsu-charade-gtti', 11, 5, now() - interval '120 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000003', 'austin-healey-sprite', 12, 4, now() - interval '6 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000004', 'bmw-507', 1, 1, now() - interval '288 days', true);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000004', 'mitsubishi-evo-vi', 2, 3, now() - interval '262 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000004', 'subaru-impreza-sti-gdb', 3, 2, now() - interval '319 days', true);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000004', 'porsche-993-turbo', 4, 1, now() - interval '234 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000004', 'honda-integra-dc2', 5, 4, now() - interval '301 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000004', 'lancia-stratos-zero', 6, 1, now() - interval '85 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000004', 'ford-capri-28i', 7, 3, now() - interval '23 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000004', 'autozam-az1', 8, 2, now() - interval '322 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000004', 'vw-golf-gti-mk1', 9, 2, now() - interval '305 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000005', 'maserati-mc12', 1, 1, now() - interval '141 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000005', 'honda-nsx-r-na1', 2, 1, now() - interval '75 days', true);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000005', 'audi-sport-quattro', 3, 0, now() - interval '50 days', true);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000005', 'ford-mustang-boss-302', 4, 2, now() - interval '328 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000005', 'austin-healey-3000', 5, 0, now() - interval '257 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000005', 'mazda-rx7-fd', 6, 3, now() - interval '254 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000005', 'porsche-914-6', 7, 0, now() - interval '109 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000005', 'peugeot-205-gti', 8, 1, now() - interval '208 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000005', 'honda-n360', 9, 4, now() - interval '24 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000006', 'ford-gt40-mk1', 1, 2, now() - interval '90 days', true);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000006', 'mercedes-300sl', 2, 4, now() - interval '203 days', true);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000006', 'ferrari-250-california', 3, 5, now() - interval '194 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000006', 'mclaren-mp4-12c', 4, 1, now() - interval '297 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000006', 'bmw-m1', 5, 2, now() - interval '217 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000006', 'detomaso-pantera', 6, 4, now() - interval '212 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000006', 'ford-mustang-boss-302', 7, 4, now() - interval '40 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000006', 'ford-escort-cosworth', 8, 3, now() - interval '304 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000006', 'saab-900-turbo', 9, 1, now() - interval '192 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000006', 'toyota-gt86', 10, 4, now() - interval '104 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000006', 'mg-midget', 11, 1, now() - interval '323 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000006', 'vw-polo-g40', 12, 2, now() - interval '18 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000007', 'audi-quattro', 1, 1, now() - interval '133 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000007', 'vw-golf-r32', 2, 1, now() - interval '155 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000007', 'saab-900-turbo', 3, 1, now() - interval '278 days', true);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000007', 'bmw-m3-e36', 4, 2, now() - interval '291 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000007', 'lada-niva', 5, 2, now() - interval '243 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000007', 'subaru-360', 6, 0, now() - interval '19 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000007', 'austin-healey-sprite', 7, 3, now() - interval '171 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000008', 'audi-r8-v8', 1, 2, now() - interval '95 days', true);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000008', 'jaguar-xk120', 2, 0, now() - interval '4 days', true);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000008', 'lancia-beta-montecarlo', 3, 0, now() - interval '123 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000008', 'vw-golf-r32', 4, 0, now() - interval '304 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000008', 'suzuki-cappuccino', 5, 3, now() - interval '149 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000008', 'triumph-spitfire', 6, 0, now() - interval '315 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000008', 'nissan-figaro', 7, 3, now() - interval '53 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000009', 'audi-quattro', 1, 1, now() - interval '154 days', true);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000009', 'toyota-celica-st205', 2, 3, now() - interval '210 days', true);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000009', 'mitsubishi-3000gt-vr4', 3, 1, now() - interval '5 days', true);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000009', 'subaru-impreza-wrx-gc8', 4, 3, now() - interval '175 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000009', 'peugeot-106-rallye', 5, 0, now() - interval '139 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000009', 'renault-clio-16s', 6, 0, now() - interval '93 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-000000000009', 'vw-polo-g40', 7, 0, now() - interval '250 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-00000000000a', 'nissan-300zx-z32', 1, 0, now() - interval '70 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-00000000000a', 'peugeot-205-rallye', 2, 0, now() - interval '55 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-00000000000a', 'mini-cooper-s', 3, 1, now() - interval '287 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-00000000000b', 'alfa-giulia-gta', 1, 1, now() - interval '263 days', true);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-00000000000b', 'opel-gt', 2, 1, now() - interval '141 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-00000000000b', 'saab-96', 3, 0, now() - interval '74 days', true);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-00000000000c', 'pagani-zonda-c12', 1, 2, now() - interval '115 days', true);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-00000000000c', 'ferrari-testarossa', 2, 3, now() - interval '64 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-00000000000c', 'nissan-skyline-r32', 3, 4, now() - interval '336 days', true);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-00000000000c', 'porsche-996-gt3', 4, 1, now() - interval '331 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-00000000000c', 'jaguar-xk120', 5, 3, now() - interval '268 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-00000000000c', 'lancia-fulvia-hf', 6, 0, now() - interval '64 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-00000000000c', 'volvo-850-t5r', 7, 1, now() - interval '93 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-00000000000c', 'honda-crx-si', 8, 0, now() - interval '48 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-00000000000c', 'ford-puma-17', 9, 1, now() - interval '148 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-00000000000d', 'mclaren-f1', 1, 5, now() - interval '232 days', true);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-00000000000d', 'ford-gt-2005', 2, 1, now() - interval '106 days', true);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-00000000000d', 'maserati-mc12', 3, 0, now() - interval '170 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-00000000000d', 'audi-r8-v8', 4, 1, now() - interval '120 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-00000000000d', 'mercedes-sls-amg', 5, 4, now() - interval '156 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-00000000000d', 'aston-martin-v8-vantage', 6, 4, now() - interval '148 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-00000000000d', 'porsche-996-gt3', 7, 2, now() - interval '217 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-00000000000d', 'mazda-rx7-fd', 8, 3, now() - interval '301 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-00000000000d', 'porsche-914-6', 9, 2, now() - interval '333 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-00000000000d', 'mitsubishi-3000gt-vr4', 10, 4, now() - interval '252 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-00000000000d', 'opel-gt', 11, 3, now() - interval '61 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-00000000000d', 'citroen-saxo-vts', 12, 5, now() - interval '278 days', false);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-00000000000e', 'renault-clio-172', 1, 0, now() - interval '113 days', true);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-00000000000e', 'vw-polo-g40', 2, 1, now() - interval '323 days', true);
insert into public.owned_cars (user_id, car_id, serial, level, acquired_at, showcase) values ('0000dead-0000-4000-a000-00000000000e', 'opel-manta-gte', 3, 0, now() - interval '230 days', true);

-- ── Activity feeds ────────────────────────────────────────────────────────────────────────────

insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000001', now() - interval '31 days 17 hours', 'Won', 'a highway run at Autobahn A9, closed section in the DB5');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000001', now() - interval '9 days 0 hours', 'Pulled', 'Audi RS2 Avant from a Street pack');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000001', now() - interval '27 days 12 hours', 'Pulled', 'Porsche 959 from a Street pack');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000001', now() - interval '9 days 1 hours', 'Pulled', 'BMW M1 E26 from a Apex pack');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000001', now() - interval '29 days 19 hours', 'Pulled', 'Nissan 300ZX Twin Turbo Z32 from a Heritage pack');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000001', now() - interval '26 days 16 hours', 'Upgraded', 'Alfa Romeo 33 Stradale to Lv 1');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000001', now() - interval '40 days 3 hours', 'Upgraded', 'Alfa Romeo 33 Stradale to Lv 5');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000001', now() - interval '43 days 13 hours', 'Upgraded', 'Fiat Uno Turbo i.e. to Lv 2');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000002', now() - interval '36 days 18 hours', 'Upgraded', 'BMW M3 CSL E46 to Lv 1');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000002', now() - interval '13 days 17 hours', 'Pulled', 'BMW M3 CSL E46 from a Street pack');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000002', now() - interval '13 days 3 hours', 'Pulled', 'Lancia Stratos HF Zero from a Street pack');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000002', now() - interval '35 days 6 hours', 'Pulled', 'Ferrari 250 GTO from a Street pack');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000002', now() - interval '14 days 8 hours', 'Pulled', 'Volkswagen Golf GTI 16V Mk2 from a Apex pack');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000002', now() - interval '38 days 0 hours', 'Won', 'a highway run at Autobahn A9, closed section in the 944 Turbo');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000003', now() - interval '13 days 9 hours', 'Pulled', 'Austin-Healey Sprite Mk1 from a Heritage pack');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000003', now() - interval '14 days 16 hours', 'Pulled', 'McLaren MP4-12C from a Heritage pack');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000003', now() - interval '41 days 23 hours', 'Proposed', 'a swap of the CCX to touge.mina');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000003', now() - interval '35 days 0 hours', 'Reached', 'level 22');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000003', now() - interval '21 days 5 hours', 'Sold', 'Ford Sierra RS Cosworth for 42,975 CR');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000003', now() - interval '45 days 14 hours', 'Proposed', 'a swap of the Charade GTti to autobahn.lena');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000003', now() - interval '19 days 1 hours', 'Reached', 'level 20');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000003', now() - interval '31 days 8 hours', 'Upgraded', 'Koenigsegg CCX to Lv 2');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000004', now() - interval '12 days 17 hours', 'Upgraded', 'Volkswagen Golf GTI Mk1 to Lv 1');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000004', now() - interval '19 days 3 hours', 'Pulled', 'BMW 507 from a Apex pack');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000004', now() - interval '9 days 17 hours', 'Pulled', 'Mitsubishi Lancer Evolution VI TME from a Apex pack');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000004', now() - interval '27 days 5 hours', 'Finished P4', 'in a drag at Quarter mile, Santa Pod');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000004', now() - interval '25 days 5 hours', 'Upgraded', 'Volkswagen Golf GTI Mk1 to Lv 4');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000004', now() - interval '17 days 1 hours', 'Pulled', 'Mitsubishi Lancer Evolution VI TME from a Street pack');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000005', now() - interval '16 days 23 hours', 'Pulled', 'Peugeot 205 GTI 1.9 from a Heritage pack');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000005', now() - interval '35 days 0 hours', 'Proposed', 'a swap of the MC12 to grid.oliver');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000005', now() - interval '14 days 19 hours', 'Pulled', 'Honda NSX-R NA1 from a Heritage pack');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000005', now() - interval '20 days 9 hours', 'Pulled', 'Honda N360 from a Heritage pack');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000005', now() - interval '29 days 13 hours', 'Proposed', 'a swap of the Mustang Boss 302 to touge.mina');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000005', now() - interval '48 days 23 hours', 'Reached', 'level 10');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000006', now() - interval '20 days 4 hours', 'Sold', 'Ford Escort RS Cosworth Mk5 for 38,529 CR');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000006', now() - interval '31 days 22 hours', 'Won', 'a sprint at Suzuka East straight in the Escort RS Cosworth Mk5');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000006', now() - interval '42 days 6 hours', 'Reached', 'level 15');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000006', now() - interval '42 days 11 hours', 'Upgraded', 'Ford Mustang Boss 302 to Lv 4');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000006', now() - interval '45 days 5 hours', 'Won', 'a drag at Quarter mile, Santa Pod in the 300 SL Gullwing W198');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000006', now() - interval '38 days 18 hours', 'Upgraded', 'Ferrari 250 GT California Spyder to Lv 4');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000006', now() - interval '45 days 23 hours', 'Pulled', 'Volkswagen Polo G40 Mk2 from a Street pack');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000006', now() - interval '54 days 10 hours', 'Pulled', 'Volkswagen Polo G40 Mk2 from a Apex pack');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000007', now() - interval '33 days 1 hours', 'Finished P3', 'in a drag at Quarter mile, Santa Pod');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000007', now() - interval '33 days 19 hours', 'Finished P3', 'in a sprint at Suzuka East straight');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000007', now() - interval '15 days 22 hours', 'Pulled', 'Austin-Healey Sprite Mk1 from a Street pack');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000007', now() - interval '19 days 3 hours', 'Proposed', 'a swap of the M3 E36 to curb.ines');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000008', now() - interval '6 days 8 hours', 'Sold', 'Jaguar XK120 for 93,253 CR');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000008', now() - interval '35 days 12 hours', 'Pulled', 'Nissan Figaro from a Heritage pack');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000008', now() - interval '34 days 8 hours', 'Upgraded', 'Audi R8 Type 42 to Lv 2');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000008', now() - interval '13 days 18 hours', 'Pulled', 'Suzuki Cappuccino from a Apex pack');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000009', now() - interval '13 days 2 hours', 'Pulled', 'Renault Clio 16S from a Heritage pack');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000009', now() - interval '2 days 1 hours', 'Reached', 'level 4');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000009', now() - interval '43 days 6 hours', 'Won', 'a drag at Quarter mile, Santa Pod in the Polo G40 Mk2');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-000000000009', now() - interval '7 days 22 hours', 'Reached', 'level 3');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-00000000000a', now() - interval '35 days 16 hours', 'Upgraded', 'Peugeot 205 Rallye to Lv 1');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-00000000000a', now() - interval '19 days 1 hours', 'Sold', 'Nissan 300ZX Twin Turbo Z32 for 36,346 CR');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-00000000000a', now() - interval '28 days 6 hours', 'Pulled', 'Nissan 300ZX Twin Turbo Z32 from a Street pack');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-00000000000b', now() - interval '35 days 22 hours', 'Pulled', 'Alfa Romeo Giulia Sprint GTA Tipo 105 from a Apex pack');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-00000000000b', now() - interval '37 days 2 hours', 'Finished P3', 'in a highway run at Autobahn A9, closed section');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-00000000000b', now() - interval '6 days 15 hours', 'Won', 'a sprint at Suzuka East straight in the 96');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-00000000000c', now() - interval '0 days 22 hours', 'Pulled', 'Lancia Fulvia Coupé HF 1.6 from a Street pack');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-00000000000c', now() - interval '18 days 7 hours', 'Reached', 'level 8');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-00000000000c', now() - interval '27 days 2 hours', 'Pulled', 'Nissan Skyline GT-R R32 from a Street pack');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-00000000000c', now() - interval '43 days 7 hours', 'Pulled', 'Lancia Fulvia Coupé HF 1.6 from a Heritage pack');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-00000000000c', now() - interval '42 days 12 hours', 'Pulled', 'Pagani Zonda C12 from a Street pack');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-00000000000c', now() - interval '25 days 14 hours', 'Pulled', 'Ford Puma 1.7 from a Street pack');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-00000000000d', now() - interval '39 days 3 hours', 'Sold', 'Mercedes-Benz SLS AMG for 169,467 CR');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-00000000000d', now() - interval '25 days 3 hours', 'Upgraded', 'Aston Martin V8 Vantage to Lv 3');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-00000000000d', now() - interval '30 days 16 hours', 'Pulled', 'Citroën Saxo VTS from a Apex pack');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-00000000000d', now() - interval '18 days 3 hours', 'Pulled', 'Maserati MC12 from a Street pack');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-00000000000d', now() - interval '19 days 9 hours', 'Upgraded', 'Mercedes-Benz SLS AMG to Lv 2');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-00000000000d', now() - interval '17 days 18 hours', 'Upgraded', 'Opel GT to Lv 5');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-00000000000d', now() - interval '15 days 22 hours', 'Proposed', 'a swap of the SLS AMG to apex.julien');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-00000000000d', now() - interval '35 days 14 hours', 'Proposed', 'a swap of the 3000GT VR-4 to boxe.hugo');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-00000000000e', now() - interval '11 days 17 hours', 'Upgraded', 'Volkswagen Polo G40 Mk2 to Lv 1');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-00000000000e', now() - interval '8 days 15 hours', 'Pulled', 'Renault Clio Sport 172 from a Heritage pack');
insert into public.activity (user_id, at, verb, what) values ('0000dead-0000-4000-a000-00000000000e', now() - interval '22 days 15 hours', 'Pulled', 'Renault Clio Sport 172 from a Street pack');

-- ── Market listings ───────────────────────────────────────────────────────────────────────────

insert into public.listings (seller_id, seller_name, car_id, level, serial, price, ends_at, status) values ('0000dead-0000-4000-a000-000000000006', 'autobahn.lena', 'porsche-carrera-gt', 0, 694, 647167, now() + interval '2 days 5 hours', 'active');
insert into public.listings (seller_id, seller_name, car_id, level, serial, price, ends_at, status) values ('0000dead-0000-4000-a000-000000000003', 'drift.sato', 'bugatti-veyron', 1, 602, 1478988, now() + interval '3 days 10 hours', 'active');
insert into public.listings (seller_id, seller_name, car_id, level, serial, price, ends_at, status) values ('0000dead-0000-4000-a000-000000000008', 'paddock.yanis', 'fiat-x19', 1, 282, 8234, now() + interval '3 days 12 hours', 'active');
insert into public.listings (seller_id, seller_name, car_id, level, serial, price, ends_at, status) values ('0000dead-0000-4000-a000-00000000000c', 'grid.oliver', 'fiat-dino-coupe', 1, 787, 66405, now() + interval '3 days 14 hours', 'active');
insert into public.listings (seller_id, seller_name, car_id, level, serial, price, ends_at, status) values ('0000dead-0000-4000-a000-00000000000b', 'freshstart.lea', 'honda-n360', 0, 285, 6506, now() + interval '3 days 21 hours', 'active');
insert into public.listings (seller_id, seller_name, car_id, level, serial, price, ends_at, status) values ('0000dead-0000-4000-a000-00000000000a', 'boxe.hugo', 'ford-escort-cosworth', 0, 511, 51266, now() + interval '1 days 18 hours', 'active');
insert into public.listings (seller_id, seller_name, car_id, level, serial, price, ends_at, status) values ('0000dead-0000-4000-a000-000000000007', 'cityhatch.noa', 'bmw-m1', 2, 874, 196261, now() + interval '1 days 4 hours', 'active');

-- ── Friendships ───────────────────────────────────────────────────────────────────────────────

insert into public.friends (user_id, friend_id, accepted) values ('0000dead-0000-4000-a000-000000000009', '0000dead-0000-4000-a000-000000000001', true), ('0000dead-0000-4000-a000-000000000001', '0000dead-0000-4000-a000-000000000009', true);
insert into public.friends (user_id, friend_id, accepted) values ('0000dead-0000-4000-a000-00000000000d', '0000dead-0000-4000-a000-000000000006', true), ('0000dead-0000-4000-a000-000000000006', '0000dead-0000-4000-a000-00000000000d', true);
insert into public.friends (user_id, friend_id, accepted) values ('0000dead-0000-4000-a000-000000000008', '0000dead-0000-4000-a000-000000000005', true), ('0000dead-0000-4000-a000-000000000005', '0000dead-0000-4000-a000-000000000008', true);
insert into public.friends (user_id, friend_id, accepted) values ('0000dead-0000-4000-a000-000000000004', '0000dead-0000-4000-a000-00000000000b', true), ('0000dead-0000-4000-a000-00000000000b', '0000dead-0000-4000-a000-000000000004', true);
insert into public.friends (user_id, friend_id, accepted) values ('0000dead-0000-4000-a000-00000000000e', '0000dead-0000-4000-a000-000000000007', true), ('0000dead-0000-4000-a000-000000000007', '0000dead-0000-4000-a000-00000000000e', true);

-- ── Swap offers ───────────────────────────────────────────────────────────────────────────────

insert into public.swap_offers (proposer_id, recipient_id, recipient_name, proposer_car, recipient_car, credits, expires_at, status) values ('0000dead-0000-4000-a000-000000000009', '0000dead-0000-4000-a000-00000000000b', 'freshstart.lea', 'vw-polo-g40', 'saab-96', 1987, now() + interval '22 hours', 'open');
insert into public.swap_offers (proposer_id, recipient_id, recipient_name, proposer_car, recipient_car, credits, expires_at, status) values ('0000dead-0000-4000-a000-000000000008', '0000dead-0000-4000-a000-000000000001', 'apex.julien', 'vw-golf-r32', 'porsche-356-speedster', 0, now() + interval '16 hours', 'open');

-- ── Sales history (feeds the market's "avg" price) ───────────────────────────────────────────

insert into public.sales (car_id, price, sold_at) values ('ferrari-f40', 455449, now() - interval '2 days 17 hours');
insert into public.sales (car_id, price, sold_at) values ('lancia-beta-montecarlo', 28172, now() - interval '2 days 19 hours');
insert into public.sales (car_id, price, sold_at) values ('saab-900-turbo', 17238, now() - interval '9 days 9 hours');
insert into public.sales (car_id, price, sold_at) values ('vw-corrado-vr6', 20813, now() - interval '10 days 7 hours');
insert into public.sales (car_id, price, sold_at) values ('alpine-a110-1600s', 79137, now() - interval '13 days 7 hours');
insert into public.sales (car_id, price, sold_at) values ('mclaren-f1', 787881, now() - interval '21 days 20 hours');
insert into public.sales (car_id, price, sold_at) values ('nissan-skyline-r32', 115627, now() - interval '2 days 14 hours');
insert into public.sales (car_id, price, sold_at) values ('alpine-a310-v6', 36124, now() - interval '0 days 13 hours');
insert into public.sales (car_id, price, sold_at) values ('porsche-356-speedster', 75044, now() - interval '10 days 10 hours');
insert into public.sales (car_id, price, sold_at) values ('peugeot-205-rallye', 11618, now() - interval '19 days 16 hours');
insert into public.sales (car_id, price, sold_at) values ('porsche-914-6', 59730, now() - interval '21 days 17 hours');
insert into public.sales (car_id, price, sold_at) values ('triumph-spitfire', 6680, now() - interval '24 days 3 hours');
insert into public.sales (car_id, price, sold_at) values ('ford-escort-xr3i', 9171, now() - interval '4 days 3 hours');
insert into public.sales (car_id, price, sold_at) values ('citroen-ax-gt', 6086, now() - interval '15 days 1 hours');
insert into public.sales (car_id, price, sold_at) values ('nissan-skyline-r34', 121183, now() - interval '23 days 20 hours');
insert into public.sales (car_id, price, sold_at) values ('austin-healey-sprite', 9618, now() - interval '2 days 12 hours');
insert into public.sales (car_id, price, sold_at) values ('alfa-romeo-spider-duetto', 45513, now() - interval '1 days 1 hours');
insert into public.sales (car_id, price, sold_at) values ('honda-civic-type-r-ep3', 26648, now() - interval '23 days 15 hours');

-- ── Optional: a season + a few upcoming calendar events, for a livelier Extras screen ─────────

insert into public.seasons (id, ends_at) values (1, now() + interval '12 days') on conflict (id) do nothing;
insert into public.calendar_events (starts_at, name, rule, prize, event_id, fee, featured) values
  (now() + interval '2 days', 'Suzuka Night Sprint', 'Street tier only', '+1,200 CR, +80 pts', 'sprint', 500, true),
  (now() + interval '4 days', 'Santa Pod Drag Night', 'No restrictions', '+900 CR, +60 pts', 'drag', 300, false),
  (now() + interval '7 days', 'Autobahn Endurance Run', 'Apex tier only', '+3,500 CR, +180 pts', 'run', 1000, true);
