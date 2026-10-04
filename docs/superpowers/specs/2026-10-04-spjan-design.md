# SPJAN - Aplikasi SPJ Perjalanan Dinas (rancangan)

Status: rancangan disetujui pengguna di sesi 2026-10-04; menunggu review spesifikasi tertulis ini.
Repo: github.com/ryandshine/spjan (kosong saat rancangan ini ditulis). Domain: spjan.ditpps.com (Dokploy, proyek `spjan` sudah ada).
Asal logika: prototipe spreadsheet `SPJ Otomatis.xlsx` (folder spj/2026/diy), yang angkanya sudah diuji.

## 1. Tujuan dan batas

Membuat SPTB, Rincian Biaya Perjalanan Dinas, dan Kuitansi untuk satu Surat Tugas (ST) berisi banyak pelaksana, dengan pengetikan sesedikit mungkin. Data pegawai dan SBM tersimpan permanen.

Tahap 1 (dikerjakan sekarang): login satu akun, data pegawai, pengaturan, SBM PMK 32/2025 (dalam negeri), editor ST, mesin hitung, pratinjau dan PDF tiga dokumen.
Tahap 2 (nanti, terpisah): unggah ST/invoice/tiket lalu form terisi otomatis (Ollama + MinIO). Tidak dirancang rinci di sini.

Di luar cakupan tahap 1: banyak pengguna/peran, multi-unit, uang harian dalam kota dan diklat, perjalanan luar negeri, pengepakan/pindah, rapat luar kantor, ekspor xlsx.

## 2. Pengguna dan keamanan

Satu pengguna. Satu akun (username + kata sandi). Kata sandi di-hash (scrypt, `node:crypto`), akun dibuat dari env saat boot pertama. Sesi: cookie httpOnly + SameSite=Lax + Secure, token sesi acak disimpan hash-nya di tabel `sessions`, kedaluwarsa 7 hari. Pembatasan percobaan login (`@fastify/rate-limit`). Semua endpoint selain `/api/auth/login` dan `/api/health` wajib sesi. Data berisi NIP pegawai, jadi tidak ada endpoint publik.

## 3. Arsitektur

Monorepo npm workspaces, mengikuti SIPEKAPS:

```
apps/api/        Fastify 5 + TypeScript + PostgreSQL (pg, zod, node-pg-migrate)
apps/web/        React + Vite + TypeScript, Tailwind 4 + shadcn/Radix, TanStack Query, react-router 7, @react-pdf/renderer
packages/shared/ Tipe, skema zod, dan mesin hitung (@spjan/shared)
docs/            spesifikasi dan rencana
```

Setelah `packages/shared/src` berubah, `npm run build` di `packages/shared` dijalankan lebih dulu (pola yang sama dengan SIPEKAPS).

Mesin hitung adalah fungsi murni di `packages/shared`: `hitungSpj(input, sbm) -> hasil`. Web memakainya untuk pratinjau langsung; API memakainya saat memvalidasi/menyimpan. Tidak ada angka total yang disimpan sebagai sumber kebenaran; total selalu dihitung dari masukan dan versi SBM yang di-pin.

Dokumen (SPTB, Rincian, Kuitansi) dirender di browser dengan `@react-pdf/renderer` (pratinjau + unduh PDF). Font Arial diganti Arimo (metrik sama, lisensi terbuka) yang dibundel di `apps/web/public/fonts`.

## 4. Model data (PostgreSQL, database `spjan`)

