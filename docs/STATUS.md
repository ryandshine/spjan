# Status SPJAN

Catatan hidup untuk melanjutkan pekerjaan tanpa mengulang berpikir. Diperbarui di akhir setiap pekerjaan bermakna.
Terakhir diperbarui: 2026-10-15 (fitur uang harian ditanggung pihak lain selesai dibuat, belum di-commit).

## Tujuan

Aplikasi multi-pengguna untuk menyusun SPJ perjalanan dinas (SPTB, Rincian Biaya, Kuitansi) Direktorat Pengendalian Perhutanan Sosial.
Arsitektur dan aturan hitung: `docs/superpowers/specs/2026-10-04-spjan-design.md`. Aturan teknis: `CLAUDE.md`.

## Sudah selesai (semua sudah di-push ke `main`)

- Form ST: penginapan, paket rapat, bar bawah, tabel transportasi, kartu uang harian dan penginapan (kontras WCAG).
- Pembagian tarif tiket multi-penumpang (`transport-ekstraksi.ts`) dan AI pembaca tiket yang tahan beragam format.
- Kunci/buka kunci ST final (`status draft|final`, 409 `ST_TERKUNCI`).
- Multi-pengguna: peran admin/operator, konfirmasi password, log audit, tempat sampah.
- Akun pengguna dibuat dari data pegawai (username = NIP).
- Tes terakhir lulus: api 143, web 30, shared 119.

## Sedang dikerjakan (belum di-commit)

- Layout baru halaman editor ST (`/st/:id`), berdasarkan desain Figma `zKfnzgtXa9TYsFRrfvj4v3` (4 layar):
  navigasi langkah dan daftar pelaksana ada di sidebar aplikasi (`langkah-st.tsx`, `daftar-pelaksana-st.tsx`; dipasang lewat portal ke slot `SlotSidebarContext` milik `AppShell`, state tetap di editor; di bawah `md` tampil sebagai baris tab di halaman), panel Ringkasan di kanan (`ringkasan-st.tsx`, menggantikan `BarBawahSt` dan `BannerPeriksa` yang dihapus),
  aksi simpan/dokumen/tandai selesai pindah ke header (`aksi-header-st.tsx`), tombol Kembali/Lanjut di bawah tiap langkah.
- Langkah Data: dua kartu (Identitas surat, Anggaran) + Pejabat (terlipat). Langkah Pelaksana: daftar pelaksana + satu pelaksana terbuka dengan sub-tab Perjalanan/Penginapan/Biaya
  (Perjalanan = identitas + tujuan; Biaya = transportasi + uang harian). Langkah Bukti & usulan: sub-tab Bukti/Usulan hotel/Usulan transport/Foto dokumentasi.
- Pengunciannya dipindah dari satu `<fieldset disabled>` ke `KelompokIsian` per panel, supaya tombol navigasi tetap hidup pada ST terkunci.
- Beda dengan mockup Figma: mockup memuat isian "Dasar penugasan", "Tujuan & waktu", "Provinsi" di langkah 1 yang tidak ada di model data (tujuan dan tanggal ada per pelaksana di sub-tab Perjalanan).
- Lulus tsc, eslint, build. **Belum dilihat di peramban**; periksa tampilan dan alur (simpan, tandai selesai, buka kunci, "perlu dilengkapi" menuju isian, ST terkunci) sebelum commit.

## Palet warna baru (belum di-commit)

- Palet hijau diganti biru (acuan: desain Stitch proyek `5727215774991893270`), hanya warna: token di `apps/web/src/index.css`, tombol Simpan, kotak Total SPTB (latar primer), chip fullboard.
- Isian wajib yang belum lengkap (`Field` dengan `warning`) kini bertanda merah (border, latar, pesan); ringkasan "Perlu dilengkapi" tetap kuning. Belum dilihat di peramban.

## Mode gelap (belum di-commit)

- Dua mode: terang (palet biru, bawaan) dan gelap (Vibrant Neon Dark dari DESIGN.md Stitch). Token gelap ada di blok `.dark` `apps/web/src/index.css`; kelas `dark` dipasang pada `<html>` oleh `lib/tema.ts` (disimpan di `localStorage` kunci `spjan.tema`, bawaan terang; `index.html` memasangnya lebih awal agar tidak berkedip).
- Tombol sun/moon (`components/tombol-tema.tsx`) di footer sidebar (di samping zoom) dan di header ponsel. Hanya warna yang dipindah; font DESIGN.md (Sora/Space Grotesk) sengaja tidak dipakai. PDF tetap terang.
- Belum dilihat di peramban; periksa kontras tiap halaman dalam mode gelap (kelas slate/amber/sky bawaan yang memakai varian `dark:` belum diselaraskan satu per satu dengan palet neon).

## Pembersihan kode (belum di-commit)

- Logika turunan kartu pelaksana (ubah tujuan/biaya, tambah tiket/taksi/transport Jakarta, hapus tujuan, batas hotel) dipindah dari `pelaksana-card.tsx` ke fungsi murni `lib/pelaksana-ubah.ts` (+ tes). Seret-lepas berkas dipusatkan di `lib/use-seret-lepas.ts` (dipakai bukti, foto dokumentasi, buat-dari-st).
- Panel bersarang diratakan (kartu penginapan, kotak Opsi Tambahan/paket rapat/hotel 30%, kartu uang harian, kartu putus-putus ganda di buat-dari-st); warna slate/amber/gray bawaan di sana diganti token tema.
- Dihapus: `ekstraktorKlasifikasi` (api, tak terpakai). Fixture tes shared dilengkapi agar `npm run lint` hijau.
- Skrip `apps/api/scripts/probe-*.ts` dan `buat-akun-massal*` sengaja dipertahankan (alat manual yang dirujuk di docs).

