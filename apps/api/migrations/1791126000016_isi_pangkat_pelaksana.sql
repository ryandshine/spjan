-- Up Migration
-- Pelaksana pada surat tugas yang sudah ada: salin pangkat/golongan dari data pegawai (cocok lewat pegawai_id atau NIP).
update pelaksana pl set pangkat_golongan = pg.pangkat_golongan
from pegawai pg
where pl.pangkat_golongan = ''
  and pg.pangkat_golongan <> ''
  and (pl.pegawai_id = pg.id or pl.nip = pg.nip);

-- Down Migration
-- Tidak ada yang perlu dibalik: kolom dibuang oleh migrasi sebelumnya.
