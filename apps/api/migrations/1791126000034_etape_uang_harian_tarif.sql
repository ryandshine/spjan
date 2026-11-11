-- Up Migration
-- Tarif uang harian per hari yang diisi manual; null = tarif SBM.
alter table etape add column if not exists uang_harian_tarif bigint;

-- Down Migration
alter table etape drop column if exists uang_harian_tarif;
