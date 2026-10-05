-- Up Migration
alter table surat_tugas add column if not exists tahun_anggaran integer;
alter table surat_tugas add column if not exists sumber_dana text not null default 'RM';
alter table surat_tugas add column if not exists pj_nama text;
alter table surat_tugas add column if not exists pj_nip text;
alter table surat_tugas add column if not exists pj_jabatan text;

-- Down Migration
alter table surat_tugas drop column if exists pj_jabatan;
alter table surat_tugas drop column if exists pj_nip;
alter table surat_tugas drop column if exists pj_nama;
alter table surat_tugas drop column if exists sumber_dana;
alter table surat_tugas drop column if exists tahun_anggaran;
