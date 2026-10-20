alter table public.planint_activities
  add column if not exists phase text not null default '',
  add column if not exists category text not null default '',
  add column if not exists dependency text not null default '';
