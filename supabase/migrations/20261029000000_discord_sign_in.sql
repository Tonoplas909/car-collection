-- Sign-in with Discord: accounts created through OAuth have no 'username' in their metadata and
-- may have no email, so the profile name falls back to the provider's name.

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  explicit text := nullif(trim(meta ->> 'username'), '');
  fallback text := coalesce(
    nullif(trim(meta ->> 'full_name'), ''),
    nullif(trim(meta ->> 'user_name'), ''),
    nullif(trim(meta ->> 'preferred_username'), ''),
    nullif(trim(meta #>> '{custom_claims,global_name}'), ''),
    nullif(trim(meta ->> 'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'player'
  );
  -- The name typed on the sign-up form is kept as is; provider names can hold spaces, emoji and #0000.
  wanted text := coalesce(explicit, regexp_replace(fallback, '[^A-Za-z0-9._-]+', '', 'g'));
  name text := left(wanted, 24);
begin
  if char_length(name) < 3 then name := name || '_' || substr(md5(random()::text), 1, 4); end if;
  if exists (select 1 from public.profiles where username = name) then
    name := left(wanted, 19) || '_' || substr(md5(random()::text), 1, 4);
  end if;
  insert into public.profiles (id, username) values (new.id, name);
  return new;
end $$;
