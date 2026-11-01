alter table etape
  add column if not exists hotel_per_kartu boolean not null default false;