- `users` (id, username unik, password_hash, created_at).
- `sessions` (token_hash pk, user_id, expires_at).
- `pengaturan` (satu baris): kode_satker, nama_satker, dasar_dipa, kode_akun_default, tahun_anggaran, ppk_nama, ppk_nip, bendahara_nama, bendahara_nip, pj_nama, pj_nip, pj_jabatan, pembuat_daftar_nama (nullable), pembuat_daftar_nip (nullable), kota_kedudukan (default "Jakarta").
- `pegawai` (id, nama, nip text unik, jabatan, status_kode, aktif, timestamps). `status_kode` salah satu dari `PEJABAT_NEGARA_WAMEN`, `ESELON_I`, `ESELON_II`, `ESELON_III_GOL_IV`, `ESELON_IV_GOL_III_II_I`.
- SBM berversi: `sbm_versi` (id, tahun_anggaran, dasar_hukum, aktif), lalu tabel anak yang semuanya memuat `versi_id`: `sbm_uang_harian` (provinsi, luar_kota, dalam_kota_8jam, diklat), `sbm_representasi` (baris 1..3: Pejabat Negara/Wamen, Eselon I, Eselon II; luar_kota, dalam_kota), `sbm_penginapan` (provinsi, hotel_kol1..kol4), `sbm_terminal` (provinsi, besaran), `sbm_tiket_pp` (asal, tujuan, bisnis, ekonomi), `sbm_transport_ibukota` (provinsi, ibukota, kabkota, besaran), `sbm_transport_jakarta` (kabkota, besaran), `sbm_transport_kegiatan_pp` (besaran), `sbm_sewa_kendaraan` (provinsi, roda4, roda6_bus_sedang, bus_besar), `sbm_status_konfigurasi` (status_kode, kolom_hotel 1..4, baris_representasi 0..3, kelas_tiket 'Bisnis'|'Ekonomi').
- `surat_tugas` (id, nomor, tanggal, tanggal_spj nullable, kode_akun, versi_sbm_id, catatan, timestamps).
- `pelaksana` (id, st_id, urutan, pegawai_id, no_spd, snapshot: nama, nip, jabatan, status_kode). Snapshot dibekukan agar dokumen lama tidak berubah bila data pegawai diedit.
- `etape` (id, pelaksana_id, urutan, provinsi, kota, kegiatan, berangkat, pulang, malam_override nullable, hotel_nama, hotel_tarif, dinas_jabatan bool).
- `biaya` (id, pelaksana_id, urutan, jenis, provinsi nullable, uraian, qty default 1, satuan nullable, tarif, keterangan nullable). `jenis`: `TIKET_PERGI`, `TIKET_KEMBALI`, `TAKSI_KEDUDUKAN`, `TRANSPORT_DARAT`, `TRANSPORT_JAKARTA_SEKITAR`, `TRANSPORT_KEGIATAN_PP`, `TAKSI_TERMINAL`, `SEWA_RODA4`, `SEWA_RODA6`, `SEWA_BUS_BESAR`, `AIRPORT_TAX_BAGASI`, `KERETA_BUS_LAIN`, `LAINNYA`.

Data SBM diisi dari fixture JSON (`apps/api/seed/sbm-2026.json`, dihasilkan dari tabel PMK 32/2025 yang sudah diekstrak) lewat seed idempoten saat boot. Surat tugas menyimpan `versi_sbm_id` saat dibuat (pola pin versi seperti SIPEKAPS).

## 5. Aturan hitung (mesin hitung)

