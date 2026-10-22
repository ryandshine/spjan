alter table etape
  add column if not exists uang_harian_60_dates text[] not null default '{}';
