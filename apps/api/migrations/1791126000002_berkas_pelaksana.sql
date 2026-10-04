-- Up Migration
alter table berkas add column if not exists pelaksana_id bigint references pelaksana (id) on delete set null;
create index if not exists berkas_pelaksana_idx on berkas (pelaksana_id);

-- Down Migration
drop index if exists berkas_pelaksana_idx;
alter table berkas drop column if exists pelaksana_id;
