-- Up Migration
-- Instansi pegawai; semua data lama diisi Direktorat Pengendalian Perhutanan Sosial.
alter table pegawai add column instansi text not null default 'Direktorat Pengendalian Perhutanan Sosial';
alter table pelaksana add column instansi text not null default 'Direktorat Pengendalian Perhutanan Sosial';

-- Down Migration
alter table pelaksana drop column if exists instansi;
alter table pegawai drop column if exists instansi;
