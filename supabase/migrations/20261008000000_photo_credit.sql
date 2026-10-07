-- Photo attribution for catalog images (Wikimedia Commons licenses require crediting the author).
alter table public.cars add column if not exists photo_credit text;
