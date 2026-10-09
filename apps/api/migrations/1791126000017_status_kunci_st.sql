-- Up Migration
-- Surat tugas yang sudah final dikunci agar tidak berubah tanpa sengaja; buka kunci dicatat.
alter table surat_tugas
  add column status text not null default 'draft' check (status in ('draft', 'final')),
  add column dikunci_pada timestamptz,
  add column dibuka_pada timestamptz,
  add column jumlah_dibuka integer not null default 0;

-- Down Migration
alter table surat_tugas drop column status, drop column dikunci_pada, drop column dibuka_pada, drop column jumlah_dibuka;
