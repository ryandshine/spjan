-- Up Migration
alter table biaya add column if not exists pengeluaran_riil boolean not null default false;

-- Down Migration
alter table biaya drop column if exists pengeluaran_riil;
