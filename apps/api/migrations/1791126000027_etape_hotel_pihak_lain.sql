alter table etape
  add column if not exists hotel_pihak_lain_dates text[] not null default '{}';
