-- Up Migration
alter table etape add column if not exists hotel_30_persen boolean not null default false;

-- Down Migration
alter table etape drop column if exists hotel_30_persen;
