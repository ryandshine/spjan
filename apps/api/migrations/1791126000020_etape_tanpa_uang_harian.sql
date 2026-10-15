alter table etape
  add column if not exists tanpa_uang_harian_dates text[] not null default '{}';
