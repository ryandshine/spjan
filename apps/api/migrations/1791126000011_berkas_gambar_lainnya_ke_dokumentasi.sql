-- Up Migration
-- Gambar yang dinilai AI bukan hotel/tiket/transport/ST ("lainnya") dianggap foto dokumentasi kegiatan.
-- Pemisahan bukti biaya dan foto dokumentasi kini berdasarkan jenis = 'dokumentasi' saja.
update berkas set jenis = 'dokumentasi' where jenis = 'lainnya' and mime like 'image/%';

-- Down Migration
-- Tidak dapat dibalik: asal jenis 'lainnya' tidak tercatat. Pindahkan manual lewat editor bila perlu.
select 1;
