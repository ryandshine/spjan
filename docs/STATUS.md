# Status SPJAN

Catatan hidup untuk melanjutkan pekerjaan tanpa mengulang berpikir. Diperbarui di akhir setiap pekerjaan bermakna.
Terakhir diperbarui: 2026-10-20 (fitur "isi naskah ST dari surat undangan" selesai dibuat, belum di-commit).

## Surat Tugas: versi 1 (≤ 3 pelaksana) dan versi 2 (> 3 pelaksana, belum di-commit)

- **Versi 1 = format sekarang** (`docx/generator.ts`): pelaksana ditulis langsung di bagian "Kepada" ("Nama / Jabatan", bernomor). Dipakai untuk 1-3 pelaksana.
- **Versi 2 = format `ST_CILOTO.docx`** (ST.189/PPS/PEMPS/PSL.04.02/B/08/2026, diberikan pengguna 2026-10-20; berkas ada di folder unggahan sesi, bukan di repo): bagian "Kepada" hanya berisi **"DAFTAR TERLAMPIR"**; daftar nama pindah ke halaman 2 sebagai **lampiran**:
  - Halaman 1 tetap lengkap: Menimbang, Dasar, Memberi Tugas, Untuk, tanggal, tanda tangan (Direktur), tembusan.
  - Halaman 2: nomor halaman "-2-", judul "Lampiran Surat Tugas" + "Nomor : …" dan "Tanggal : …", judul "DAFTAR PELAKSANA TUGAS", tabel 3 kolom **NO | NAMA/NIP | JABATAN** (nama di baris atas, "NIP. …" di baris bawahnya; non-PNS "NIP. -"), lalu blok tanda tangan Direktur diulang.
  - Margin contoh (atas 1138, kanan 1138, bawah 1530, kiri 1699 dxa) berbeda dari generator; **tidak dipakai** (lihat keputusan di bawah).
- **Keputusan pengguna (2026-10-20):** versi 2 aktif otomatis bila pelaksana **lebih dari 3** (`AMBANG_LAMPIRAN_PELAKSANA`, `pakaiLampiranPelaksana` di `packages/shared/src/naskah-st.ts`); margin, font, kop, dan jarak **tetap mengikuti generator versi 1**, bukan contoh `ST_CILOTO.docx` (margin kiri 3 cm tidak dipakai). Tanpa opsi manual dan tanpa kolom/migrasi baru.
- Dikerjakan: `docx/generator.ts` (Kepada = "DAFTAR TERLAMPIR"; halaman baru via `pageBreakBefore`; nomor halaman field `PAGE` "-N-"; "Lampiran Surat Tugas" + Nomor + Tanggal; tabel NO | NAMA/NIP | JABATAN dengan baris judul berulang dan baris tak terpotong; tanda tangan diulang tanpa baris tanggal; tembusan hanya di halaman 1) dan pratinjau di `st-naskah-editor.tsx` (lembar kedua "-2-"). Nomor/tanggal pratinjau kini memakai satu sumber (`nomorPratinjau`, `tanggalPratinjau`).
- Diperiksa lewat render LibreOffice: 3 pelaksana 1 halaman, 4 pelaksana 2 halaman, 40 pelaksana 4 halaman (baris judul tabel berulang). Belum diperiksa di Word dan di peramban.
- Keterbatasan: baris terakhir tabel diberi keep-with-next agar tanda tangan tidak sendirian di satu halaman; Word menghormatinya, LibreOffice tidak (pada daftar yang pas memenuhi satu halaman, tanda tangan bisa terdampar sendirian). NIP lampiran ditulis apa adanya dari data pelaksana (tidak diformat ulang).

## Isi naskah ST dari surat undangan (sudah di-push, commit 5f30249)

- Di editor `/st-naskah`, kartu "Isi dari surat undangan" menerima PDF/JPG/PNG/WEBP (seret-lepas atau pilih berkas, maks 10 MB). AI membaca dokumen dan mengusulkan maksud tugas, lokasi, tanggal mulai/selesai, dan dasar spesifik ("Undangan {penyelenggara} Nomor {nomor} tanggal {tanggal}"). Pelaksana tidak diisi AI.
- Alur: `POST /api/naskah-st/ekstrak-undangan` (multipart, sinkron; berkas **tidak disimpan**) → `{ model, hasil }`. Usulan dihitung di web oleh fungsi murni `usulanDariUndangan`/`terapkanUsulan` (`packages/shared/src/undangan-ekstraksi.ts`). Panel usulan memberi kotak centang per field; hanya field kosong/bawaan yang tercentang awal, field yang sudah Anda isi harus dicentang sendiri. Panel hilang setelah Terapkan/Batal.
- Backend: `ekstraksi/undangan.ts` (pola `ekstrakTiket`: teks → `modelTeks`, gambar/scan → `modelGambar` halaman pertama, retry sekali). Galat AI dipetakan: model belum diatur 409, berkas tak terbaca/hasil tak valid 422, lainnya 502. Aksi `st.ekstrak_undangan` dicatat di audit tanpa isi berkas. `@fastify/multipart` didaftarkan di plugin `naskahStRoutes` sendiri (terenkapsulasi per plugin).
- Deploy: `apps/web/nginx.conf.template` punya location khusus `= /api/naskah-st/ekstrak-undangan` dengan `proxy_read_timeout`/`proxy_send_timeout` 300 dtk (panggilan AI sinkron bisa >60 dtk, batas bawaan nginx). Rute `/api/` lain tetap bawaan. Ini jalur AI sinkron pertama di permintaan pengguna; bila memakai proxy lain di depan (Traefik), pastikan timeout-nya tidak lebih pendek.
- Spec/rencana: `docs/superpowers/specs/2026-10-20-isi-st-dari-undangan-design.md`, `docs/superpowers/plans/2026-10-20-isi-st-dari-undangan.md`.
- Tes lulus: api 168, web 39, shared 141; build dan lint bersih. **Belum dilihat di peramban.**
- Risiko/utang: mutu bergantung pada model AI yang diatur admin (scan buram bisa meleset); undangan scan multi-halaman hanya halaman pertama; belum ada pembaca .docx; drop berkas tipe tak didukung baru ditolak server; `tanggalUndangan` tak divalidasi kalender sebelum diformat.

