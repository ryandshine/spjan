# Status SPJAN

Catatan hidup untuk melanjutkan pekerjaan tanpa mengulang berpikir. Diperbarui di akhir setiap pekerjaan bermakna.
Terakhir diperbarui: 2026-10-11 (commit terakhir `f6abceb`; navigasi langkah dipindah ke sidebar, belum di-commit).

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
