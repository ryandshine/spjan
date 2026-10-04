-- Up Migration
create table berkas (
  id bigserial primary key,
  st_id bigint references surat_tugas (id) on delete cascade,
  nama_asli text not null,
  mime text not null check (mime in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  ukuran integer not null check (ukuran > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]+$'),
  jenis text not null default 'belum' check (jenis in ('belum', 'st', 'hotel', 'tiket', 'transport', 'lainnya')),
  created_at timestamptz not null default now()
);
-- coalesce: dua berkas tanpa ST dengan isi sama juga dianggap ganda
create unique index berkas_st_sha_idx on berkas ((coalesce(st_id, 0)), sha256);
create index berkas_st_idx on berkas (st_id);

create table ekstraksi (
  id bigserial primary key,
  berkas_id bigint not null references berkas (id) on delete cascade,
  status text not null default 'antre' check (status in ('antre', 'berjalan', 'selesai', 'gagal')),
  model text,
  hasil jsonb,
  kode_galat text,
  galat text,
  usulan_status text not null default 'menunggu' check (usulan_status in ('menunggu', 'diterapkan', 'diabaikan')),
  percobaan integer not null default 0,
  created_at timestamptz not null default now(),
  mulai_at timestamptz,
  selesai_at timestamptz
);
create index ekstraksi_antre_idx on ekstraksi (id) where status = 'antre';
create index ekstraksi_berkas_idx on ekstraksi (berkas_id, id desc);

create table model_ai (
  id smallint primary key default 1 check (id = 1),
  llm_url text,
  model_teks text,
  model_gambar text,
  updated_at timestamptz not null default now()
);
insert into model_ai (id, model_teks) values (1, 'gpt-oss:120b-cloud');

-- Down Migration
drop table model_ai;
drop table ekstraksi;
drop table berkas;