Semua angka dalam rupiah bulat.
- Hari = pulang - berangkat + 1. Malam = max(hari - 1, 0), kecuali `malam_override`.
- Uang harian = hari x tarif luar kota (provinsi, versi SBM). Keterangan: "Lumpsum/Prov. {Provinsi} Tanggal {rentang}".
- Hotel = malam x `hotel_tarif` (riil). Batas = `sbm_penginapan[provinsi].kol[kolom_hotel(status)]`. Tarif > batas menghasilkan peringatan `HOTEL_MELEBIHI_BATAS`. Baris hotel hanya tampil bila malam > 0 dan tarif terisi.
- Representasi = hari x tarif luar kota, hanya bila `baris_representasi(status) > 0` dan `dinas_jabatan`.
- Biaya transport: tiket pergi/kembali dan taksi sebagai baris; uraian tiket tersusun: "Tiket Pesawat {asal} ke {kota}" (asal = kota kedudukan atau kota etape sebelumnya) dan "Tiket Pesawat {kota} ke {kota kedudukan}". Biaya tambahan: baris = qty x tarif.
- Pagu informatif per jenis: transport darat (provinsi + kab/kota persis), Jakarta-sekitar (kab/kota), kegiatan dalam kab/kota PP (Rp170.000 pada SBM 2026), taksi terminal (provinsi), sewa kendaraan (provinsi + kelas), tiket PP (hanya orang satu etape; asal kota kedudukan, kelas menurut status; bandingkan tiket pergi + kembali). Hasil: catatan "dalam pagu", "melebihi pagu (dapat dilampaui bila riil; lampirkan bukti)", "tujuan tidak ditemukan (at cost)", atau "tidak ada pagu di PMK: biaya riil". Pagu tidak pernah memblokir.
- Total per pelaksana = transport + uang harian + representasi + hotel. Total SPTB = jumlah semua pelaksana.
- Terbilang bahasa Indonesia (satuan sampai miliar; "seratus", "seribu", belas, puluh), diakhiri "Rupiah". Nol = "Nol Rupiah".
- Teks tanggal: satu hari "10 September 2026"; satu bulan "10-13 September 2026" (Rincian) / "10 s.d. 13 September 2026" (SPTB); lintas bulan "30 September - 2 Oktober 2026" / "30 September s.d. 2 Oktober 2026". Nama bulan Indonesia.
- Uraian SPTB per pelaksana: "Biaya Perjalanan dinas dalam rangka {kegiatan etape 1} selama {n} ({kata}) hari pada tanggal {rentang} dan {etape 2 ...} sesuai Surat Tugas Nomor: {nomor} tanggal {tanggal ST} dan SPD terlampir."
- Peringatan (kode): `DATA_BELUM_LENGKAP`, `TANGGAL_SALAH`, `STATUS_PEGAWAI_KOSONG`, `NIP_KOSONG`, `NO_SPD_KOSONG`, `TARIF_HOTEL_KOSONG`, `HOTEL_MELEBIHI_BATAS`. Dokumen hanya boleh dianggap siap bila tidak ada peringatan tingkat galat.

Aturan di atas disalin dari prototipe spreadsheet dan diverifikasi dengan kasus uji (bagian 9).

## 6. API (ringkas, semua di bawah `/api`)

