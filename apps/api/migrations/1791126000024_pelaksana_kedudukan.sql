alter table pelaksana
  add column if not exists kota_kedudukan text,
  add column if not exists provinsi_kedudukan text;
