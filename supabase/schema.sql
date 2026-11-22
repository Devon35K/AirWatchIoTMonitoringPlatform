create table public.airwatch_readings (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  device_id text not null,
  observed_at timestamptz not null default now(),
  valid boolean not null default true,
  co2 integer not null check (co2 >= 0),
  temperature real not null,
  humidity real not null check (humidity between 0 and 100),
  quality text not null,
  display_theme text not null check (display_theme in ('light', 'dark')),
  fan_on boolean not null,
  fan_mode text not null check (fan_mode in ('auto', 'on', 'off')),
  muted boolean not null,
  alarm_active boolean not null,
  system_on boolean not null,
  uptime_seconds bigint not null check (uptime_seconds >= 0),
  last_reading_uptime bigint not null check (last_reading_uptime >= 0),
  last_reading_epoch bigint not null default 0 check (last_reading_epoch >= 0)
);

create index airwatch_readings_owner_time_idx
  on public.airwatch_readings (user_id, observed_at desc);

alter table public.airwatch_readings enable row level security;

grant select, insert on public.airwatch_readings to authenticated;
grant usage, select on sequence public.airwatch_readings_id_seq to authenticated;

create policy "Users read their own AirWatch readings"
  on public.airwatch_readings
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users insert their own AirWatch readings"
  on public.airwatch_readings
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);