## Fitur Pembuat Naskah Surat Tugas (ST / SPT) (belum di-commit)

- Fitur menu baru **"Buat Surat Tugas"** di sidebar (`/st-naskah`) untuk drafting naskah penugasan resmi sebelum perjalanan dinas dilaksanakan, serta pembaruan label menu lama `/` menjadi **"SPJ Perjalanan Dinas"** untuk memperjelas batas peran administrasi.
- Dokumen acuan: `CONTOH SPT.docx` dijadikan master template di `apps/api/assets/template-spt.docx`.
- Mesin pembangkit DOCX (`apps/api/src/docx/generator.ts` via JSZip & DOMParser @xmldom/xmldom): menghasilkan berkas Word presisi dengan kop resmi logo Kementerian Kehutanan, tipografi Bookman Old Style 11pt, margin A4 dinas, tabel borderless konsideran Menimbang & Dasar, penomoran otomatis pelaksana & diktum Untuk, serta variabel SRIKANDI `${nomor_naskah}`, `${tanggal_naskah}`, `${ttd_pengirim}`.
- Model data & skema: tabel `naskah_st` dan `naskah_st_pelaksana` (migrasi `1791126000021_naskah_st.sql`), tipe dan skema Zod di `@spjan/shared`, helper `naskah-st.ts` (hitung hari, terbilang hari, rentang tanggal, nilai bawaan DIPA & dasar hukum).
- Endpoint API `/api/naskah-st`: CRUD, GET `/:id/docx`, POST `/preview-docx`, dan integrasi 1-klik `POST /:id/buat-spj` yang otomatis membuat entri SPJ lengkap dengan nomor, tanggal, maksud kegiatan, lokasi, dan daftar pelaksana.
- Antarmuka pengguna:
  - `st-naskah-list.tsx`: daftar surat tugas dengan badge Srikandi/Manual, jumlah personil, tombol unduh DOCX, dan tombol cepat "Buat SPJ".
  - `st-naskah-editor.tsx`: editor 2-kolom dengan live preview lembar naskah dinas resmi A4, pemilihan cepat pelaksana dari master data Pegawai SPJAN, pengaturan urutan tim, pembebanan anggaran, dan tembusan.
- Tes lulus: api 158 tests, shared 129 tests; lint & build bersih di semua workspace.

- Perapian format DOCX (2026-10-20, belum di-commit): `generator.ts` kini mempertahankan hanya kop + garis dari template dan membangun ulang badan surat (tabel label|titik dua|isi lebar tetap, butir bernomor dengan tab dan indentasi gantung, blok tanda tangan tanpa paragraf kosong/spasi pengisi, tanda baca dasar/tembusan diseragamkan, pelaksana ditulis "Nama / Jabatan"). 2 pelaksana muat 1 halaman; makin banyak pelaksana, blok tanda tangan + tembusan pindah utuh ke halaman 2. Diperiksa lewat render LibreOffice, belum di Word. Berkas `Surat-Tugas-_nomor_naskah_ (3).docx` di root adalah keluaran lama (margin kiri 1701), bukan hasil generator sekarang.
- Kop dan margin DOCX dikembalikan ke format ST.265 / CONTOH SPT (belum di-commit): template `assets/template-spt.docx` = salinan asli `CONTOH SPT.docx`; margin atas 1,0 / kiri 1,78 / kanan 2,0 / bawah 2,5 cm; logo 2,80 cm (x 1,99 cm); kop Figtree Bold 14/14/15 pt (Permenhut 1/2025 Pasal 56 ayat 3; ST.265 memakai Cambria 14/14/16); garis ganda 19,8 cm; isi Bookman Old Style 11 pt dengan jarak baris tetap 12,9 pt; label di x 1,78 cm, titik dua di 4,28 cm, butir di 4,98 cm, blok tanda tangan di 9,78 cm. Posisi hasil render cocok dengan ST.265 dalam ±0,02 cm. Selisih dengan Permenhut 1/2025 yang dibiarkan mengikuti ST.265: Bookman 12 pt dan margin kiri min. 3 cm. Aturan tidak menyebut ukuran logo dalam cm (hanya "disesuaikan dengan ukuran kertas dan jumlah baris nomenklatur"); 2,80 cm diambil dari ST.265. Kertas A4 (11906 x 16838 dxa). Pratinjau di `st-naskah-editor.tsx` belum disesuaikan (masih logo 2,65 cm dan Figtree).


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
