-- Up Migration
create table laporan (
  st_id bigint primary key references surat_tugas (id) on delete cascade,
  isi jsonb not null,
  updated_at timestamptz not null default now()
);

-- Down Migration
drop table if exists laporan;
