# Status SPJAN

Catatan hidup untuk melanjutkan pekerjaan tanpa mengulang berpikir. Diperbarui di akhir setiap pekerjaan bermakna.
Terakhir diperbarui: 2026-10-10 (commit terakhir `0e1a71e`).

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

## Keputusan dan alasannya

- Satu orang satu akun; admin bisa semuanya; operator hanya mengubah/mengunci/menghapus ST buatannya. Alasan: banyak pengguna, hindari perubahan tak sengaja.
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
