-- =====================================================================
-- Gestion des plantes vertes — schéma Supabase
-- Toutes les tables sont préfixées "plantes_" pour cohabiter avec ton
-- projet existant. À coller dans Supabase > SQL Editor > Run.
-- Le script peut être relancé sans risque (idempotent).
-- =====================================================================

-- 1) Plantes -----------------------------------------------------------
create table if not exists plantes_plants (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  species       text,
  room          text,
  exposure      text,
  notes         text,
  purchase_date date,
  photo_path    text,
  archived      boolean not null default false,
  created_at    timestamptz not null default now()
);

-- 2) Soins programmés (un par plante et par type de soin) --------------
--    freq_summer : fréquence en jours (été / mi-saison)
--    freq_winter : fréquence en jours en hiver (nov. à mars)
--                  NULL = identique à l'été, 0 = soin en pause l'hiver
create table if not exists plantes_tasks (
  id          uuid primary key default gen_random_uuid(),
  plant_id    uuid not null references plantes_plants(id) on delete cascade,
  care_type   text not null,  -- arrosage | brumisation | nettoyage | engrais | rempotage | bilan
  freq_summer integer not null default 7 check (freq_summer >= 0),
  freq_winter integer check (freq_winter >= 0),
  last_done   date,
  active      boolean not null default true,
  unique (plant_id, care_type)
);

-- 3) Journal des soins -------------------------------------------------
--    health (bilan uniquement) : 1 = souci, 2 = moyen, 3 = au top
create table if not exists plantes_logs (
  id         uuid primary key default gen_random_uuid(),
  plant_id   uuid not null references plantes_plants(id) on delete cascade,
  care_type  text not null,
  done_on    date not null default current_date,
  health     smallint check (health between 1 and 3),
  note       text,
  created_at timestamptz not null default now()
);

create index if not exists plantes_tasks_plant_idx on plantes_tasks(plant_id);
create index if not exists plantes_logs_plant_idx  on plantes_logs(plant_id, done_on desc);
create index if not exists plantes_logs_date_idx   on plantes_logs(done_on desc);

-- 4) Sécurité (RLS) ----------------------------------------------------
--    Pas de login : l'appli utilise la clé "anon". Les politiques ci-dessous
--    autorisent donc anon + authenticated, uniquement sur les tables plantes_.
--    Ton URL Vercel fait office de "mot de passe" : ne la partage pas.
alter table plantes_plants enable row level security;
alter table plantes_tasks  enable row level security;
alter table plantes_logs   enable row level security;

drop policy if exists plantes_plants_all on plantes_plants;
create policy plantes_plants_all on plantes_plants
  for all to anon, authenticated using (true) with check (true);

drop policy if exists plantes_tasks_all on plantes_tasks;
create policy plantes_tasks_all on plantes_tasks
  for all to anon, authenticated using (true) with check (true);

drop policy if exists plantes_logs_all on plantes_logs;
create policy plantes_logs_all on plantes_logs
  for all to anon, authenticated using (true) with check (true);

-- 5) Photos (Supabase Storage) ----------------------------------------
insert into storage.buckets (id, name, public)
values ('plantes-photos', 'plantes-photos', true)
on conflict (id) do nothing;

drop policy if exists plantes_photos_select on storage.objects;
create policy plantes_photos_select on storage.objects
  for select to anon, authenticated using (bucket_id = 'plantes-photos');

drop policy if exists plantes_photos_insert on storage.objects;
create policy plantes_photos_insert on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'plantes-photos');

drop policy if exists plantes_photos_update on storage.objects;
create policy plantes_photos_update on storage.objects
  for update to anon, authenticated
  using (bucket_id = 'plantes-photos') with check (bucket_id = 'plantes-photos');

drop policy if exists plantes_photos_delete on storage.objects;
create policy plantes_photos_delete on storage.objects
  for delete to anon, authenticated using (bucket_id = 'plantes-photos');
