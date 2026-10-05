-- Up Migration
alter table pelaksana add column if not exists tanggal_spd date;

-- Down Migration
alter table pelaksana drop column if exists tanggal_spd;