## Biaya mobil: BBM dan E-Toll (belum di-commit)

- Jenis biaya baru `BBM_KENDARAAN` ("BBM kendaraan (PP)") dan `TOL_ETOLL` ("E-Toll (PP)") di `@spjan/shared` (`types.ts`, urutan 53/54 di `hitung.ts` **dan** `st-model.ts`, tertaut ke tujuan lewat `etapeIndex`). Uraian otomatis "BBM|E-Toll dari {asal} ke {tujuan} PP" (asal = kedudukan atau tujuan sebelumnya); boleh ditimpa lewat kolom uraian. Tidak ada pagu SBM: tarif = nominal di kuitansi, qty 1.
- Menu "Tambah Biaya" memuat dua opsi baru; `biayaTiketPergi` digeneralisasi menjadi `biayaPerTujuan(x, jenis)`.
- Belum: pembaca AI (`transport-ekstraksi`) belum mengenali kuitansi BBM/E-Toll; ceklis DPR tidak otomatis.

## Uang harian "dalam kota > 8 jam" (belum di-commit)

- Bug: menambah/mengubah biaya "Transport Jakarta ke kota sekitar" (`lib/pelaksana-ubah.ts`) menandai tujuan sebagai `dalamKota8Jam` tanpa memeriksa lama perjalanan, sehingga perjalanan 3 hari pun dihitung dengan tarif dalam kota (Rp150.000, bukan luar kota).
- Perbaikan: mesin hitung (`hitung.ts`) hanya memakai tarif dalam kota bila perjalanannya sehari; penanda otomatis di UI juga hanya untuk perjalanan sehari; kotak centang dalam kota hanya tampil untuk perjalanan sehari. Kota asal tidak perlu ditanya: asal = kota kedudukan (Pengaturan).
- Dampak: ST lama yang tersimpan dengan penanda ini dan lebih dari sehari kini terhitung luar kota (total naik).

## Uang harian ditanggung pihak lain (belum di-commit)

- Fitur untuk menonaktifkan uang harian (lumpsum) pada tanggal-tanggal tertentu yang telah dibayarkan oleh pihak lain / panitia (agar tidak terjadi pembayaran ganda sesuai PMK 113/2012).
- Data model: kolom `tanpa_uang_harian_dates text[]` pada tabel `etape` (migrasi `1791126000020_etape_tanpa_uang_harian.sql`), `tanpaUangHarianDates: string[]` pada `EtapeInput` dan `EtapePayload`.
- Perhitungan: tanggal dalam `tanpaUangHarianDates` dikeluarkan dari perhitungan lumpsum/uang saku, keterangan tanggal di rincian biaya hanya mencantumkan tanggal yang dibayarkan kantor, dan dicatat di `catatan` pelaksana. Bila seluruh hari dinonaktifkan, uang harian menjadi Rp0.
- UI: Pemilih tanggal interaktif di kartu Penginapan (Opsi Tambahan) dengan opsi pilih semua/reset, badge jumlah hari pihak lain di `EtapeForm`, serta ringkasan informatif pada kartu Uang Harian di sub-tab Biaya.

## Keputusan dan alasannya

- Satu orang satu akun; admin bisa semuanya; operator hanya melihat ST buatannya atau yang memuat namanya sebagai pelaksana (ST lain tersembunyi, 404), dan hanya pembuat/admin yang mengubah/mengunci/menghapus; pelaksana lain hanya lihat dan unduh. Alasan: ST orang lain bukan kepentingannya; hindari perubahan tak sengaja. Catatan: berkas yang belum tertaut ke ST (unggahan sebelum ST dibuat) belum dibatasi.
- Hapus ST/berkas = tempat sampah; hapus permanen dan pulihkan khusus admin. Hapus dan buka kunci meminta password sendiri.
- Pemisahan data per unit dan alur persetujuan buka kunci/SSO **ditunda** atas permintaan pengguna ("4 dan 5 jangan dulu").
- Jangan tampilkan data yang sama di dua tempat UI (lihat memori `feedback-cek-duplikasi-ui`).
- Verifikasi UI tanpa otomasi Chrome: tsc, eslint, build, tes.

## Risiko dan utang yang diketahui

- Pengaturan global belum di-snapshot saat ST dikunci (SBM sudah di-pin per ST).
- Status "diterapkan" usulan tiket multi-penumpang hanya diingat selama halaman terbuka.
- Username tidak ikut berubah saat NIP pegawai diubah.
- Tempat sampah tidak dibersihkan otomatis.
- Log audit tidak mencatat perubahan ST biasa.
- Tampilan UI terbaru belum diverifikasi di peramban.

## Belum dilakukan

- **Deploy belum pernah dijalankan** (perlu persetujuan eksplisit). Setelah deploy: semua pengguna harus login ulang; ekstraksi ulang berkas 23 di produksi agar tarif terbagi dua.
