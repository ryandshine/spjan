-- Up Migration
alter table etape add column if not exists dalam_kota_8_jam boolean not null default false;

-- Down Migration
alter table etape drop column if exists dalam_kota_8_jam;