- `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `GET /health`.
- `GET/PUT /pengaturan`.
- `GET/POST /pegawai`, `GET/PATCH/DELETE /pegawai/:id` (DELETE = nonaktifkan).
- `GET /sbm/versi`, `GET /sbm/:versiId/{uang-harian|penginapan|representasi|terminal|tiket|transport-ibukota|transport-jakarta|sewa-kendaraan|status}`.
- `GET/POST /surat-tugas`, `GET/PUT/DELETE /surat-tugas/:id` (PUT mengganti seluruh pohon pelaksana/etape/biaya dalam satu transaksi; validasi zod dari `@spjan/shared`).
- `GET /surat-tugas/:id/hasil` mengembalikan keluaran `hitungSpj` (dipakai pratinjau dan dokumen).
Semua masukan divalidasi zod; kesalahan memakai bentuk galat seragam.

## 7. Web

Rute: `/login`, `/` (daftar ST), `/st/baru`, `/st/:id` (editor satu halaman: header ST; kartu per pelaksana dengan etape dan biaya; panel total dan peringatan yang berubah langsung), `/st/:id/dokumen` (pratinjau + unduh SPTB, Rincian per orang, Kuitansi per orang), `/pegawai`, `/pengaturan`, `/sbm`.
Pegawai bisa ditambahkan langsung dari editor ST (tersimpan permanen). Dropdown provinsi dan status. Autosimpan draf.
Dokumen: SPTB lanskap (satu baris per pelaksana); Rincian potret per pelaksana (baris dinamis, pindah halaman bila panjang); Kuitansi per pelaksana. Tata letak mengikuti berkas SPJ yang ada (judul, kolom, blok tanda tangan PPK, bendahara, pejabat bertanggung jawab, pembuat daftar).

## 8. Deploy

`docker-compose.dokploy.yml` dengan dua layanan: `api` (Fastify, port internal 8000) dan `web` (nginx statis, meneruskan `/api` ke api). Satu domain `spjan.ditpps.com` lewat Traefik + Let's Encrypt, mengikuti label SIPEKAPS. Database: server Postgres yang sama, database `spjan` dan peran sendiri (dibuat pengguna). Env: `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` (hanya untuk seed akun pertama). Migrasi + seed SBM otomatis saat container api boot, idempoten dengan advisory lock. Deploy lewat webhook Dokploy; commit, push, dan deploy masing-masing gerbang konfirmasi terpisah.

## 9. Pengujian

Vitest di `packages/shared` dan `apps/api`. Tidak ada tes frontend (konvensi proyek). Kasus uji emas untuk mesin hitung:
- Resa (Bali 10-11 Sep, tiket 2.260.940 + 2.223.091, taksi 2 x 250.000, hotel 1.021.948): total 6.965.979.
- Riandi (Yogyakarta 10-13 Sep, hotel 3 x 845.000): uang harian 1.680.000, hotel 2.535.000.
- Direktur Manado (Eselon II, 7-10 Apr, dinas jabatan, tiket 3.689.972 + 4.189.812, hotel 3 x 650.000): uang harian 1.480.000, representasi 600.000, total 11.909.784.
- Gunadi dua etape: uraian SPTB dan urutan tiket tiga leg.
- Terbilang: 0, 21, 100, 1.000, 1.001.000, 15.000, 111.111.111, 2.020.000, 4.715.000.
- Rentang tanggal: satu hari, satu bulan, lintas bulan.
- Pagu: Kab. Gianyar 225.000, sewa roda 4 Bali 1.275.000, terminal Bali 219.000, tiket Jakarta-Denpasar ekonomi 3.262.000.
Dokumen PDF diperiksa manual terhadap berkas SPJ yang ada.

## 10. Risiko dan hal terbuka

- Fidelitas tata letak PDF terhadap format kantor perlu dicocokkan secara visual berulang.
- Aturan kelas tiket per status belum diverifikasi terhadap PMK Perjalanan Dinas (bukan PMK 32/2025); default dapat diedit di `sbm_status_konfigurasi`.
- Pagu transport darat memakai pencocokan nama kab/kota persis seperti PMK.
- Pembuatan database `spjan`, ID webhook Dokploy, dan kredensial akun pertama dilakukan pengguna saat mendekati deploy.
- Tahap 2 (ekstraksi dokumen) belum dirancang rinci.

## 11. Penyesuaian yang ditemukan saat menyusun rencana tahap 1

- Masukan mesin hitung memuat `provinsiKedudukan` (default "D.K.I. JAKARTA"), dipakai untuk pagu taksi dari tempat kedudukan. Di basis data menjadi kolom `pengaturan.provinsi_kedudukan`.
- `biaya` memuat `etape_urutan` (nullable) sebagai penghubung tiket ke etape (`etapeIndex` pada masukan mesin hitung): TIKET_PERGI default etape 0, TIKET_KEMBALI default etape terakhir.
- Fixture SBM berupa berkas TypeScript hasil `scripts/build-sbm-fixture.py` (`packages/shared/src/data/sbm-2026.ts`); seed basis data di API membaca objek yang sama.
- Rencana dibagi: (1) fondasi + `@spjan/shared` (mesin hitung bertes), (2) API + basis data + auth, (3) web + dokumen PDF, (4) deploy Dokploy.
- Data SBM disimpan sebagai satu kolom `jsonb` (`sbm_versi.data`, bentuk `Sbm` dari `@spjan/shared`), bukan tabel anak per jenis: tabel itu selalu dibaca utuh oleh mesin hitung dan tidak pernah di-query per baris. Konfigurasi status (kolom hotel, baris representasi, kelas tiket) ada di `data.statusKonfigurasi` dan dapat diedit lewat `PATCH /api/sbm/versi/:id/status-konfigurasi`.
- Skema zod (`SuratTugasPayloadSchema`, `PegawaiPayloadSchema`, `PengaturanSchema`, ...) dan `toSpjInput` berada di `@spjan/shared` (satu-satunya dependensi runtime shared: `zod`).
- `SESSION_SECRET` dihapus dari env: token sesi acak disimpan sebagai hash sha256 di tabel `sessions`, tidak ada penandatanganan.
- Perlindungan CSRF: cookie SameSite=Strict + penolakan `Origin` selain `FRONTEND_ORIGIN` pada metode non-GET.
- Deploy: `api` menjangkau PostgreSQL lewat `dokploy-network` (alias `gealgeolgeo-postgis` pada jaringan overlay itu), bukan `gealgeolgeo-db` (bridge lokal). `web` meneruskan `/api/` ke `api:8000` dengan resolver Docker (resolusi saat permintaan). Image `api` hanya berisi dependensi produksi.
