-- Up Migration
-- Akun terhubung ke data pegawai (identitas). Akun tanpa pegawai (mis. admin sistem) tetap diizinkan.
alter table users add column pegawai_id bigint unique references pegawai (id) on delete set null;

-- Down Migration
alter table users drop column pegawai_id;
