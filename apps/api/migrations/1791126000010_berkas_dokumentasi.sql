-- Up Migration
alter table berkas drop constraint if exists berkas_jenis_check;
alter table berkas add constraint berkas_jenis_check check (jenis in ('belum', 'st', 'hotel', 'tiket', 'transport', 'dokumentasi', 'lainnya'));
alter table berkas add column if not exists keterangan text;

-- Down Migration
alter table berkas drop constraint if exists berkas_jenis_check;
alter table berkas add constraint berkas_jenis_check check (jenis in ('belum', 'st', 'hotel', 'tiket', 'transport', 'lainnya'));
alter table berkas drop column if exists keterangan;
