-- Up Migration
-- Banyak pengguna: satu orang satu akun dengan peran admin/operator; akun yang sudah ada menjadi admin.
alter table users
  add column nama text not null default '',
  add column peran text not null default 'operator' check (peran in ('admin', 'operator')),
  add column aktif boolean not null default true;
update users set peran = 'admin', nama = username;

-- Pemilik surat tugas: operator hanya boleh mengubah miliknya, admin semuanya.
alter table surat_tugas add column dibuat_oleh bigint references users (id) on delete set null;
update surat_tugas set dibuat_oleh = (select id from users order by id limit 1);

-- Tempat sampah: hapus biasa hanya menyembunyikan; admin memulihkan atau menghapus permanen.
alter table surat_tugas
  add column dihapus_pada timestamptz,
  add column dihapus_oleh bigint references users (id) on delete set null;
alter table berkas
  add column dihapus_pada timestamptz,
  add column dihapus_oleh bigint references users (id) on delete set null;

-- Berkas di tempat sampah tidak boleh menghalangi unggah ulang berkas yang sama.
drop index berkas_st_sha_idx;
create unique index berkas_st_sha_idx on berkas ((coalesce(st_id, 0)), sha256) where dihapus_pada is null;

-- Jejak audit: siapa melakukan apa, kapan, dan alasannya. Tanpa FK ke surat tugas agar tetap ada setelah dihapus permanen.
create table log_audit (
  id bigserial primary key,
  waktu timestamptz not null default now(),
  user_id bigint references users (id) on delete set null,
  username text not null,
  aksi text not null,
  entitas text not null,
  entitas_id bigint,
  st_id bigint,
  alasan text,
  detail jsonb
);
create index log_audit_waktu_idx on log_audit (waktu desc);
create index log_audit_st_idx on log_audit (st_id);

-- Down Migration
drop index berkas_st_sha_idx;
create unique index berkas_st_sha_idx on berkas ((coalesce(st_id, 0)), sha256);
drop table log_audit;
alter table berkas drop column dihapus_pada, drop column dihapus_oleh;
alter table surat_tugas drop column dihapus_pada, drop column dihapus_oleh, drop column dibuat_oleh;
alter table users drop column nama, drop column peran, drop column aktif;
