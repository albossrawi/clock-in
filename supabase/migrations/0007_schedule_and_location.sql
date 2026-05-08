-- Per-employee schedule + GPS location capture + early/late warning settings.

-- ---------------------------------------------------------------
-- profiles: scheduled work window
-- ---------------------------------------------------------------
alter table public.profiles
  add column if not exists scheduled_start time,                                  -- e.g. 09:00
  add column if not exists scheduled_end   time,                                  -- e.g. 17:00
  add column if not exists scheduled_days  int[]                                   -- ISO 1=Mon..7=Sun
    default '{1,2,3,4,5}';

-- ---------------------------------------------------------------
-- companies: warn-on-early / warn-on-late toggles + thresholds
-- ---------------------------------------------------------------
alter table public.companies
  add column if not exists warn_early_clock_in    boolean not null default true,
  add column if not exists warn_late_clock_in     boolean not null default true,
  add column if not exists early_threshold_minutes int     not null default 5,
  add column if not exists late_threshold_minutes  int     not null default 5;

alter table public.companies drop constraint if exists companies_thresholds_check;
alter table public.companies add constraint companies_thresholds_check
  check (early_threshold_minutes between 0 and 240
     and late_threshold_minutes  between 0 and 240);

-- ---------------------------------------------------------------
-- time_entries: GPS location at clock-in and clock-out
-- ---------------------------------------------------------------
alter table public.time_entries
  add column if not exists clock_in_lat        numeric(10,7),
  add column if not exists clock_in_lng        numeric(10,7),
  add column if not exists clock_in_accuracy_m int,
  add column if not exists clock_out_lat       numeric(10,7),
  add column if not exists clock_out_lng       numeric(10,7),
  add column if not exists clock_out_accuracy_m int;

create index if not exists time_entries_clock_in_loc_idx
  on public.time_entries(clock_in_lat, clock_in_lng)
  where clock_in_lat is not null;
