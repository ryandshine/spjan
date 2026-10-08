-- Up Migration
-- Jenis 'laporan': gambar yang disisipkan di dalam teks Laporan Perjalanan Dinas (tidak diproses AI).
alter table berkas drop constraint if exists berkas_jenis_check;
alter table berkas add constraint berkas_jenis_check check (jenis in ('belum', 'st', 'hotel', 'tiket', 'transport', 'dokumentasi', 'laporan', 'lainnya'));

-- Down Migration
delete from berkas where jenis = 'laporan';
alter table berkas drop constraint if exists berkas_jenis_check;
alter table berkas add constraint berkas_jenis_check check (jenis in ('belum', 'st', 'hotel', 'tiket', 'transport', 'dokumentasi', 'lainnya'));
