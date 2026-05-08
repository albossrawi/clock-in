-- Overtime settings per company.
-- Daily: hours over `daily_standard_minutes` (after `daily_break_minutes` of unpaid break) become overtime.
-- Weekly: hours over `weekly_standard_minutes` are weekly overtime, computed on top of the daily figures.
-- All paid at `overtime_multiplier` (e.g. 1.5x). Per-employee overrides remain on the profiles table.

alter table public.companies
  add column if not exists daily_standard_minutes  int     not null default 450,   -- 7.5h
  add column if not exists daily_break_minutes     int     not null default 30,
  add column if not exists weekly_standard_minutes int     not null default 2220,  -- 37h
  add column if not exists overtime_multiplier     numeric(5,2) not null default 1.50;

-- Optional sanity bounds.
alter table public.companies drop constraint if exists companies_daily_standard_check;
alter table public.companies add constraint companies_daily_standard_check
  check (daily_standard_minutes between 0 and 24*60);

alter table public.companies drop constraint if exists companies_weekly_standard_check;
alter table public.companies add constraint companies_weekly_standard_check
  check (weekly_standard_minutes between 0 and 7*24*60);
