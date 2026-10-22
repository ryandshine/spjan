alter table etape
  add column if not exists hotel_30_dates text[] not null default '{}';
