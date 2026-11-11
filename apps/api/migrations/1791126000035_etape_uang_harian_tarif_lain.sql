-- Up Migration
-- Tarif uang harian lain untuk tanggal tertentu: [{ tarif, tanggal: [YYYY-MM-DD] }].
alter table etape add column if not exists uang_harian_tarif_lain jsonb not null default '[]'::jsonb;

-- Down Migration
alter table etape drop column if exists uang_harian_tarif_lain;
