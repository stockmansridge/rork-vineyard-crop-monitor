-- ============================================
-- VineWatch Supabase Schema
-- Run this SQL in your Supabase SQL Editor
-- ============================================

-- 1. Profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  display_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Vineyards table
create table if not exists public.vineyards (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references auth.users on delete cascade not null,
  name text not null,
  variety text not null,
  area numeric not null default 0,
  area_unit text not null default 'ha',
  latitude numeric,
  longitude numeric,
  polygon_coords jsonb,
  planting_date text,
  health_score integer default 75,
  last_scan timestamptz default now(),
  image_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.vineyards enable row level security;

-- Owner can do everything
create policy "Owners can manage their vineyards"
  on public.vineyards for all
  using (auth.uid() = owner_id);

-- 3. Vineyard shares table (must be created BEFORE policies that reference it)
create table if not exists public.vineyard_shares (
  id uuid default gen_random_uuid() primary key,
  vineyard_id uuid references public.vineyards on delete cascade not null,
  owner_id uuid references auth.users on delete cascade not null,
  shared_with_email text not null,
  shared_with_id uuid references auth.users on delete cascade,
  permission text not null default 'view' check (permission in ('view', 'edit')),
  role text not null default 'worker' check (role in ('owner','manager','worker')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz default now()
);

alter table public.vineyard_shares enable row level security;

create policy "Owners can manage shares"
  on public.vineyard_shares for all
  using (auth.uid() = owner_id);

create policy "Shared users can view their shares"
  on public.vineyard_shares for select
  using (auth.uid() = shared_with_id or shared_with_email = (auth.jwt() ->> 'email'));

create policy "Shared users can update their share status"
  on public.vineyard_shares for update
  using (auth.uid() = shared_with_id or shared_with_email = (auth.jwt() ->> 'email'));

-- Now add the vineyards policy that references vineyard_shares
create policy "Shared users can view vineyards"
  on public.vineyards for select
  using (
    exists (
      select 1 from public.vineyard_shares
      where vineyard_shares.vineyard_id = vineyards.id
      and vineyard_shares.shared_with_id = auth.uid()
      and vineyard_shares.status = 'accepted'
    )
  );

-- 4. Soil probes table
create table if not exists public.soil_probes (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references auth.users on delete cascade not null,
  vineyard_id uuid references public.vineyards on delete cascade,
  name text not null,
  depth integer default 30,
  is_online boolean default false,
  battery_level integer default 100,
  last_reading timestamptz default now(),
  moisture numeric,
  temperature numeric,
  ph numeric,
  ec numeric,
  nitrogen numeric,
  phosphorus numeric,
  potassium numeric,
  -- thresholds (optional per probe)
  moisture_min numeric,
  moisture_max numeric,
  temp_min numeric,
  temp_max numeric,
  ph_min numeric,
  ph_max numeric,
  ec_min numeric,
  ec_max numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.soil_probes enable row level security;

create policy "Owners can manage their probes"
  on public.soil_probes for all
  using (auth.uid() = owner_id);

create policy "Shared vineyard users can view probes"
  on public.soil_probes for select
  using (
    exists (
      select 1 from public.vineyard_shares
      where vineyard_shares.vineyard_id = soil_probes.vineyard_id
      and vineyard_shares.shared_with_id = auth.uid()
      and vineyard_shares.status = 'accepted'
    )
  );

-- 5. Auto-link shares when user signs up
create or replace function public.link_pending_shares()
returns trigger as $$
begin
  update public.vineyard_shares
  set shared_with_id = new.id
  where shared_with_email = new.email
  and shared_with_id is null;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created_link_shares on auth.users;
create trigger on_auth_user_created_link_shares
  after insert on auth.users
  for each row execute function public.link_pending_shares();

-- 6. Updated_at triggers
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists vineyards_updated_at on public.vineyards;
create trigger vineyards_updated_at
  before update on public.vineyards
  for each row execute function public.update_updated_at();

drop trigger if exists soil_probes_updated_at on public.soil_probes;
create trigger soil_probes_updated_at
  before update on public.soil_probes
  for each row execute function public.update_updated_at();

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

-- 7. Vineyard index readings (NDVI/NDMI/NDRE/RECI time-series)
create table if not exists public.vineyard_index_readings (
  id uuid default gen_random_uuid() primary key,
  vineyard_id uuid references public.vineyards on delete cascade not null,
  owner_id uuid references auth.users on delete cascade not null,
  index_type text not null check (index_type in ('NDVI','NDMI','NDRE','RECI','MSAVI')),
  value numeric not null,
  source text,
  scene_id text,
  cloud_cover numeric,
  acquired_at timestamptz not null,
  created_at timestamptz default now()
);

create index if not exists idx_idx_readings_vy_type_date
  on public.vineyard_index_readings (vineyard_id, index_type, acquired_at desc);

alter table public.vineyard_index_readings enable row level security;

create policy "Owners can manage their index readings"
  on public.vineyard_index_readings for all
  using (auth.uid() = owner_id);

create policy "Shared users can view index readings"
  on public.vineyard_index_readings for select
  using (
    exists (
      select 1 from public.vineyard_shares
      where vineyard_shares.vineyard_id = vineyard_index_readings.vineyard_id
      and vineyard_shares.shared_with_id = auth.uid()
      and vineyard_shares.status = 'accepted'
    )
  );

-- 8. Probe readings history (time-series)
create table if not exists public.probe_readings (
  id uuid default gen_random_uuid() primary key,
  probe_id uuid references public.soil_probes on delete cascade not null,
  owner_id uuid references auth.users on delete cascade not null,
  recorded_at timestamptz not null default now(),
  moisture numeric,
  temperature numeric,
  ph numeric,
  ec numeric,
  nitrogen numeric,
  phosphorus numeric,
  potassium numeric,
  battery_level integer,
  created_at timestamptz default now()
);

create index if not exists idx_probe_readings_probe_date
  on public.probe_readings (probe_id, recorded_at desc);

alter table public.probe_readings enable row level security;

create policy "Owners can manage their probe readings"
  on public.probe_readings for all
  using (auth.uid() = owner_id);

create policy "Shared users can view probe readings"
  on public.probe_readings for select
  using (
    exists (
      select 1 from public.soil_probes p
      join public.vineyard_shares s on s.vineyard_id = p.vineyard_id
      where p.id = probe_readings.probe_id
      and s.shared_with_id = auth.uid()
      and s.status = 'accepted'
    )
  );

-- 9. Vineyard tasks & activities log
create table if not exists public.vineyard_tasks (
  id uuid default gen_random_uuid() primary key,
  vineyard_id uuid references public.vineyards on delete cascade not null,
  owner_id uuid references auth.users on delete cascade not null,
  task_type text not null check (task_type in ('pruning','spraying','harvesting','irrigation','fertilizing','canopy','scouting','other')),
  title text not null,
  notes text,
  status text not null default 'planned' check (status in ('planned','in_progress','completed','cancelled')),
  scheduled_for timestamptz,
  completed_at timestamptz,
  duration_hours numeric,
  labor_hours numeric,
  cost numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_tasks_vineyard_date
  on public.vineyard_tasks (vineyard_id, scheduled_for desc);

alter table public.vineyard_tasks enable row level security;

create policy "Owners can manage their tasks"
  on public.vineyard_tasks for all
  using (auth.uid() = owner_id);

create policy "Shared users can view tasks"
  on public.vineyard_tasks for select
  using (
    exists (
      select 1 from public.vineyard_shares
      where vineyard_shares.vineyard_id = vineyard_tasks.vineyard_id
      and vineyard_shares.shared_with_id = auth.uid()
      and vineyard_shares.status = 'accepted'
    )
  );

drop trigger if exists vineyard_tasks_updated_at on public.vineyard_tasks;
create trigger vineyard_tasks_updated_at
  before update on public.vineyard_tasks
  for each row execute function public.update_updated_at();

-- 10. Phenology events (budbreak, flowering, veraison, harvest stages)
create table if not exists public.phenology_events (
  id uuid default gen_random_uuid() primary key,
  vineyard_id uuid references public.vineyards on delete cascade not null,
  owner_id uuid references auth.users on delete cascade not null,
  stage text not null check (stage in ('dormant','budbreak','leaf_out','flowering','fruit_set','veraison','ripening','harvest','post_harvest','leaf_fall')),
  observed_on date not null,
  percent_complete integer check (percent_complete between 0 and 100),
  gdd_at_event numeric,
  notes text,
  photo_url text,
  created_at timestamptz default now()
);

create index if not exists idx_phenology_vineyard_date
  on public.phenology_events (vineyard_id, observed_on desc);

alter table public.phenology_events enable row level security;

create policy "Owners can manage their phenology"
  on public.phenology_events for all
  using (auth.uid() = owner_id);

create policy "Shared users can view phenology"
  on public.phenology_events for select
  using (
    exists (
      select 1 from public.vineyard_shares
      where vineyard_shares.vineyard_id = phenology_events.vineyard_id
      and vineyard_shares.shared_with_id = auth.uid()
      and vineyard_shares.status = 'accepted'
    )
  );

-- 11. Spray / treatment records
create table if not exists public.spray_records (
  id uuid default gen_random_uuid() primary key,
  vineyard_id uuid references public.vineyards on delete cascade not null,
  owner_id uuid references auth.users on delete cascade not null,
  applied_on timestamptz not null,
  product_name text not null,
  active_ingredient text,
  target text,
  rate numeric,
  rate_unit text,
  total_volume numeric,
  volume_unit text,
  water_volume numeric,
  phi_days integer,
  rei_hours integer,
  weather_conditions text,
  wind_speed numeric,
  temperature numeric,
  applicator text,
  equipment text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_spray_vineyard_date
  on public.spray_records (vineyard_id, applied_on desc);

alter table public.spray_records enable row level security;

create policy "Owners can manage their sprays"
  on public.spray_records for all
  using (auth.uid() = owner_id);

create policy "Shared users can view sprays"
  on public.spray_records for select
  using (
    exists (
      select 1 from public.vineyard_shares
      where vineyard_shares.vineyard_id = spray_records.vineyard_id
      and vineyard_shares.shared_with_id = auth.uid()
      and vineyard_shares.status = 'accepted'
    )
  );

drop trigger if exists spray_records_updated_at on public.spray_records;
create trigger spray_records_updated_at
  before update on public.spray_records
  for each row execute function public.update_updated_at();

-- 12. Harvest records
create table if not exists public.harvest_records (
  id uuid default gen_random_uuid() primary key,
  vineyard_id uuid references public.vineyards on delete cascade not null,
  owner_id uuid references auth.users on delete cascade not null,
  harvested_on date not null,
  yield_kg numeric,
  yield_tons numeric,
  yield_per_ha numeric,
  brix numeric,
  ph numeric,
  ta numeric,
  ya_n numeric,
  berry_weight_g numeric,
  cluster_count integer,
  destination text,
  picker_count integer,
  labor_hours numeric,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_harvest_vineyard_date
  on public.harvest_records (vineyard_id, harvested_on desc);

alter table public.harvest_records enable row level security;

create policy "Owners can manage their harvests"
  on public.harvest_records for all
  using (auth.uid() = owner_id);

create policy "Shared users can view harvests"
  on public.harvest_records for select
  using (
    exists (
      select 1 from public.vineyard_shares
      where vineyard_shares.vineyard_id = harvest_records.vineyard_id
      and vineyard_shares.shared_with_id = auth.uid()
      and vineyard_shares.status = 'accepted'
    )
  );

drop trigger if exists harvest_records_updated_at on public.harvest_records;
create trigger harvest_records_updated_at
  before update on public.harvest_records
  for each row execute function public.update_updated_at();

-- 13a. Block agronomy profile columns on vineyards
alter table public.vineyards
  add column if not exists clone text,
  add column if not exists rootstock text,
  add column if not exists row_spacing_m numeric,
  add column if not exists vine_spacing_m numeric,
  add column if not exists training_system text,
  add column if not exists pruning_type text,
  add column if not exists irrigation_type text,
  add column if not exists irrigation_zone text,
  add column if not exists emitter_spacing_m numeric,
  add column if not exists emitter_flow_lph numeric,
  add column if not exists soil_type text,
  add column if not exists subsoil_notes text,
  add column if not exists drainage_notes text,
  add column if not exists slope_pct numeric,
  add column if not exists aspect text,
  add column if not exists elevation_m numeric,
  add column if not exists frost_risk boolean default false,
  add column if not exists heat_exposure boolean default false,
  add column if not exists disease_prone boolean default false,
  add column if not exists low_vigor_history boolean default false,
  add column if not exists waterlogging_risk boolean default false,
  add column if not exists target_yield_t_per_ha numeric,
  add column if not exists normal_harvest_start text,
  add column if not exists normal_harvest_end text,
  add column if not exists block_notes text;

-- 13b. Per-season phenology + target dates per block
create table if not exists public.block_seasons (
  id uuid default gen_random_uuid() primary key,
  vineyard_id uuid references public.vineyards on delete cascade not null,
  owner_id uuid references auth.users on delete cascade not null,
  season integer not null,
  budburst_date date,
  flowering_date date,
  fruit_set_date date,
  veraison_date date,
  harvest_date date,
  target_yield_t_per_ha numeric,
  actual_yield_t_per_ha numeric,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (vineyard_id, season)
);

create index if not exists idx_block_seasons_vineyard
  on public.block_seasons (vineyard_id, season desc);

alter table public.block_seasons enable row level security;

create policy "Owners can manage their block seasons"
  on public.block_seasons for all
  using (auth.uid() = owner_id);

create policy "Shared users can view block seasons"
  on public.block_seasons for select
  using (
    exists (
      select 1 from public.vineyard_shares
      where vineyard_shares.vineyard_id = block_seasons.vineyard_id
      and vineyard_shares.shared_with_id = auth.uid()
      and vineyard_shares.status = 'accepted'
    )
  );

drop trigger if exists block_seasons_updated_at on public.block_seasons;
create trigger block_seasons_updated_at
  before update on public.block_seasons
  for each row execute function public.update_updated_at();

-- 13c. Block management zones (future-ready)
create table if not exists public.block_zones (
  id uuid default gen_random_uuid() primary key,
  vineyard_id uuid references public.vineyards on delete cascade not null,
  owner_id uuid references auth.users on delete cascade not null,
  name text not null,
  kind text not null default 'generic' check (kind in ('generic','probe_linked','high_vigor','low_vigor','issue_area')),
  description text,
  polygon_coords jsonb,
  probe_id uuid references public.soil_probes on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_block_zones_vineyard
  on public.block_zones (vineyard_id);

alter table public.block_zones enable row level security;

create policy "Owners can manage their block zones"
  on public.block_zones for all
  using (auth.uid() = owner_id);

create policy "Shared users can view block zones"
  on public.block_zones for select
  using (
    exists (
      select 1 from public.vineyard_shares
      where vineyard_shares.vineyard_id = block_zones.vineyard_id
      and vineyard_shares.shared_with_id = auth.uid()
      and vineyard_shares.status = 'accepted'
    )
  );

drop trigger if exists block_zones_updated_at on public.block_zones;
create trigger block_zones_updated_at
  before update on public.block_zones
  for each row execute function public.update_updated_at();

-- 14. Migration: add role column to existing vineyard_shares tables
alter table public.vineyard_shares
  add column if not exists role text not null default 'worker';

do $
begin
  if not exists (
    select 1 from pg_constraint where conname = 'vineyard_shares_role_check'
  ) then
    alter table public.vineyard_shares
      add constraint vineyard_shares_role_check
      check (role in ('owner','manager','worker'));
  end if;
end $;
