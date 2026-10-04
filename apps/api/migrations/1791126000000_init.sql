-- Up Migration
create table users (
  id bigserial primary key,
  username text not null unique,
  password_salt text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table sessions (
  token_hash text primary key,
  user_id bigint not null references users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index sessions_expires_idx on sessions (expires_at);

create table pengaturan (
  id smallint primary key default 1 check (id = 1),
  kode_satker text not null default '',
  nama_satker text not null default '',
  dasar_dipa text not null default '',
  kode_akun_default text not null default '',
  tahun_anggaran integer not null default 2026,
  ppk_nama text not null default '',
  ppk_nip text not null default '',
  bendahara_nama text not null default '',
  bendahara_nip text not null default '',
  pj_nama text not null default '',
  pj_nip text not null default '',
  pj_jabatan text not null default '',
  pembuat_daftar_nama text,
  pembuat_daftar_nip text,
  kota_kedudukan text not null default 'Jakarta',
  provinsi_kedudukan text not null default 'D.K.I. JAKARTA',
  updated_at timestamptz not null default now()
);
insert into pengaturan (id) values (1);

create table pegawai (
  id bigserial primary key,
  nama text not null,
  nip text not null unique,
  jabatan text not null default '',
  status_kode text check (status_kode in ('PEJABAT_NEGARA_WAMEN','ESELON_I','ESELON_II','ESELON_III_GOL_IV','ESELON_IV_GOL_III_II_I')),
  aktif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sbm_versi (
  id serial primary key,
  tahun_anggaran integer not null,
  dasar_hukum text not null,
  aktif boolean not null default true,
  data jsonb not null,
  created_at timestamptz not null default now(),
  unique (tahun_anggaran, dasar_hukum)
);

create table surat_tugas (
  id bigserial primary key,
  nomor text not null,
  tanggal date not null,
  tanggal_spj date,
  kode_akun text not null default '',
  versi_sbm_id integer not null references sbm_versi (id),
  catatan text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table pelaksana (
  id bigserial primary key,
  st_id bigint not null references surat_tugas (id) on delete cascade,
  urutan integer not null,
  pegawai_id bigint references pegawai (id) on delete set null,
  no_spd text,
  nama text not null,
  nip text not null default '',
  jabatan text not null default '',
  status_kode text,
  unique (st_id, urutan)
);

create table etape (
  id bigserial primary key,
  pelaksana_id bigint not null references pelaksana (id) on delete cascade,
  urutan integer not null,
  provinsi text not null default '',
  kota text not null default '',
  kegiatan text not null default '',
  berangkat date,
  pulang date,
  malam_override integer,
  hotel_nama text,
  hotel_tarif bigint,
  dinas_jabatan boolean not null default false,
  unique (pelaksana_id, urutan)
);

create table biaya (
  id bigserial primary key,
  pelaksana_id bigint not null references pelaksana (id) on delete cascade,
  urutan integer not null,
  jenis text not null,
  provinsi text,
  uraian text,
  qty integer,
  satuan text,
  tarif bigint not null,
  keterangan text,
  etape_urutan integer,
  unique (pelaksana_id, urutan)
);

-- Down Migration
drop table biaya;
drop table etape;
drop table pelaksana;
drop table surat_tugas;
drop table sbm_versi;
drop table pegawai;
drop table pengaturan;
drop table sessions;
drop table users;
