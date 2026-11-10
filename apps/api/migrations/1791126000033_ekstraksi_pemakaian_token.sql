-- Up Migration
-- Pemakaian model per pekerjaan ekstraksi (klasifikasi + ekstraksi + coba ulang), termasuk yang gagal.
alter table ekstraksi
  add column token_masuk integer not null default 0,
  add column token_keluar integer not null default 0,
  add column jumlah_panggilan integer not null default 0;

-- Down Migration
alter table ekstraksi drop column token_masuk, drop column token_keluar, drop column jumlah_panggilan;
