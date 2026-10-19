-- Up Migration
create table if not exists naskah_st (
  id bigserial primary key,
  nomor text not null default '${nomor_naskah}',
  mode_nomor text not null default 'srikandi' check (mode_nomor in ('srikandi', 'manual')),
  tanggal date,
  tempat_naskah text not null default 'Jakarta',
  maksud_tugas text not null,
  lokasi_tugas text not null,
  tanggal_mulai date not null,
  tanggal_selesai date not null,
  lama_hari integer not null default 1,
  dasar_hukum jsonb not null default '[]'::jsonb,
  dasar_spesifik text not null default '',
  pelaporan_hari integer not null default 5,
  pembebanan_anggaran text not null,
  penandatangan_jabatan text not null default 'Direktur,',
  penandatangan_nama text not null,
  penandatangan_nip text not null,
  tembusan jsonb not null default '[]'::jsonb,
  spj_id bigint references surat_tugas (id) on delete set null,
  dibuat_oleh bigint references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists naskah_st_pelaksana (
  id bigserial primary key,
  naskah_st_id bigint not null references naskah_st (id) on delete cascade,
  urutan integer not null,
  pegawai_id bigint references pegawai (id) on delete set null,
  nama text not null,
  nip text not null default '',
  jabatan text not null default '',
  unique (naskah_st_id, urutan)
);

create index if not exists naskah_st_dibuat_oleh_idx on naskah_st (dibuat_oleh);
create index if not exists naskah_st_spj_id_idx on naskah_st (spj_id);
create index if not exists naskah_st_pelaksana_naskah_id_idx on naskah_st_pelaksana (naskah_st_id);

-- Down Migration
drop table if exists naskah_st_pelaksana;
drop table if exists naskah_st;
